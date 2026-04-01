# QubeTalk File Bridge

This bridge is a fallback communication path for agents that cannot reach Supabase QubeTalk endpoints directly from the workspace network.

## Layout

- `inbox/latest.json` — latest relayed channel snapshot from Lovable.
- `outbox/*.json` — messages queued by agents for Lovable to relay.

Use ISO-like timestamp filenames for outbox messages, for example:
- `openai-codex-2026-04-01T19-00-00Z.json`
- `claude-code-2026-04-01T19-02-10Z.json`

## Threads

| Thread | Purpose |
|---|---|
| `spec` | Contract definitions and schema proposals |
| `api-wiring` | Endpoint contracts and artifact sync |
| `ui-shell` | Runtime cards and menu wiring |
| `dev-exec` | Build status, blockers, and PR coordination |
| `ops` | Deployment, registry, and infra |

## Agent IDs

| Agent | `from_agent.id` | `from_agent.label` |
|---|---|---|
| Claude Code | `claude-code` | `Claude Code` |
| OpenAI Codex | `openai-codex` | `OpenAI Codex` |
| Lovable | `lovable-metame` | `Lovable MetaMe` |

## Outbox schema

```json
{
  "channel_id": "metame-runtime-thinclient",
  "from_agent": { "id": "openai-codex", "label": "OpenAI Codex" },
  "thread": "dev-exec",
  "type": "text",
  "content": "[EXP-208] EXP-208 complete",
  "metadata": {
    "type": "status",
    "severity": "info",
    "title": "EXP-208 complete",
    "body": "NBE ranking engine merged and validated.",
    "control": {
      "id": "codex-exp-208-<sha8>",
      "status": "done",
      "assignee": "claude-code",
      "depends_on": ["relay-qubetalk-bridge"]
    },
    "refs": {
      "repo": "AigentZBeta",
      "paths": ["path/to/file.ts"],
      "branch": "work",
      "commit": "<sha>",
      "timestamp": "2026-04-01T19:20:00Z",
      "deploy_ready": true,
      "tests": ["pnpm test"],
      "embedded_file_count": 1,
      "file_payloads": [
        {
          "path": "path/to/file.ts",
          "encoding": "utf-8",
          "sha256": "...",
          "size_bytes": 123,
          "content": "<full file contents>"
        }
      ]
    }
  }
}
```

## Relay command

Ask Lovable to run: **"Relay QubeTalk bridge"**.

Expected relay behavior:
1. Post all `outbox/*.json` messages to QubeTalk.
2. Refresh `inbox/latest.json` with recent channel history.
3. Optionally archive processed outbox files.

## Coordination protocol

1. Before starting a story, post a `task` with `status: in_progress`.
2. If blocked, post a `question` with `severity: blocker` and an assignee.
3. When done, post a `status` with `control.status: done`.
4. Post contract payload handoffs under `api-wiring`.

## Bridge state tracking

- Operational state is recorded in `STATUS.md`.
- Treat `inbox/latest.json` as stale until Lovable runs **"Relay QubeTalk bridge"** and `fetched_at` advances.
- Deployment gate: do not trigger Amplify until inbox confirms both Codex and Claude Sprint artifacts are visible.

## Repeatable parallel-delivery loop (no PR juggling)

```text
Codex finish work
  -> create_packet.py --deploy-ready --paths <files>
  -> Lovable: Relay QubeTalk bridge
  -> Claude: apply_packets.py
  -> Claude deploy gate checks
  -> Deploy from origin/ev
```

### Codex packet command

```bash
python3 scripts/qubetalk_bridge/create_packet.py \
  --story EXP-208 \
  --title "EXP-208 complete" \
  --body "NBE ranking engine merged and validated." \
  --thread spec \
  --type status \
  --status done \
  --paths docs/agent-harness/metaproof-core.md \
  --tests "pnpm test" \
  --tests "pnpm lint" \
  --deploy-ready
```

### Claude apply command

```bash
python3 scripts/qubetalk_bridge/apply_packets.py
```

### Pending queue check

```bash
python3 scripts/qubetalk_bridge/list_pending.py
```
