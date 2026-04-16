# Software Requirements Specification (SRS)

**Project:** Distributed Data Processing Pipeline  
**Course:** DSC3219 — Cloud and Distributed Computing (BSDS 32)  
**Milestone:** One — Requirements Specification & Planning (updated for as-built alignment)  
**Version:** 1.4  
**Date:** April 2026  

---

> **Submission note:** For Moodle, paste this content into Microsoft Word (or equivalent), set **Font: Trebuchet MS, 12 pt**, **Line spacing: 1.5**, **Alignment: Justified**, and keep **IEEE-style references** as shown in §1.4.

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and non-functional requirements for a **Distributed Data Processing Pipeline**. The system shall ingest batch datasets into **distributed storage**, process them in parallel using **Apache Spark** and **Apache Hadoop** components **where necessary** (e.g., HDFS, YARN, or MapReduce jobs), orchestrate workloads with **Apache Airflow**, run in **Docker** containers, and load curated aggregates into an **open-source analytical store**. The stack shall **not** depend on paid commercial software or paid cloud-only services. This document is intended for course assessors, the development team, and stakeholders who need a single authoritative statement of what the system must do and how success will be validated.

### 1.2 Scope

**Goals**

- Demonstrate applied knowledge of **distributed storage**, **parallel processing** (MapReduce-style execution via **Apache Spark** and, where justified, **Hadoop** MapReduce/HDFS/YARN), **containerisation (Docker)**, **orchestration (Apache Airflow)**, **load balancing** (where applicable, e.g., reverse proxy or scheduler workers), and **secure access** to data and services.
- Deliver a documented, demonstrable pipeline: **Input → Processing → Result store**, aligned with the examination brief [1].

**In scope**

- **Containerisation:** Core services run as **Docker** containers (e.g., **Docker Compose** on a developer or lab host) with reproducible images and documented `docker compose` (or equivalent) workflows.
- **Orchestration:** Batch pipelines are scheduled and monitored with **Apache Airflow** (DAGs for ingest, Spark/Hadoop steps, and load to the analytical store).
- **Input stage:** Batch datasets land in **distributed storage** using **open-source** options only — e.g., **HDFS** (Hadoop) and/or an **S3-compatible** object store such as **MinIO** (no AWS/GCP/Azure *paid* managed services required).
- **Processing stage:** **Apache Spark** for primary analytics; **Hadoop ecosystem** components (**HDFS**, **YARN**, **MapReduce** jobs) used **where necessary** to satisfy the brief and to demonstrate distributed execution (design shall justify what runs on Spark vs. Hadoop).
- **Result store:** Curated data loaded into a **free, open-source analytical database** suitable for SQL validation (e.g., **PostgreSQL**, **Apache Hive**, or **Trino** with Hive — exact choice fixed in Milestone 2), deployed in Docker; **not** commercial warehouses that require payment (e.g., Snowflake, paid tiers of proprietary SaaS).  
  **As implemented:** PostgreSQL hosts the **`analytics`** database and **`analytics_curated`** schema (see `infra/postgres/init.sql`). An **optional** read-only integration with **Google BigQuery** exists for cloud warehouse queries and optional CSV load jobs; it **does not** replace the open-source result store and may be disabled (`BIGQUERY_ENABLED=false`).
- Identity and access controls, Docker network segmentation where practical, and auditability sufficient for an academic deployment.
- Documentation artefacts required by the brief: architecture, scalability, fault tolerance, and security configuration (detailed in later milestones; requirements for their *existence* and *content* are stated here).

**Out of scope (for this course project unless explicitly added later)**

