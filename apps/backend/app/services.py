from pathlib import Path
from datetime import datetime, timezone
import csv
import json
import re
import sqlite3
import shutil
from typing import Dict, List, Tuple, Any, Optional

from .data_access import count_rows, sum_column, top_merchants_from_transactions


class MetricsService:
    UPLOAD_GATED_DATASETS = {
        "dim_accounts.csv",
        "fact_transactions.csv",
        "fact_loans.csv",
        "fact_fraud_alerts.csv",
        "dim_merchants.csv",
    }

    def __init__(self, data_dir: Path, activated_dir: Optional[Path] = None):
        self.data_dir = data_dir
        self.activated_dir = activated_dir or (data_dir / "uploads" / "activated")

    def _path(self, name: str) -> Path:
        if name in self.UPLOAD_GATED_DATASETS:
            marker = self.activated_dir / f"{name}.ok"
            if not marker.exists():
                return self.data_dir / "__missing__.csv"
        return self.data_dir / name

    def overview(self) -> Dict[str, int]:
        customers = count_rows(self._path("dim_customers.csv"))
        accounts = count_rows(self._path("dim_accounts.csv"))
        transactions = count_rows(self._path("fact_transactions.csv"))
        loans = count_rows(self._path("fact_loans.csv"))
        fraud_alerts = count_rows(self._path("fact_fraud_alerts.csv"))

        transaction_volume = sum_column(self._path("fact_transactions.csv"), "amount")
        loan_principal = sum_column(self._path("fact_loans.csv"), "principal_amount")

        return {
            "customers": customers,
            "accounts": accounts,
            "transactions": transactions,
            "loans": loans,
            "fraud_alerts": fraud_alerts,
            "transaction_volume_ugx": int(transaction_volume),
            "loan_principal_ugx": int(loan_principal),
        }

    def top_merchants(self, limit: int = 5) -> List[Dict[str, object]]:
        return top_merchants_from_transactions(
            self._path("fact_transactions.csv"),
            self._path("dim_merchants.csv"),
            limit=limit,
        )


