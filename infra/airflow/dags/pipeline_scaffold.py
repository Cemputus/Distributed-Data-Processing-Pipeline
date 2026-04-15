"""
Production-style Airflow DAG for DSC3219 fintech pipeline.

Flow:
1) Validate required input datasets
2) Run Spark transformation job
3) Load curated outputs into Postgres analytics schema
"""
from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path
from typing import Iterable, List

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator


INPUT_DIR = Path("/opt/data/fintech")
OUTPUT_DIR = Path("/opt/airflow/logs/curated")
SPARK_JOB = "/opt/spark-jobs/fintech_transform.py"
POSTGRES_DSN = "postgresql://airflow:airflow@postgres:5432/analytics"

REQUIRED_INPUTS = [
    "fact_transactions.csv",
    "fact_fraud_alerts.csv",
    "fact_loans.csv",
    "dim_merchants.csv",
]


def _validate_input_files() -> None:
    missing = [name for name in REQUIRED_INPUTS if not (INPUT_DIR / name).exists()]
    if missing:
        raise FileNotFoundError(f"Missing input files: {missing}")


def _find_csv_file(folder: Path) -> Path:
    matches = [p for p in folder.glob("*.csv") if p.is_file()]
    if not matches:
        raise FileNotFoundError(f"No CSV output found in {folder}")
    return matches[0]


def _copy_rows(reader: Iterable[dict], columns: List[str], table_name: str, cursor) -> int:
    insert_sql = f"INSERT INTO analytics_curated.{table_name} ({', '.join(columns)}) VALUES ({', '.join(['%s'] * len(columns))})"
    count = 0
    for row in reader:
        values = [row.get(col) for col in columns]
        cursor.execute(insert_sql, values)
        count += 1
    return count


def _load_curated_to_postgres() -> None:
    import psycopg2

    mapping = {
        "kpi_daily_transactions": ("kpi_daily_transactions", ["transaction_date", "transaction_count", "total_amount_ugx", "failed_count"]),
        "kpi_customer_risk": ("kpi_customer_risk", ["customer_id", "transaction_count", "total_amount_ugx", "fraud_alert_count", "loan_count"]),
        "kpi_top_merchants": ("kpi_top_merchants", ["merchant_id", "transaction_count", "total_amount_ugx", "merchant_name"]),
    }

    with psycopg2.connect(POSTGRES_DSN) as conn:
        with conn.cursor() as cursor:
            for output_folder, (table_name, columns) in mapping.items():
                csv_file = _find_csv_file(OUTPUT_DIR / output_folder)
                cursor.execute(f"TRUNCATE TABLE analytics_curated.{table_name}")
                with csv_file.open("r", encoding="utf-8", newline="") as handle:
                    reader = csv.DictReader(handle)
                    inserted = _copy_rows(reader, columns, table_name, cursor)
                print(f"Loaded {inserted} rows into analytics_curated.{table_name}")
        conn.commit()


with DAG(
    dag_id="distributed_pipeline_scaffold",
    description="Fintech pipeline: validate input -> Spark transform -> Postgres load",
    start_date=datetime(2025, 1, 1),
    schedule=None,
    catchup=False,
    tags=["dsc3219", "pipeline", "fintech", "etl"],
) as dag:
    validate_input = PythonOperator(
        task_id="validate_input_files",
        python_callable=_validate_input_files,
    )

    # Spark Standalone cluster (spark-master + spark-worker in docker-compose)
    SPARK_MASTER = "spark://spark-master:7077"
    run_spark_transform = BashOperator(
        task_id="run_spark_transform",
        bash_command=(
            f'spark-submit --master "{SPARK_MASTER}" --deploy-mode client {SPARK_JOB} '
            f'--input-dir "{INPUT_DIR}" --output-dir "{OUTPUT_DIR}"'
        ),
        env={"JAVA_HOME": "/usr/lib/jvm/java-17-openjdk-amd64"},
        retries=2,
    )

    load_curated = PythonOperator(
        task_id="load_curated_to_postgres",
        python_callable=_load_curated_to_postgres,
        retries=1,
    )

    validate_input >> run_spark_transform >> load_curated
