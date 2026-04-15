from pathlib import Path
from datetime import datetime, timezone
from functools import wraps
from uuid import uuid4

from flask import Blueprint, jsonify, request

from .config import Settings
from .etl_delegate import run_delegate_etl
from .services import CENQueryService, MetricsService, UploadPipelineService


def create_api_blueprint(data_dir: Path) -> Blueprint:
    api = Blueprint("api", __name__)
    service = MetricsService(data_dir=data_dir)
    upload_service = UploadPipelineService(
        data_dir=data_dir,
        landing_dir=Settings.LANDING_DIR,
        processing_dir=Settings.PROCESSING_DIR,
        failed_dir=Settings.FAILED_DIR,
        published_dir=Settings.PUBLISHED_DIR,
        external_dir=Settings.EXTERNAL_DIR,
        metadata_dir=Settings.METADATA_DIR,
    )
    query_service = CENQueryService(data_dir=data_dir, external_dir=Settings.EXTERNAL_DIR)
    token_store = {}
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

    role_permissions = {
        "admin": {"analytics", "uploads", "datasets", "etl", "audit", "query", "users"},
        "data_engineer": {"analytics", "uploads", "datasets", "etl", "audit", "query"},
        "analyst": {"analytics", "datasets", "query"},
        "operator": {"uploads", "datasets", "etl"},
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
        append_audit(action="auth.login", outcome="success", details="User logged in", username=username)
        return jsonify({"token": token, "username": username, "role": user_entry["role"]})

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
                    {"method": "POST", "path": "/api/uploads", "description": "Upload dataset and run 3-stage processing"},
                    {"method": "GET", "path": "/api/uploads/success", "description": "Successful dataset uploads"},
                    {"method": "GET", "path": "/api/uploads/failed", "description": "Failed dataset uploads"},
                    {"method": "GET", "path": "/api/datasets", "description": "Uploaded dataset catalog and insights"},
                    {"method": "POST", "path": "/api/auth/login", "description": "Authenticate and receive bearer token"},
                    {"method": "GET", "path": "/api/etl/jobs", "description": "List ETL jobs"},
                    {"method": "POST", "path": "/api/etl/jobs", "description": "Trigger ETL job"},
                    {"method": "GET", "path": "/api/audit-logs", "description": "Read audit logs"},
                    {"method": "POST", "path": "/api/cen-query/execute", "description": "Run read-only SQL in CEN Query workspace"},
                    {"method": "GET", "path": "/api/datasets/<dataset_name>/preview", "description": "Preview dataset rows"},
                    {"method": "GET", "path": "/api/users", "description": "List users"},
                    {"method": "POST", "path": "/api/users", "description": "Create user"},
                    {"method": "PATCH", "path": "/api/users/<username>", "description": "Update user role/status"},
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

    @api.get("/api/upload-datasets")
    @require_permission("uploads")
    def upload_datasets():
        user = current_user()
        append_audit(action="uploads.catalog", outcome="success", details="Upload dataset catalog read", username=user["username"])
        return jsonify(
            {
                "preloaded_dataset": "dim_customers.csv",
                "message": "Upload any CSV dataset. Finance datasets are auto-routed to the finance pipeline; non-finance datasets are profiled and stored in the external analytics zone.",
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

    @api.get("/api/uploads/success")
    @require_permission("uploads")
    def upload_success():
        user = current_user()
        append_audit(action="uploads.success", outcome="success", details="Successful uploads queried", username=user["username"])
        items = [event for event in upload_service.list_datasets() if event.get("status") == "success"]
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
        append_audit(action="etl.jobs.list", outcome="success", details="ETL jobs listed", username=user["username"])
        return jsonify({"items": etl_jobs})

    @api.post("/api/etl/jobs")
    @require_permission("etl")
    def trigger_etl_job():
        user = current_user()
        payload = request.get_json(silent=True) or {}
        job_name = payload.get("job_name", "etl-pipeline.py")
        now = datetime.now(timezone.utc).isoformat()
        delegate_result = run_delegate_etl(metadata_registry=Settings.METADATA_DIR / "dataset_registry.json")
        job = {
            "job_id": str(uuid4()),
            "job_name": job_name,
            "triggered_by": user["username"],
            "status": delegate_result.get("status", "completed"),
            "triggered_at": now,
            "stages": ["input_stage", "processing_stage", "result_stage"],
            "summary": delegate_result.get("summary", {}),
        }
        etl_jobs.insert(0, job)
        _save_json(etl_jobs_file, etl_jobs[:500])
        append_audit(action="etl.jobs.trigger", outcome="success", details=f"Triggered {job_name}", username=user["username"])
        return jsonify(job), 201

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

