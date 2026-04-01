#!/usr/bin/env python3
"""
list_pending.py — Show pending QubeTalk bridge outbox packets.

Usage:
    python3 scripts/qubetalk_bridge/list_pending.py [--json]

Output:
    Table of pending packets: agent, story, status, deploy_ready, files count, created_at
    With --json: raw JSON array of packet summaries
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
OUTBOX_DIR = REPO_ROOT / "docs" / "qubetalk-bridge" / "outbox"


def load_packets() -> list[dict]:
    packets = []
    if not OUTBOX_DIR.exists():
        return packets
    for f in sorted(OUTBOX_DIR.glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            meta = data.get("metadata", {})
            packets.append({
                "filename": f.name,
                "from": data.get("from_agent", {}).get("id", "?"),
                "thread": data.get("thread", "?"),
                "story": meta.get("story", "?"),
                "status": meta.get("status", "?"),
                "deploy_ready": meta.get("deploy_ready", False),
                "files": len(data.get("files", [])),
                "severity": data.get("severity", "info"),
                "created_at": meta.get("created_at", "?"),
                "title": data.get("title", ""),
            })
        except Exception as e:
            packets.append({"filename": f.name, "error": str(e)})
    return packets


def main():
    as_json = "--json" in sys.argv
    packets = load_packets()

    if not packets:
        print("No pending outbox packets.")
        return

    if as_json:
        print(json.dumps(packets, indent=2))
        return

    # Table output
    cols = ["from", "story", "status", "deploy_ready", "files", "severity", "created_at"]
    widths = {c: max(len(c), max((len(str(p.get(c, ""))) for p in packets), default=0)) for c in cols}
    widths["title"] = 40

    header = "  ".join(c.upper().ljust(widths[c]) for c in cols) + "  TITLE"
    print(f"\n{len(packets)} pending packet(s) in outbox:\n")
    print(header)
    print("-" * (len(header) + 42))
    for p in packets:
        row = "  ".join(str(p.get(c, "")).ljust(widths[c]) for c in cols)
        title = p.get("title", "")[:40]
        print(f"{row}  {title}")

    deploy_ready = [p for p in packets if p.get("deploy_ready")]
    if deploy_ready:
        print(f"\n{len(deploy_ready)} packet(s) marked deploy_ready — Claude will apply on next relay.")
    else:
        print("\nNo packets marked deploy_ready yet.")


if __name__ == "__main__":
    main()
