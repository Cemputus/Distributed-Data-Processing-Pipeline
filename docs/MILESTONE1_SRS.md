# Software Requirements Specification (SRS)

**Project:** Distributed Data Processing Pipeline  
**Course:** DSC3219 — Cloud and Distributed Computing (BSDS 32)  
**Milestone:** One — Requirements Specification & Planning  
**Version:** 1.1  
**Date:** April 2026  

---

> **Submission note:** For Moodle, paste this content into Microsoft Word (or equivalent), set **Font: Trebuchet MS, 12 pt**, **Line spacing: 1.5**, **Alignment: Justified**, and keep **IEEE-style references** as shown in §1.4.

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and non-functional requirements for a **Distributed Data Processing Pipeline**. The system shall ingest large datasets into distributed storage, process them in parallel on a cloud-hosted compute layer, and load curated aggregates into an analytical data warehouse. This document is intended for course assessors, the development team, and stakeholders who need a single authoritative statement of what the system must do and how success will be validated.

### 1.2 Scope

**Goals**

- Demonstrate applied knowledge of **distributed storage**, **parallel processing** (MapReduce-style execution model, e.g., via Apache Spark), **cloud deployment**, **load balancing** (where applicable to the chosen architecture), **virtualisation / managed cluster** usage, and **secure access** to data and services.
- Deliver a documented, demonstrable pipeline: **Input → Processing → Result store**, aligned with the examination brief [1].

**In scope**

- Ingestion and organisation of batch datasets in a **distributed object store** (e.g., Amazon S3; alternatives such as HDFS on cloud VMs are acceptable if equivalently justified).
- Parallel transformation and aggregation using **Apache Spark** (or Hadoop MapReduce) on **cloud-managed** compute (e.g., Amazon EMR, AWS Glue, Dataproc, HDInsight, Databricks — subject to final design in Milestone 2).
- Loading of processed outputs into a **cloud data warehouse** (e.g., Amazon Redshift, Google BigQuery, Snowflake, or Azure Synapse Analytics).
- Identity and access controls, network exposure minimisation, and auditability sufficient for an academic production-like deployment.
- Documentation artefacts required by the brief: architecture, scalability, fault tolerance, and security configuration (detailed in later milestones; requirements for their *existence* and *content* are stated here).

**Out of scope (for this course project unless explicitly added later)**

- Real-time streaming at scale (e.g., Kafka + Flink) as a primary path — *optional extension only*.
- Full enterprise SDLC tooling (multi-region DR, full SOC2 programme) beyond what is reasonable for a two-week academic project.
- Mobile or rich desktop front-end applications; a minimal **web-based or script-driven operational interface** (e.g., console UI, simple dashboard, or notebook) is sufficient if required for demonstration.

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|------|------------|
| **SRS** | Software Requirements Specification |
| **HDFS** | Hadoop Distributed File System |
| **S3** | Amazon Simple Storage Service |
| **IAM** | Identity and Access Management |
| **VPC** | Virtual Private Cloud |
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

[5] Project artefact, *UCU Analytics Anonymized Synthetic_Data — schema and descriptions*, `Synthetic_Data/Data_info/` (e.g., `data_description.md`, `data_shema.md`), 2026.  

### 1.5 Overview of Document

Section 2 summarises the product context and constraints, including the **reference batch dataset** (`Synthetic_Data`). Section 3 lists functional requirements. Section 4 lists non-functional requirements. Section 5 defines validation criteria and acceptance tests at requirements level.

---

## 2. Overall Description

### 2.1 Product Perspective

The system is a **greenfield** data pipeline comprising three logical tiers consistent with the examination brief:

1. **Input stage:** Authoritative landing zone for raw and staged datasets on **distributed storage** (S3 or HDFS-class storage).
2. **Processing stage:** Parallel analytics engine (Spark- or Hadoop-based) running on **cloud compute** with cluster-style execution.
3. **Result store:** Relational or columnar **warehouse** for aggregated tables supporting analytical queries.

The solution may expose a minimal **front-end or operator interface** (e.g., Jupyter notebook, lightweight web app, or cloud console workflows) for job submission and monitoring; the examination requires an **architecture diagram** showing interactions among front-end (if any), **load balancers** (if used), **servers / services**, and **storage** [1].

