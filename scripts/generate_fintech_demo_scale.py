"""Optional: generate synthetic dim_customers / dim_accounts rows.

Canonical fintech datasets are the 10 CSVs under data/fintech/; restore them with git, e.g.:
  git checkout 6d1e272 -- data/fintech/dim_*.csv data/fintech/fact_*.csv

Do not run this script unless you intentionally want to replace those files with synthetic data.
"""
from __future__ import annotations

import argparse
import csv
from pathlib import Path

REGIONS = ("Central", "East", "West", "North")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--customers", type=int, default=10_000, help="Number of customer rows")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "data" / "fintech",
        help="Directory for dim_customers.csv and dim_accounts.csv",
    )
    args = parser.parse_args()
    n = max(1, args.customers)
    data_dir: Path = args.data_dir
    data_dir.mkdir(parents=True, exist_ok=True)

    cust_path = data_dir / "dim_customers.csv"
    acct_path = data_dir / "dim_accounts.csv"

    with cust_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["customer_id", "full_name", "region"])
        for i in range(1, n + 1):
            cid = f"CUST{i:05d}"
            w.writerow([cid, f"Customer {i}", REGIONS[(i - 1) % len(REGIONS)]])

    with acct_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["account_id", "customer_id", "current_balance"])
        for i in range(1, n + 1):
            cid = f"CUST{i:05d}"
            aid = f"ACC{i:05d}"
            balance = 500_000.0 + (i % 1000) * 1_000.5
            w.writerow([aid, cid, f"{balance:.2f}"])

    print(f"Wrote {n} rows -> {cust_path}")
    print(f"Wrote {n} rows -> {acct_path}")


if __name__ == "__main__":
    main()