- Real-time streaming at scale (e.g., Kafka + Flink) as a primary path — *optional extension only*.
- Full enterprise SDLC tooling (multi-region DR, full SOC2 programme) beyond what is reasonable for a two-week academic project.
- Mobile native applications; a **web-based operational console** is **in scope** for the implemented project (React + Flask API). Rich desktop clients remain out of scope.

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|------|------------|
| **SRS** | Software Requirements Specification |
| **HDFS** | Hadoop Distributed File System |
| **S3** | S3 API — in this project typically **MinIO** or HDFS connectors, not proprietary paid object storage |
| **IAM** | Identity and access patterns (cloud IAM concepts applied to OSS: MinIO policies, Airflow RBAC, DB roles) |
| **VPC** | Docker bridge/overlay networks and host firewall rules (logical isolation analogous to private networks) |
| **Airflow** | Apache Airflow — workflow orchestration |
| **YARN** | Yet Another Resource Negotiator (Hadoop resource manager) |
| **ETL / ELT** | Extract, Transform, Load / Extract, Load, Transform |
| **Spark** | Apache Spark distributed processing engine |
| **DW** | Data warehouse |
| **NFR** | Non-functional requirement |
| **FR** | Functional requirement |

### 1.4 References

[1] Uganda Christian University, Faculty of Engineering, Design and Technology, *DSC3219 Cloud and Distributed Computing (BSDS 32) — Project-based Examination*, Easter 2026.  

[2] IEEE Computer Society, *IEEE Std 830-1998 (archived)*, *IEEE Recommended Practice for Software Requirements Specifications* (structure adapted for clarity).  

[3] Amazon Web Services, *AWS Well-Architected Framework* (reliability, security, performance pillars — concepts referenced for NFR rationale).  

[4] Apache Software Foundation, *Apache Spark Documentation*, https://spark.apache.org/docs/latest/  

[5] Project artefact, *Fintech synthetic dataset package*, `data/fintech/`, 2026.  

[6] Apache Software Foundation, *Apache Airflow Documentation*, https://airflow.apache.org/docs/  

[7] Apache Software Foundation, *Apache Hadoop Documentation*, https://hadoop.apache.org/docs/  

[8] Docker Inc., *Docker Documentation — Compose*, https://docs.docker.com/compose/  

### 1.5 Overview of Document

Section 2 summarises the product context and constraints, including **Docker**, **Apache Airflow**, **Spark/Hadoop**, **OSS-first** stack with **optional BigQuery**, and the **reference batch dataset** (`data/fintech`). **§2.8** summarises the **as-built** mapping to repository paths. Section 3 lists functional requirements, including **§3.8** (web app, CEN Query, optional BigQuery, session persistence). Section 4 lists non-functional requirements. Section 5 defines validation criteria and acceptance tests at requirements level.

---

## 2. Overall Description

### 2.1 Product Perspective

The system is a **greenfield** data pipeline comprising three logical tiers consistent with the examination brief, implemented as a **Docker-based** stack:

1. **Input stage:** Landing zone on **distributed storage** — **HDFS** and/or **S3-compatible** storage (e.g., **MinIO**) — deployable in containers.
2. **Processing stage:** **Apache Spark** for distributed analytics; **Hadoop** (**HDFS**, **YARN**, **MapReduce** as needed) to satisfy distributed/cluster requirements without paid platforms.
3. **Result store:** **Open-source** analytical tables (e.g., PostgreSQL, Hive-metastore-backed tables) supporting SQL validation queries.

**Orchestration** is provided by **Apache Airflow**, which schedules DAGs that coordinate ingestion, Spark and Hadoop jobs, and loads to the result store [6].

The solution may expose **Airflow’s UI**, **Spark UIs**, and/or a minimal **notebook** for monitoring; the examination requires an **architecture diagram** showing interactions among front-end (if any), **load balancers** (if any), **servers / services**, and **storage** [1].

### 2.2 Product Functions (Summary)

- Secure upload or transfer of datasets into the landing zone (scripts, Airflow tasks, or volume mounts into containers).
- **Apache Airflow DAGs** defining pipeline steps: ingest → Spark and/or Hadoop processing → load to analytical store.
- Configurable jobs: **Spark** applications (PySpark/Scala); **Hadoop MapReduce** or **distcp**-style steps **where necessary** [7].
- Load of curated outputs into **open-source** warehouse or lakehouse tables.
- Authentication/authorisation for operators (**Airflow** users/RBAC, MinIO/HDFS service accounts, database roles) and **least-privilege** between containers.
- Observability: Airflow task logs, Spark UI, container logs — sufficient for demonstration and failure analysis.

