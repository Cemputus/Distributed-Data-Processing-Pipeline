# Scalability Analysis

## Goal
Demonstrate that the processing stage handles increasing workloads by scaling Spark workers/executors and observing runtime behavior.

## Test approach
1. Baseline run: single Spark worker (`SPARK_WORKER_CORES=1`, memory `1G`).
2. Scale-up run: increase worker resources (`SPARK_WORKER_CORES=2+`, memory `2G`) and optionally additional worker replicas.
3. Run DAG `distributed_pipeline_scaffold` for each configuration.
4. Record total DAG duration, Spark stage durations, and output row counts.

## Metrics to capture
- DAG total runtime (Airflow task duration)
- Spark job runtime
- Rows written to curated tables
- CPU/memory pressure from Docker stats

## Expected outcome
- Runtime should reduce or remain stable as worker resources increase.
- Output row counts must remain consistent between baseline and scaled runs.

