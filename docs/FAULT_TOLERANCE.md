# Fault Tolerance Mechanisms

## Failure scenarios

### 1) Spark worker interruption
- Action: stop `spark-worker` container during DAG run.
- Expected behavior: Spark retries tasks; DAG task retries if configured.
- Evidence: Airflow logs + Spark UI failed/retried stages.

### 2) Postgres temporary unavailability
- Action: restart `postgres` while load task is queued/running.
- Expected behavior: Airflow `load_curated_to_postgres` task retries and succeeds after DB recovery.
- Evidence: Task retry logs and final successful load.

### 3) Network/transient download failure during image build
- Mitigation implemented in Airflow Dockerfile:
  - retriable `curl` with `--retry-all-errors`
  - archive integrity check `tar -tzf` before extraction

## Recovery strategy
- Use `restart: unless-stopped` for core services.
- Use Airflow task retries for ETL critical steps.
- Keep idempotent loads (`TRUNCATE` + deterministic insert per run) to avoid duplicate curated data.

