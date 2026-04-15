from pathlib import Path


class Settings:
    """Runtime configuration for the Flask API."""

    DATA_DIR = Path("/data")
    UPLOAD_ROOT = DATA_DIR / "uploads"
    LANDING_DIR = UPLOAD_ROOT / "landing"
    PROCESSING_DIR = UPLOAD_ROOT / "processing"
    FAILED_DIR = UPLOAD_ROOT / "failed"
    PUBLISHED_DIR = UPLOAD_ROOT / "published"
    EXTERNAL_DIR = UPLOAD_ROOT / "external"
    METADATA_DIR = UPLOAD_ROOT / "metadata"
    ANALYTICS_DB_DSN = "postgresql://airflow:airflow@postgres:5432/analytics"
    USERS = {
        "admin": {"password": "admin123", "role": "admin"},
        "engineer": {"password": "engineer123", "role": "data_engineer"},
        "analyst": {"password": "analyst123", "role": "analyst"},
        "operator": {"password": "operator123", "role": "operator"},
    }

