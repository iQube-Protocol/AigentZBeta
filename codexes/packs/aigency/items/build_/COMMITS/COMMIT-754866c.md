# Commit Brief: `754866c` — Add CTP-001A Phase 1 live acceptance script for Aletheon/Mansa Meta

| Field | Value |
|-------|-------|
| SHA | [`754866c`](https://github.com/iQube-Protocol/AigentZBeta/commit/754866c0d36952ca59a06de712288d8020f130bf) |
| Author | Claude |
| Date | 2026-09-01T01:43:08Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add CTP-001A Phase 1 live acceptance script for Aletheon/Mansa Meta

Resolves both persona ids live from the identity spine (Aletheon's AigentMe persona projection via provisionAgentWalletPersona's own root_did join, Mansa Meta's PersonaQube persona by display name) — never hardcoded. Proves getActivePersona()/isCartridgeAdmin() select Aletheon explicitly through the real code path before writing anything, then builds two fresh isolated exchanges (web + mcp) via the existing canonical createExchange/depositArtifact/inviteCounterparty/joinExchange/registerArtifactOperatorAssisted functions only.
```

## Body

Resolves both persona ids live from the identity spine (Aletheon's AigentMe persona projection via provisionAgentWalletPersona's own root_did join, Mansa Meta's PersonaQube persona by display name) — never hardcoded. Proves getActivePersona()/isCartridgeAdmin() select Aletheon explicitly through the real code path before writing anything, then builds two fresh isolated exchanges (web + mcp) via the existing canonical createExchange/depositArtifact/inviteCounterparty/joinExchange/registerArtifactOperatorAssisted functions only.

## Files Changed

| Change | File |
|--------|------|
| Added | `scripts/ctp-acceptance-aletheon-mansameta.ts` |

## Stats

 1 file changed, 367 insertions(+)