**As implemented (repository baseline, April 2026)**

- **Web console:** React (Vite) single-page application on port **5173**; **Flask** REST API on port **5000**; Bearer-token authentication with **role-based** access (admin, data engineer, analyst, operator).
- **Ingestion:** CSV uploads land under `data/fintech/uploads/` with metadata in `dataset_registry.json`; **MinIO** mirrors landing objects; **Spark Standalone** (master + worker) and **Airflow DAGs** (`tiny_pyspark_standalone`, `distributed_pipeline_scaffold`) coordinate processing.
- **Ad hoc analytics:** **CEN Query** — read-only SQL over in-memory **SQLite** built from `analytics_ready` CSVs in `DATA_DIR`. **Optional BigQuery** tab — read-only SQL via GCP when credentials are mounted (`secrets/`, environment variables).
- **Dashboard:** KPIs and charts computed from finance CSVs on disk (same `DATA_DIR`); expandable “KPI source files” in the UI maps to resolved paths.
- **Session persistence:** API auth tokens may be persisted under `uploads/metadata/auth_tokens.json` so sessions survive API process restarts; clients keep `token` / `auth_user` in `localStorage` with a “Restoring session…” gate on hard refresh.

### 2.3 User Classes and Characteristics

| User class | Description | Typical interactions |
|------------|-------------|----------------------|
| **Pipeline operator** | Developer / data engineer running the project pipeline | Uploads data, triggers jobs, inspects logs, runs validation queries |
| **Console user (analyst / engineer / admin)** | Authenticated user of the web UI | Views dashboard, manages uploads/datasets, runs CEN or BigQuery SQL, triggers ETL, reviews audit logs (permissions vary by role) |
| **Assessor / examiner** | Evaluates milestones | Reviews SRS, design, demo, security evidence |
| **System services** | Service accounts / technical users (MinIO, HDFS, DB), Airflow connections, GCP service account (optional BigQuery) | Read/write storage, run Spark/Hadoop, load warehouse |

### 2.4 Operating Environment

- **Runtime:** **Docker Engine** (Linux containers) on a physical or virtual **host machine** (developer laptop, lab PC, or VM) — no requirement to use paid public-cloud managed services [8].
- **Orchestration runtime:** **Apache Airflow** (containerised) with executor choice documented in Milestone 2 (e.g., `LocalExecutor` or `CeleryExecutor` with Redis — OSS components only).
- **Client environment:** Scripts in **Python** (Airflow DAGs, PySpark), **SQL**, or **Bash**; browser access to Airflow UI and optional Spark UIs on `localhost` or confined host ports.
- **Network:** Docker **bridge/custom networks** to isolate database and storage from public internet; only required ports published (documented under security NFRs).

### 2.5 Design and Implementation Constraints

- The examination expects programmatic automation [1]; implementation shall use **Airflow**, **Spark/Hadoop APIs**, and **Docker** tooling so the pipeline is **reproducible** (`docker compose up`, documented env vars). Ad-hoc manual steps may supplement the demo but **must not** be the only path.
- **Apache Spark** shall be used for core distributed analytics; **Apache Hadoop** (e.g., **HDFS** for storage, **YARN** for resource management, or **MapReduce** jobs) shall be incorporated **where necessary** to align with the course’s distributed-computing outcomes [7].
- **Containerisation:** All major components (Airflow, Spark workers, HDFS/MinIO, analytical DB, etc.) shall run under **Docker** with version-pinned images or Dockerfiles committed to the repository [8].
- **Orchestration:** **Apache Airflow** is mandatory for workflow scheduling and dependency management between pipeline stages [6].
- **No paid software (core stack):** The project shall **not** require **paid licences**, **paid SaaS**, or **mandatory** paid cloud managed services for the **graded** pipeline. **Free and open-source** alternatives shall be used for ingest, orchestration, processing, and primary SQL validation. **Optional** use of **Google Cloud BigQuery** (or similar) is permitted only as a **supplementary** analytics path when the operator supplies credentials; the core demonstration remains reproducible with **Docker + PostgreSQL + MinIO + Spark + Airflow** alone (`BIGQUERY_ENABLED` may be set to `false`).
- Cost and complexity shall remain appropriate to a **two-week** academic project (document trade-offs in design).
- Final report formatting must follow course instructions (Trebuchet MS, 12 pt, 1.5 spacing, justified, IEEE references) [1].

