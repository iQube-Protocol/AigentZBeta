#!/usr/bin/env python3
"""
create_packet.py — Generate a QubeTalk bridge outbox packet.

Usage:
    python3 scripts/qubetalk_bridge/create_packet.py \
        --story DEV-1002 \
        --title "DEV-1002 AGENTS.md completed" \
        --body "Codex completed AGENTS.md generation." \
        --thread dev-exec \
        --type status \
        --status done \
        --paths AGENTS.md scripts/qubetalk_bridge/create_packet.py \
        --tests "python3 scripts/qubetalk_bridge/list_pending.py" \
        --deploy-ready

Flags:
    --story         Story key (e.g. DEV-1002)
    --title         Short title (≤80 chars)
    --body          Full message body
    --thread        QubeTalk thread: spec|api-wiring|ui-shell|dev-exec|ops
    --type          Metadata type: task|decision|question|status|patch|log
    --status        done|partial|blocked
    --severity      info|warn|blocker  (default: info)
    --paths         Space-separated repo-relative file paths to embed in packet
    --tests         Test command(s) that were run (evidence string)
    --deploy-ready  Flag: include this to mark packet as ready for Claude deploy
    --agent-id      Override agent ID (default: openai-codex)
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
OUTBOX_DIR = REPO_ROOT / "docs" / "qubetalk-bridge" / "outbox"

AGENT_DEFAULTS = {
    "openai-codex": "OpenAI Codex",
    "claude-code": "Claude Code",
    "lovable-metame": "Lovable MetaMe",
}


def read_file_contents(paths: list[str]) -> list[dict]:
    files = []
    for rel_path in paths:
        abs_path = REPO_ROOT / rel_path
        if not abs_path.exists():
            print(f"WARNING: {rel_path} not found — skipping", file=sys.stderr)
            continue
        try:
            content = abs_path.read_text(encoding="utf-8")
            files.append({"path": rel_path, "content": content})
        except Exception as e:
            print(f"WARNING: could not read {rel_path}: {e}", file=sys.stderr)
    return files


def main():
    parser = argparse.ArgumentParser(description="Create a QubeTalk bridge outbox packet")
    parser.add_argument("--story", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--body", required=True)
    parser.add_argument("--thread", default="dev-exec",
                        choices=["spec", "api-wiring", "ui-shell", "dev-exec", "ops"])
    parser.add_argument("--type", dest="msg_type", default="status",
                        choices=["task", "decision", "question", "status", "patch", "log"])
    parser.add_argument("--status", default="done",
                        choices=["done", "partial", "blocked"])
    parser.add_argument("--severity", default="info",
                        choices=["info", "warn", "blocker"])
    parser.add_argument("--paths", nargs="*", default=[])
    parser.add_argument("--tests", default=None)
    parser.add_argument("--deploy-ready", action="store_true")
    parser.add_argument("--agent-id", default="openai-codex")
    args = parser.parse_args()

    agent_label = AGENT_DEFAULTS.get(args.agent_id, args.agent_id)
    now = datetime.now(timezone.utc)
    ts = now.strftime("%Y-%m-%dT%H-%M-%SZ")
    story_slug = args.story.lower().replace(" ", "-")

    # Collect git info if available
    branch, commit_sha = None, None
    try:
        import subprocess
        branch = subprocess.check_output(
            ["git", "branch", "--show-current"], cwd=REPO_ROOT, text=True
        ).strip()
        commit_sha = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=REPO_ROOT, text=True
        ).strip()
    except Exception:
        pass

    files = read_file_contents(args.paths) if args.paths else []

    packet = {
        "from_agent": {"id": args.agent_id, "label": agent_label},
        "thread": args.thread,
        "title": args.title,
        "body": args.body,
        "severity": args.severity,
        "metadata": {
            "type": args.msg_type,
            "story": args.story,
            "status": args.status,
            "deploy_ready": args.deploy_ready,
            "branch": branch,
            "commit_sha": commit_sha,
            "created_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "tests_run": args.tests,
            "tags": [args.story, args.thread],
        },
        "files": files,
    }

    filename = f"{args.agent_id}-{story_slug}-{ts}.json"
    out_path = OUTBOX_DIR / filename
    OUTBOX_DIR.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(packet, indent=2), encoding="utf-8")

    print(f"Packet written: docs/qubetalk-bridge/outbox/{filename}")
    if files:
        print(f"  Embedded {len(files)} file(s): {[f['path'] for f in files]}")
    if args.deploy_ready:
        print("  deploy_ready: true — Claude will apply files and deploy on next relay")
    print(f"\nNext step: ask Lovable to 'Relay QubeTalk bridge'")


if __name__ == "__main__":
    main()
