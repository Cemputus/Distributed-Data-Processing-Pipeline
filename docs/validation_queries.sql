-- Validation & smoke-test SQL — warehouse KPIs + BigQuery templates + pointer to CEN tests
-- Canonical merged examples (10 CEN + 10 BigQuery): docs/sample_sql.sql
-- CI/local smoke (CEN + public BigQuery when GOOGLE_APPLICATION_CREDENTIALS + google-cloud-bigquery): scripts/validate_sql_examples.py

-- =============================================================================
-- A) Spark / warehouse / BigQuery curated zone (analytics_curated.*)
--     Use when your ETL pipeline has created these tables in your warehouse.
--     In BigQuery, qualify: `YOUR_PROJECT.analytics_curated.TABLE`
-- =============================================================================

-- W1) Daily KPI table non-empty and totals
SELECT COUNT(*) AS daily_rows, SUM(transaction_count) AS total_transactions,
       SUM(total_amount_ugx) AS total_amount_ugx
FROM analytics_curated.kpi_daily_transactions;

-- W2) Top merchants — top 10
SELECT merchant_id, merchant_name, transaction_count, total_amount_ugx
FROM analytics_curated.kpi_top_merchants
ORDER BY transaction_count DESC, total_amount_ugx DESC LIMIT 10;

-- W3) Customer risk sanity
SELECT COUNT(*) AS customer_rows, SUM(fraud_alert_count) AS fraud_alert_total,
       SUM(loan_count) AS loan_total
FROM analytics_curated.kpi_customer_risk;

-- W4) Daily trend — last 14 days
SELECT transaction_date, transaction_count, total_amount_ugx, failed_count
FROM analytics_curated.kpi_daily_transactions
ORDER BY transaction_date DESC LIMIT 14;

-- W5) Concentration — top 3 share of top 10 by amount
WITH ranked AS (
  SELECT total_amount_ugx, ROW_NUMBER() OVER (ORDER BY total_amount_ugx DESC) AS rnk
  FROM analytics_curated.kpi_top_merchants
)
SELECT ROUND(100.0 * SUM(CASE WHEN rnk <= 3 THEN total_amount_ugx ELSE 0 END)
       / NULLIF(SUM(CASE WHEN rnk <= 10 THEN total_amount_ugx ELSE 0 END), 0), 2) AS pct_top3_of_top10
FROM ranked WHERE rnk <= 10;

-- W6) Risk outliers — fraud and loans
SELECT customer_id, fraud_alert_count, loan_count, transaction_count
FROM analytics_curated.kpi_customer_risk
WHERE fraud_alert_count > 0 AND loan_count > 0
ORDER BY fraud_alert_count DESC, loan_count DESC LIMIT 25;

-- W7) Data quality — bad rows in daily KPI (expect empty when healthy)
SELECT * FROM analytics_curated.kpi_daily_transactions
WHERE transaction_count IS NULL OR total_amount_ugx IS NULL
   OR (transaction_count = 0 AND total_amount_ugx > 0);

-- W8) Top merchants row stats
SELECT COUNT(*) AS merchant_rows, MIN(transaction_count) AS min_txn, MAX(transaction_count) AS max_txn
FROM analytics_curated.kpi_top_merchants;


-- =============================================================================
-- B) BigQuery project hygiene (replace PROJECT_ID; requires IAM + enabled APIs)
-- =============================================================================

-- BQ-V1) List datasets (use your project, e.g. cloud-project-493415)
-- SELECT schema_name FROM `cloud-project-493415.INFORMATION_SCHEMA.SCHEMATA` ORDER BY 1;

-- BQ-V2) Public sanity (no project tables required)
-- SELECT CURRENT_TIMESTAMP() ts, @@project_id AS project_id;

-- BQ-V3) Your default dataset tables (after you create cen_analytics and load data)
-- SELECT table_name FROM `cloud-project-493415.cen_analytics.INFORMATION_SCHEMA.TABLES`
-- WHERE table_type = 'BASE TABLE' ORDER BY table_name;


-- =============================================================================
-- C) CEN Query — run Part 1 in docs/sample_sql.sql in the app Query tab (CSV · SQL)
-- =============================================================================
