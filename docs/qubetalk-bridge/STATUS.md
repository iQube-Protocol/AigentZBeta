# QubeTalk Bridge Status

- `last_inbox_sync_at`: `2026-04-01T18:48:26Z`
- `relay_required`: `true`
- `relay_command`: `Relay QubeTalk bridge`
- `deployment_gate`: `Do not trigger Amplify until outbox is relayed and inbox confirms Codex + Claude Sprint 1 artifacts are visible.`

## Current checks

1. Inbox is currently a pre-relay snapshot and may be stale.
2. Codex outbox messages are present and pending relay.
3. Lovable relay is required to publish outbox messages and refresh inbox.

## Operator runbook

1. Ask Lovable to run `Relay QubeTalk bridge`.
2. Confirm `docs/qubetalk-bridge/inbox/latest.json` timestamp advanced.
3. Confirm inbox contains Codex and Claude messages for Sprint 1 completion.
4. Merge all Sprint 1 branches/artifacts.
5. Trigger Amplify deploy to `origin/ev`.
