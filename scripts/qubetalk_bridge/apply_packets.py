#!/usr/bin/env python3
"""Apply relayed Codex packet payloads into the repository workspace.

Expected flow: Lovable relays QubeTalk -> inbox snapshot contains packet payloads ->
Claude runs this script to materialize files before deploy.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INBOX = ROOT / "docs" / "qubetalk-bridge" / "inbox" / "latest.json"


def collect_payloads(inbox_data: dict) -> list[dict]:
    payloads: list[dict] = []

    # case 1: direct single packet (outbox json)
    direct_refs = inbox_data.get("metadata", {}).get("refs", {})
    if direct_refs.get("file_payloads"):
        payloads.append({"source": "direct-packet", "file_payloads": direct_refs.get("file_payloads", [])})

    # case 2: inbox snapshot with top-level packets list
    direct = inbox_data.get("packets", [])
    if isinstance(direct, list):
        payloads.extend(direct)

    # case 3: inbox snapshot with message list
    for msg in inbox_data.get("messages", []):
        refs = msg.get("metadata", {}).get("refs", {})
        file_payloads = refs.get("file_payloads", [])
        if file_payloads:
            payloads.append({"source": msg.get("message_id", "unknown"), "file_payloads": file_payloads})

    return payloads


def verify_sha(content: str, expected_sha: str) -> bool:
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
    return digest == expected_sha


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply file payloads from relayed bridge packets")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without writing files")
    parser.add_argument("--source", default=str(INBOX), help="Inbox JSON source file")
    args = parser.parse_args()

    source = Path(args.source)
    if not source.exists():
        raise SystemExit(f"Inbox source not found: {source}")

    data = json.loads(source.read_text())
    payload_sets = collect_payloads(data)
    if not payload_sets:
        print("No payloads found in inbox source.")
        return 0

    writes = 0
    for packet in payload_sets:
        for item in packet.get("file_payloads", []):
            rel_path = item["path"]
            content = item["content"]
            expected_sha = item.get("sha256")
            target = ROOT / rel_path
            target.parent.mkdir(parents=True, exist_ok=True)

            if expected_sha and not verify_sha(content, expected_sha):
                raise SystemExit(f"SHA mismatch for payload: {rel_path}")

            if args.dry_run:
                print(f"DRY-RUN write: {rel_path}")
                writes += 1
                continue

            target.write_text(content)
            print(f"Wrote: {rel_path}")
            writes += 1

    print(f"Applied files: {writes}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
