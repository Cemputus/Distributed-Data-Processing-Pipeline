-- =============================================================================
-- BigQuery sample queries for cen_analytics
-- Project/Dataset: cloud-project-493415.cen_analytics
-- =============================================================================

-- 1) Quick table row counts
SELECT 'dim_customers' AS table_name, COUNT(*) AS row_count FROM `cloud-project-493415.cen_analytics.dim_customers`
UNION ALL
SELECT 'dim_accounts', COUNT(*) FROM `cloud-project-493415.cen_analytics.dim_accounts`
UNION ALL
SELECT 'fact_transactions', COUNT(*) FROM `cloud-project-493415.cen_analytics.fact_transactions`
UNION ALL
SELECT 'fact_loans', COUNT(*) FROM `cloud-project-493415.cen_analytics.fact_loans`;

-- 2) Daily transaction volume (last 30 days)
SELECT
  DATE(transaction_date) AS tx_date,
  COUNT(*) AS tx_count,
  SUM(amount_ugx) AS total_amount_ugx
FROM `cloud-project-493415.cen_analytics.fact_transactions`
WHERE DATE(transaction_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY tx_date
ORDER BY tx_date DESC;

-- 3) Top merchants by transaction count
SELECT
  merchant_name,
  COUNT(*) AS tx_count
FROM `cloud-project-493415.cen_analytics.fact_transactions`
GROUP BY merchant_name
ORDER BY tx_count DESC
LIMIT 20;

-- 4) Top merchants by amount
SELECT
  merchant_name,
  SUM(amount_ugx) AS total_amount_ugx
FROM `cloud-project-493415.cen_analytics.fact_transactions`
GROUP BY merchant_name
ORDER BY total_amount_ugx DESC
LIMIT 20;

-- 5) Transactions by channel
SELECT
  channel,
  COUNT(*) AS tx_count,
  SUM(amount_ugx) AS total_amount_ugx
FROM `cloud-project-493415.cen_analytics.fact_transactions`
GROUP BY channel
ORDER BY tx_count DESC;

-- 6) Fraud rate by channel
SELECT
  channel,
  COUNT(*) AS total_tx,
  SUM(CASE WHEN is_fraud = TRUE THEN 1 ELSE 0 END) AS fraud_tx,
  SAFE_DIVIDE(SUM(CASE WHEN is_fraud = TRUE THEN 1 ELSE 0 END), COUNT(*)) AS fraud_rate
FROM `cloud-project-493415.cen_analytics.fact_transactions`
GROUP BY channel
ORDER BY fraud_rate DESC;

-- 7) Loan portfolio by status
SELECT
  loan_status,
  COUNT(*) AS loan_count,
  SUM(principal_ugx) AS total_principal_ugx,
  AVG(principal_ugx) AS avg_principal_ugx
FROM `cloud-project-493415.cen_analytics.fact_loans`
GROUP BY loan_status
ORDER BY loan_count DESC;

-- 8) Customer regional distribution
SELECT
  region,
  COUNT(*) AS customer_count
FROM `cloud-project-493415.cen_analytics.dim_customers`
GROUP BY region
ORDER BY customer_count DESC
LIMIT 20;

-- 9) High-value customers (tx + loans)
WITH tx AS (
  SELECT customer_id, SUM(amount_ugx) AS total_tx_ugx
  FROM `cloud-project-493415.cen_analytics.fact_transactions`
  GROUP BY customer_id
),
ln AS (
  SELECT customer_id, SUM(principal_ugx) AS total_loans_ugx
  FROM `cloud-project-493415.cen_analytics.fact_loans`
  GROUP BY customer_id
)
SELECT
  c.customer_id,
  c.full_name,
  c.region,
  IFNULL(tx.total_tx_ugx, 0) AS total_tx_ugx,
  IFNULL(ln.total_loans_ugx, 0) AS total_loans_ugx
FROM `cloud-project-493415.cen_analytics.dim_customers` c
LEFT JOIN tx USING (customer_id)
LEFT JOIN ln USING (customer_id)
ORDER BY total_tx_ugx DESC, total_loans_ugx DESC
LIMIT 50;

-- 10) Create dashboard KPI view
CREATE OR REPLACE VIEW `cloud-project-493415.cen_analytics.vw_dashboard_kpis` AS
SELECT
  (SELECT COUNT(*) FROM `cloud-project-493415.cen_analytics.dim_customers`) AS customers,
  (SELECT COUNT(*) FROM `cloud-project-493415.cen_analytics.dim_accounts`) AS accounts,
  (SELECT COUNT(*) FROM `cloud-project-493415.cen_analytics.fact_transactions`) AS transactions,
  (SELECT COUNT(*) FROM `cloud-project-493415.cen_analytics.fact_loans`) AS loans,
  (SELECT SUM(amount_ugx) FROM `cloud-project-493415.cen_analytics.fact_transactions`) AS tx_volume_ugx,
  (SELECT SUM(principal_ugx) FROM `cloud-project-493415.cen_analytics.fact_loans`) AS loan_principal_ugx;

