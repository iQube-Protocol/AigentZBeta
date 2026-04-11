# QubeTalk File Bridge

Claude Code and Codex cannot reach Supabase/QubeTalk directly from their sandboxes.
Lovable acts as the relay — it reads this directory and posts/fetches on behalf of all agents.

## How to use

### Sending a message

Write a JSON file to `outbox/` with filename `<agent-id>-<timestamp>.json`:

```json
{
  "from_agent": {
    "id": "claude-code",
    "label": "Claude Code"
  },
  "thread": "dev-exec",
  "title": "Short title",
  "body": "Full message body here.",
  "severity": "info",
  "metadata": {
    "type": "status",
    "tags": []
  }
}
```

Then ask the user: **"Ask Lovable to relay QubeTalk bridge"** — Lovable will post all `outbox/*.json` files to the channel and refresh `inbox/latest.json`.

### Reading messages

Check `inbox/latest.json` for the current channel state. This file is refreshed each time Lovable relays.

If you need full message bodies for specific messages, note the `message_id` and ask the user to ask Lovable to fetch them.

## Message schema

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `from_agent.id` | string | yes | See Agent IDs below |
| `from_agent.label` | string | yes | Human-readable name |
| `thread` | string | yes | See Threads below |
| `title` | string | yes | Short summary (≤80 chars) |
| `body` | string | yes | Full message content |
| `severity` | `info\|warn\|blocker` | yes | |
| `metadata.type` | string | no | `task\|decision\|question\|status\|patch\|log` |
| `metadata.tags` | string[] | no | Free-form |

## Outbox filename convention

```
<agent-id>-<ISO8601-compact>.json
```

Example: `claude-code-2026-04-01T19-00-00Z.json`

## Threads

| Thread | Purpose |
|--------|---------|
| `spec` | Contract and schema proposals |
| `api-wiring` | Endpoint contracts, artifact sync |
| `ui-shell` | Runtime card specs, menu wiring |
| `dev-exec` | Build status, blocker coordination |
| `ops` | Deployment, infra |

## Agent IDs

| Agent | `from_agent.id` | `from_agent.label` |
|-------|-----------------|---------------------|
| Claude Code | `claude-code` | Claude Code |
| OpenAI Codex | `openai-codex` | OpenAI Codex |
| Lovable | `lovable-metame` | Lovable MetaMe |

## Relay command

Ask Lovable: **"Relay QubeTalk bridge"** — it will:
1. Post all `outbox/*.json` files to the `metame-runtime-thinclient` channel
2. Move posted files to `outbox/sent/`
3. Fetch the latest 20 messages from the channel into `inbox/latest.json`

---

## Code Transfer Protocol (Codex → Claude)

Codex cannot push to GitHub directly. To deliver code to the repo:

### Codex: generate a packet with embedded files

```bash
python3 scripts/qubetalk_bridge/create_packet.py \
  --story DEV-1002 \
  --title "DEV-1002 AGENTS.md completed" \
  --body "Codex completed AGENTS.md and helper scripts." \
  --thread dev-exec \
  --type status \
  --status done \
  --paths AGENTS.md scripts/qubetalk_bridge/create_packet.py \
  --tests "python3 scripts/qubetalk_bridge/list_pending.py" \
  --deploy-ready
```

This writes a packet to `outbox/` with a `files` array containing the full content of each path.

### Codex: check what's pending

```bash
python3 scripts/qubetalk_bridge/list_pending.py
```

### User: trigger relay

Ask Lovable: **"Relay QubeTalk bridge"**

### Claude: apply files from bridge and deploy

```bash
# 1. Apply all deploy_ready packet file contents to repo
python3 scripts/qubetalk_bridge/apply_packets.py

# 2. Stage and commit applied files
git add <files listed by apply_packets.py>
git commit -m "apply codex sprint deliverables from bridge"

# 3. Trigger Amplify deploy
echo "Deploy trigger $(date -u)" > .amplify-deploy
git add .amplify-deploy
git commit -m "trigger deploy to dev"
git push origin HEAD:dev
```

### Packet schema with files

```json
{
  "from_agent": { "id": "openai-codex", "label": "OpenAI Codex" },
  "thread": "dev-exec",
  "title": "DEV-1002 AGENTS.md completed",
  "body": "Full message body.",
  "severity": "info",
  "metadata": {
    "type": "status",
    "story": "DEV-1002",
    "status": "done",
    "deploy_ready": true,
    "branch": "codex/sprint-1",
    "commit_sha": "abc1234",
    "created_at": "2026-04-01T19:08:02Z",
    "tests_run": "python3 scripts/qubetalk_bridge/list_pending.py"
  },
  "files": [
    { "path": "AGENTS.md", "content": "# AGENTS.md\n..." },
    { "path": "scripts/qubetalk_bridge/create_packet.py", "content": "#!/usr/bin/env python3\n..." }
  ]
}
```

---

## Repeatable Sprint/Epic Delivery Loop

```
Codex completes work
    ↓
python3 scripts/qubetalk_bridge/create_packet.py --deploy-ready --paths <files>
    ↓
User: "Ask Lovable to relay QubeTalk bridge"
    ↓
Claude: python3 scripts/qubetalk_bridge/apply_packets.py
    ↓
Claude: git commit + push origin HEAD:dev
    ↓
Amplify auto-builds
```

No manual PRs. No branch juggling. Lovable is the relay; Claude is the deployer.
