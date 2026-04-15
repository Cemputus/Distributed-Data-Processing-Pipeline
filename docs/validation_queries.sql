-- DSC3219 validation queries for curated warehouse outputs.
-- Run against analytics database after DAG `distributed_pipeline_scaffold` succeeds.

-- Q1: Daily KPI table should be non-empty and have realistic totals.
SELECT
  COUNT(*) AS daily_rows,
  SUM(transaction_count) AS total_transactions,
  SUM(total_amount_ugx) AS total_amount_ugx
FROM analytics_curated.kpi_daily_transactions;

-- Q2: Top merchants table must contain top 10 ranked records with positive totals.
SELECT
  merchant_id,
  merchant_name,
  transaction_count,
  total_amount_ugx
FROM analytics_curated.kpi_top_merchants
ORDER BY transaction_count DESC, total_amount_ugx DESC
LIMIT 10;

-- Q3: Customer risk table sanity check.
SELECT
  COUNT(*) AS customer_rows,
  SUM(fraud_alert_count) AS fraud_alert_total,
  SUM(loan_count) AS loan_total
FROM analytics_curated.kpi_customer_risk;

