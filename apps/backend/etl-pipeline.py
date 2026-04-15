from __future__ import annotations

import json
from pathlib import Path

from app.config import Settings
from app.etl_delegate import run_delegate_etl


def main() -> None:
    registry = Settings.METADATA_DIR / "dataset_registry.json"
    result = run_delegate_etl(metadata_registry=registry)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
