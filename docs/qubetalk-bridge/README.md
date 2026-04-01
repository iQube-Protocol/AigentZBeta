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
2. Delete posted files from `outbox/` (or move to `outbox/sent/`)
3. Fetch the latest 20 messages from the channel into `inbox/latest.json`
