-- Second database for curated pipeline outputs (warehouse-style SQL validation).
CREATE DATABASE analytics;

\connect analytics;

CREATE SCHEMA IF NOT EXISTS analytics_curated;

CREATE TABLE IF NOT EXISTS analytics_curated.kpi_daily_transactions (
    transaction_date DATE,
    transaction_count BIGINT,
    total_amount_ugx NUMERIC(18,2),
    failed_count BIGINT
);

CREATE TABLE IF NOT EXISTS analytics_curated.kpi_customer_risk (
    customer_id TEXT,
    transaction_count BIGINT,
    total_amount_ugx NUMERIC(18,2),
    fraud_alert_count BIGINT,
    loan_count BIGINT
);

CREATE TABLE IF NOT EXISTS analytics_curated.kpi_top_merchants (
    merchant_id TEXT,
    transaction_count BIGINT,
    total_amount_ugx NUMERIC(18,2),
    merchant_name TEXT
);
