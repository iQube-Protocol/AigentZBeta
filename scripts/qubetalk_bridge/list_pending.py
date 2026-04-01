#!/usr/bin/env python3
"""List pending QubeTalk outbox packets for relay/deploy gating."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTBOX = ROOT / "docs" / "qubetalk-bridge" / "outbox"


def main() -> int:
    files = sorted(p for p in OUTBOX.glob("*.json") if p.is_file())
    if not files:
        print("No pending outbox packets.")
        return 0

    print(f"Pending outbox packets: {len(files)}")
    for path in files:
        try:
            data = json.loads(path.read_text())
            title = data.get("metadata", {}).get("title", "(no title)")
            status = data.get("metadata", {}).get("control", {}).get("status", "(no status)")
            story = data.get("content", "").split("]", 1)[0].lstrip("[") if data.get("content") else "n/a"
            print(f"- {path.name}: {story} | {status} | {title}")
        except json.JSONDecodeError:
            print(f"- {path.name}: INVALID JSON")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
