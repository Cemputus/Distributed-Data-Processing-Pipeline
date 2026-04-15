"""Trigger Apache Airflow DAG runs via REST API."""
from __future__ import annotations

from typing import Any, Dict, Optional

import requests
from requests.auth import HTTPBasicAuth

from ..config import Settings


def trigger_dag(dag_id: str, conf: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not Settings.AIRFLOW_BASE_URL:
        raise RuntimeError("AIRFLOW_BASE_URL is not configured.")
    base = Settings.AIRFLOW_BASE_URL.rstrip("/")
    url = f"{base}/api/v1/dags/{dag_id}/dagRuns"
    payload: Dict[str, Any] = {"conf": conf or {}}
    auth = HTTPBasicAuth(Settings.AIRFLOW_USERNAME, Settings.AIRFLOW_PASSWORD)
    response = requests.post(url, json=payload, auth=auth, timeout=120)
    if response.status_code >= 400:
        detail = response.text
        try:
            detail = response.json()
        except Exception:
            pass
        raise RuntimeError(f"Airflow API {response.status_code}: {detail}")
    return response.json()


def healthcheck() -> bool:
    if not Settings.AIRFLOW_BASE_URL:
        return False
    try:
        base = Settings.AIRFLOW_BASE_URL.rstrip("/")
        for path in ("/api/v1/health", "/health"):
            r = requests.get(f"{base}{path}", timeout=5)
            if r.status_code == 200:
                return True
        return False
    except Exception:
        return False
