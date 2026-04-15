-- =============================================================================
-- Console — merged SQL reference: CEN Query · BigQuery · optional warehouse checks
-- =============================================================================
-- Smoke-test locally: python scripts/validate_sql_examples.py (CEN always; BigQuery if creds + google-cloud-bigquery)
-- =============================================================================
-- Where to run
--   • CEN Query tab (CSV/SQL): SQLite in-memory, tables = analytics_ready CSV basenames.
--   • BigQuery tab: Google Cloud BigQuery API; use backticks: `project.dataset.table`
--   • Warehouse validation: only when curated tables exist (e.g. Spark → BigQuery/Postgres).
--
-- CEN naming: dim_customers.csv → table dim_customers. Files must have .analytics_ready in uploads/activated/.
-- BigQuery: replace PROJECT_ID / YOUR_DATASET / YOUR_TABLE from the in-app catalog where noted.
-- =============================================================================


-- ##############################################################################
-- PART 1 — CEN Query (10 examples) — SELECT / WITH only; one statement per block
-- ##############################################################################

-- CEN1) Row counts for finance tables currently loaded (adjust table list to match your markers)
SELECT 'dim_customers' AS t, COUNT(*) AS n FROM dim_customers
UNION ALL SELECT 'dim_accounts', COUNT(*) FROM dim_accounts
UNION ALL SELECT 'dim_merchants', COUNT(*) FROM dim_merchants
UNION ALL SELECT 'fact_transactions', COUNT(*) FROM fact_transactions;

-- CEN2) Sample customers
SELECT customer_id, full_name, region FROM dim_customers LIMIT 15;

-- CEN3) Customers with account coverage
SELECT c.customer_id, c.full_name, COUNT(a.account_id) AS account_count
FROM dim_customers c
LEFT JOIN dim_accounts a ON c.customer_id = a.customer_id
GROUP BY c.customer_id, c.full_name
ORDER BY account_count DESC LIMIT 25;

-- CEN4) Top merchants by transactions (requires fact_transactions + dim_merchants)
SELECT m.merchant_name, COUNT(t.transaction_id) AS txn_count,
       SUM(CAST(t.amount AS REAL)) AS total_amount_ugx
FROM fact_transactions t
JOIN dim_merchants m ON t.merchant_id = m.merchant_id
GROUP BY m.merchant_id, m.merchant_name
ORDER BY txn_count DESC LIMIT 15;

-- CEN5) Fraud alerts by customer (requires fact_fraud_alerts + dim_customers)
SELECT c.customer_id, c.full_name, COUNT(f.alert_id) AS alert_count
FROM dim_customers c
LEFT JOIN fact_fraud_alerts f ON c.customer_id = f.customer_id
GROUP BY c.customer_id, c.full_name
HAVING alert_count > 0
ORDER BY alert_count DESC LIMIT 20;

-- CEN6) Loans summary (requires fact_loans)
SELECT COUNT(*) AS loans, SUM(CAST(principal_amount AS REAL)) AS total_principal_ugx
FROM fact_loans;

-- CEN7) Branch rollup by region (uses dim_branches)
SELECT region, COUNT(*) AS branches FROM dim_branches GROUP BY region ORDER BY branches DESC;

-- CEN8) Account balances — top by current_balance
SELECT account_id, customer_id, CAST(current_balance AS REAL) AS current_balance
FROM dim_accounts ORDER BY current_balance DESC LIMIT 15;

-- CEN9) Merchants list (small dimension sample)
SELECT merchant_id, merchant_name FROM dim_merchants ORDER BY merchant_name LIMIT 20;

-- CEN10) WITH — customer tiers by account count
WITH ac AS (
  SELECT customer_id, COUNT(*) AS n FROM dim_accounts GROUP BY customer_id
)
SELECT c.full_name, ac.n AS account_count
FROM ac
JOIN dim_customers c ON c.customer_id = ac.customer_id
ORDER BY ac.n DESC LIMIT 15;


-- ##############################################################################
-- PART 2 — BigQuery (10 examples) — SELECT / WITH; public datasets work without your tables
-- ##############################################################################

-- BQ1) Server time
SELECT CURRENT_TIMESTAMP() AS server_ts;

-- BQ2) Project running the job
SELECT @@project_id AS project_id;

-- BQ3) Shakespeare sample (public)
SELECT word, word_count
FROM `bigquery-public-data.samples.shakespeare`
WHERE corpus = 'hamlet' AND word_count > 100
ORDER BY word_count DESC LIMIT 20;

-- BQ4) GitHub timeline slice (public; column names vary by sample version)
SELECT repository_name, type, created_at
FROM `bigquery-public-data.samples.github_timeline`
LIMIT 10;

-- BQ5) USA names (public)
SELECT name, gender, number
FROM `bigquery-public-data.usa_names.usa_1910_2013`
WHERE state = 'TX' AND year = 2010
ORDER BY number DESC LIMIT 15;

-- BQ6) Shakespeare — distinct corpora (small scan)
SELECT corpus, COUNT(*) AS word_rows
FROM `bigquery-public-data.samples.shakespeare`
GROUP BY corpus
ORDER BY word_rows DESC LIMIT 10;

-- BQ7) USA names — year range summary (single-year slice)
SELECT year, SUM(number) AS births
FROM `bigquery-public-data.usa_names.usa_1910_2013`
WHERE state = 'CA'
GROUP BY year
ORDER BY year DESC LIMIT 15;

-- BQ8) INFORMATION_SCHEMA — tables in public `samples` dataset (no PROJECT_ID substitute)
SELECT table_name, table_type
FROM `bigquery-public-data.samples.INFORMATION_SCHEMA.TABLES`
WHERE table_schema = 'samples'
ORDER BY table_name LIMIT 30;

-- BQ9) USA names — another slice (year + state filter; small scan)
SELECT name, gender, number
FROM `bigquery-public-data.usa_names.usa_1910_2013`
WHERE year = 2000 AND state = 'CA'
ORDER BY number DESC LIMIT 10;

-- BQ10) Shakespeare — vocabulary filter (indexed-friendly; small LIMIT)
SELECT word, corpus
FROM `bigquery-public-data.samples.shakespeare`
WHERE LOWER(word) LIKE 'king%'
LIMIT 15;

-- (Optional) Your GCP project + analytics dataset (create once in BigQuery; default in .env.example: cen_analytics in US)
-- SELECT * FROM `cloud-project-493415.cen_analytics.dim_merchants` LIMIT 50;
-- SELECT table_name FROM `cloud-project-493415.cen_analytics.INFORMATION_SCHEMA.TABLES`
-- WHERE table_type = 'BASE TABLE' ORDER BY table_name;


-- ##############################################################################
-- PART 3 — Warehouse validation (optional; requires analytics_curated.* or equivalent)
--         Run in BigQuery console or a SQL engine where these tables were materialized.
-- ##############################################################################

-- VAL1) Daily KPI non-empty check
-- SELECT COUNT(*) AS daily_rows, SUM(transaction_count) AS total_txn,
--        SUM(total_amount_ugx) AS total_amount_ugx
-- FROM `cloud-project-493415.analytics_curated.kpi_daily_transactions`;

-- VAL2) Top merchants ranked (template)
-- SELECT merchant_id, merchant_name, transaction_count, total_amount_ugx
-- FROM `cloud-project-493415.analytics_curated.kpi_top_merchants`
-- ORDER BY transaction_count DESC, total_amount_ugx DESC LIMIT 10;

-- See also: docs/validation_queries.sql for the full warehouse script (non–CEN/BQ-console native).

