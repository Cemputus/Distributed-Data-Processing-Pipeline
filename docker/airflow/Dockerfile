# Airflow + Spark client (spark-submit) — versions aligned with Spark Standalone cluster in docker-compose.
FROM apache/airflow:2.8.3-python3.11

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-17-jre-headless curl \
    && rm -rf /var/lib/apt/lists/*

ENV SPARK_VERSION=3.5.4
ENV HADOOP_VERSION=3
ENV SPARK_HOME=/opt/spark
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

RUN curl -fsSL "https://archive.apache.org/dist/spark/spark-${SPARK_VERSION}/spark-${SPARK_VERSION}-bin-hadoop${HADOOP_VERSION}.tgz" \
    | tar xz -C /opt \
    && ln -sfn "/opt/spark-${SPARK_VERSION}-bin-hadoop${HADOOP_VERSION}" "${SPARK_HOME}"

ENV PATH="${SPARK_HOME}/bin:${PATH}"

USER airflow