### 2.6 Assumptions and Dependencies

- **Assumption A1:** **Batch** CSV files under **`data/fintech/`** are the **reference inputs**; volume is sufficient for **partitioned reads** in Spark (additional partitions may be used if disclosed) to demonstrate parallel benefit.
- **Assumption A2:** The host machine can run **Docker** with enough RAM/CPU for a minimal multi-container stack (exact sizing in Milestone 2).
- **Dependency D1:** **Docker**, **Docker Compose**, and open-source images/builds for Airflow, Spark, Hadoop components, and the analytical store.
- **Dependency D2:** Pinned versions of Airflow, Spark, Hadoop (if used), and Python dependencies (recorded in `requirements.txt` / `pyproject.toml` / Compose files).

### 2.7 Reference dataset: `data/fintech`

The pipeline shall use the fintech synthetic datasets supplied in the project repository under **`data/fintech/`** [5]. The data models core digital-finance domains: customer accounts, transactions, fraud alerts, loans, repayments, and merchant activity.

**Format and layout**

- **File format:** CSV (comma-separated values), suitable for parallel read in Spark/Hadoop.
- **Domain tables:** The package contains 10 fintech tables split into dimensions and facts.
- **Implementation scope:** First release must process at least transactions + fraud + loans into curated analytics tables.

**Representative assets (non-exhaustive)**

| Category | Example files |
|----------|----------------|
| Dimensions | `dim_customers.csv`, `dim_accounts.csv`, `dim_cards.csv`, `dim_merchants.csv`, `dim_branches.csv`, `dim_date.csv` |
| Facts — operations | `fact_transactions.csv`, `fact_fraud_alerts.csv` |
| Facts — credit | `fact_loans.csv`, `fact_loan_repayments.csv` |

**Integration keys (for requirements traceability to processing)**

- Entity identifiers: **`customer_id`**, **`account_id`**, **`merchant_id`**, **`loan_id`**.
- Time keys: **`transaction_date`**, **`alert_date`**, **`issue_date`**, **`payment_date`**, and `dim_date.date_key`.
- Monetary measures: **`amount`**, **`principal_amount`**, **`total_amount_ugx`** in curated outputs.

**Minimum viable analytics (illustrative — final metrics fixed in Milestone 2/3)**

The processing stage shall support **at least one** multi-table workflow over this dataset, for example: transaction + fraud + merchant joins with daily KPI aggregation and customer risk summaries — sufficient to demonstrate **joins + aggregations** in Spark (FR-05) and **SQL validation** in the warehouse (FR-10).

### 2.8 Current implementation snapshot (reference architecture)

The following table maps **logical components** to **repository / runtime** artefacts. It supplements §2.1 and does not relax FR/NFR IDs.

| Component | Implementation |
|-----------|----------------|
| Web UI | `apps/frontend/` — React, Vite, role-gated navigation |
| API | `apps/backend/` — Flask, Gunicorn, `/api/*` routes |
| Compose | `docker-compose.yml` — backend, frontend, postgres, minio, airflow (init, webserver, scheduler), spark-master, spark-worker |
| Data root | Host `data/fintech` → container `DATA_DIR` (`/data` in Docker) |
| Orchestration | `infra/airflow/dags/*.py` |
| Spark jobs | `infra/spark/jobs/` → `/opt/spark-jobs` in containers |
| Warehouse (OSS) | PostgreSQL `analytics` + `analytics_curated.*` |
| Optional cloud DW | BigQuery — `apps/backend/app/integrations/bigquery_client.py`, env vars in `.env.example` |
| SQL examples | `docs/sample_sql.sql`, `docs/cen_query_examples.sql`, `docs/validation_queries.sql` |
| Ops / validation | `README.md`, `scripts/validate_sql_examples.py` |

---

## 3. Functional Requirements