class UploadPipelineService:
    FINANCE_SCHEMAS = {
        "dim_accounts.csv": ["account_id", "customer_id"],
        "dim_merchants.csv": ["merchant_id", "merchant_name"],
        "dim_cards.csv": ["card_id", "customer_id"],
        "dim_branches.csv": ["branch_id", "branch_name"],
        "dim_date.csv": ["date_key", "date"],
        "fact_transactions.csv": ["transaction_id", "account_id", "merchant_id", "amount"],
        "fact_fraud_alerts.csv": ["alert_id", "transaction_id", "customer_id"],
        "fact_loans.csv": ["loan_id", "customer_id", "principal_amount"],
        "fact_loan_repayments.csv": ["repayment_id", "loan_id", "amount_paid"],
    }

    def __init__(
        self,
        data_dir: Path,
        landing_dir: Path,
        processing_dir: Path,
        failed_dir: Path,
        published_dir: Path,
        external_dir: Path,
        metadata_dir: Path,
    ):
        self.data_dir = data_dir
        self.landing_dir = landing_dir
        self.processing_dir = processing_dir
        self.failed_dir = failed_dir
        self.published_dir = published_dir
        self.external_dir = external_dir
        self.metadata_dir = metadata_dir
        self.activated_dir = self.data_dir / "uploads" / "activated"
        self.registry_file = self.metadata_dir / "dataset_registry.json"
        for folder in (
            self.landing_dir,
            self.processing_dir,
            self.failed_dir,
            self.published_dir,
            self.external_dir,
            self.metadata_dir,
            self.activated_dir,
        ):
            folder.mkdir(parents=True, exist_ok=True)
        if not self.registry_file.exists():
            self.registry_file.write_text("[]", encoding="utf-8")

    def upload_dataset(self, dataset_name: str, incoming_file) -> Dict[str, Any]:
        dataset_name = Path(dataset_name).name
        stage_events: List[Dict[str, str]] = []
        current_stage = "input_stage"
        now = datetime.now(timezone.utc)
        stamp = now.strftime("%Y%m%dT%H%M%SZ")
        landing_path = self.landing_dir / f"{stamp}_{dataset_name}"
        classification = "finance" if dataset_name in self.FINANCE_SCHEMAS else "external"

        try:
            self._stage_landing(incoming_file, landing_path)
            extra = ""
            try:
                from .integrations import minio_util

                meta = minio_util.upload_landing_file(landing_path, landing_path.name)
                if meta and "bucket" in meta:
                    extra = f" · MinIO s3://{meta['bucket']}/{meta['object']}"
                elif meta and meta.get("error"):
                    extra = f" (MinIO mirror: {meta['error']})"
            except Exception as exc:
                extra = f" (MinIO: {exc})"
            stage_events.append(
                self._stage_event("input_stage", "passed", f"Stored file in landing zone: {landing_path.name}{extra}"),
            )

            current_stage = "processing_stage"
            processing_path, row_count, insights = self._stage_processing(dataset_name, landing_path, classification)
            stage_events.append(self._stage_event("processing_stage", "passed", f"Validated and normalized {row_count} records."))

            current_stage = "result_stage"
            result_path = self._stage_result(dataset_name, processing_path, classification)
            stage_events.append(self._stage_event("result_stage", "passed", f"Published dataset to {classification} zone: {result_path.name}"))

            payload = {
                "dataset": dataset_name,
                "classification": classification,
                "uploaded_at": now.isoformat(),
                "status": "success",
                "row_count": row_count,
                "stages": stage_events,
                "insights": insights,
            }
            self._record_registry(payload)
            return payload
        except Exception as error:
            failed_path = self.failed_dir / f"{stamp}_{dataset_name}"
            try:
                if landing_path.exists():
                    shutil.copy2(landing_path, failed_path)
            except OSError:
                pass

            payload = {
                "dataset": dataset_name,
                "classification": classification,
                "uploaded_at": now.isoformat(),
                "status": "failed",
                "error": str(error),
                "stages": stage_events + [self._stage_event(current_stage, "failed", str(error))],
            }
            self._record_registry(payload)
            return payload

    def list_datasets(self) -> List[Dict[str, Any]]:
        try:
            return json.loads(self.registry_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []

    def preview_dataset(self, dataset_name: str, limit: int = 25) -> Dict[str, Any]:
        safe_name = Path(dataset_name).name
        candidates = [
            self.data_dir / safe_name,
            self.external_dir / safe_name,
            self.published_dir / safe_name,
        ]
        target = next((path for path in candidates if path.exists()), None)
        if target is None:
            raise ValueError(f"Dataset not found: {safe_name}")

        with target.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames:
                raise ValueError("Dataset has no header row.")
            rows = []
            for index, row in enumerate(reader):
                if index >= max(1, min(200, limit)):
                    break
                rows.append({column: row.get(column, "") for column in reader.fieldnames})

        return {
            "dataset": safe_name,
            "columns": reader.fieldnames,
            "rows": rows,
            "row_count": len(rows),
            "source_path": str(target),
        }

    @staticmethod
    def _stage_event(stage: str, status: str, message: str) -> Dict[str, str]:
        return {"stage": stage, "status": status, "message": message}

    def _stage_landing(self, incoming_file, target_path: Path) -> None:
        incoming_file.save(target_path)
        if target_path.stat().st_size == 0:
            raise ValueError("Uploaded file is empty.")

    def _stage_processing(self, dataset_name: str, landing_path: Path, classification: str) -> Tuple[Path, int, Dict[str, Any]]:
        processing_path = self.processing_dir / landing_path.name
        required_columns = self.FINANCE_SCHEMAS.get(dataset_name, [])

        with landing_path.open("r", encoding="utf-8", newline="") as source_file:
            reader = csv.DictReader(source_file)
            if not reader.fieldnames:
                raise ValueError("CSV header is missing.")
            if classification == "finance":
                missing = [column for column in required_columns if column not in reader.fieldnames]
                if missing:
                    raise ValueError(f"Missing required columns: {', '.join(missing)}")

            row_count = 0
            null_counts = {column: 0 for column in reader.fieldnames}
            numeric_stats: Dict[str, Dict[str, float]] = {}

            with processing_path.open("w", encoding="utf-8", newline="") as normalized_file:
                writer = csv.DictWriter(normalized_file, fieldnames=reader.fieldnames)
                writer.writeheader()
                for row in reader:
                    cleaned = {}
                    for column, value in row.items():
                        cleaned_value = value.strip() if isinstance(value, str) else value
                        cleaned[column] = cleaned_value
                        if cleaned_value in (None, ""):
                            null_counts[column] += 1
                        else:
                            try:
                                numeric_value = float(cleaned_value)
                                stats = numeric_stats.setdefault(column, {"min": numeric_value, "max": numeric_value, "sum": 0.0, "count": 0.0})
                                stats["min"] = min(stats["min"], numeric_value)
                                stats["max"] = max(stats["max"], numeric_value)
                                stats["sum"] += numeric_value
                                stats["count"] += 1.0
                            except (TypeError, ValueError):
                                pass
                    writer.writerow(cleaned)
                    row_count += 1

        if row_count == 0:
            raise ValueError("CSV contains no data rows.")

        numeric_summary = {}
        for column, stats in numeric_stats.items():
            if stats["count"] > 0:
                numeric_summary[column] = {
                    "min": round(stats["min"], 4),
                    "max": round(stats["max"], 4),
                    "avg": round(stats["sum"] / stats["count"], 4),
                }

        insights = {
            "columns": reader.fieldnames,
            "row_count": row_count,
            "null_counts": null_counts,
            "numeric_summary": numeric_summary,
        }
        return processing_path, row_count, insights

    def _stage_result(self, dataset_name: str, processing_path: Path, classification: str) -> Path:
        published_path = self.published_dir / dataset_name
        shutil.copy2(processing_path, published_path)

        if classification == "finance":
            final_path = self.data_dir / dataset_name
            shutil.copy2(processing_path, final_path)
            (self.activated_dir / f"{dataset_name}.ok").write_text(datetime.now(timezone.utc).isoformat(), encoding="utf-8")
            return final_path

        final_path = self.external_dir / dataset_name
        shutil.copy2(processing_path, final_path)
        return final_path

    def _record_registry(self, payload: Dict[str, Any]) -> None:
        items = self.list_datasets()
        items.insert(0, payload)
        self.registry_file.write_text(json.dumps(items[:500], indent=2), encoding="utf-8")


class CENQueryService:
    BLOCKED_SQL_TOKENS = [
        "insert ",
        "update ",
        "delete ",
        "drop ",
        "alter ",
        "create ",
        "truncate ",
        "attach ",
        "detach ",
        "pragma ",
    ]

    def __init__(self, data_dir: Path, external_dir: Path):
        self.data_dir = data_dir
        self.external_dir = external_dir

    def execute_readonly_query(self, query: str, row_limit: int = 200) -> Dict[str, Any]:
        cleaned = (query or "").strip()
        if not cleaned:
            raise ValueError("SQL query is required.")
        lowered = cleaned.lower()
        if ";" in cleaned[:-1]:
            raise ValueError("Only one SQL statement is allowed.")
        if not (lowered.startswith("select") or lowered.startswith("with")):
            raise ValueError("CEN Query only allows read-only SELECT/WITH statements.")
        if any(token in lowered for token in self.BLOCKED_SQL_TOKENS):
            raise ValueError("Detected non read-only SQL token.")

        with sqlite3.connect(":memory:") as conn:
            conn.row_factory = sqlite3.Row
            table_names = self._load_tables(conn)
            cur = conn.execute(f"SELECT * FROM ({cleaned.rstrip(';')}) LIMIT {max(1, min(1000, row_limit))}")
            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description] if cur.description else []
            return {
                "columns": columns,
                "rows": [dict(row) for row in rows],
                "row_count": len(rows),
                "tables": sorted(table_names),
            }

    def _iter_csv_files(self) -> List[Path]:
        files: List[Path] = []
        for folder in (self.data_dir, self.external_dir):
            if folder.exists():
                files.extend(sorted(folder.glob("*.csv")))
        return files

    @staticmethod
    def _table_name_from_file(file_path: Path) -> str:
        raw = file_path.stem.lower()
        return re.sub(r"[^a-z0-9_]+", "_", raw).strip("_") or "dataset"

    def _load_tables(self, conn: sqlite3.Connection) -> List[str]:
        table_names: List[str] = []
        for file_path in self._iter_csv_files():
            table_name = self._table_name_from_file(file_path)
            with file_path.open("r", encoding="utf-8", newline="") as handle:
                reader = csv.DictReader(handle)
                if not reader.fieldnames:
                    continue
                quoted_cols = [f'"{col}" TEXT' for col in reader.fieldnames]
                conn.execute(f'DROP TABLE IF EXISTS "{table_name}"')
                conn.execute(f'CREATE TABLE "{table_name}" ({", ".join(quoted_cols)})')
                placeholders = ", ".join(["?"] * len(reader.fieldnames))
                insert_sql = f'INSERT INTO "{table_name}" VALUES ({placeholders})'
                rows = []
                for row in reader:
                    rows.append([row.get(col) for col in reader.fieldnames])
                if rows:
                    conn.executemany(insert_sql, rows)
            table_names.append(table_name)
        return table_names

