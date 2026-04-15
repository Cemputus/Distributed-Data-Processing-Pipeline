"""
Fintech transformation job for DSC3219.

Reads raw fintech CSVs and writes curated analytics CSV outputs.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, count, lit, sum as spark_sum, when


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    spark = SparkSession.builder.appName("fintech_curation_job").getOrCreate()
    try:
        tx = spark.read.option("header", True).csv(str(input_dir / "fact_transactions.csv"))
        fraud = spark.read.option("header", True).csv(str(input_dir / "fact_fraud_alerts.csv"))
        loans = spark.read.option("header", True).csv(str(input_dir / "fact_loans.csv"))
        merchants = spark.read.option("header", True).csv(str(input_dir / "dim_merchants.csv"))

        tx_cast = tx.select(
            col("transaction_id"),
            col("customer_id"),
            col("merchant_id"),
            col("transaction_date"),
            col("status"),
            col("amount").cast("double").alias("amount"),
        )
        fraud_cast = fraud.select(col("transaction_id"), col("alert_status"))
        loans_cast = loans.select(col("customer_id"), col("loan_id"))

        kpi_daily = (
            tx_cast.groupBy("transaction_date")
            .agg(
                count("*").alias("transaction_count"),
                spark_sum("amount").alias("total_amount_ugx"),
                spark_sum(when(col("status") == lit("failed"), 1).otherwise(0)).alias("failed_count"),
            )
            .orderBy(col("transaction_date").asc())
        )

        tx_fraud = tx_cast.join(
            fraud_cast.withColumn("is_fraud", lit(1)),
            on="transaction_id",
            how="left",
        )
        customer_risk = (
            tx_fraud.groupBy("customer_id")
            .agg(
                count("*").alias("transaction_count"),
                spark_sum("amount").alias("total_amount_ugx"),
                spark_sum(when(col("is_fraud").isNotNull(), 1).otherwise(0)).alias("fraud_alert_count"),
            )
            .join(loans_cast.groupBy("customer_id").agg(count("*").alias("loan_count")), on="customer_id", how="left")
            .fillna(0, subset=["loan_count"])
        )

        top_merchants = (
            tx_cast.groupBy("merchant_id")
            .agg(
                count("*").alias("transaction_count"),
                spark_sum("amount").alias("total_amount_ugx"),
            )
            .join(merchants.select("merchant_id", "merchant_name"), on="merchant_id", how="left")
            .orderBy(col("transaction_count").desc(), col("total_amount_ugx").desc())
        )

        kpi_daily.coalesce(1).write.mode("overwrite").option("header", True).csv(str(output_dir / "kpi_daily_transactions"))
        customer_risk.coalesce(1).write.mode("overwrite").option("header", True).csv(str(output_dir / "kpi_customer_risk"))
        top_merchants.coalesce(1).write.mode("overwrite").option("header", True).csv(str(output_dir / "kpi_top_merchants"))
    finally:
        spark.stop()


if __name__ == "__main__":
    main()

