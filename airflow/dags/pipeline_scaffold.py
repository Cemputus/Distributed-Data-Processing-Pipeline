"""
Placeholder DAG for DSC3219 — Distributed Data Processing Pipeline.

Replace tasks with: ingest to MinIO/HDFS → Spark/Hadoop processing → load to analytics DB.
"""
from datetime import datetime

from airflow import DAG
from airflow.operators.python import PythonOperator


def _scaffold_hello() -> None:
    print("Pipeline scaffold: wire Spark + Hadoop steps and warehouse load in Milestone 2/3.")


with DAG(
    dag_id="distributed_pipeline_scaffold",
    description="Scaffold — extend with Synthetic_Data ETL",
    start_date=datetime(2025, 1, 1),
    schedule=None,
    catchup=False,
    tags=["dsc3219", "pipeline"],
) as dag:
    PythonOperator(
        task_id="hello",
        python_callable=_scaffold_hello,
    )