### 2.2 Product Functions (Summary)

- Secure upload or transfer of datasets into the landing zone.
- Configurable pipeline definitions (e.g., Spark job, Glue/EMR job, or equivalent) for cleansing, transformation, and aggregation.
- Orchestrated execution of processing jobs on scalable compute.
- Load of curated outputs into warehouse tables.
- Authentication/authorisation for human operators and **least-privilege** access for services (IAM roles, bucket policies, etc.).
- Observability sufficient to demonstrate failures and recovery (logs, basic metrics).

### 2.3 User Classes and Characteristics

| User class | Description | Typical interactions |
|------------|-------------|----------------------|
| **Pipeline operator** | Student / developer running the course project | Uploads data, triggers jobs, inspects logs, runs validation queries |
| **Assessor / examiner** | Evaluates milestones | Reviews SRS, design, demo, security evidence |
| **System services** | Automated principals (IAM roles, service accounts) | Read/write storage, run jobs, load warehouse |

### 2.4 Operating Environment

- **Cloud provider:** One major public cloud (AWS, GCP, or Azure) with SDK/API-driven provisioning *or* infrastructure-as-code templates; exact provider is fixed in Milestone 2.
- **Client environment:** Developer workstation with VPN or secure browser access to cloud console; scripts written in Python, Scala, or SQL as appropriate.
- **Network:** Processing and data services shall run in **private subnets** or provider-equivalent isolated networks where feasible; public exposure limited to required endpoints only (documented under security NFRs).

### 2.5 Design and Implementation Constraints

- The examination mandates use of **cloud SDKs/APIs** for implementation [1]; ad-hoc manual steps may exist for demonstration but **must not** be the only reproducible path.
- Processing must reflect **parallel / distributed** execution suitable for large data (Spark/Hadoop cluster or managed Spark service).
- Cost and complexity shall remain appropriate to a **two-week** academic project (document trade-offs in design).
- Final report formatting must follow course instructions (Trebuchet MS, 12 pt, 1.5 spacing, justified, IEEE references) [1].

### 2.6 Assumptions and Dependencies

- **Assumption A1:** **Batch** CSV files under **`Synthetic_Data/`** are the **reference inputs**; volume is sufficient to partition/partition-read in Spark (additional synthetic row duplication or extra partitions may be used if disclosed) to demonstrate parallel benefit.
- **Assumption A2:** At least one **warehouse** and one **distributed store** are available in the chosen cloud with student-accessible credentials.
- **Dependency D1:** Availability of cloud accounts, quotas, and educator-approved services.
- **Dependency D2:** Third-party documentation and SDK versions current at implementation time (pinned in Milestone 3).

### 2.7 Reference dataset: `Synthetic_Data`

The pipeline shall use the **UCU Analytics anonymized synthetic datasets** supplied in the project repository under **`Synthetic_Data/`** [5]. The data models a university ERP/SIS: students, enrolment, finance, grades, attendance, progression, and related dimensions.

**Format and layout**

- **File format:** CSV (comma-separated values), suitable for parallel read in Spark/Hadoop.
- **Cohort splits:** Several tables exist per **List15** and **List16** student cohorts (e.g., `*_list15.csv`, `*_list16.csv`); `enrollment_all.csv` and related “`_all`” files combine or span cohorts. The implementation shall document which files are **in scope** for the first release (minimum: one fact pipeline with clear grain).
- **Documentation:** Field meanings, primary/foreign keys, and star-schema guidance are defined in [5] (`data_description.md`, `data_shema.md`, and related notes in `Synthetic_Data/Data_info/`).

**Representative assets (non-exhaustive)**

| Category | Example files |
|----------|----------------|
| Enrolment / student snapshot | `enrollment_all.csv`, `enrollment_list15.csv`, `enrollment_list16.csv` |
| Dimensions | `course_catalog_ucu.csv`, `dim_date_2022_2026.csv`, `high_schools_dimension.csv`, `faculties_departments.csv`, `student_high_schools_*.csv` |
| Facts — financial | `student_payments_list15.csv`, `student_payments_list16.csv`, `student_sponsorships_list15.csv`, `student_sponsorships_list16.csv` |
| Facts — academic | `student_grades_list15.csv`, `student_grades_list16.csv`, `student_transcript_list15.csv`, `student_transcript_list16.csv`, `fact_student_academic_performance_list15.csv`, `fact_student_academic_performance_list16.csv`, `academic_progression_list15.csv`, `academic_progression_list16.csv`, `student_attendance_list15.csv`, `student_attendance_list16.csv` |
| Generation / provenance | `data_generation.py` (how synthetic rows were produced — cite in design/report as needed) |