Each requirement is **unique**, **testable**, and **prioritised** (Must / Should / Could).

### 3.1 Containerisation, Orchestration, and Stack Policy

| ID | Priority | Statement |
|----|----------|-----------|
| **FR-21** | Must | The system shall be **deployed with Docker** — services run as containers with a reproducible **`docker compose`** (or equivalent) definition and/or Dockerfiles version-controlled in the repository [8]. |
| **FR-22** | Must | Batch workflows shall be **orchestrated by Apache Airflow** using **DAGs** that model dependencies between ingest, processing, and load steps [6]. |
| **FR-23** | Must | The **core pipeline shall not require paid software** — no paid licences, mandatory paid SaaS, or paid proprietary cloud-managed analytics/storage services; only **free and open-source** components (and the host OS/Docker Engine) are in scope. |

### 3.2 Data Ingestion and Storage (Input Stage)

| ID | Priority | Statement |
|----|----------|-----------|
| **FR-01** | Must | The system shall store **raw input datasets** in a **distributed storage layer** — **HDFS** and/or **S3-compatible object storage (e.g., MinIO)** — running in **Docker**, with a documented path/prefix convention (e.g., `raw/`, `staging/`, `processed/`). |
| **FR-02** | Must | The system shall support **adding new batch files** (e.g., CSV, Parquet, JSON) without redeploying the entire application stack (configuration or script update is acceptable). |
| **FR-03** | Should | The system shall record **basic ingestion metadata** (object key, size, timestamp, checksum optional) for traceability. |
| **FR-04** | Must | Access to raw and staged data shall be **enforced** via **MinIO bucket policies / credentials**, **HDFS permissions**, and **Docker network isolation** (no anonymous public read/write to private data). |

### 3.3 Distributed Processing (Processing Stage)

| ID | Priority | Statement |
|----|----------|-----------|
| **FR-05** | Must | The system shall execute **at least one** non-trivial analytics workflow (filtering, joins, aggregations) using **Apache Spark** as the primary engine, and shall use **Hadoop components** (**HDFS**, **YARN**, and/or **MapReduce** jobs) **where necessary**, all runnable **inside the Docker-based stack** (not on paid proprietary managed clusters). |
| **FR-06** | Must | Processing shall be **parallelisable** across multiple workers (evidence: Spark partitions / YARN containers / service worker count documented in design and demo). |
| **FR-07** | Should | The system shall support **re-running** the same job idempotently on the same input version (or clearly versioned inputs) without corrupting downstream tables (overwrite or merge strategy documented). |
| **FR-08** | Could | The system may expose **parameterised jobs** (e.g., date range, input path) via configuration file or CLI arguments. |

### 3.4 Results and Analytics (Result Store)

| ID | Priority | Statement |
|----|----------|-----------|
| **FR-09** | Must | The system shall **load aggregated or curated outputs** into an **open-source analytical store** (e.g., **PostgreSQL**, **Apache Hive**, or **Trino** querying Hive — choice fixed in Milestone 2) exposed as **queryable tables** or **views**, containerised. |
| **FR-10** | Must | The assessor shall be able to **verify correctness** by running **at least two** representative SQL queries against the warehouse (e.g., row counts, aggregate totals matching expected benchmarks documented in validation). |
| **FR-11** | Should | Schema for warehouse tables shall be **documented** (column names, types, grain of aggregation). |

### 3.5 Security, Identity, and Access

| ID | Priority | Statement |
|----|----------|-----------|
| **FR-12** | Must | The system shall implement **authentication** for human operators (e.g., **Airflow** web UI login / RBAC, database users); technical credentials for MinIO/HDFS/DB shall not be embedded in DAG code. |
| **FR-13** | Must | The system shall implement **authorisation** such that only designated principals can **read/write** storage, **trigger or clear Airflow tasks**, or **query** sensitive tables (policy files, HDFS ACLs, PostgreSQL/Hive grants, MinIO policies — documented). |
| **FR-14** | Should | Secrets (access keys, passwords) shall **not** be committed to source control; use environment variables, secrets manager, or college-approved method. |

