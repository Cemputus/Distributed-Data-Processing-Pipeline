# Milestone 4 Demo Checklist (2-3 minutes)

## 1. Architecture walkthrough (30-40s)
- Show `docker-compose.yml` services: frontend, backend, airflow, spark, hadoop, minio, postgres.
- Show architecture diagram in `docs/ARCHITECTURE.md`.

## 2. Live pipeline run (60-90s)
- Open Airflow UI and trigger `distributed_pipeline_scaffold`.
- Show tasks: `validate_input_files` -> `run_spark_transform` -> `load_curated_to_postgres`.
- Open Spark UI to show execution evidence.

## 3. Result-store verification (30-40s)
- Run SQL from `docs/validation_queries.sql` against `analytics` DB.
- Show output counts and top merchants.

## 4. Security + reliability highlights (20-30s)
- Mention read-only mounts, auth-enabled Airflow UI, and retry behavior.
- Reference `docs/SECURITY_CONFIGURATION.md` and `docs/FAULT_TOLERANCE.md`.