**Integration keys (for requirements traceability to processing)**

- Student identifiers: **`REG_NO`**, **`ACC_NO`** (see [5]).
- Time and term: **`ACADEMIC_YEAR`**, **`SEMESTER`**, **`SEMESTER_INDEX`**.
- Financial facts: **`PAYMENT_ID`** (payments); sponsor keys per [5].

**Minimum viable analytics (illustrative — final metrics fixed in Milestone 2/3)**

The processing stage shall support **at least one** multi-table workflow over this dataset, for example: semester-level **GPA or performance** joined to **payment totals** or **faculty/program** aggregates — sufficient to demonstrate **joins + aggregations** in Spark (FR-05) and **SQL validation** in the warehouse (FR-10).

---

## 3. Functional Requirements

Each requirement is **unique**, **testable**, and **prioritised** (Must / Should / Could).

### 3.1 Data Ingestion and Storage (Input Stage)

| ID | Priority | Statement |
|----|----------|-----------|
| **FR-01** | Must | The system shall store **raw input datasets** in a **distributed storage layer** (e.g., S3 bucket(s) or HDFS namespace) with a documented folder or prefix convention (e.g., `raw/`, `staging/`, `processed/`). |
| **FR-02** | Must | The system shall support **adding new batch files** (e.g., CSV, Parquet, JSON) without redeploying the entire application stack (configuration or script update is acceptable). |
| **FR-03** | Should | The system shall record **basic ingestion metadata** (object key, size, timestamp, checksum optional) for traceability. |
| **FR-04** | Must | Access to raw and staged data shall be **enforced via IAM or equivalent** (no world-readable private data by default). |

### 3.2 Distributed Processing (Processing Stage)

| ID | Priority | Statement |
|----|----------|-----------|
| **FR-05** | Must | The system shall execute **at least one** non-trivial analytics workflow (filtering, joins, aggregations) using **Apache Spark** or **Hadoop MapReduce** on **cloud-hosted** compute (cluster or managed service). |
| **FR-06** | Must | Processing shall be **parallelisable** across multiple workers (evidence: Spark partitions / YARN containers / service worker count documented in design and demo). |
| **FR-07** | Should | The system shall support **re-running** the same job idempotently on the same input version (or clearly versioned inputs) without corrupting downstream tables (overwrite or merge strategy documented). |
| **FR-08** | Could | The system may expose **parameterised jobs** (e.g., date range, input path) via configuration file or CLI arguments. |

### 3.3 Results and Analytics (Result Store)

| ID | Priority | Statement |
|----|----------|-----------|
| **FR-09** | Must | The system shall **load aggregated or curated outputs** into a **cloud data warehouse** (e.g., Redshift, BigQuery, Snowflake, Synapse) as **queryable tables** or **views**. |
| **FR-10** | Must | The assessor shall be able to **verify correctness** by running **at least two** representative SQL queries against the warehouse (e.g., row counts, aggregate totals matching expected benchmarks documented in validation). |
| **FR-11** | Should | Schema for warehouse tables shall be **documented** (column names, types, grain of aggregation). |

### 3.4 Security, Identity, and Access

| ID | Priority | Statement |
|----|----------|-----------|
| **FR-12** | Must | The system shall implement **authentication** for human operators appropriate to the chosen interface (e.g., cloud console SSO, application login, or API keys stored outside version control — method documented). |
| **FR-13** | Must | The system shall implement **authorisation** such that only designated principals can **read/write** sensitive buckets, run jobs, or query sensitive tables (IAM policies, role assumption, or equivalent). |
| **FR-14** | Should | Secrets (access keys, passwords) shall **not** be committed to source control; use environment variables, secrets manager, or college-approved method. |

### 3.5 Operations, Monitoring, and Demonstration

