# Airflow + Spark client (spark-submit) — versions aligned with Spark Standalone cluster in docker-compose.
FROM apache/airflow:2.8.3-python3.11

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-17-jre-headless curl \
    && rm -rf /var/lib/apt/lists/*

ENV SPARK_VERSION=3.5.1
ENV HADOOP_VERSION=3
ENV SPARK_HOME=/opt/spark
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

RUN set -eux; \
    SPARK_TGZ="/tmp/spark-${SPARK_VERSION}-bin-hadoop${HADOOP_VERSION}.tgz"; \
    SPARK_URL="https://archive.apache.org/dist/spark/spark-${SPARK_VERSION}/spark-${SPARK_VERSION}-bin-hadoop${HADOOP_VERSION}.tgz"; \
    curl -fL --retry 8 --retry-all-errors --retry-delay 5 -o "${SPARK_TGZ}" "${SPARK_URL}"; \
    tar -tzf "${SPARK_TGZ}" > /dev/null; \
    tar -xzf "${SPARK_TGZ}" -C /opt; \
    ln -sfn "/opt/spark-${SPARK_VERSION}-bin-hadoop${HADOOP_VERSION}" "${SPARK_HOME}"; \
    rm -f "${SPARK_TGZ}"

ENV PATH="${SPARK_HOME}/bin:${PATH}"

USER airflow
RUN pip install --no-cache-dir psycopg2-binary==2.9.9
