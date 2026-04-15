"""Read-only BigQuery analytics layer (cloud warehouse)."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..config import Settings

_BLOCKED = (
    "insert ",
    "update ",
    "delete ",
    "drop ",
    "alter ",
    "create ",
    "truncate ",
    "merge ",
    "call ",
)


def _bigquery_feature_on() -> None:
    if not Settings.BIGQUERY_ENABLED:
        raise RuntimeError("BigQuery integration is disabled (BIGQUERY_ENABLED=false).")


def credentials_available() -> bool:
    path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or ""
    return bool(path and Path(path).is_file())


def resolve_project_id() -> Optional[str]:
    """Prefer BIGQUERY_PROJECT_ID; else read project_id from the service account JSON."""
    if Settings.BIGQUERY_PROJECT_ID:
        return Settings.BIGQUERY_PROJECT_ID.strip()
    path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or ""
    if not path or not Path(path).is_file():
        return None
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return str(data.get("project_id") or "").strip() or None
    except (OSError, json.JSONDecodeError):
        return None


def _client():
    from google.cloud import bigquery

    project = resolve_project_id()
    if not project:
        raise RuntimeError("Set BIGQUERY_PROJECT_ID or use a service account JSON with project_id.")
    return bigquery.Client(project=project)


def console_project_url(project_id: str) -> str:
    return f"https://console.cloud.google.com/bigquery?project={project_id}"


def console_dataset_url(project_id: str, dataset_id: str) -> str:
    return (
        f"https://console.cloud.google.com/bigquery?project={project_id}"
        f"&p={project_id}&d={dataset_id}&page=dataset"
    )


def console_table_url(project_id: str, dataset_id: str, table_id: str) -> str:
    return (
        f"https://console.cloud.google.com/bigquery?project={project_id}"
        f"&p={project_id}&d={dataset_id}&t={table_id}&page=table"
    )


def list_datasets() -> Dict[str, Any]:
    """List all datasets in the project (same scope as BigQuery console for this project)."""
    _bigquery_feature_on()
    if not credentials_available():
        raise RuntimeError(
            "Google Cloud credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or BIGQUERY_CREDENTIALS_PATH."
        )
    client = _client()
    project_id = client.project
    items: List[Dict[str, Any]] = []
    for ds in client.list_datasets():
        did = ds.dataset_id
        items.append(
            {
                "dataset_id": did,
                "project_id": project_id,
                "full_id": f"{project_id}.{did}",
                "console_url": console_dataset_url(project_id, did),
            }
        )
    items.sort(key=lambda x: x["dataset_id"])
    return {
        "project_id": project_id,
        "datasets": items,
        "console_url": console_project_url(project_id),
    }


def list_tables(dataset_id: str) -> Dict[str, Any]:
    """List tables in a dataset."""
    _bigquery_feature_on()
    if not credentials_available():
        raise RuntimeError(
            "Google Cloud credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or BIGQUERY_CREDENTIALS_PATH."
        )
    if not re.match(r"^[A-Za-z0-9_\-]+$", dataset_id or ""):
        raise ValueError("Invalid dataset id.")
    client = _client()
    project_id = client.project
    dataset_ref = client.dataset(dataset_id)
    items: List[Dict[str, Any]] = []
    for t in client.list_tables(dataset_ref):
        tid = t.table_id
        fq = f"{project_id}.{dataset_id}.{tid}"
        items.append(
            {
                "table_id": tid,
                "dataset_id": dataset_id,
                "project_id": project_id,
                "full_id": fq,
                "table_type": getattr(t, "table_type", None) or "TABLE",
                "console_url": console_table_url(project_id, dataset_id, tid),
                "select_preview_sql": f"SELECT * FROM `{fq}` LIMIT 100",
            }
        )
    items.sort(key=lambda x: x["table_id"])
    return {"project_id": project_id, "dataset_id": dataset_id, "tables": items}


def run_readonly_query(sql: str, max_rows: int = 100) -> Dict[str, Any]:
    _bigquery_feature_on()
    if not credentials_available():
        raise RuntimeError(
            "Google Cloud credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or BIGQUERY_CREDENTIALS_PATH."
        )
    cleaned = (sql or "").strip()
    if not cleaned:
        raise ValueError("SQL is required.")
    lowered = cleaned.lower()
    if ";" in cleaned[:-1]:
        raise ValueError("Only one SQL statement is allowed.")
    if not (lowered.startswith("select") or lowered.startswith("with")):
        raise ValueError("Only SELECT / WITH queries are allowed.")
    if any(tok in lowered for tok in _BLOCKED):
        raise ValueError("Non-read-only SQL is not allowed.")
    cap = max(1, min(500, max_rows))
    if not re.search(r"\blimit\s+\d+", lowered):
        cleaned = cleaned.rstrip().rstrip(";") + f" LIMIT {cap}"

    client = _client()
    query_job = client.query(cleaned)
    rows_iter = query_job.result(max_results=cap)
    rows_list = list(rows_iter)
    columns = list(rows_list[0].keys()) if rows_list else []
    out: List[Dict[str, Any]] = [dict(row) for row in rows_list]
    return {
        "columns": columns,
        "rows": out,
        "row_count": len(out),
        "job_id": getattr(query_job, "job_id", None),
        "project": client.project,
    }


def _sanitize_table_id(name: str) -> str:
    raw = Path(name).stem.lower()
    cleaned = re.sub(r"[^a-z0-9_]+", "_", raw).strip("_")
    return cleaned or "uploaded_table"


def load_csv_upload_to_bigquery(local_csv_path: Path, original_filename: str) -> Dict[str, Any]:
    """
    Load a local CSV into BigQuery as a native table (WRITE_TRUNCATE).
    Used after CenAnalytics upload succeeds so console queries use `project.dataset.table`.

    Requires: GOOGLE_APPLICATION_CREDENTIALS, BIGQUERY_INGEST_DATASET (or BIGQUERY_DEFAULT_DATASET),
    Settings.BIGQUERY_AUTO_LOAD_ON_UPLOAD=true, and IAM: bigquery.tables.update, bigquery.jobs.create
    on the target dataset.

    Returns dict with full_table_id, job_id, or skipped/error keys.
    """
    from google.cloud import bigquery
    from google.cloud.bigquery import LoadJobConfig, SourceFormat, WriteDisposition

    from ..config import Settings

    out: Dict[str, Any] = {"skipped": True}
    if not Settings.BIGQUERY_ENABLED:
        out["reason"] = "BIGQUERY_ENABLED is false"
        return out
    if not Settings.BIGQUERY_AUTO_LOAD_ON_UPLOAD:
        out["reason"] = "BIGQUERY_AUTO_LOAD_ON_UPLOAD is false"
        return out
    if not credentials_available():
        out["reason"] = "no GOOGLE_APPLICATION_CREDENTIALS or BIGQUERY_CREDENTIALS_PATH"
        return out
    dataset_id = Settings.BIGQUERY_INGEST_DATASET or Settings.BIGQUERY_DEFAULT_DATASET
    if not dataset_id:
        out["reason"] = "set BIGQUERY_INGEST_DATASET or BIGQUERY_DEFAULT_DATASET"
        return out
    if not local_csv_path.is_file():
        return {"error": "csv_not_found", "path": str(local_csv_path)}

    table_id = _sanitize_table_id(original_filename)
    client = _client()
    project_id = client.project
    full_id = f"{project_id}.{dataset_id}.{table_id}"

    job_config = LoadJobConfig(
        source_format=SourceFormat.CSV,
        skip_leading_rows=1,
        autodetect=True,
        write_disposition=WriteDisposition.WRITE_TRUNCATE,
        allow_quoted_newlines=True,
    )

    with local_csv_path.open("rb") as handle:
        load_job = client.load_table_from_file(
            handle,
            full_id,
            job_config=job_config,
        )
    load_job.result()

    return {
        "skipped": False,
        "project_id": project_id,
        "dataset_id": dataset_id,
        "table_id": table_id,
        "full_table_id": full_id,
        "job_id": load_job.job_id,
        "console_url": console_table_url(project_id, dataset_id, table_id),
        "sample_sql": f"SELECT * FROM `{full_id}` LIMIT 100",
    }
