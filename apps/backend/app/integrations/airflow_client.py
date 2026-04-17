"""Trigger Apache Airflow DAG runs via REST API (Airflow 2.x).

Uses a :class:`requests.Session` with HTTP Basic Auth so redirects keep credentials.
Unpauses the DAG if needed, then POSTs a dag run with an explicit ``dag_run_id``.

Compose should set::

  AIRFLOW__API__AUTH_BACKENDS=airflow.api.auth.backend.basic_auth,airflow.api.auth.backend.session
"""
from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple
from uuid import uuid4

import requests
from requests.auth import HTTPBasicAuth

from ..config import Settings


def _basic_headers() -> Dict[str, str]:
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _auth_session() -> requests.Session:
    s = requests.Session()
    s.auth = HTTPBasicAuth(Settings.AIRFLOW_USERNAME, Settings.AIRFLOW_PASSWORD)
    s.headers.update(_basic_headers())
    return s


def _csrf_from_login_html(html: str) -> Optional[str]:
    m = re.search(r'name="csrf_token"[^>]*value="([^"]*)"', html, re.I)
    if m:
        return m.group(1)
    m = re.search(r'value="([^"]+)"[^>]*name="csrf_token"', html, re.I)
    return m.group(1) if m else None


def _fab_login_session(base: str) -> Optional[requests.Session]:
    """Flask-AppBuilder web login so subsequent API calls use session cookies (fallback)."""
    session = requests.Session()
    for login_path in ("/login/", "/auth/login/", "/home/login/"):
        login_url = f"{base.rstrip('/')}{login_path}"
        try:
            page = session.get(login_url, timeout=30)
        except OSError:
            continue
        if page.status_code != 200:
            continue
        token = _csrf_from_login_html(page.text)
        if not token:
            continue
        try:
            post = session.post(
                login_url,
                data={
                    "username": Settings.AIRFLOW_USERNAME,
                    "password": Settings.AIRFLOW_PASSWORD,
                    "csrf_token": token,
                },
                headers={"Referer": login_url, "Content-Type": "application/x-www-form-urlencoded"},
                timeout=30,
                allow_redirects=True,
            )
        except OSError:
            continue
        if post.status_code < 400:
            return session
    return None


def _ensure_dag_unpaused(session: requests.Session, base: str, dag_id: str) -> str:
    """Return error message if unpausing failed; empty string if OK or unknown."""
    url = f"{base}/api/v1/dags/{dag_id}"
    try:
        r = session.get(url, timeout=30)
    except OSError as exc:
        return f"DAG GET failed: {exc}"
    if r.status_code == 404:
        return ""
    if r.status_code != 200:
        return f"DAG GET {r.status_code}: {r.text[:200]}"
    try:
        data = r.json()
    except ValueError:
        return ""
    if not data.get("is_paused"):
        return ""
    try:
        patch = session.patch(
            url,
            json={"is_paused": False},
            timeout=30,
        )
    except OSError as exc:
        return f"DAG unpause failed: {exc}"
    if patch.status_code >= 400:
        try:
            detail = str(patch.json())
        except ValueError:
            detail = patch.text[:300]
        return f"DAG unpause {patch.status_code}: {detail}"
    return ""


def _post_dag_run(session: requests.Session, base: str, dag_id: str, conf: Optional[Dict[str, Any]]) -> requests.Response:
    url = f"{base}/api/v1/dags/{dag_id}/dagRuns"
    body: Dict[str, Any] = {
        "dag_run_id": f"manual__{uuid4()}",
        "conf": conf or {},
    }
    # Avoid redirect chains that drop Authorization on some proxies.
    return session.post(url, json=body, timeout=120, allow_redirects=False)


def try_trigger_dag(dag_id: str, conf: Optional[Dict[str, Any]] = None) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Trigger a DAG run. Returns (response_json, None) on success.
    On failure returns (None, short_error_message). Does not raise for HTTP/network errors.
    """
    if not Settings.AIRFLOW_BASE_URL:
        return None, "AIRFLOW_BASE_URL is not configured."

    base = Settings.AIRFLOW_BASE_URL.rstrip("/")
    err_parts: list[str] = []

    session = _auth_session()
    unpause_err = _ensure_dag_unpaused(session, base, dag_id)
    if unpause_err:
        err_parts.append(f"unpause: {unpause_err}")

    try:
        response = _post_dag_run(session, base, dag_id, conf)
    except OSError as exc:
        return None, f"Airflow request failed: {exc}"

    if response.status_code in (301, 302, 303, 307, 308):
        loc = response.headers.get("Location", "")
        err_parts.append(f"redirect {response.status_code} to {loc} (check AIRFLOW_BASE_URL / API path)")
        # Retry without disabling redirects once; follow redirects with same session (auth preserved for same host)
        try:
            response = session.post(
                f"{base}/api/v1/dags/{dag_id}/dagRuns",
                json={"dag_run_id": f"manual__{uuid4()}", "conf": conf or {}},
                timeout=120,
                allow_redirects=True,
            )
        except OSError as exc:
            return None, "; ".join(err_parts) + f" | retry: {exc}"

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
                r2 = sess.post(
                    f"{base}/api/v1/dags/{dag_id}/dagRuns",
                    json={"dag_run_id": f"manual__{uuid4()}", "conf": conf or {}},
                    headers=_basic_headers(),
                    timeout=120,
                )
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


def try_get_dag_run_state(dag_id: str, dag_run_id: str) -> Tuple[Optional[str], Optional[str]]:
    """Fetch a DAG run state from Airflow API. Returns (state, error)."""
    if not Settings.AIRFLOW_BASE_URL:
        return None, "AIRFLOW_BASE_URL is not configured."
    if not dag_id or not dag_run_id:
        return None, "dag_id and dag_run_id are required."

    base = Settings.AIRFLOW_BASE_URL.rstrip("/")
    url = f"{base}/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}"
    session = _auth_session()
    try:
        response = session.get(url, timeout=8, allow_redirects=True)
    except OSError as exc:
        return None, f"Airflow request failed: {exc}"
    if response.status_code >= 400:
        detail = response.text[:300]
        try:
            detail = str(response.json())
        except ValueError:
            pass
        return None, f"dag run GET {response.status_code}: {detail}"
    try:
        body = response.json()
    except ValueError:
        return None, "Airflow returned non-JSON DAG run body."
    state = str(body.get("state") or "").strip().lower()
    return (state or None), None


def healthcheck() -> bool:
    if not Settings.AIRFLOW_BASE_URL:
        return False
    try:
        base = Settings.AIRFLOW_BASE_URL.rstrip("/")
        session = _auth_session()
        for path in ("/api/v1/health", "/health"):
            r = session.get(f"{base}{path}", timeout=5)
            if r.status_code == 200:
                return True
            r2 = requests.get(f"{base}{path}", timeout=5)
            if r2.status_code == 200:
                return True
        return False
    except Exception:
        return False
