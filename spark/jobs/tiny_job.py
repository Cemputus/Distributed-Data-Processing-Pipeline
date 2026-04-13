"""
Tiny PySpark job — submitted to Spark Standalone (cluster deploy mode).
Mounted read-only at /opt/spark-jobs/tiny_job.py on Airflow and Spark nodes.
"""
from __future__ import annotations

from pyspark.sql import SparkSession


def main() -> None:
    spark = (
        SparkSession.builder.appName("tiny_standalone_job")
        .getOrCreate()
    )
    try:
        n = 1000
        count = spark.range(0, n, 1, 8).count()
        if count != n:
            raise RuntimeError(f"expected count {n}, got {count}")
        total = spark.sparkContext.parallelize(range(10), 4).sum()
        if total != sum(range(10)):
            raise RuntimeError(f"expected sum {sum(range(10))}, got {total}")
        print(f"OK: range_count={count}, parallelize_sum={total}")
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
