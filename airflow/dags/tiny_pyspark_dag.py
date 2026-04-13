"""
Second DAG — submits a tiny PySpark script to Spark Standalone (cluster mode).

Requires: spark-master + spark-worker services running.
"""
from datetime import datetime

from airflow import DAG
from airflow.operators.bash import BashOperator

SPARK_MASTER = "spark://spark-master:7077"
JOB = "/opt/spark-jobs/tiny_job.py"

with DAG(
    dag_id="tiny_pyspark_standalone",
    description="Submit tiny_job.py to Spark Standalone via spark-submit",
    start_date=datetime(2025, 1, 1),
    schedule=None,
    catchup=False,
    tags=["dsc3219", "spark", "pyspark"],
) as dag:
    BashOperator(
        task_id="spark_submit_tiny_job",
        bash_command=(
            f'spark-submit --deploy-mode cluster --master "{SPARK_MASTER}" '
            f'--name tiny_job {JOB}'
        ),
        env={
            "JAVA_HOME": "/usr/lib/jvm/java-17-openjdk-amd64",
        },
    )
