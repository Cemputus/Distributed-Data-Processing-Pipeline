# Validation Results Template

Use this sheet to capture final evidence for Milestone 3/5.

## Run metadata
- DAG run ID:
- Execution date:
- Operator:
- Data source path: `data/fintech/`

## Query results

### Query 1 (daily KPI aggregate)
- `daily_rows`:
- `total_transactions`:
- `total_amount_ugx`:
- Pass criteria: all values > 0

### Query 2 (top merchants)
- Screenshot attached: Yes/No
- Row count returned (expected 10): 
- Pass criteria: rows sorted descending by `transaction_count`

### Query 3 (customer risk sanity)
- `customer_rows`:
- `fraud_alert_total`:
- `loan_total`:
- Pass criteria: all values >= 0 and `customer_rows` > 0

