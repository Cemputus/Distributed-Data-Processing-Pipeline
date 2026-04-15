-- CEN Query — 10 read-only examples (SQLite). Full merged reference: docs/sample_sql.sql
-- Tables = basenames of analytics_ready CSVs in DATA_DIR (e.g. dim_customers.csv → dim_customers).
-- Validate: python scripts/validate_sql_examples.py

-- CEN1
SELECT 'dim_customers' AS t, COUNT(*) AS n FROM dim_customers
UNION ALL SELECT 'dim_accounts', COUNT(*) FROM dim_accounts
UNION ALL SELECT 'dim_merchants', COUNT(*) FROM dim_merchants
UNION ALL SELECT 'fact_transactions', COUNT(*) FROM fact_transactions;

-- CEN2
SELECT customer_id, full_name, region FROM dim_customers LIMIT 15;

-- CEN3
SELECT c.customer_id, c.full_name, COUNT(a.account_id) AS account_count
FROM dim_customers c
LEFT JOIN dim_accounts a ON c.customer_id = a.customer_id
GROUP BY c.customer_id, c.full_name
ORDER BY account_count DESC LIMIT 25;

-- CEN4
SELECT m.merchant_name, COUNT(t.transaction_id) AS txn_count,
       SUM(CAST(t.amount AS REAL)) AS total_amount_ugx
FROM fact_transactions t
JOIN dim_merchants m ON t.merchant_id = m.merchant_id
GROUP BY m.merchant_id, m.merchant_name
ORDER BY txn_count DESC LIMIT 15;

-- CEN5
SELECT c.customer_id, c.full_name, COUNT(f.alert_id) AS alert_count
FROM dim_customers c
LEFT JOIN fact_fraud_alerts f ON c.customer_id = f.customer_id
GROUP BY c.customer_id, c.full_name
HAVING alert_count > 0
ORDER BY alert_count DESC LIMIT 20;

-- CEN6
SELECT COUNT(*) AS loans, SUM(CAST(principal_amount AS REAL)) AS total_principal_ugx FROM fact_loans;

-- CEN7
SELECT region, COUNT(*) AS branches FROM dim_branches GROUP BY region ORDER BY branches DESC;

-- CEN8
SELECT account_id, customer_id, CAST(current_balance AS REAL) AS current_balance
FROM dim_accounts ORDER BY current_balance DESC LIMIT 15;

-- CEN9
SELECT merchant_id, merchant_name FROM dim_merchants ORDER BY merchant_name LIMIT 20;

-- CEN10
WITH ac AS (SELECT customer_id, COUNT(*) AS n FROM dim_accounts GROUP BY customer_id)
SELECT c.full_name, ac.n AS account_count
FROM ac JOIN dim_customers c ON c.customer_id = ac.customer_id
ORDER BY ac.n DESC LIMIT 15;
