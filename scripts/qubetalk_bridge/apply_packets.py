#!/usr/bin/env python3
"""
apply_packets.py — Read deploy_ready packets from the bridge inbox/outbox,
apply embedded file contents to the repo, and report what was written.

Run by Claude Code after Lovable relays the bridge.

Usage:
    python3 scripts/qubetalk_bridge/apply_packets.py [--dry-run]

Behaviour:
    1. Scans outbox/*.json for packets with deploy_ready=true
    2. Also scans inbox/latest.json for any packets with files[] from other agents
    3. Writes each file in packet["files"] to the repo (path relative to repo root)
    4. Moves applied outbox packets to outbox/sent/
    5. Prints a summary of applied files for git staging

With --dry-run:
    Reports what would be written without touching the filesystem.
"""

import json
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
OUTBOX_DIR = REPO_ROOT / "docs" / "qubetalk-bridge" / "outbox"
SENT_DIR = OUTBOX_DIR / "sent"
INBOX_FILE = REPO_ROOT / "docs" / "qubetalk-bridge" / "inbox" / "latest.json"

DRY_RUN = "--dry-run" in sys.argv


def apply_files(files: list[dict], source: str) -> list[str]:
    written = []
    for f in files:
        rel_path = f.get("path")
        content = f.get("content")
        if not rel_path or content is None:
            print(f"  SKIP: malformed file entry in {source}", file=sys.stderr)
            continue
        abs_path = REPO_ROOT / rel_path
        if DRY_RUN:
            print(f"  [dry-run] would write {rel_path} ({len(content)} chars)")
        else:
            abs_path.parent.mkdir(parents=True, exist_ok=True)
            abs_path.write_text(content, encoding="utf-8")
            print(f"  wrote {rel_path} ({len(content)} chars)")
        written.append(rel_path)
    return written


def process_outbox() -> list[str]:
    all_written = []
    for packet_file in sorted(OUTBOX_DIR.glob("*.json")):
        try:
            data = json.loads(packet_file.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"SKIP {packet_file.name}: {e}", file=sys.stderr)
            continue

        meta = data.get("metadata", {})
        if not meta.get("deploy_ready"):
            continue

        agent = data.get("from_agent", {}).get("id", "?")
        story = meta.get("story", "?")
        files = data.get("files", [])

        print(f"\nApplying outbox packet: {packet_file.name}")
        print(f"  agent={agent}  story={story}  files={len(files)}")

        written = apply_files(files, packet_file.name)
        all_written.extend(written)

        if not DRY_RUN:
            SENT_DIR.mkdir(exist_ok=True)
            shutil.move(str(packet_file), str(SENT_DIR / packet_file.name))
            print(f"  moved to outbox/sent/")

    return all_written


def process_inbox() -> list[str]:
    """Apply any file-carrying messages from the inbox (posted by other agents via QubeTalk)."""
    all_written = []
    if not INBOX_FILE.exists():
        return all_written

    try:
        inbox = json.loads(INBOX_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Could not read inbox: {e}", file=sys.stderr)
        return all_written

    for msg in inbox.get("messages", []):
        files = msg.get("files", [])
        if not files:
            continue
        meta = msg.get("metadata", {})
        if not meta.get("deploy_ready"):
            continue
        agent = msg.get("from", "?")
        story = meta.get("story", "?")
        print(f"\nApplying inbox message from {agent} (story={story}, files={len(files)})")
        written = apply_files(files, f"inbox/{msg.get('message_id', '?')}")
        all_written.extend(written)

    return all_written


def main():
    print(f"{'[DRY RUN] ' if DRY_RUN else ''}Bridge apply starting...\n")

    outbox_written = process_outbox()
    inbox_written = process_inbox()
    all_written = outbox_written + inbox_written

    print(f"\n{'─' * 50}")
    if all_written:
        print(f"{'Would write' if DRY_RUN else 'Written'} {len(all_written)} file(s):")
        for p in all_written:
            print(f"  {p}")
        if not DRY_RUN:
            print("\nNext steps:")
            print("  git add " + " ".join(f'"{p}"' for p in all_written))
            print("  git commit -m 'apply codex sprint deliverables from bridge'")
            print("  echo 'Deploy trigger ...' > .amplify-deploy && git add .amplify-deploy")
            print("  git commit -m 'trigger deploy to dev'")
            print("  git push origin HEAD:dev")
    else:
        print("No deploy_ready packets with files found.")
        print("Waiting for Codex to push packets via create_packet.py --deploy-ready")


if __name__ == "__main__":
    main()
