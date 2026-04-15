"""Trigger Apache Airflow DAG runs via REST API.

Airflow 2.x: enable basic auth for the API or programmatic POSTs hit FAB/CSRF instead of JSON API:

  AIRFLOW__API__AUTH_BACKENDS=airflow.api.auth.backend.basic_auth,airflow.api.auth.backend.session

If trigger still fails, :func:`try_trigger_dag` falls back to a FAB login + session cookie, then delegates
callers to treat failure as non-fatal and continue local ETL delegate work.
"""
from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple

import requests
from requests.auth import HTTPBasicAuth

from ..config import Settings


def _basic_headers() -> Dict[str, str]:
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _post_dag_run_basic(base: str, dag_id: str, conf: Optional[Dict[str, Any]]) -> requests.Response:
    url = f"{base}/api/v1/dags/{dag_id}/dagRuns"
    payload: Dict[str, Any] = {"conf": conf or {}}
    auth = HTTPBasicAuth(Settings.AIRFLOW_USERNAME, Settings.AIRFLOW_PASSWORD)
    return requests.post(url, json=payload, auth=auth, headers=_basic_headers(), timeout=120)


def _csrf_from_login_html(html: str) -> Optional[str]:
    m = re.search(r'name="csrf_token"[^>]*value="([^"]*)"', html, re.I)
    if m:
        return m.group(1)
    m = re.search(r'value="([^"]+)"[^>]*name="csrf_token"', html, re.I)
    return m.group(1) if m else None


def _fab_login_session(base: str) -> Optional[requests.Session]:
    """Flask-AppBuilder web login so subsequent API calls use session cookies (fallback)."""
    session = requests.Session()
    login_url = f"{base}/login/"
    try:
        page = session.get(login_url, timeout=30)
    except OSError:
        return None
    if page.status_code != 200:
        return None
    token = _csrf_from_login_html(page.text)
    if not token:
        return None
    try:
        post = session.post(
            login_url,
            data={
                "username": Settings.AIRFLOW_USERNAME,
                "password": Settings.AIRFLOW_PASSWORD,
                "csrf_token": token,
            },
            headers={"Referer": login_url},
            timeout=30,
            allow_redirects=True,
        )
    except OSError:
        return None
    if post.status_code >= 400:
        return None
    return session


def _post_dag_run_session(session: requests.Session, base: str, dag_id: str, conf: Optional[Dict[str, Any]]) -> requests.Response:
    url = f"{base}/api/v1/dags/{dag_id}/dagRuns"
    return session.post(
        url,
        json={"conf": conf or {}},
        headers=_basic_headers(),
        timeout=120,
    )


def try_trigger_dag(dag_id: str, conf: Optional[Dict[str, Any]] = None) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Trigger a DAG run. Returns (response_json, None) on success.
    On failure returns (None, short_error_message). Does not raise for HTTP/network errors.
    """
    if not Settings.AIRFLOW_BASE_URL:
        return None, "AIRFLOW_BASE_URL is not configured."

    base = Settings.AIRFLOW_BASE_URL.rstrip("/")
    err_parts: list[str] = []

    try:
        response = _post_dag_run_basic(base, dag_id, conf)
    except OSError as exc:
        return None, f"Airflow request failed: {exc}"

    if response.status_code < 400:
        try:
            return response.json(), None
        except ValueError:
            return None, "Airflow returned non-JSON success body."

    detail = response.text[:500]
    try:
        detail = str(response.json())
    except ValueError:
        pass
    err_parts.append(f"basic_auth {response.status_code}: {detail}")

    looks_like_csrf = response.status_code in (400, 401, 403) and (
        "csrf" in response.text.lower() or "session token" in response.text.lower()
    )
    if looks_like_csrf or response.status_code in (401, 403):
        sess = _fab_login_session(base)
        if sess:
            try:
                r2 = _post_dag_run_session(sess, base, dag_id, conf)
            except OSError as exc:
                return None, "; ".join(err_parts) + f" | session fallback: {exc}"
            if r2.status_code < 400:
                try:
                    return r2.json(), None
                except ValueError:
                    return None, "; ".join(err_parts) + " | session POST returned non-JSON."
            try:
                d2 = str(r2.json())
            except ValueError:
                d2 = r2.text[:500]
            err_parts.append(f"session {r2.status_code}: {d2}")
        else:
            err_parts.append("session_login_failed")

    return None, "; ".join(err_parts)


def trigger_dag(dag_id: str, conf: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Trigger DAG run or raise on failure (legacy callers). Prefer :func:`try_trigger_dag` for soft handling."""
    result, err = try_trigger_dag(dag_id, conf)
    if err:
        raise RuntimeError(f"Airflow API: {err}")
    return result or {}


def healthcheck() -> bool:
    if not Settings.AIRFLOW_BASE_URL:
        return False
    try:
        base = Settings.AIRFLOW_BASE_URL.rstrip("/")
        auth = HTTPBasicAuth(Settings.AIRFLOW_USERNAME, Settings.AIRFLOW_PASSWORD)
        for path in ("/api/v1/health", "/health"):
            r = requests.get(f"{base}{path}", auth=auth, timeout=5)
            if r.status_code == 200:
                return True
            # Unauthenticated health may work on some images
            r2 = requests.get(f"{base}{path}", timeout=5)
            if r2.status_code == 200:
                return True
        return False
    except Exception:
        return False
