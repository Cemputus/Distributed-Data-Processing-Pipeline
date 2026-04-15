"""Read Spark Standalone master Web UI JSON (`/json/`) for workers and applications."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional


def _first(d: Dict[str, Any], *keys: str) -> Any:
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return None


def fetch_master_json(internal_base_url: str) -> Dict[str, Any]:
    base = internal_base_url.rstrip("/")
    # Spark Master Web UI exposes cluster state at /json/ (see MasterWebUI).
    url = f"{base}/json/"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=8) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body)


def try_fetch_master_state(internal_base_url: Optional[str]) -> Dict[str, Any]:
    """
    Returns:
      reachable: bool
      error: optional message
      status: optional master json (url, status, counts) when reachable
      workers: list of normalized worker dicts
      active_applications: list
      completed_applications: list
    """
    if not (internal_base_url or "").strip():
        return {"reachable": False, "error": "spark_master_ui_not_configured"}

    try:
        raw = fetch_master_json(internal_base_url)
    except urllib.error.HTTPError as e:
        return {"reachable": False, "error": f"http_{e.code}"}
    except urllib.error.URLError as e:
        return {"reachable": False, "error": str(e.reason or e)}
    except (TimeoutError, OSError, json.JSONDecodeError, ValueError) as e:
        return {"reachable": False, "error": str(e)}

    workers_in = _first(raw, "workers", "Workers") or []
    active = _first(raw, "activeApps", "activeapps", "active_applications") or []
    completed = _first(raw, "completedApps", "completedapps", "completed_applications") or []

    workers: List[Dict[str, Any]] = []
    for w in workers_in if isinstance(workers_in, list) else []:
        if not isinstance(w, dict):
            continue
        workers.append(
            {
                "id": _first(w, "id", "workerId", "workerid"),
                "host": _first(w, "host", "Host"),
                "port": _first(w, "port", "Port"),
                "web_ui": _first(w, "webuiaddress", "webUiAddress", "webUIAddress"),
                "cores": _first(w, "cores", "Cores"),
                "cores_free": _first(w, "coresfree", "coresFree", "cores_free"),
                "memory_mb": _first(w, "memory", "Memory"),
                "memory_free_mb": _first(w, "memoryfree", "memoryFree", "memory_free"),
                "state": _first(w, "state", "State"),
            }
        )

    def _norm_app(a: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(a, dict):
            return None
        return {
            "id": _first(a, "id", "applicationId"),
            "name": _first(a, "name", "appName", "desc"),
            "cores": _first(a, "cores", "Cores"),
            "user": _first(a, "user", "User"),
            "state": _first(a, "state", "State"),
            "duration_ms": _first(a, "duration", "durationMillis"),
        }

    active_apps = [x for x in (_norm_app(a) for a in (active or [])) if x]
    completed_apps = [x for x in (_norm_app(a) for a in (completed or [])) if x]

    status_summary = {
        "url": raw.get("url"),
        "status": raw.get("status"),
        "alive_workers": _first(raw, "aliveworkers", "aliveWorkers"),
        "cores": _first(raw, "cores", "Cores"),
        "cores_used": _first(raw, "coresused", "coresUsed"),
        "memory": _first(raw, "memory", "Memory"),
        "memory_used": _first(raw, "memoryused", "memoryUsed"),
    }

    return {
        "reachable": True,
        "error": None,
        "status": status_summary,
        "workers": workers,
        "active_applications": active_apps,
        "completed_applications": completed_apps,
    }
