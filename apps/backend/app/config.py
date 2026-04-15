import os
from pathlib import Path


class Settings:
    """Runtime configuration for the Flask API."""

    DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
    UPLOAD_ROOT = DATA_DIR / "uploads"
    LANDING_DIR = UPLOAD_ROOT / "landing"
    PROCESSING_DIR = UPLOAD_ROOT / "processing"
    FAILED_DIR = UPLOAD_ROOT / "failed"
    PUBLISHED_DIR = UPLOAD_ROOT / "published"
    EXTERNAL_DIR = UPLOAD_ROOT / "external"
    METADATA_DIR = UPLOAD_ROOT / "metadata"
    ANALYTICS_DB_DSN = os.environ.get(
        "ANALYTICS_DB_DSN",
        "postgresql://airflow:airflow@postgres:5432/analytics",
    )
    USERS = {
        "admin": {"password": "admin123", "role": "admin"},
        "engineer": {"password": "engineer123", "role": "data_engineer"},
        "analyst": {"password": "analyst123", "role": "analyst"},
        "operator": {"password": "operator123", "role": "operator"},
    }

    # MinIO (S3-compatible ingestion zone)
    MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "").strip() or None
    MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET_LANDING = os.environ.get("MINIO_BUCKET_LANDING", "fintech-landing")
    MINIO_USE_SSL = os.environ.get("MINIO_USE_SSL", "false").lower() in ("1", "true", "yes")

    # Apache Airflow (ETL orchestration)
    AIRFLOW_BASE_URL = os.environ.get("AIRFLOW_BASE_URL", "").strip() or None
    AIRFLOW_USERNAME = os.environ.get("AIRFLOW_USERNAME", "airflow")
    AIRFLOW_PASSWORD = os.environ.get("AIRFLOW_PASSWORD", "airflow")
    AIRFLOW_ETL_DAG_ID = os.environ.get("AIRFLOW_ETL_DAG_ID", "distributed_pipeline_scaffold")
    AIRFLOW_UI_PUBLIC = os.environ.get("AIRFLOW_UI_PUBLIC", "http://localhost:8080")
    MINIO_CONSOLE_PUBLIC = os.environ.get("MINIO_CONSOLE_PUBLIC", "http://localhost:9001")

    # Google BigQuery (cloud warehouse on top of curated datasets)
    BIGQUERY_PROJECT_ID = os.environ.get("BIGQUERY_PROJECT_ID", "").strip() or None
    # Optional hint only; queries must use real dataset.table IDs (see catalog or public samples).
    BIGQUERY_DEFAULT_DATASET = (os.environ.get("BIGQUERY_DEFAULT_DATASET") or "").strip() or None
