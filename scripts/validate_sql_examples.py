"""
Validate CEN Query examples against local DATA_DIR (analytics_ready CSVs only).
Optionally smoke-test BigQuery public examples if GOOGLE_APPLICATION_CREDENTIALS is set.

Usage (from repo root):
  python scripts/validate_sql_examples.py
  set DATA_DIR=D:\\path\\to\\data\\fintech && python scripts/validate_sql_examples.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
BACKEND = REPO / "apps" / "backend"
sys.path.insert(0, str(BACKEND))

# Default local demo data
os.environ.setdefault("DATA_DIR", str(REPO / "data" / "fintech"))

from app.config import Settings  # noqa: E402
from app.services import CENQueryService  # noqa: E402

# Ten CEN examples (must match docs/cen_query_examples.sql)
CEN_EXAMPLES: list[tuple[str, str]] = [
    (
        "CEN1",
        """SELECT 'dim_customers' AS t, COUNT(*) AS n FROM dim_customers
UNION ALL SELECT 'dim_accounts', COUNT(*) FROM dim_accounts
UNION ALL SELECT 'dim_merchants', COUNT(*) FROM dim_merchants
UNION ALL SELECT 'fact_transactions', COUNT(*) FROM fact_transactions""",
    ),
    ("CEN2", "SELECT customer_id, full_name, region FROM dim_customers LIMIT 15"),
    (
        "CEN3",
        """SELECT c.customer_id, c.full_name, COUNT(a.account_id) AS account_count
FROM dim_customers c
LEFT JOIN dim_accounts a ON c.customer_id = a.customer_id
GROUP BY c.customer_id, c.full_name
ORDER BY account_count DESC LIMIT 25""",
    ),
    (
        "CEN4",
        """SELECT m.merchant_name, COUNT(t.transaction_id) AS txn_count,
SUM(CAST(t.amount AS REAL)) AS total_amount_ugx
FROM fact_transactions t
JOIN dim_merchants m ON t.merchant_id = m.merchant_id
GROUP BY m.merchant_id, m.merchant_name
ORDER BY txn_count DESC LIMIT 15""",
    ),
    (
        "CEN5",
        """SELECT c.customer_id, c.full_name, COUNT(f.alert_id) AS alert_count
FROM dim_customers c
LEFT JOIN fact_fraud_alerts f ON c.customer_id = f.customer_id
GROUP BY c.customer_id, c.full_name
HAVING alert_count > 0
ORDER BY alert_count DESC LIMIT 20""",
    ),
    (
        "CEN6",
        "SELECT COUNT(*) AS loans, SUM(CAST(principal_amount AS REAL)) AS total_principal_ugx FROM fact_loans",
    ),
    ("CEN7", "SELECT region, COUNT(*) AS branches FROM dim_branches GROUP BY region ORDER BY branches DESC"),
    (
        "CEN8",
        """SELECT account_id, customer_id, CAST(current_balance AS REAL) AS current_balance
FROM dim_accounts ORDER BY current_balance DESC LIMIT 15""",
    ),
    ("CEN9", "SELECT merchant_id, merchant_name FROM dim_merchants ORDER BY merchant_name LIMIT 20"),
    (
        "CEN10",
        """WITH ac AS (SELECT customer_id, COUNT(*) AS n FROM dim_accounts GROUP BY customer_id)
SELECT c.full_name, ac.n AS account_count
FROM ac JOIN dim_customers c ON c.customer_id = ac.customer_id
ORDER BY ac.n DESC LIMIT 15""",
    ),
]

BQ_EXAMPLES: list[tuple[str, str]] = [
    ("BQ1", "SELECT CURRENT_TIMESTAMP() AS server_ts"),
    ("BQ2", "SELECT @@project_id AS project_id"),
    (
        "BQ3",
        """SELECT word, word_count FROM `bigquery-public-data.samples.shakespeare`
WHERE corpus = 'hamlet' AND word_count > 100 ORDER BY word_count DESC LIMIT 20""",
    ),
    (
        "BQ4",
        "SELECT repository_name, type, created_at FROM `bigquery-public-data.samples.github_timeline` LIMIT 10",
    ),
    (
        "BQ5",
        """SELECT name, gender, number FROM `bigquery-public-data.usa_names.usa_1910_2013`
WHERE state = 'TX' AND year = 2010 ORDER BY number DESC LIMIT 15""",
    ),
    (
        "BQ6",
        """SELECT corpus, COUNT(*) AS word_rows FROM `bigquery-public-data.samples.shakespeare`
GROUP BY corpus ORDER BY word_rows DESC LIMIT 10""",
    ),
    (
        "BQ7",
        """SELECT year, SUM(number) AS births FROM `bigquery-public-data.usa_names.usa_1910_2013`
WHERE state = 'CA' GROUP BY year ORDER BY year DESC LIMIT 15""",
    ),
    (
        "BQ8",
        """SELECT table_name, table_type FROM `bigquery-public-data.samples.INFORMATION_SCHEMA.TABLES`
WHERE table_schema = 'samples' ORDER BY table_name LIMIT 30""",
    ),
    (
        "BQ9",
        """SELECT name, gender, number FROM `bigquery-public-data.usa_names.usa_1910_2013`
WHERE year = 2000 AND state = 'CA' ORDER BY number DESC LIMIT 10""",
    ),
    (
        "BQ10",
        """SELECT word, corpus FROM `bigquery-public-data.samples.shakespeare`
WHERE LOWER(word) LIKE 'king%' LIMIT 15""",
    ),
]


def _cen_service() -> CENQueryService:
    return CENQueryService(
        data_dir=Settings.DATA_DIR,
        external_dir=Settings.EXTERNAL_DIR,
        activated_dir=Settings.ACTIVATED_DIR,
    )


def run_cen() -> int:
    svc = _cen_service()
    failed = 0
    for label, sql in CEN_EXAMPLES:
        try:
            out = svc.execute_readonly_query(sql, row_limit=250)
            print(f"  [OK] {label}  rows={out.get('row_count')}")
        except Exception as e:
            print(f"  [!!] {label}  {e}")
            failed += 1
    return failed


def run_bq() -> int:
    cred = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    if not cred or not Path(cred).is_file():
        print("  BigQuery: skipped (GOOGLE_APPLICATION_CREDENTIALS not set or file missing)")
        return 0
    try:
        from app.integrations import bigquery_client as bq
    except Exception as e:
        print(f"  BigQuery: import failed: {e}")
        return 0
    failed = 0
    for label, sql in BQ_EXAMPLES:
        try:
            out = bq.run_readonly_query(sql, max_rows=100)
            print(f"  [OK] {label}  rows={out.get('row_count')}")
        except Exception as e:
            print(f"  [!!] {label}  {e}")
            failed += 1
    return failed


def main() -> int:
    print(f"DATA_DIR={Settings.DATA_DIR}")
    print(f"ACTIVATED_DIR={Settings.ACTIVATED_DIR}")
    print("CEN Query examples:")
    c = run_cen()
    print("BigQuery examples:")
    b = run_bq()
    if c or b:
        print(f"Done with failures: CEN={c}, BQ={b}")
        return 1
    print("All executed examples succeeded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
