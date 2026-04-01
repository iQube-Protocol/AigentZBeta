#!/usr/bin/env python3
"""Create a repeatable QubeTalk bridge outbox packet for relay by Lovable.

Packet includes optional embedded file payloads so Claude can apply delivered
changes without branch or PR juggling.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import subprocess
from pathlib import Path

CHANNEL_ID = "metame-runtime-thinclient"


def run_git(args: list[str]) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_file_payload(repo_root: Path, rel_path: str) -> dict:
    file_path = repo_root / rel_path
    if not file_path.exists():
        raise FileNotFoundError(f"Path not found: {rel_path}")
    if file_path.is_dir():
        raise IsADirectoryError(f"Path is a directory: {rel_path}")

    raw = file_path.read_bytes()
    text = raw.decode("utf-8")
    return {
        "path": rel_path,
        "encoding": "utf-8",
        "sha256": hashlib.sha256(raw).hexdigest(),
        "size_bytes": len(raw),
        "content": text,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a QubeTalk bridge outbox packet")
    parser.add_argument("--story", required=True, help="Story/epic key, e.g. EXP-208")
    parser.add_argument("--title", required=True, help="Short packet title")
    parser.add_argument("--body", required=True, help="Detailed status or handoff notes")
    parser.add_argument("--thread", default="dev-exec", choices=["spec", "api-wiring", "ui-shell", "dev-exec", "ops"])
    parser.add_argument("--type", dest="msg_type", default="status", choices=["task", "status", "question", "handoff"])
    parser.add_argument("--severity", default="info", choices=["info", "warning", "blocker"])
    parser.add_argument("--status", default="open", choices=["open", "in_progress", "done"])
    parser.add_argument("--assignee", default="claude-code")
    parser.add_argument("--deploy-ready", action="store_true", help="Set true when this packet is deploy-ready")
    parser.add_argument("--tests", action="append", default=[], help="Repeatable test/check command that was run")
    parser.add_argument("--paths", action="append", default=[], help="Repeatable path list for changed artifacts")
    parser.add_argument("--no-embed", action="store_true", help="Do not embed file contents")

    args = parser.parse_args()

    repo_root = Path(run_git(["rev-parse", "--show-toplevel"]))
    branch = run_git(["rev-parse", "--abbrev-ref", "HEAD"])
    sha = run_git(["rev-parse", "HEAD"])
    ts = utc_now()
    ts_file = ts.replace(":", "-")

    outbox = repo_root / "docs" / "qubetalk-bridge" / "outbox"
    outbox.mkdir(parents=True, exist_ok=True)

    file_payloads = []
    if args.paths and not args.no_embed:
        for rel_path in args.paths:
            file_payloads.append(read_file_payload(repo_root, rel_path))

    packet = {
        "channel_id": CHANNEL_ID,
        "from_agent": {"id": "openai-codex", "label": "OpenAI Codex"},
        "thread": args.thread,
        "type": "text",
        "content": f"[{args.story}] {args.title}",
        "metadata": {
            "type": args.msg_type,
            "severity": args.severity,
            "title": args.title,
            "body": args.body,
            "control": {
                "id": f"codex-{args.story.lower()}-{sha[:8]}",
                "status": args.status,
                "assignee": args.assignee,
                "depends_on": ["relay-qubetalk-bridge"],
            },
            "refs": {
                "repo": repo_root.name,
                "paths": args.paths,
                "endpoints": [],
                "env": ["workspace-file-bridge"],
                "branch": branch,
                "commit": sha,
                "timestamp": ts,
                "deploy_ready": args.deploy_ready,
                "tests": args.tests,
                "embedded_file_count": len(file_payloads),
                "file_payloads": file_payloads,
            },
            "attestations": {
                "authority": "openai_codex",
                "signature": "openai_codex:",
            },
        },
    }

    filename = outbox / f"openai-codex-{args.story.lower()}-{ts_file}.json"
    filename.write_text(json.dumps(packet, indent=2) + "\n")
    print(filename.relative_to(repo_root))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
