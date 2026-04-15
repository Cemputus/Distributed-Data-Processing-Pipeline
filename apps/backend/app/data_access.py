import csv
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Tuple


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


def numeric_histogram(path: Path, column: str, bins: int = 5) -> Tuple[List[str], List[float]]:
    """Return bin labels and counts for a numeric column (CSV)."""
    if not path.exists():
        return [], []
    values: List[float] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or column not in reader.fieldnames:
            return [], []
        for row in reader:
            try:
                values.append(float(row.get(column) or 0))
            except (TypeError, ValueError):
                continue
    if not values:
        return [], []
    vmin, vmax = min(values), max(values)
    if vmin == vmax:
        return [str(int(vmin))], [float(len(values))]
    step = (vmax - vmin) / max(1, bins)
    counts = [0.0] * bins
    for v in values:
        idx = min(bins - 1, int((v - vmin) / step)) if step > 0 else 0
        counts[idx] += 1.0
    labels = []
    for i in range(bins):
        lo = vmin + i * step
        hi = vmin + (i + 1) * step
        labels.append(f"{lo:.0f}-{hi:.0f}")
    return labels, counts


def count_column_values(path: Path, column: str, limit: int = 10) -> Tuple[List[str], List[float]]:
    """Top values for a categorical column (string)."""
    if not path.exists():
        return [], []
    ctr: Counter = Counter()
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or column not in reader.fieldnames:
            return [], []
        for row in reader:
            ctr[str(row.get(column) or "").strip() or "(empty)"] += 1
    top = ctr.most_common(limit)
    if not top:
        return [], []
    return [t[0][:24] for t in top], [float(t[1]) for t in top]


def registry_uploads_by_day(registry_rows: List[Dict[str, Any]], days: int = 14) -> Tuple[List[str], List[float]]:
    """Count registry rows per UTC date (uploaded_at) for last `days` days."""
    counts: Dict[str, int] = defaultdict(int)
    for row in registry_rows:
        raw = row.get("uploaded_at") or ""
        if not raw:
            continue
        try:
            day = raw[:10]
        except Exception:
            continue
        counts[day] += 1
    if not counts:
        return [], []
    sorted_days = sorted(counts.keys())[-days:]
    labels = sorted_days
    vals = [float(counts[d]) for d in sorted_days]
    return labels, vals


def registry_pipeline_mix(registry_rows: List[Dict[str, Any]]) -> Tuple[List[str], List[float]]:
    mix = Counter()
    for row in registry_rows:
        mix[str(row.get("pipeline_status") or "unknown")] += 1
    labels = list(mix.keys())
    vals = [float(mix[k]) for k in labels]
    return labels, vals

