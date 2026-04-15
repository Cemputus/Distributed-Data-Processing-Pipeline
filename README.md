# Distributed Data Processing Pipeline (DSC3219)

Open-source stack: **Docker**, **React frontend**, **Flask backend**, **Apache Airflow**, **PostgreSQL**, **MinIO** (S3-compatible). **Spark** and **Hadoop** are added in Milestone 2/3 per `docs/MILESTONE1_SRS.md`.

## Prerequisites

- [Docker Desktop](https://docs.docker.com/desktop/) (Compose v2)
- First `docker compose up` builds a custom Airflow image (includes Apache Spark **3.5.4** `spark-submit` client to match the **Spark 3.5** Bitnami cluster).

## First-time bring-up

From the repository root:

```powershell
docker compose up -d --build
```

`airflow-init` runs database migrations and creates the default admin user before the webserver and scheduler start.

- **Airflow UI:** http://localhost:8080 — sign in with `airflow` / `airflow`
- **React frontend:** http://localhost:5173
- **Flask API:** http://localhost:5000 (`/api/overview`, `/health`)
- **Spark Standalone (master UI):** http://localhost:8085
- **Hadoop NameNode UI:** http://localhost:9870
- **Hadoop YARN ResourceManager UI:** http://localhost:8088
- **Hadoop Job History UI:** http://localhost:8188
- **MinIO console:** http://localhost:9001 — `minioadmin` / `minioadmin` (override via `.env` from `.env.example`)

After startup, trigger DAG **`tiny_pyspark_standalone`** (smoke test), then run **`distributed_pipeline_scaffold`** for full ingest-transform-load.

PostgreSQL also has database **`analytics`** (see `infra/postgres/init.sql`) for warehouse-style validation queries.

## Layout

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | React, Flask API, Postgres, MinIO, Airflow, Spark, Hadoop (HDFS + YARN) |
| `apps/frontend/` | React dashboard (Vite) |
| `apps/backend/` | Flask API reading fintech CSV metrics |
| `infra/docker/airflow/Dockerfile` | Airflow + Spark client (`SPARK_HOME`) |
| `infra/airflow/dags/` | Airflow DAGs (`tiny_pyspark_standalone` + `distributed_pipeline_scaffold`) |
| `infra/spark/jobs/` | PySpark scripts (mounted at `/opt/spark-jobs` in containers) |
| `infra/postgres/` | DB init scripts |
| `data/fintech/` | 10 fintech CSV datasets |
| `docs/` | SRS, validation SQL, architecture, scalability/fault/security evidence |

Place CSVs in `data/fintech/` locally (gitignored); sync into MinIO or mounted volumes in later milestones.

## Stop

```powershell
docker compose down
```

To remove volumes (wipe DB and MinIO data): `docker compose down -v`

## Hadoop profile (optional heavy services)

Hadoop services are grouped under the `hadoop` profile:

```powershell
docker compose --profile hadoop up -d
```

## Validation runbook

1. Trigger DAG `distributed_pipeline_scaffold` in Airflow.
2. Connect to Postgres `analytics` DB.
3. Run queries in `docs/validation_queries.sql`.
4. Record outputs using `docs/VALIDATION_RESULTS_TEMPLATE.md`.
