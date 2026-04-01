# Bridge-to-Deploy Workflow

Use this when Codex and Claude run in parallel and Lovable relays bridge packets.

## Roles

- **Codex**: implements work and writes outbox packets (`deploy_ready=true` only when complete).
- **Lovable**: relays outbox to QubeTalk and refreshes inbox snapshots.
- **Claude**: consumes inbox state, verifies readiness, merges/deploys to `origin/ev`, posts receipt.

## Standard operating cycle

1. Codex commits work on branch.
2. Codex creates outbox packet via `scripts/qubetalk_bridge/create_packet.py`.
3. Lovable runs `Relay QubeTalk bridge`.
4. Claude verifies `docs/qubetalk-bridge/inbox/latest.json` is fresh and includes required Codex packets.
5. Claude merges to `origin/ev` and deploys Amplify.
6. Claude posts deploy receipt in QubeTalk (`ops` thread) and updates bridge artifacts.

## Go/No-Go checks for Claude

- Inbox timestamp newer than previous run.
- Required stories for the sprint marked `control.status=done`.
- Packet `refs.deploy_ready=true` for stories intended in this deploy.
- No unresolved `severity=blocker` packets.

If any check fails, do not deploy.
