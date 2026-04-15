import csv
from pathlib import Path
from typing import Dict, List


def count_rows(file_path: Path) -> int:
    if not file_path.exists():
        return 0
    with file_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        next(reader, None)
        return sum(1 for _ in reader)


def sum_column(file_path: Path, column: str) -> float:
    if not file_path.exists():
        return 0.0
    total = 0.0
    with file_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            value = row.get(column, "0")
            try:
                total += float(value)
            except (TypeError, ValueError):
                continue
    return total


def top_merchants_from_transactions(
    transactions_path: Path, merchants_path: Path, limit: int = 5
) -> List[Dict[str, object]]:
    if not transactions_path.exists() or not merchants_path.exists():
        return []

    merchant_names: Dict[str, str] = {}
    with merchants_path.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            merchant_names[row["merchant_id"]] = row.get("merchant_name", row["merchant_id"])

    stats: Dict[str, Dict[str, object]] = {}
    with transactions_path.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            merchant_id = row.get("merchant_id", "")
            if not merchant_id:
                continue
            amount = 0.0
            try:
                amount = float(row.get("amount", "0"))
            except (TypeError, ValueError):
                pass
            entry = stats.setdefault(
                merchant_id,
                {
                    "merchant_id": merchant_id,
                    "merchant_name": merchant_names.get(merchant_id, merchant_id),
                    "transaction_count": 0,
                    "total_amount_ugx": 0,
                },
            )
            entry["transaction_count"] += 1
            entry["total_amount_ugx"] += int(amount)

    ranked = sorted(
        stats.values(),
        key=lambda item: (item["transaction_count"], item["total_amount_ugx"]),
        reverse=True,
    )
    return ranked[:limit]

