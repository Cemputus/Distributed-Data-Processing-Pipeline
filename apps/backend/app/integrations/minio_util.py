"""Mirror landing uploads to MinIO (S3-compatible) for ingestion zone."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

from ..config import Settings


def _client():
    if not Settings.MINIO_ENDPOINT:
        return None
    try:
        from minio import Minio
    except ImportError:
        return None
    return Minio(
        Settings.MINIO_ENDPOINT,
        access_key=Settings.MINIO_ACCESS_KEY or "",
        secret_key=Settings.MINIO_SECRET_KEY or "",
        secure=Settings.MINIO_USE_SSL,
    )


def ensure_bucket() -> None:
    client = _client()
    if not client:
        return
    if not client.bucket_exists(Settings.MINIO_BUCKET_LANDING):
        client.make_bucket(Settings.MINIO_BUCKET_LANDING)


def upload_landing_file(local_path: Path, object_key: str) -> Optional[Dict[str, Any]]:
    """Upload a file to the landing bucket. Returns metadata or None if MinIO disabled."""
    client = _client()
    if not client:
        return None
    try:
        ensure_bucket()
        client.fput_object(
            Settings.MINIO_BUCKET_LANDING,
            object_key,
            str(local_path),
            content_type="text/csv",
        )
        return {
            "bucket": Settings.MINIO_BUCKET_LANDING,
            "object": object_key,
            "endpoint": Settings.MINIO_ENDPOINT,
        }
    except Exception as exc:
        return {"error": str(exc)}