### 3.6 Operations, Monitoring, and Demonstration

| ID | Priority | Statement |
|----|----------|-----------|
| **FR-15** | Must | The system shall produce **auditable evidence** of execution (**Airflow** run IDs, Spark application IDs, container logs, or screenshots) suitable for Milestone 4 demonstration. |
| **FR-16** | Should | The system shall expose **basic health information** (last successful DAG run, task failure status) via **Airflow** and container logs. |

### 3.7 Documentation Deliverables (Cross-Milestone, Required by Brief)

| ID | Priority | Statement |
|----|----------|-----------|
| **FR-17** | Must | The final submission shall include a **system architecture diagram** showing interactions among front-end (if any), load balancers (if any), compute, and storage [1]. |
| **FR-18** | Must | The final submission shall include a **scalability analysis** describing behaviour under increasing data volume or concurrent jobs [1]. |
| **FR-19** | Must | The final submission shall include **fault tolerance mechanisms** describing steps when a node or service fails [1]. |
| **FR-20** | Must | The final submission shall include **security configuration** evidence (e.g., MinIO/HDFS policy summaries, **Docker** network and port bindings, Airflow access controls, DB grants, least-privilege narrative) [1]. |

### 3.8 Web application, ad hoc query, and optional BigQuery (as implemented)

| ID | Priority | Statement |
|----|----------|-----------|
| **FR-24** | Must | The system shall provide a **web-based console** (browser) that supports **authentication**, **role-based access** to features (e.g., dashboard, uploads, datasets, ETL, query, audit, user management as applicable), and **health-visible** integration links (Airflow, MinIO, Spark Master UI) where configured. |
| **FR-25** | Must | The system shall expose a **read-only SQL** capability over curated **CSV** inputs marked for analytics (**CEN Query**), using server-side execution with blocked DML/DDL, consistent with traceability to `data/fintech`. |
| **FR-26** | Should | The system may expose **optional Google BigQuery** access (read-only queries; optional load job on upload when enabled) using operator-supplied **service account** credentials; **no** mandatory dependency on BigQuery for core pipeline correctness. |
| **FR-27** | Should | **API authentication tokens** shall remain valid across **API process restarts** when persisted to operator-approved storage (e.g. metadata directory), and the client shall **restore session state** after browser refresh without forcing re-login when the token remains valid. |
| **FR-28** | Should | The **dashboard** shall derive KPIs and charts from **documented on-disk** finance CSV paths under `DATA_DIR`, with **ingestion/registry** metadata for time-series and pipeline-status charts where applicable. |

---

## 4. Non-Functional Requirements

### 4.1 Performance and Scalability

| ID | Priority | Statement |
|----|----------|-----------|
| **NFR-01** | Must | The processing layer shall demonstrate **horizontal scale-out** within practical limits (e.g., add Spark executors, extra Airflow workers, or additional Docker replicas on the host); **limits of the host machine** and observed behaviour shall be documented. |
| **NFR-02** | Should | End-to-end batch runtime for the **`data/fintech`** pipeline run shall be measured and reported (no fixed SLA required; trend vs. single-node baseline acceptable). |

### 4.2 Reliability and Fault Tolerance

| ID | Priority | Statement |
|----|----------|-----------|
| **NFR-03** | Must | The design shall address **single-node / single-task failure** using platform features (e.g., **Spark** stage retries, **Airflow** task retries, container restart policies) and shall describe **operator recovery steps** [1]. |
| **NFR-04** | Should | Critical data shall rely on **durable storage** (object store / warehouse durability guarantees) rather than ephemeral cluster disks alone. |

### 4.3 Security

| ID | Priority | Statement |
|----|----------|-----------|
| **NFR-05** | Must | **Least privilege:** default deny; grants limited to required actions on required resources (documented IAM or RBAC policies). |
| **NFR-06** | Must | **Network controls:** processing and data services communicate on **internal Docker networks**; only required ports (e.g., Airflow UI, Spark UI for debug) published to the host and **documented**. |
| **NFR-07** | Should | **Encryption in transit** for service communication where supported (HTTPS/TLS); **encryption at rest** enabled for object store and warehouse where available without excessive cost. |

