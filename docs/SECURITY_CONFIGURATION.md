# Security Configuration

## Identity and access
- Airflow uses authenticated UI users (`airflow-init` user creation).
- Backend API serves read-only metrics from mounted data path.
- Postgres access is restricted to internal compose network except published ports needed for development.

## Data access controls
- Fintech dataset mounted read-only into backend and airflow (`:ro` bind mounts).
- Spark jobs mounted read-only into airflow/spark services.
- Curated writes go only to Postgres `analytics` database.

## Network controls
- Docker internal network used for service-to-service communication.
- Only required ports are exposed:
  - 5173 (frontend), 5000 (backend), 8080 (airflow), 8085 (spark UI), 9870/8088/8188 (hadoop UIs), 9001 (minio console).

## Secret handling guidance
- `.env` file provides runtime secrets/keys (e.g., `AIRFLOW__CORE__FERNET_KEY`).
- `.env` is gitignored; commit only `.env.example`.
- Replace default credentials before external exposure.

