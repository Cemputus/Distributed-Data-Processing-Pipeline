import json
from pathlib import Path
from datetime import datetime, timezone
from functools import wraps
from typing import Optional
from uuid import uuid4

from flask import Blueprint, jsonify, request

from .config import Settings
from .etl_delegate import run_delegate_etl
from .integrations import airflow_client
from .integrations import bigquery_client as bq_client
from .integrations import spark_master_client
from .services import CENQueryService, MetricsService, UploadPipelineService


def create_api_blueprint(data_dir: Path) -> Blueprint:
    api = Blueprint("api", __name__)
    service = MetricsService(data_dir=data_dir, activated_dir=Settings.ACTIVATED_DIR)
    upload_service = UploadPipelineService(
        data_dir=data_dir,
        landing_dir=Settings.LANDING_DIR,
        processing_dir=Settings.PROCESSING_DIR,
        failed_dir=Settings.FAILED_DIR,
        published_dir=Settings.PUBLISHED_DIR,
        external_dir=Settings.EXTERNAL_DIR,
        metadata_dir=Settings.METADATA_DIR,
    )
    query_service = CENQueryService(
        data_dir=data_dir,
        external_dir=Settings.EXTERNAL_DIR,
        activated_dir=Settings.ACTIVATED_DIR,
    )
    token_store: dict = {}
    auth_tokens_file = Settings.METADATA_DIR / "auth_tokens.json"

    def _persist_auth_tokens() -> None:
        auth_tokens_file.parent.mkdir(parents=True, exist_ok=True)
        trimmed = dict(list(token_store.items())[:800])
        auth_tokens_file.write_text(json.dumps(trimmed, indent=2), encoding="utf-8")

    def _load_auth_tokens_from_disk() -> None:
        if not auth_tokens_file.exists():
            return
        try:
            raw = json.loads(auth_tokens_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, TypeError):
            return
        if not isinstance(raw, dict):
            return
        for key, val in raw.items():
            if isinstance(val, dict) and val.get("username") and val.get("role"):
                token_store[key] = {"username": val["username"], "role": val["role"]}

    def _reload_tokens_if_missing(token: str) -> None:
        """Re-read disk so sessions survive API restarts and work across Gunicorn workers."""
        if token in token_store:
            return
        _load_auth_tokens_from_disk()

    _load_auth_tokens_from_disk()

    users_file = Settings.METADATA_DIR / "users.json"
    etl_jobs_file = Settings.METADATA_DIR / "etl_jobs.json"
    audit_logs_file = Settings.METADATA_DIR / "audit_logs.json"

    def _load_json(path: Path, fallback):
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            import json
            path.write_text(json.dumps(fallback, indent=2), encoding="utf-8")
            return fallback
        try:
            import json
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return fallback

    def _save_json(path: Path, payload) -> None:
        import json
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    default_users = {
        username: {"password": item["password"], "role": item["role"], "enabled": True}
        for username, item in Settings.USERS.items()
    }
    user_store = _load_json(users_file, default_users)
    etl_jobs = _load_json(etl_jobs_file, [])
    audit_logs = _load_json(audit_logs_file, [])

    def _analytics_ready_upload_row(event: dict) -> bool:
        if event.get("pipeline_status") == "analytics_ready":
            return True
        if event.get("status") == "success" and not event.get("pipeline_status"):
            return True
        return False

    def _create_etl_job_record(username: str, job_name: str, preprocess: Optional[dict] = None) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        dag_id = Settings.AIRFLOW_ETL_DAG_ID or "distributed_pipeline_scaffold"
        airflow_run, airflow_error = airflow_client.try_trigger_dag(
            dag_id,
            conf={"triggered_by": username, "job_name": job_name},
        )

        delegate_result = run_delegate_etl(metadata_registry=Settings.METADATA_DIR / "dataset_registry.json")
        delegate_ok = delegate_result.get("status") == "completed"
        airflow_ok = bool(airflow_run and not airflow_error)
        if airflow_ok:
            overall = "queued"
        elif delegate_ok:
            overall = "completed"
        else:
            overall = delegate_result.get("status", "completed")

        job = {
            "job_id": str(uuid4()),
            "job_name": job_name,
            "triggered_by": username,
            "status": overall,
            "triggered_at": now,
            "stages": ["airflow_trigger", "delegate_summary"],
            "summary": delegate_result.get("summary", {}),
            "airflow_dag_id": dag_id,
            "airflow_dag_run_id": (airflow_run or {}).get("dag_run_id") if airflow_run else None,
            "airflow_state": (airflow_run or {}).get("state") if airflow_run else None,
            "airflow_ui_url": f"{Settings.AIRFLOW_UI_PUBLIC.rstrip('/')}/dags/{dag_id}/grid",
            "airflow_error": airflow_error,
            "airflow_trigger_ok": airflow_ok,
            "delegate_etl_ok": delegate_ok,
            "message": (
                None
                if airflow_ok
                else (
                    "Airflow did not queue a run: "
                    + (airflow_error or "unknown error")
                    + (
                        " Local delegate ETL still recorded."
                        if delegate_ok
                        else " Check Airflow logs, DAG id, and AIRFLOW__API__AUTH_BACKENDS (basic_auth)."
                    )
                )
            ),
        }
        if preprocess is not None:
            job["preprocess"] = preprocess
        etl_jobs.insert(0, job)
        _save_json(etl_jobs_file, etl_jobs[:500])
        return job

    def _sync_etl_jobs_with_airflow() -> None:
        """Refresh ETL job status from Airflow for jobs that have a DAG run id."""
        changed = False
        for job in etl_jobs:
            if not job.get("airflow_trigger_ok"):
                continue
            dag_id = str(job.get("airflow_dag_id") or "").strip()
            run_id = str(job.get("airflow_dag_run_id") or "").strip()
            if not dag_id or not run_id:
                continue
            current = str(job.get("airflow_state") or "").strip().lower()
            if current in {"success", "failed"} and str(job.get("status") or "").strip().lower() in {"completed", "failed"}:
                continue

            new_state, err = airflow_client.try_get_dag_run_state(dag_id, run_id)
            if err:
                continue
            if not new_state:
                continue
            if new_state != current:
                job["airflow_state"] = new_state
                changed = True

            if new_state == "success":
                if job.get("status") != "completed":
                    job["status"] = "completed"
                    job["message"] = job.get("message") or "Airflow DAG run completed successfully."
                    changed = True
            elif new_state in {"failed", "upstream_failed"}:
                if job.get("status") != "failed":
                    job["status"] = "failed"
                    if not job.get("message"):
                        job["message"] = f"Airflow DAG run ended in state: {new_state}."
                    changed = True
            elif new_state in {"running", "queued", "scheduled"}:
                if job.get("status") != "queued":
                    job["status"] = "queued"
                    changed = True

        if changed:
            _save_json(etl_jobs_file, etl_jobs[:500])

    role_permissions = {
        "admin": {"analytics", "uploads", "datasets", "etl", "audit", "query", "bigquery", "users"},
        "data_engineer": {"analytics", "uploads", "datasets", "etl", "audit", "query", "bigquery"},
        "analyst": {"analytics", "datasets", "query", "bigquery"},
        "operator": {"analytics", "uploads", "datasets", "etl"},
    }

    def append_audit(action: str, outcome: str, details: str, username: str = "anonymous") -> None:
        audit_logs.insert(
            0,
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "username": username,
                "action": action,
                "outcome": outcome,
                "details": details,
            },
        )
        _save_json(audit_logs_file, audit_logs[:500])

    def current_user():
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None
        token = auth_header.split(" ", 1)[1].strip()
        _reload_tokens_if_missing(token)
        return token_store.get(token)

    def require_permission(permission: str):
        def decorator(handler):
            @wraps(handler)
            def wrapper(*args, **kwargs):
                user = current_user()
                if not user:
                    append_audit(action=request.path, outcome="failed", details="Unauthorized request")
                    return jsonify({"error": "unauthorized"}), 401
                role = user["role"]
                if permission not in role_permissions.get(role, set()):
                    append_audit(
                        action=request.path,
                        outcome="failed",
                        details=f"Access denied for role {role}",
                        username=user["username"],
                    )
                    return jsonify({"error": "forbidden"}), 403
                return handler(*args, **kwargs)

            return wrapper

        return decorator

    @api.get("/health")
    def health():
        return jsonify({"status": "ok"})

    @api.post("/api/auth/login")
    def login():
        payload = request.get_json(silent=True) or {}
        username = payload.get("username", "").strip()
        password = payload.get("password", "")
        user_entry = user_store.get(username)
        if not user_entry or not user_entry.get("enabled", True) or user_entry["password"] != password:
            append_audit(action="auth.login", outcome="failed", details=f"Invalid credentials for {username or 'unknown'}")
            return jsonify({"error": "invalid_credentials"}), 401

        token = str(uuid4())
        token_store[token] = {"username": username, "role": user_entry["role"]}
        _persist_auth_tokens()
        append_audit(action="auth.login", outcome="success", details="User logged in", username=username)
        return jsonify({"token": token, "username": username, "role": user_entry["role"]})

    @api.post("/api/auth/logout")
    def logout():
        auth_header = request.headers.get("Authorization", "")
        uname = "anonymous"
        if auth_header.startswith("Bearer "):
            tok = auth_header.split(" ", 1)[1].strip()
            _reload_tokens_if_missing(tok)
            prev = token_store.get(tok)
            if prev:
                uname = prev.get("username", "anonymous")
            token_store.pop(tok, None)
            _persist_auth_tokens()
        append_audit(action="auth.logout", outcome="success", details="Session ended", username=uname)
        return jsonify({"ok": True})

    @api.get("/api/auth/me")
    def me():
        user = current_user()
        if not user:
            return jsonify({"error": "unauthorized"}), 401
        return jsonify(user)

    @api.get("/api/docs")
    def docs():
        return jsonify(
            {
                "endpoints": [
                    {"method": "GET", "path": "/health", "description": "Service health check"},
                    {"method": "GET", "path": "/api/overview", "description": "KPI overview metrics"},
                    {"method": "GET", "path": "/api/top-merchants?limit=5", "description": "Top merchants by transaction volume"},
                    {"method": "GET", "path": "/api/upload-datasets", "description": "Datasets allowed for upload"},
                    {"method": "POST", "path": "/api/uploads", "description": "Upload CSV to landing + MinIO only (ingest)"},
                    {"method": "GET", "path": "/api/uploads/pending", "description": "Landings awaiting preprocess + analytics_ready"},
                    {"method": "POST", "path": "/api/datasets/process", "description": "Run preprocess/publish from landing; optional run_etl"},
                    {"method": "GET", "path": "/api/uploads/success", "description": "Uploads that reached analytics_ready (dashboard/CEN)"},
                    {"method": "GET", "path": "/api/uploads/failed", "description": "Failed dataset uploads"},
                    {"method": "GET", "path": "/api/datasets", "description": "Uploaded dataset catalog and insights"},
                    {"method": "POST", "path": "/api/auth/login", "description": "Authenticate and receive bearer token"},
                    {"method": "POST", "path": "/api/auth/logout", "description": "Invalidate current bearer token (Authorization header)"},
                    {"method": "GET", "path": "/api/etl/jobs", "description": "List ETL jobs"},
                    {"method": "POST", "path": "/api/etl/jobs", "description": "Trigger ETL (scope: delegate_only | preprocess_single | preprocess_all)"},
                    {"method": "GET", "path": "/api/audit-logs", "description": "Read audit logs"},
                    {"method": "POST", "path": "/api/cen-query/execute", "description": "Run read-only SQL in CEN Query workspace"},
                    {"method": "GET", "path": "/api/datasets/<dataset_name>/preview", "description": "Preview dataset rows"},
                    {"method": "DELETE", "path": "/api/datasets/<dataset_name>", "description": "Delete dataset catalog rows and files"},
                    {"method": "GET", "path": "/api/analytics/charts", "description": "Dashboard chart series (CSV + registry)"},
                    {"method": "GET", "path": "/api/users", "description": "List users"},
                    {"method": "POST", "path": "/api/users", "description": "Create user"},
                    {"method": "PATCH", "path": "/api/users/<username>", "description": "Update user role/status"},
                    {"method": "GET", "path": "/api/integrations/config", "description": "Airflow UI URL, MinIO console, BigQuery project, Spark Master UI URL (auth)"},
                    {"method": "GET", "path": "/api/integrations/spark", "description": "Spark Standalone workers + applications (from Master /json/, auth, etl)"},
                    {"method": "GET", "path": "/api/integrations/health", "description": "Airflow/BigQuery connectivity (auth)"},
                    {"method": "GET", "path": "/api/bigquery/status", "description": "BigQuery credentials status"},
                    {"method": "GET", "path": "/api/bigquery/datasets", "description": "List datasets (same project as console)"},
                    {"method": "GET", "path": "/api/bigquery/datasets/<dataset_id>/tables", "description": "List tables in dataset"},
                    {"method": "POST", "path": "/api/bigquery/query", "description": "Read-only BigQuery SQL"},
                ]
            }
        )

    @api.get("/api/overview")
    @require_permission("analytics")
    def overview():
        user = current_user()
        append_audit(action="analytics.overview", outcome="success", details="Overview queried", username=user["username"])
        return jsonify(service.overview())

    @api.get("/api/top-merchants")
    @require_permission("analytics")
    def top_merchants():
        limit = request.args.get("limit", "5")
        try:
            parsed_limit = max(1, min(20, int(limit)))
        except ValueError:
            parsed_limit = 5
        user = current_user()
        append_audit(action="analytics.top_merchants", outcome="success", details=f"Top merchants limit={parsed_limit}", username=user["username"])
        return jsonify({"items": service.top_merchants(limit=parsed_limit)})

    @api.get("/api/analytics/charts")
    @require_permission("analytics")
    def analytics_charts():
        user = current_user()
        registry = upload_service.list_datasets()
        payload = service.dashboard_charts(registry)
        append_audit(action="analytics.charts", outcome="success", details="dashboard charts", username=user["username"])
        return jsonify(payload)

    @api.get("/api/upload-datasets")
    @require_permission("uploads")
    def upload_datasets():
        user = current_user()
        append_audit(action="uploads.catalog", outcome="success", details="Upload dataset catalog read", username=user["username"])
        return jsonify(
            {
                "preloaded_dataset": "dim_customers.csv",
                "message": "Upload any CSV: this step only lands the file and mirrors to MinIO. Use Process (awaiting processing) or ETL Jobs to preprocess, publish, mark analytics_ready, and run Spark/Airflow.",
            }
        )

    @api.post("/api/uploads")
    @require_permission("uploads")
    def upload():
        user = current_user()
        upload_file = request.files.get("file")
        if upload_file is None or not upload_file.filename:
            return jsonify({"error": "file is required"}), 400

        dataset_name = Path(upload_file.filename).name
        result = upload_service.upload_dataset(dataset_name=dataset_name, incoming_file=upload_file)
        if result.get("status") == "failed":
            append_audit(action="uploads.submit", outcome="failed", details=f"{dataset_name}: {result.get('error')}", username=user["username"])
            return jsonify(result), 400
        append_audit(action="uploads.submit", outcome="success", details=f"{dataset_name}: uploaded", username=user["username"])
        return jsonify(result), 201

    @api.get("/api/uploads/pending")
    @require_permission("uploads")
    def upload_pending():
        user = current_user()
        append_audit(action="uploads.pending", outcome="success", details="Pending landings queried", username=user["username"])
        items = [event for event in upload_service.list_datasets() if event.get("pipeline_status") == "landed"]
        return jsonify({"items": items})

    @api.get("/api/uploads/success")
    @require_permission("uploads")
    def upload_success():
        user = current_user()
        append_audit(action="uploads.success", outcome="success", details="Analytics-ready uploads queried", username=user["username"])
        items = [event for event in upload_service.list_datasets() if _analytics_ready_upload_row(event)]
        return jsonify({"items": items})

    @api.get("/api/uploads/failed")
    @require_permission("uploads")
    def upload_failed():
        user = current_user()
        append_audit(action="uploads.failed", outcome="success", details="Failed uploads queried", username=user["username"])
        items = [event for event in upload_service.list_datasets() if event.get("status") == "failed"]
        return jsonify({"items": items})

    @api.get("/api/datasets")
    @require_permission("datasets")
    def list_datasets():
        user = current_user()
        append_audit(action="datasets.list", outcome="success", details="Dataset catalog viewed", username=user["username"])
        return jsonify({"items": upload_service.list_datasets()})

    @api.post("/api/datasets/process")
    @require_permission("uploads")
    def process_datasets_route():
        """Preprocess + publish landed files; optional ETL. Must be registered before /api/datasets/<name> or 'process' is captured as a dataset name (405)."""
        user = current_user()
        payload = request.get_json(silent=True) or {}
        mode = (payload.get("mode") or "single").strip().lower()
        dataset = payload.get("dataset") or payload.get("dataset_name")
        run_etl = bool(payload.get("run_etl"))
        job_name = str(payload.get("job_name") or "post_preprocess_etl").strip() or "post_preprocess_etl"

        result = upload_service.process_datasets(mode, dataset)
        err = result.get("error")
        if err == "dataset_required":
            append_audit(action="datasets.process", outcome="failed", details="dataset_required", username=user["username"])
            return jsonify(result), 400
        if err == "not_found":
            append_audit(action="datasets.process", outcome="failed", details="not_found", username=user["username"])
            return jsonify(result), 404
        if err in ("nothing_pending", "invalid_mode"):
            append_audit(action="datasets.process", outcome="failed", details=str(err), username=user["username"])
            return jsonify(result), 400

        etl_job = None
        if run_etl:
            etl_job = _create_etl_job_record(user["username"], job_name, preprocess=result)

        append_audit(
            action="datasets.process",
            outcome="success",
            details=f"mode={mode} run_etl={run_etl}",
            username=user["username"],
        )
        out = {"preprocess": result}
        if etl_job is not None:
            out["etl_job"] = etl_job
        return jsonify(out), 200

    @api.delete("/api/datasets/<dataset_name>")
    @require_permission("datasets")
    def delete_dataset(dataset_name: str):
        user = current_user()
        result = upload_service.delete_dataset(dataset_name)
        if not result.get("deleted"):
            append_audit(
                action="datasets.delete",
                outcome="failed",
                details=result.get("message", "not found"),
                username=user["username"],
            )
            return jsonify(result), 404
        append_audit(
            action="datasets.delete",
            outcome="success",
            details=f"removed {result.get('removed_entries', 0)} entries for {result.get('dataset')}",
            username=user["username"],
        )
        return jsonify(result), 200

    @api.get("/api/datasets/<dataset_name>/preview")
    @require_permission("datasets")
    def preview_dataset(dataset_name: str):
        user = current_user()
        limit = request.args.get("limit", "25")
        try:
            parsed_limit = max(1, min(200, int(limit)))
        except ValueError:
            parsed_limit = 25
        try:
            result = upload_service.preview_dataset(dataset_name=dataset_name, limit=parsed_limit)
            append_audit(action="datasets.preview", outcome="success", details=f"Previewed {dataset_name}", username=user["username"])
            return jsonify(result)
        except Exception as error:
            append_audit(action="datasets.preview", outcome="failed", details=str(error), username=user["username"])
            return jsonify({"error": "preview_error", "message": str(error)}), 404

    @api.get("/api/etl/jobs")
    @require_permission("etl")
    def get_etl_jobs():
        user = current_user()
        _sync_etl_jobs_with_airflow()
        append_audit(action="etl.jobs.list", outcome="success", details="ETL jobs listed", username=user["username"])
        return jsonify({"items": etl_jobs})

    @api.post("/api/etl/jobs")
    @require_permission("etl")
    def trigger_etl_job():
        user = current_user()
        payload = request.get_json(silent=True) or {}
        job_name = str(payload.get("job_name", "distributed_pipeline_scaffold")).strip() or "distributed_pipeline_scaffold"
        scope = (payload.get("scope") or "delegate_only").strip().lower()
        preprocess = None

        if scope == "preprocess_single":
            dataset = payload.get("dataset") or payload.get("dataset_name")
            if not dataset:
                return jsonify({"error": "dataset_required", "message": "dataset is required for preprocess_single"}), 400
            preprocess = upload_service.process_datasets("single", dataset)
            if preprocess.get("error") == "not_found":
                return jsonify(preprocess), 404
            if preprocess.get("error") == "dataset_required":
                return jsonify(preprocess), 400
        elif scope == "preprocess_all":
            preprocess = upload_service.process_datasets("all", None)
            if preprocess.get("error") == "nothing_pending":
                return jsonify(preprocess), 400
        elif scope != "delegate_only":
            return jsonify({"error": "invalid_scope", "message": "Use delegate_only, preprocess_single, or preprocess_all"}), 400

        job = _create_etl_job_record(user["username"], job_name, preprocess=preprocess)
        append_audit(
            action="etl.jobs.trigger",
            outcome="success" if not job.get("airflow_error") else "partial",
            details=f"scope={scope} dag={job.get('airflow_dag_id')}",
            username=user["username"],
        )
        return jsonify(job), 201

    @api.get("/api/integrations/config")
    def integrations_config():
        user = current_user()
        if not user:
            return jsonify({"error": "unauthorized"}), 401
        return jsonify(
            {
                "airflow_ui_url": Settings.AIRFLOW_UI_PUBLIC,
                "minio_console_url": Settings.MINIO_CONSOLE_PUBLIC,
                "minio_bucket": Settings.MINIO_BUCKET_LANDING,
                "bigquery_project": Settings.BIGQUERY_PROJECT_ID,
                "airflow_dag_id": Settings.AIRFLOW_ETL_DAG_ID,
                "minio_endpoint_configured": bool(Settings.MINIO_ENDPOINT),
                "airflow_api_configured": bool(Settings.AIRFLOW_BASE_URL),
                "spark_master_ui_url": Settings.SPARK_MASTER_UI_PUBLIC,
            }
        )

    @api.get("/api/integrations/spark")
    @require_permission("etl")
    def integrations_spark():
        payload = spark_master_client.try_fetch_master_state(Settings.SPARK_MASTER_UI_INTERNAL_URL)
        payload["spark_ui_url"] = Settings.SPARK_MASTER_UI_PUBLIC
        return jsonify(payload)

    @api.get("/api/integrations/health")
    def integrations_health():
        user = current_user()
        if not user:
            return jsonify({"error": "unauthorized"}), 401
        return jsonify(
            {
                "airflow_ui_reachable": airflow_client.healthcheck(),
                "bigquery_credentials": bq_client.credentials_available(),
            }
        )

    @api.get("/api/bigquery/status")
    @require_permission("bigquery")
    def bigquery_status():
        user = current_user()
        append_audit(action="bigquery.status", outcome="success", details="status", username=user["username"])
        creds_ok = bq_client.credentials_available()
        return jsonify(
            {
                "feature_enabled": Settings.BIGQUERY_ENABLED,
                "enabled": Settings.BIGQUERY_ENABLED and creds_ok,
                "credentials_configured": creds_ok,
                "project": bq_client.resolve_project_id() or Settings.BIGQUERY_PROJECT_ID,
                "default_dataset": Settings.BIGQUERY_DEFAULT_DATASET,
                "ingest_dataset": Settings.BIGQUERY_INGEST_DATASET,
                "dataset_location": Settings.BIGQUERY_DATASET_LOCATION,
                "console_url": (
                    bq_client.console_project_url(bq_client.resolve_project_id())
                    if bq_client.resolve_project_id()
                    else None
                ),
            }
        )

    @api.get("/api/bigquery/datasets")
    @require_permission("bigquery")
    def bigquery_list_datasets():
        user = current_user()
        try:
            payload = bq_client.list_datasets()
            append_audit(action="bigquery.datasets", outcome="success", details="list", username=user["username"])
            return jsonify(payload)
        except Exception as exc:
            append_audit(action="bigquery.datasets", outcome="failed", details=str(exc), username=user["username"])
            return jsonify({"error": "bigquery_error", "message": str(exc)}), 400

    @api.get("/api/bigquery/datasets/<dataset_id>/tables")
    @require_permission("bigquery")
    def bigquery_list_tables(dataset_id: str):
        user = current_user()
        try:
            payload = bq_client.list_tables(dataset_id)
            append_audit(
                action="bigquery.tables",
                outcome="success",
                details=f"dataset={dataset_id}",
                username=user["username"],
            )
            return jsonify(payload)
        except Exception as exc:
            append_audit(action="bigquery.tables", outcome="failed", details=str(exc), username=user["username"])
            return jsonify({"error": "bigquery_error", "message": str(exc)}), 400

    @api.post("/api/bigquery/query")
    @require_permission("bigquery")
    def bigquery_query():
        user = current_user()
        payload = request.get_json(silent=True) or {}
        sql = payload.get("sql", "")
        max_rows = int(payload.get("max_rows", 100))
        try:
            result = bq_client.run_readonly_query(sql, max_rows=max_rows)
            append_audit(action="bigquery.query", outcome="success", details="query executed", username=user["username"])
            return jsonify(result)
        except Exception as exc:
            append_audit(action="bigquery.query", outcome="failed", details=str(exc), username=user["username"])
            return jsonify({"error": "bigquery_error", "message": str(exc)}), 400

    @api.get("/api/audit-logs")
    @require_permission("audit")
    def get_audit_logs():
        user = current_user()
        append_audit(action="audit.read", outcome="success", details="Audit logs viewed", username=user["username"])
        return jsonify({"items": audit_logs[:300]})

    @api.get("/api/users")
    @require_permission("users")
    def list_users():
        user = current_user()
        append_audit(action="users.list", outcome="success", details="User list viewed", username=user["username"])
        items = [
            {"username": username, "role": details["role"], "enabled": details.get("enabled", True)}
            for username, details in sorted(user_store.items(), key=lambda x: x[0])
        ]
        return jsonify({"items": items})

    @api.post("/api/users")
    @require_permission("users")
    def create_user():
        user = current_user()
        payload = request.get_json(silent=True) or {}
        username = str(payload.get("username", "")).strip().lower()
        password = str(payload.get("password", "")).strip()
        role = str(payload.get("role", "")).strip()
        if not username or not password or not role:
            return jsonify({"error": "invalid_request", "message": "username, password, and role are required"}), 400
        if role not in role_permissions:
            return jsonify({"error": "invalid_request", "message": "Unsupported role"}), 400
        if username in user_store:
            return jsonify({"error": "already_exists", "message": "Username already exists"}), 409
        user_store[username] = {"password": password, "role": role, "enabled": True}
        _save_json(users_file, user_store)
        append_audit(action="users.create", outcome="success", details=f"Created {username}", username=user["username"])
        return jsonify({"username": username, "role": role, "enabled": True}), 201

    @api.patch("/api/users/<username>")
    @require_permission("users")
    def update_user(username: str):
        user = current_user()
        target = user_store.get(username)
        if not target:
            return jsonify({"error": "not_found", "message": "User not found"}), 404
        payload = request.get_json(silent=True) or {}
        role = payload.get("role")
        enabled = payload.get("enabled")
        password = payload.get("password")
        if role is not None:
            if role not in role_permissions:
                return jsonify({"error": "invalid_request", "message": "Unsupported role"}), 400
            target["role"] = role
        if isinstance(enabled, bool):
            target["enabled"] = enabled
        if isinstance(password, str) and password.strip():
            target["password"] = password.strip()
        user_store[username] = target
        _save_json(users_file, user_store)
        append_audit(action="users.update", outcome="success", details=f"Updated {username}", username=user["username"])
        return jsonify({"username": username, "role": target["role"], "enabled": target.get("enabled", True)})

    @api.post("/api/cen-query/execute")
    @require_permission("query")
    def execute_cen_query():
        user = current_user()
        payload = request.get_json(silent=True) or {}
        query = payload.get("query", "")
        row_limit = payload.get("row_limit", 200)
        try:
            result = query_service.execute_readonly_query(query=query, row_limit=int(row_limit))
            append_audit(action="query.execute", outcome="success", details="CEN Query executed", username=user["username"])
            return jsonify(result)
        except Exception as error:
            append_audit(action="query.execute", outcome="failed", details=str(error), username=user["username"])
            return jsonify({"error": "query_error", "message": str(error)}), 400

    return api

