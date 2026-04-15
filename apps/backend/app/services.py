from pathlib import Path
from datetime import datetime, timezone
import csv
import json
import re
import sqlite3
import shutil
from typing import Dict, List, Tuple, Any, Optional

from .data_access import (
    count_column_values,
    count_rows,
    numeric_histogram,
    registry_pipeline_mix,
    registry_uploads_by_day,
    sum_column,
    top_merchants_from_transactions,
)


class MetricsService:
    UPLOAD_GATED_DATASETS = {
        "dim_accounts.csv",
        "fact_transactions.csv",
        "fact_loans.csv",
        "fact_fraud_alerts.csv",
        "dim_merchants.csv",
    }

    DASHBOARD_GATED = UPLOAD_GATED_DATASETS | {"dim_customers.csv"}

    def __init__(self, data_dir: Path, activated_dir: Optional[Path] = None):
        self.data_dir = data_dir
        self.activated_dir = activated_dir or (data_dir / "uploads" / "activated")
        self._migrate_legacy_ok_markers()

    def _migrate_legacy_ok_markers(self) -> None:
        """Older deployments used .ok; analytics KPIs use .analytics_ready."""
        for name in self.DASHBOARD_GATED:
            ok_p = self.activated_dir / f"{name}.ok"
            ar_p = self.activated_dir / f"{name}.analytics_ready"
            if ok_p.exists() and not ar_p.exists():
                try:
                    ar_p.write_text(ok_p.read_text(encoding="utf-8"), encoding="utf-8")
                except OSError:
                    pass

    def _analytics_ready(self, name: str) -> bool:
        return (self.activated_dir / f"{name}.analytics_ready").exists()

    def _path(self, name: str) -> Path:
        target = self.data_dir / name
        if name in self.DASHBOARD_GATED:
            if self._analytics_ready(name):
                return target
            # Use on-disk finance CSVs when present so KPIs match published/seed data, not an empty stub.
            if target.exists() and target.stat().st_size > 0:
                return target
            return self.data_dir / "__missing__.csv"
        return target

    _KPI_FILES = (
        "dim_customers.csv",
        "dim_accounts.csv",
        "fact_transactions.csv",
        "fact_loans.csv",
        "fact_fraud_alerts.csv",
    )

    def _kpi_source_meta(self) -> Dict[str, Dict[str, Any]]:
        """Which files on disk drive KPI row counts (same rules as `_path`)."""
        out: Dict[str, Dict[str, Any]] = {}
        for name in self._KPI_FILES:
            p = self._path(name)
            try:
                resolved = str(p.resolve(strict=False))
            except OSError:
                resolved = str(p)
            out[name] = {
                "path": resolved,
                "analytics_ready": self._analytics_ready(name),
            }
        return out

    def overview(self) -> Dict[str, Any]:
        customers = count_rows(self._path("dim_customers.csv"))
        accounts = count_rows(self._path("dim_accounts.csv"))
        transactions = count_rows(self._path("fact_transactions.csv"))
        loans = count_rows(self._path("fact_loans.csv"))
        fraud_alerts = count_rows(self._path("fact_fraud_alerts.csv"))

        transaction_volume = sum_column(self._path("fact_transactions.csv"), "amount")
        loan_principal = sum_column(self._path("fact_loans.csv"), "principal_amount")

        try:
            data_root = str(self.data_dir.resolve(strict=False))
        except OSError:
            data_root = str(self.data_dir)
        try:
            activated_root = str(self.activated_dir.resolve(strict=False))
        except OSError:
            activated_root = str(self.activated_dir)

        return {
            "customers": customers,
            "accounts": accounts,
            "transactions": transactions,
            "loans": loans,
            "fraud_alerts": fraud_alerts,
            "transaction_volume_ugx": int(transaction_volume),
            "loan_principal_ugx": int(loan_principal),
            "data_dir": data_root,
            "activated_dir": activated_root,
            "kpi_sources": self._kpi_source_meta(),
        }

    def top_merchants(self, limit: int = 5) -> List[Dict[str, object]]:
        return top_merchants_from_transactions(
            self._path("fact_transactions.csv"),
            self._path("dim_merchants.csv"),
            limit=limit,
        )

    def dashboard_charts(self, registry_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Eight chart payloads derived from analytics-ready CSVs and the dataset registry."""
        tx_path = self._path("fact_transactions.csv")
        mer_path = self._path("dim_merchants.csv")
        loans_path = self._path("fact_loans.csv")
        fraud_path = self._path("fact_fraud_alerts.csv")

        tm = top_merchants_from_transactions(tx_path, mer_path, limit=8)
        charts: List[Dict[str, Any]] = [
            {
                "key": "merchants_txn",
                "title": "Top merchants — transaction count",
                "type": "bar",
                "labels": [str(m.get("merchant_name", ""))[:22] for m in tm],
                "values": [float(m.get("transaction_count", 0)) for m in tm],
            },
            {
                "key": "merchants_amt",
                "title": "Top merchants — amount (UGX)",
                "type": "bar",
                "labels": [str(m.get("merchant_name", ""))[:22] for m in tm],
                "values": [float(m.get("total_amount_ugx", 0)) for m in tm],
            },
        ]

        la, va = numeric_histogram(tx_path, "amount", 5)
        charts.append(
            {
                "key": "txn_amount_bins",
                "title": "Transaction amounts (bins)",
                "type": "bar",
                "labels": la or ["—"],
                "values": va or [0.0],
            }
        )
        ll, vl = numeric_histogram(loans_path, "principal_amount", 5)
        charts.append(
            {
                "key": "loan_principal_bins",
                "title": "Loan principal (bins)",
                "type": "bar",
                "labels": ll or ["—"],
                "values": vl or [0.0],
            }
        )
        fc, fv = count_column_values(fraud_path, "customer_id", 8)
        charts.append(
            {
                "key": "fraud_by_customer",
                "title": "Fraud alerts by customer (top)",
                "type": "bar",
                "labels": fc or ["—"],
                "values": fv or [0.0],
            }
        )

        ov = self.overview()
        charts.append(
            {
                "key": "entity_counts",
                "title": "Entity row counts",
                "type": "bar",
                "labels": ["Customers", "Accounts", "Txns", "Loans", "Fraud"],
                "values": [
                    float(ov["customers"]),
                    float(ov["accounts"]),
                    float(ov["transactions"]),
                    float(ov["loans"]),
                    float(ov["fraud_alerts"]),
                ],
            }
        )

        ul, uvals = registry_uploads_by_day(registry_rows or [], 14)
        charts.append(
            {
                "key": "uploads_by_day",
                "title": "Catalog uploads by day (UTC)",
                "type": "bar",
                "labels": ul or ["—"],
                "values": uvals or [0.0],
            }
        )
        pl, pmix = registry_pipeline_mix(registry_rows or [])
        charts.append(
            {
                "key": "pipeline_status",
                "title": "Catalog by pipeline status",
                "type": "bar",
                "labels": pl or ["—"],
                "values": pmix or [0.0],
            }
        )

        try:
            data_root = str(self.data_dir.resolve(strict=False))
        except OSError:
            data_root = str(self.data_dir)
        return {
            "charts": charts,
            "data_dir": data_root,
            "chart_csv_note": "Charts that use transactions/merchants/loans/fraud read the same CSV paths as /api/overview kpi_sources.",
        }


class UploadPipelineService:
    # Required columns must exist in the CSV header. Extra columns are allowed.
    # Aligned with canonical data/fintech/*.csv (restored from git: commit 6d1e272, “cen analytics”).
    FINANCE_SCHEMAS = {
        "dim_customers.csv": ["customer_id", "full_name"],
        "dim_accounts.csv": ["account_id", "customer_id"],
        "dim_merchants.csv": ["merchant_id", "merchant_name"],
        "dim_cards.csv": ["card_id", "account_id", "customer_id"],
        "dim_branches.csv": ["branch_id", "branch_name"],
        "dim_date.csv": ["date_key", "full_date"],
        "fact_transactions.csv": ["transaction_id", "account_id", "merchant_id", "amount"],
        "fact_fraud_alerts.csv": ["alert_id", "transaction_id", "account_id"],
        "fact_loans.csv": ["loan_id", "customer_id", "principal_amount"],
        "fact_loan_repayments.csv": ["repayment_id", "loan_id", "amount"],
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
        """Landing + MinIO only. Run preprocess + publish + ETL via /api/datasets/process."""
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

            payload = {
                "dataset": dataset_name,
                "classification": classification,
                "uploaded_at": now.isoformat(),
                "landing_file": landing_path.name,
                "pipeline_status": "landed",
                "status": "landed",
                "stages": stage_events,
                "insights": {},
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

    def _run_bigquery_optional(self, result_path: Path, dataset_name: str) -> Tuple[Dict[str, Any], List[Dict[str, str]]]:
        stage_events: List[Dict[str, str]] = []
        bq_meta: Dict[str, Any] = {}
        try:
            from .integrations import bigquery_client as bq

            bq_meta = bq.load_csv_upload_to_bigquery(result_path, dataset_name)
        except Exception as exc:
            bq_meta = {"error": str(exc), "skipped": False}
        if bq_meta.get("full_table_id"):
            stage_events.append(
                self._stage_event(
                    "bigquery_stage",
                    "passed",
                    f"Loaded into BigQuery: `{bq_meta['full_table_id']}`",
                ),
            )
        elif bq_meta.get("error") and not bq_meta.get("skipped"):
            stage_events.append(self._stage_event("bigquery_stage", "failed", str(bq_meta["error"])))
        return bq_meta, stage_events

    def _mark_analytics_ready(self, dataset_name: str) -> None:
        self.activated_dir.mkdir(parents=True, exist_ok=True)
        marker = self.activated_dir / f"{Path(dataset_name).name}.analytics_ready"
        marker.write_text(datetime.now(timezone.utc).isoformat(), encoding="utf-8")

    def process_pipeline_from_landing(
        self,
        dataset_name: str,
        landing_path: Path,
        uploaded_at: str,
    ) -> Dict[str, Any]:
        """Preprocess → publish → BigQuery (optional) → analytics_ready marker."""
        dataset_name = Path(dataset_name).name
        classification = "finance" if dataset_name in self.FINANCE_SCHEMAS else "external"
        stage_events: List[Dict[str, str]] = []
        processing_path, row_count, insights = self._stage_processing(dataset_name, landing_path, classification)
        stage_events.append(
            self._stage_event("processing_stage", "passed", f"Validated and normalized {row_count} records."),
        )
        result_path = self._stage_result(dataset_name, processing_path, classification)
        stage_events.append(
            self._stage_event("result_stage", "passed", f"Published dataset to {classification} zone: {result_path.name}"),
        )
        bq_meta, bq_stages = self._run_bigquery_optional(result_path, dataset_name)
        stage_events.extend(bq_stages)
        self._mark_analytics_ready(dataset_name)
        stage_events.append(
            self._stage_event(
                "analytics_ready_stage",
                "passed",
                "Marked for dashboard & CEN Query (analytics_ready).",
            ),
        )
        return {
            "dataset": dataset_name,
            "classification": classification,
            "uploaded_at": uploaded_at,
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "pipeline_status": "analytics_ready",
            "status": "success",
            "row_count": row_count,
            "stages": stage_events,
            "insights": insights,
            "bigquery": bq_meta,
        }

    def _pending_landed_entries(self) -> List[Dict[str, Any]]:
        return [item for item in self.list_datasets() if item.get("pipeline_status") == "landed" and item.get("landing_file")]

    def _latest_landed_per_dataset(self) -> Dict[str, Dict[str, Any]]:
        """dataset_name -> registry row with most recent uploaded_at."""
        by_name: Dict[str, Dict[str, Any]] = {}
        for item in self._pending_landed_entries():
            name = item.get("dataset") or ""
            if not name:
                continue
            prev = by_name.get(name)
            if not prev or (item.get("uploaded_at") or "") > (prev.get("uploaded_at") or ""):
                by_name[name] = item
        return by_name

    def process_datasets(self, mode: str, dataset_name: Optional[str] = None) -> Dict[str, Any]:
        """
        mode: 'single' — process one dataset (latest landed file); 'all' — every dataset with pending landings.
        """
        mode_l = (mode or "single").lower().strip()
        targets: List[Dict[str, Any]] = []
        if mode_l == "single":
            if not dataset_name:
                return {"error": "dataset_required", "message": "Pass dataset filename for single mode."}
            ds = Path(dataset_name).name
            latest = self._latest_landed_per_dataset().get(ds)
            if not latest:
                return {"error": "not_found", "message": f"No landed upload pending for {ds}."}
            targets = [latest]
        elif mode_l == "all":
            targets = list(self._latest_landed_per_dataset().values())
            if not targets:
                return {"error": "nothing_pending", "message": "No landed datasets awaiting processing."}
        else:
            return {"error": "invalid_mode", "message": "Use mode single or all."}

        results: List[Dict[str, Any]] = []
        errors: List[str] = []
        for entry in targets:
            name = entry["dataset"]
            lfile = entry.get("landing_file")
            uploaded_at = entry.get("uploaded_at", "")
            if not lfile:
                errors.append(f"{name}: missing landing_file in registry")
                continue
            landing_path = self.landing_dir / lfile
            if not landing_path.exists():
                errors.append(f"{name}: landing file missing on disk: {lfile}")
                continue
            try:
                payload = self.process_pipeline_from_landing(name, landing_path, uploaded_at)
                self._merge_registry_entry(uploaded_at, name, payload)
                results.append({"dataset": name, "ok": True, "payload": payload})
            except Exception as exc:
                errors.append(f"{name}: {exc}")
                results.append({"dataset": name, "ok": False, "error": str(exc)})
        return {
            "mode": mode_l,
            "processed": results,
            "errors": errors,
        }

    def _merge_registry_entry(self, uploaded_at: str, dataset: str, updates: Dict[str, Any]) -> None:
        items = self.list_datasets()
        for i, row in enumerate(items):
            if row.get("uploaded_at") == uploaded_at and row.get("dataset") == dataset:
                items[i] = {**row, **updates}
                break
        self.registry_file.write_text(json.dumps(items[:500], indent=2), encoding="utf-8")

    def list_datasets(self) -> List[Dict[str, Any]]:
        try:
            return json.loads(self.registry_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []

    def delete_dataset(self, dataset_name: str) -> Dict[str, Any]:
        """Remove all catalog rows for a dataset filename and delete associated files + markers."""
        safe = Path(dataset_name).name
        items = self.list_datasets()
        removed = [row for row in items if row.get("dataset") == safe]
        if not removed:
            return {"deleted": False, "error": "not_found", "message": f"No catalog entries for {safe}."}

        try:
            from .integrations import minio_util
        except ImportError:
            minio_util = None  # type: ignore

        for row in removed:
            lf = row.get("landing_file")
            if lf:
                lp = self.landing_dir / lf
                if lp.exists():
                    try:
                        lp.unlink()
                    except OSError:
                        pass
                proc = self.processing_dir / Path(lf).name
                if proc.exists():
                    try:
                        proc.unlink()
                    except OSError:
                        pass
                if minio_util:
                    minio_util.remove_landing_object(Path(lf).name)

        for path in (self.published_dir / safe, self.data_dir / safe, self.external_dir / safe):
            if path.exists():
                try:
                    path.unlink()
                except OSError:
                    pass

        for suffix in (".analytics_ready", ".ok"):
            marker = self.activated_dir / f"{safe}{suffix}"
            if marker.exists():
                try:
                    marker.unlink()
                except OSError:
                    pass

        new_items = [row for row in items if row.get("dataset") != safe]
        self.registry_file.write_text(json.dumps(new_items[:500], indent=2), encoding="utf-8")
        return {"deleted": True, "dataset": safe, "removed_entries": len(removed)}

    def preview_dataset(self, dataset_name: str, limit: int = 25) -> Dict[str, Any]:
        safe_name = Path(dataset_name).name
        candidates = [
            self.data_dir / safe_name,
            self.external_dir / safe_name,
            self.published_dir / safe_name,
        ]
        target = next((path for path in candidates if path.exists()), None)
        if target is None:
            for row in self.list_datasets():
                if row.get("dataset") == safe_name and row.get("landing_file") and row.get("pipeline_status") == "landed":
                    lp = self.landing_dir / row["landing_file"]
                    if lp.exists():
                        target = lp
                        break
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

    def __init__(self, data_dir: Path, external_dir: Path, activated_dir: Optional[Path] = None):
        self.data_dir = data_dir
        self.external_dir = external_dir
        self.activated_dir = activated_dir or (data_dir / "uploads" / "activated")

    def _file_is_analytics_ready(self, file_path: Path) -> bool:
        name = file_path.name
        return (self.activated_dir / f"{name}.analytics_ready").exists()

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

    def _csv_included_for_query(self, path: Path, *, is_external: bool) -> bool:
        if path.name.startswith("__") or not path.exists() or path.stat().st_size == 0:
            return False
        if is_external:
            return True
        if path.name not in MetricsService.DASHBOARD_GATED:
            return True
        # Gated finance tables: same rule as dashboard — marker or non-empty file on disk.
        return self._file_is_analytics_ready(path) or path.stat().st_size > 0

    def _iter_csv_files(self) -> List[Path]:
        files: List[Path] = []
        if self.data_dir.exists():
            for path in sorted(self.data_dir.glob("*.csv")):
                if self._csv_included_for_query(path, is_external=False):
                    files.append(path)
        if self.external_dir.exists():
            for path in sorted(self.external_dir.glob("*.csv")):
                if self._csv_included_for_query(path, is_external=True):
                    files.append(path)
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

