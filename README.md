# Distributed Data Processing Pipeline

End-to-end **distributed data processing** demo and coursework stack (**DSC3219-style**): ingest CSVs, land in **MinIO**, orchestrate with **Apache Airflow**, transform with **Apache Spark**, expose metrics and operations through a **Flask** API and **React** console, optionally mirror analytics into **Google BigQuery**, and validate curated outputs in **PostgreSQL** (`analytics` schema). Optional **Apache Hadoop** (HDFS/YARN) services run under a Compose profile for storage and runtime demonstrations.

This document is the **primary operator’s guide** for architecture, configuration, API surface, data layout, and troubleshooting.

---

## Table of contents

1. [High-level architecture](#1-high-level-architecture)
2. [Technology stack](#2-technology-stack)
3. [Repository layout](#3-repository-layout)
4. [Prerequisites](#4-prerequisites)
5. [Quick start (Docker Compose)](#5-quick-start-docker-compose)
6. [Services, ports, and default credentials](#6-services-ports-and-default-credentials)
7. [Environment variables](#7-environment-variables)
8. [Data directory and upload pipeline](#8-data-directory-and-upload-pipeline)
9. [Dashboard KPIs and charts](#9-dashboard-kpis-and-charts)
10. [Query workspace: CEN vs BigQuery](#10-query-workspace-cen-vs-bigquery)
11. [Authentication and roles (RBAC)](#11-authentication-and-roles-rbac)
12. [REST API overview](#12-rest-api-overview)
13. [Integrations (Airflow, MinIO, Spark, BigQuery)](#13-integrations-airflow-minio-spark-bigquery)
14. [Airflow DAGs](#14-airflow-dags)
15. [PostgreSQL `analytics` database](#15-postgresql-analytics-database)
16. [Optional Hadoop profile](#16-optional-hadoop-profile)
17. [Development without Docker](#17-development-without-docker)
18. [Validation, SQL examples, and scripts](#18-validation-sql-examples-and-scripts)
19. [Troubleshooting](#19-troubleshooting)
20. [Security](#20-security)
21. [Further documentation](#21-further-documentation)

---

## 1. High-level architecture

Data moves from **files and uploads** through **landing → processing → published**, with **metadata** and **activated** markers for dashboard and ad hoc SQL. Airflow and Spark jobs can consume the same host-mounted paths inside containers.

```mermaid
flowchart TB
  subgraph users [Operators and analysts]
    UI[React Console]
  end
  subgraph api [Flask API]
    KPI[MetricsService KPIs]
    UP[UploadPipelineService]
    CEN[CENQueryService SQLite]
    BQ[BigQuery client read-only]
  end
  subgraph data [Host data/fintech]
    CSV[Root CSVs]
    LAND[uploads/landing]
    PROC[uploads/processing]
    PUB[uploads/published]
    ACT[uploads/activated]
    META[uploads/metadata]
  end
  subgraph object [MinIO]
    S3[S3 bucket fintech-landing]
  end
  subgraph orch [Orchestration]
    AF[Airflow]
    SP[Spark Standalone]
  end
  subgraph db [PostgreSQL]
    AFDB[(airflow metadata)]
    AN[(database analytics)]
  end
  subgraph cloud [Optional GCP]
    BQGCP[BigQuery cen_analytics etc]
  end
  UI --> api
  KPI --> CSV
  UP --> LAND
  UP --> PROC
  UP --> PUB
  UP --> ACT
  UP --> META
  UP --> S3
  CEN --> CSV
  BQ --> BQGCP
  AF --> AFDB
  AF --> SP
```

- **React** calls the **Flask** API with a **Bearer token** after `POST /api/auth/login`.
- **KPIs** and **CEN Query** read **`DATA_DIR`** (default in Docker: `/data` ← host `./data/fintech`).
- **BigQuery** uses **Application Default Credentials** (service account JSON path).

---

## 2. Technology stack

| Concern | Choice | Notes |
|--------|--------|--------|
| UI | React 18, Vite 5 | Tailwind-oriented styling; dev server port **5173** |
| API | Flask 3, Gunicorn | CORS enabled; blueprint under `apps/backend/app/` |
| Auth | Bearer tokens (in-memory store) | User store persisted in `users.json` under metadata |
| Object storage | MinIO | S3-compatible; landing bucket for uploads |
| Orchestration | Apache Airflow 2.8.x (Python 3.11 image) | Custom image adds Spark **3.5.4** tarball for `spark-submit` |
| Compute | Spark **3.5.x** (Bitnami legacy image) | Master + worker; jobs in `infra/spark/jobs` |
| Warehouse (optional) | Google BigQuery | Read-only SQL from API; optional load job on upload |
| Databases | PostgreSQL 15 | Airflow DB + separate **`analytics`** database |
| Hadoop (optional) | HDFS + YARN images (`bde2020`) | Behind `docker compose --profile hadoop` |

---

## 3. Repository layout

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | All runtime services, networks, volumes |
| `apps/frontend/` | React app: `src/`, `vite.config.js`, `Dockerfile` |
| `apps/backend/` | Flask app: `app/main.py`, `app/routes.py`, `app/services.py`, `app/config.py`, `app/integrations/` |
| `infra/docker/airflow/` | Dockerfile extending `apache/airflow` + Spark client |
| `infra/airflow/dags/` | DAG Python files (`tiny_pyspark_standalone`, `distributed_pipeline_scaffold`) |
| `infra/airflow/logs/` | Airflow logs (often gitignored) |
| `infra/spark/jobs/` | PySpark and helper scripts mounted at `/opt/spark-jobs` |
| `infra/postgres/init.sql` | Creates **`analytics`** DB and **`analytics_curated`** tables |
| `data/fintech/` | CSV datasets and full upload pipeline directory tree |
| `secrets/` | GCP JSON and other secrets (gitignored) |
| `docs/` | SRS, architecture, validation SQL, security, scalability, fault tolerance |
| `scripts/` | e.g. `validate_sql_examples.py` for CEN + BigQuery smoke tests |
| `.env.example` | Template for Compose and local overrides |
| `README.md` | This file |

---

## 4. Prerequisites

- **Docker Desktop** with **Compose v2** (Windows, macOS, or Linux).
- Sufficient RAM for Airflow + Spark + Postgres + MinIO (typically **8 GB+** recommended for comfortable local use).
- First **`docker compose up --build`** will pull base images and build the **custom Airflow image** (includes downloading the Spark binary during image build).

---

## 5. Quick start (Docker Compose)

From the repository root:

```powershell
copy .env.example .env
```

Edit **`.env`** as needed (Airflow Fernet key, MinIO, BigQuery paths). Then:

```powershell
docker compose up -d --build
```

- **`airflow-init`** runs migrations and creates the default Airflow admin user (`airflow` / `airflow` unless you change Airflow’s config).
- **Backend** waits on MinIO start; **frontend** waits on backend **healthcheck**.
- Verify API: `curl http://localhost:5000/health` → `{"status":"ok"}`.

To stop:

```powershell
docker compose down
```

To remove named volumes (Postgres data, MinIO blobs, etc.):

```powershell
docker compose down -v
```

---

## 6. Services, ports, and default credentials

### URLs

| Service | URL | Default credentials / notes |
|---------|-----|-----------------------------|
| **Console (React)** | http://localhost:5173 | App login: see [§11](#11-authentication-and-roles-rbac) |
| **Flask API** | http://localhost:5000 | `GET /health` unauthenticated |
| **OpenAPI-style discovery** | http://localhost:5000/api/docs | Lists routes (no auth required for discovery) |
| **Airflow Web UI** | http://localhost:8080 | `airflow` / `airflow` |
| **Spark Master UI** | http://localhost:8085 | Workers and applications |
| **Spark Worker UI (host)** | http://localhost:8086 | Mapped from container port 8081 |
| **MinIO API** | http://localhost:9000 | Access key / secret from `.env` (`minioadmin` default) |
| **MinIO Console** | http://localhost:9001 | Same credentials as MinIO |

### Hadoop (optional profile)

| Service | Host port | UI |
|---------|-----------|-----|
| NameNode | 9870 | http://localhost:9870 |
| YARN ResourceManager | 8088 | http://localhost:8088 |
| MapReduce History | 8188 | http://localhost:8188 |

Start with: `docker compose --profile hadoop up -d`

---

## 7. Environment variables

Variables are loaded by **Docker Compose** from **`.env`** at the repo root. The backend also reads **`DATA_DIR`**, **`GOOGLE_APPLICATION_CREDENTIALS`**, and BigQuery-related keys at runtime.

### Core backend paths (Docker)

| Variable | Typical Docker value | Meaning |
|----------|----------------------|---------|
| `DATA_DIR` | `/data` | Root for finance CSVs; compose mounts `./data/fintech:/data` |
| Derived | `/data/uploads/landing` etc. | See `Settings` in `apps/backend/app/config.py` |

### BigQuery (optional)

| Variable | Purpose |
|----------|---------|
| `BIGQUERY_ENABLED` | `true`/`false` — gates BigQuery API behavior |
| `BIGQUERY_PROJECT_ID` | GCP project id (must match service account JSON) |
| `BIGQUERY_DEFAULT_DATASET` | Hint for UI (e.g. `cen_analytics`) |
| `BIGQUERY_INGEST_DATASET` | Target dataset for optional load jobs |
| `BIGQUERY_DATASET_LOCATION` | Documentation / console alignment (e.g. `US`) |
| `BIGQUERY_AUTO_LOAD_ON_UPLOAD` | If `true`, successful pipeline may load CSV to BigQuery |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON |
| `BIGQUERY_CREDENTIALS_PATH` | Alternative path; config bridges to ADC if the primary path is missing in-container |

**Docker:** place JSON under `./secrets/` and set e.g. `BIGQUERY_CREDENTIALS_PATH=/secrets/your-key.json` (compose mounts `./secrets:/secrets:ro`).

### Airflow / MinIO / Spark (see `.env.example`)

- `AIRFLOW__CORE__FERNET_KEY` — required for Airflow metadata encryption.
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` — MinIO root credentials.
- `SPARK_MASTER_UI_INTERNAL_URL` — URL the **backend** uses to fetch Spark JSON (inside Docker: `http://spark-master:8085`; on host dev: `http://localhost:8085`).

Full comments live in **`.env.example`**.

---

## 8. Data directory and upload pipeline

### Physical layout (under `data/fintech/`)

| Subpath | Role |
|---------|------|
| `*.csv` (root) | Published finance dimensions/facts consumed by KPIs and CEN Query |
| `uploads/landing/` | Timestamped files on upload |
| `uploads/processing/` | Copies during processing |
| `uploads/published/` | Published copies |
| `uploads/failed/` | Failed attempts (if used by pipeline) |
| `uploads/external/` | External drops (if used) |
| `uploads/activated/` | **Markers** e.g. `dim_merchants.csv.analytics_ready` |
| `uploads/metadata/` | `dataset_registry.json`, `audit_logs.json`, `etl_jobs.json`, `users.json` |

### `analytics_ready`

For **gated** finance files, the **MetricsService** prefers CSVs that have an **`analytics_ready`** marker (or legacy `.ok` migrated automatically) so KPIs align with intentional “ready for analytics” datasets. See `MetricsService.DASHBOARD_GATED` in `apps/backend/app/services.py`.

### MinIO

Uploads can mirror to bucket **`fintech-landing`** (configurable) so Airflow or external tools can read the same landings as S3 objects.

---

## 9. Dashboard KPIs and charts

- **`GET /api/overview`** returns row counts (customers, accounts, transactions, loans, fraud alerts), **transaction volume** and **loan principal** sums, plus **`data_dir`**, **`activated_dir`**, and **`kpi_sources`** (resolved paths and marker flags).
- **`GET /api/analytics/charts`** returns **eight** chart series (top merchants by count/amount, histograms, fraud by customer, entity counts, registry uploads by day, pipeline status mix).
- **`GET /api/top-merchants`** feeds the **Top merchants** table (joins transactions + merchant dimension).

The **Dashboard** page explains that KPIs read CSVs from **`DATA_DIR`** and shows expandable **KPI source files** when the API returns metadata.

---

## 10. Query workspace: CEN vs BigQuery

| Mode | Engine | Scope |
|------|--------|--------|
| **CSV · SQL (CEN)** | SQLite in-memory | Tables loaded from `*.csv` under `DATA_DIR` / `EXTERNAL_DIR` that pass the analytics-ready gate (see `CENQueryService`) |
| **BigQuery** | Google BigQuery API | Read-only `SELECT` / `WITH`; project/dataset from your GCP account |

- Examples: **`docs/sample_sql.sql`**, **`docs/cen_query_examples.sql`**, **`docs/validation_queries.sql`**.

Smoke test (Python, from repo root):

```powershell
pip install -r apps/backend/requirements.txt
$env:DATA_DIR="d:\path\to\data\fintech"   # optional override
python scripts/validate_sql_examples.py
```

BigQuery tests run only when credentials are available and `google-cloud-bigquery` is installed.

---

## 11. Authentication and roles (RBAC)

### Login

- **`POST /api/auth/login`** with JSON `{"username","password"}` returns `{ token, username, role }`.
- Send **`Authorization: Bearer <token>`** on subsequent requests.

### Default users (seeded from `Settings.USERS` unless overridden by `users.json`)

| Username | Password (default dev) | Role |
|----------|-------------------------|------|
| `admin` | `admin123` | `admin` |
| `engineer` | `engineer123` | `data_engineer` |
| `analyst` | `analyst123` | `analyst` |
| `operator` | `operator123` | `operator` |

### Permissions (sidebar and API)

| Permission | admin | data_engineer | analyst | operator |
|------------|:-----:|:-------------:|:-------:|:--------:|
| `analytics` (dashboard) | ✓ | ✓ | ✓ | ✓ |
| `uploads` | ✓ | ✓ | — | ✓ |
| `datasets` | ✓ | ✓ | ✓ | ✓ |
| `etl` | ✓ | ✓ | — | ✓ |
| `query` | ✓ | ✓ | ✓ | — |
| `bigquery` | ✓ | ✓ | ✓ | — |
| `audit` | ✓ | ✓ | — | — |
| `users` | ✓ | — | — | — |

**Operators** cannot open **Query** or **BigQuery** in the UI.

---

## 12. REST API overview

Authoritative list: **`GET /api/docs`**. Summary:

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/health` | — | Liveness |
| POST | `/api/auth/login` | — | Issue token |
| GET | `/api/auth/me` | Bearer | Current user |
| GET | `/api/overview` | analytics | KPI overview + `data_dir` / `kpi_sources` |
| GET | `/api/top-merchants` | analytics | Ranked merchants |
| GET | `/api/analytics/charts` | analytics | Eight chart payloads + `data_dir` |
| GET | `/api/upload-datasets` | uploads | Allowed upload catalog |
| POST | `/api/uploads` | uploads | Upload CSV to landing + MinIO |
| GET | `/api/uploads/pending` | uploads | Awaiting processing |
| GET | `/api/uploads/success` | uploads | Successful / analytics_ready |
| GET | `/api/uploads/failed` | uploads | Failed uploads |
| POST | `/api/datasets/process` | uploads | Process from landing |
| GET | `/api/datasets` | datasets | Dataset catalog + insights |
| GET | `/api/datasets/<name>/preview` | datasets | Preview rows |
| DELETE | `/api/datasets/<name>` | datasets | Remove dataset entries and files |
| POST | `/api/cen-query/execute` | query | CEN read-only SQL |
| GET | `/api/etl/jobs` | etl | List ETL job records |
| POST | `/api/etl/jobs` | etl | Trigger ETL / Airflow |
| GET | `/api/audit-logs` | audit | Audit entries |
| GET | `/api/users` | users | List users |
| POST | `/api/users` | users | Create user |
| PATCH | `/api/users/<username>` | users | Update user |
| GET | `/api/integrations/config` | Bearer | Airflow, MinIO, Spark URLs |
| GET | `/api/integrations/spark` | etl | Spark master JSON (workers/apps) |
| GET | `/api/integrations/health` | Bearer | Integration health |
| GET | `/api/bigquery/status` | bigquery | Feature flags + project + datasets |
| GET | `/api/bigquery/datasets` | bigquery | List datasets |
| GET | `/api/bigquery/datasets/<id>/tables` | bigquery | List tables |
| POST | `/api/bigquery/query` | bigquery | Read-only SQL |

---

## 13. Integrations (Airflow, MinIO, Spark, BigQuery)

- **Airflow:** Backend uses **`AIRFLOW_BASE_URL`** with basic auth to **trigger DAGs** (`AIRFLOW_ETL_DAG_ID`, default `distributed_pipeline_scaffold`). The Airflow image must allow **Basic Auth** for the REST API (`AIRFLOW__API__AUTH_BACKENDS` including `basic_auth`).
- **MinIO:** **`minio_util`** ensures bucket existence on startup; uploads use the configured endpoint and credentials.
- **Spark:** **`spark_master_client`** fetches `http://spark-master:8085/json/` (or override) for workers and completed applications shown on the **ETL** page.
- **BigQuery:** **`google-cloud-bigquery`**; queries are **read-only** (blocked keywords for DML/DDL). Optional **load job** after upload when enabled.

---

## 14. Airflow DAGs

DAG files live in **`infra/airflow/dags/`**:

| File | `dag_id` | Purpose |
|------|----------|---------|
| `tiny_pyspark_dag.py` | `tiny_pyspark_standalone` | Small Spark smoke test |
| `pipeline_scaffold.py` | `distributed_pipeline_scaffold` | Scaffold pipeline (ingest/transform/load wiring) |

Spark scripts are available inside containers at **`/opt/spark-jobs`** (host: **`infra/spark/jobs`**).

The backend default **`AIRFLOW_ETL_DAG_ID`** is **`distributed_pipeline_scaffold`** (override via environment).

---

## 15. PostgreSQL `analytics` database

`infra/postgres/init.sql` creates:

- Database **`analytics`**
- Schema **`analytics_curated`** with placeholder KPI tables (e.g. `kpi_daily_transactions`, `kpi_top_merchants`, `kpi_customer_risk`)

Use these for **warehouse-style validation** SQL in **`docs/validation_queries.sql`** and **`docs/sample_sql.sql`** (Part 3), separate from the **SQLite CEN** layer.

Connection string default: `postgresql://airflow:airflow@postgres:5432/analytics` (`ANALYTICS_DB_DSN`).

---

## 16. Optional Hadoop profile

Services: **hadoop-namenode**, **hadoop-datanode**, **hadoop-resourcemanager**, **hadoop-nodemanager**, **hadoop-historyserver** — not started by default.

```powershell
docker compose --profile hadoop up -d
```

Use for HDFS/YARN demos; Spark in this stack primarily uses **Spark Standalone**.

---

## 17. Development without Docker

### Backend

```powershell
cd apps\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
$env:DATA_DIR="d:\path\to\repo\data\fintech"
$env:GOOGLE_APPLICATION_CREDENTIALS="d:\path\to\secrets\key.json"   # if using BigQuery
python -c "from app.main import app; app.run(host='0.0.0.0', port=5000)"
```

Or: `gunicorn -b 0.0.0.0:5000 app.main:app` from `apps/backend` with `PYTHONPATH` including `apps/backend` (package `app`).

### Frontend

```powershell
cd apps\frontend
npm install
$env:VITE_API_BASE_URL="http://localhost:5000"
npm run dev
```

Ensure CORS allows your dev origin (Flask-CORS is enabled on the app).

---

## 18. Validation, SQL examples, and scripts

| Artifact | Purpose |
|----------|---------|
| `docs/sample_sql.sql` | Merged **CEN + BigQuery** examples |
| `docs/cen_query_examples.sql` | CEN-only snippets |
| `docs/validation_queries.sql` | Warehouse + BigQuery hygiene + pointers |
| `docs/ARCHITECTURE.md` | Short architecture diagram and components |
| `docs/MILESTONE1_SRS.md` | Requirements / milestone context |
| `docs/SECURITY_CONFIGURATION.md` | Security notes |
| `docs/VALIDATION_RESULTS_TEMPLATE.md` | Template for recording validation runs |
| `scripts/validate_sql_examples.py` | Automated smoke tests for documented SQL |

---

## 19. Troubleshooting

| Symptom | Things to check |
|---------|-----------------|
| Frontend **“Unable to reach the backend”** | API running on **5000**; `VITE_API_BASE_URL`; browser not blocking mixed content |
| **401/403** on API | Valid `Bearer` token; role has permission for route ([§11](#11-authentication-and-roles-rbac)) |
| KPIs show **zeros** | CSVs present under `DATA_DIR`; gated files have **`analytics_ready`** or non-empty files per `MetricsService` |
| **CEN Query** missing tables | `*.csv` in `DATA_DIR` and matching **`*.csv.analytics_ready`** in `uploads/activated/` |
| **BigQuery** errors | `BIGQUERY_ENABLED`; JSON path mounted in Docker; IAM **BigQuery Job User** + dataset access; dataset created in GCP |
| Airflow **POST** returns HTML / CSRF | Image must set **`AIRFLOW__API__AUTH_BACKENDS`** to include **basic_auth** (see `docker-compose.yml`) |
| Spark UI empty from API | `SPARK_MASTER_UI_INTERNAL_URL` reachable from **backend** container |

---

## 20. Security

- Never commit **`.env`**, **`secrets/*.json`**, or private keys.
- Replace **default app passwords**, **MinIO** credentials, and **Airflow Fernet** key for any shared or production-like environment.
- Restrict BigQuery service accounts to **least privilege** (Job User + data roles on target datasets only).

---

## 21. Further documentation

- **`docs/ARCHITECTURE.md`** — Mermaid flowchart
- **`docs/MILESTONE1_SRS.md`** — Milestone requirements
- **`docs/SECURITY_CONFIGURATION.md`**, **`docs/SCALABILITY_ANALYSIS.md`**, **`docs/FAULT_TOLERANCE.md`**
- **`docs/DEMO_CHECKLIST.md`** — Demo checklist

---

## Course / license context

This repository supports **distributed data processing**  (**DSC3219**). Adapt ports, DAG ids, and credentials for your institution’s environment.