### 4.4 Usability and Maintainability

| ID | Priority | Statement |
|----|----------|-----------|
| **NFR-08** | Must | A new team member (or the assessor with provided credentials) shall be able to **reproduce** the pipeline using **documented steps** and **scripts/IaC** within reasonable time. |
| **NFR-09** | Should | Repository layout and naming shall follow **consistent conventions** (e.g., `infra/`, `jobs/`, `docs/`). |

### 4.5 Portability and Standards

| ID | Priority | Statement |
|----|----------|-----------|
| **NFR-10** | Could | Where practical, use **open formats** (Parquet, CSV with schema) to ease migration between environments. |

### 4.6 Cost and Licensing

| ID | Priority | Statement |
|----|----------|-----------|
| **NFR-11** | Must | The deliverable shall **not** list or require **paid third-party services** as mandatory for building, running, or grading the pipeline; optional free-tier cloud resources are allowed only if explicitly non-essential and disclosed. |

---

## 5. Validation Criteria and Acceptance

Validation ties measurable evidence to requirements.

### 5.1 Milestone 1 (This Document)

| Criterion | Evidence |
|-----------|----------|
| **V-01** | Completeness — all sections 1–5 present; FR and NFR tables complete (including **FR-21–FR-23**, **NFR-11**) |
| **V-02** | Clarity — requirements are unambiguous and testable (no “fast”, “good” without measure) |
| **V-03** | Alignment — input → processing → analytical store traced to **FR-01**, **FR-05**, **FR-09**; **`data/fintech`** in §2.7; **Docker** + **Airflow** + **Spark/Hadoop** stated |
| **V-04** | Constraints — **Docker**, **Apache Airflow**, **OSS-first core** (**FR-23**, **NFR-11**), optional BigQuery stated, automation, and security expectations stated |
| **V-04b** | Web / API — **FR-24–FR-28** traceable to running Compose stack (`README.md`, `GET /api/docs`) |

### 5.2 System-Level Acceptance (End of Project)

| Criterion | Evidence |
|-----------|----------|
| **V-05** Demo | Live or recorded walkthrough showing data in distributed store, job execution, warehouse queries [1]; optional walkthrough of **web console** (dashboard, upload/process, query workspace) |
| **V-06** Security | Access-control artefacts and narrative for FR-12–FR-14 (Airflow, MinIO/HDFS, DB) |
| **V-07** Scalability | NFR-01 addressed with test or reasoned analysis |
| **V-08** Fault tolerance | NFR-03 with concrete scenario (e.g., kill worker, retry, or service outage drill) |
| **V-09** Documentation | FR-17–FR-20 satisfied in final report |

### 5.3 Traceability (Summary)

- **Exam brief [1]** → FR-01, FR-05, FR-09, FR-17–FR-20  
- **Reference dataset [5]** → §2.7, A1, FR-05, FR-10, NFR-02  
- **Platform [6][7][8]** → FR-21, FR-22, FR-23, NFR-11  
- **Milestone 3 secure implementation** → FR-12–FR-14, NFR-05–NFR-07  
- **Web console & query** → FR-24–FR-28, V-04b  
- **Presentation milestone** → FR-15–FR-16, V-05  

---

## 6. Revision History

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 1.0 | April 2026 | Project team | Initial SRS for Milestone 1 |
| 1.2 | April 2026 | Project team | **Docker**, **Apache Airflow**, **Spark + Hadoop where necessary**, **no paid core software**; FR-21–FR-23, NFR-11; refs [6]–[8]; §2.1–2.6 and FR/NFR updates |
| 1.3 | April 2026 | Project team | Synced SRS to fintech domain, `data/fintech` paths, updated dataset model and validation alignment |
| 1.4 | April 2026 | Project team | **As-built alignment:** §2.8 implementation snapshot; optional **BigQuery** and OSS-first clarification; **FR-24–FR-28** (web console, CEN Query, optional BQ, session persistence, dashboard data binding); user class **Console user**; **V-04b**; README / repository cross-references |

---

*End of SRS (Milestone One — revision 1.4).*