| ID | Priority | Statement |
|----|----------|-----------|
| **FR-15** | Must | The system shall produce **auditable evidence** of execution (job run IDs, logs, or console screenshots) suitable for Milestone 4 demonstration. |
| **FR-16** | Should | The system shall expose **basic health information** (last successful run time, failure status) via logs or a simple status page/notebook output. |

### 3.6 Documentation Deliverables (Cross-Milestone, Required by Brief)

| ID | Priority | Statement |
|----|----------|-----------|
| **FR-17** | Must | The final submission shall include a **system architecture diagram** showing interactions among front-end (if any), load balancers (if any), compute, and storage [1]. |
| **FR-18** | Must | The final submission shall include a **scalability analysis** describing behaviour under increasing data volume or concurrent jobs [1]. |
| **FR-19** | Must | The final submission shall include **fault tolerance mechanisms** describing steps when a node or service fails [1]. |
| **FR-20** | Must | The final submission shall include **security configuration** evidence (e.g., IAM policy summaries, network security group rules, least-privilege narrative) [1]. |

---

## 4. Non-Functional Requirements

### 4.1 Performance and Scalability

| ID | Priority | Statement |
|----|----------|-----------|
| **NFR-01** | Must | The processing layer shall **scale horizontally** (increase workers / auto-scaling group / managed worker count) within the limits of the student cloud account; scalability limits and observed behaviour shall be documented. |
| **NFR-02** | Should | End-to-end batch runtime for the **`Synthetic_Data`** pipeline run shall be measured and reported (no fixed SLA required; trend vs. single-node baseline acceptable). |

### 4.2 Reliability and Fault Tolerance

| ID | Priority | Statement |
|----|----------|-----------|
| **NFR-03** | Must | The design shall address **single-node / single-task failure** using platform features (e.g., Spark stage retries, EMR/Glue retries, multi-AZ where applicable) and shall describe **operator recovery steps** [1]. |
| **NFR-04** | Should | Critical data shall rely on **durable storage** (object store / warehouse durability guarantees) rather than ephemeral cluster disks alone. |

### 4.3 Security

| ID | Priority | Statement |
|----|----------|-----------|
| **NFR-05** | Must | **Least privilege:** default deny; grants limited to required actions on required resources (documented IAM or RBAC policies). |
| **NFR-06** | Must | **Network controls:** processing and data services placed in private connectivity patterns where the cloud provider supports it; public endpoints justified if used. |
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

---

## 5. Validation Criteria and Acceptance

Validation ties measurable evidence to requirements.

### 5.1 Milestone 1 (This Document)

| Criterion | Evidence |
|-----------|----------|
| **V-01** | Completeness — all sections 1–5 present; FR and NFR tables complete |
| **V-02** | Clarity — requirements are unambiguous and testable (no “fast”, “good” without measure) |
| **V-03** | Alignment — input → processing → warehouse path traced to FR-01, FR-05, FR-09; **`Synthetic_Data`** named as reference dataset (§2.7) |
| **V-04** | Constraints — cloud SDK/API use and security expectations stated |

### 5.2 System-Level Acceptance (End of Project)

| Criterion | Evidence |
|-----------|----------|
| **V-05** Demo | Live or recorded walkthrough showing data in distributed store, job execution, warehouse queries [1] |
| **V-06** Security | IAM/RBAC artefacts and narrative for FR-12–FR-14 |
| **V-07** Scalability | NFR-01 addressed with test or reasoned analysis |
| **V-08** Fault tolerance | NFR-03 with concrete scenario (e.g., kill worker, retry, or service outage drill) |
| **V-09** Documentation | FR-17–FR-20 satisfied in final report |

### 5.3 Traceability (Summary)

- **Exam brief [1]** → FR-01, FR-05, FR-09, FR-17–FR-20  
- **Reference dataset [5]** → §2.7, A1, FR-05, FR-10, NFR-02  
- **Milestone 3 secure implementation** → FR-12–FR-14, NFR-05–NFR-07  
- **Presentation milestone** → FR-15–FR-16, V-05  

---

## 6. Revision History

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 1.0 | April 2026 | Project team | Initial SRS for Milestone 1 |
| 1.1 | April 2026 | Project team | Bound requirements to repository **`Synthetic_Data`** (§2.7), reference [5], A1/NFR-02/V-03 updates |

---

*End of SRS (Milestone One).*
