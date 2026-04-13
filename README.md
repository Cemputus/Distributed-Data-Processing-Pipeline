# Distributed Data Processing Pipeline (DSC3219)

Open-source stack: **Docker**, **Apache Airflow**, **PostgreSQL**, **MinIO** (S3-compatible). **Spark** and **Hadoop** are added in Milestone 2/3 per `docs/MILESTONE1_SRS.md`.

## Prerequisites

- [Docker Desktop](https://docs.docker.com/desktop/) (Compose v2)
- First `docker compose up` builds a custom Airflow image (includes Apache Spark **3.5.4** `spark-submit` client to match the **Spark 3.5** Bitnami cluster).

## First-time bring-up

From the repository root:

```powershell
docker compose up -d
```

`airflow-init` runs database migrations and creates the default admin user before the webserver and scheduler start.

- **Airflow UI:** http://localhost:8080 — sign in with `airflow` / `airflow`
- **Spark Standalone (master UI):** http://localhost:8085
- **MinIO console:** http://localhost:9001 — `minioadmin` / `minioadmin` (override via `.env` from `.env.example`)

After startup, trigger DAG **`tiny_pyspark_standalone`** — it runs `spark-submit` in **cluster** mode against `spark://spark-master:7077` using `spark/jobs/tiny_job.py`.

PostgreSQL also has database **`analytics`** (see `config/postgres/init.sql`) for warehouse-style validation queries.

## Layout

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | Postgres, MinIO, Airflow, Spark master + worker |
| `docker/airflow/Dockerfile` | Airflow + Spark client (`SPARK_HOME`) |
| `airflow/dags/` | Airflow DAGs (`tiny_pyspark_standalone` submits PySpark) |
| `spark/jobs/` | PySpark scripts (mounted at `/opt/spark-jobs` in containers) |
| `config/postgres/` | DB init scripts |
| `docs/` | SRS and course docs |

Place CSVs in `Synthetic_Data/` locally (gitignored); sync into MinIO or mounted volumes in later milestones.

## Stop

```powershell
docker compose down
```

To remove volumes (wipe DB and MinIO data): `docker compose down -v`
