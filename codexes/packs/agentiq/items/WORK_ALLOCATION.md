# Work Allocation — Cascade vs Codex

## Ownership map
### Cascade-owned (Aigent Z / platform integrator)
- `app/api/**`
- `src/server/**` (if present)
- auth/session and tenant/RBAC
- payments/entitlements plumbing
- Autodrive PR pipeline
- iQube Registry endpoints
- QubeTalk transport + audit

### Codex-owned (Aigent C / module builder)
- `codexes/packs/**`
- `src/client/**` (if present)
- `examples/**`
- pack loader tests + index tooling
- thin-client SDKs
- Liquid UI component registry population

## Rules of engagement
- Contract-first: Codex builds against frozen schemas.
- No shared hot files: Cascade owns core router/auth changes.
- If overlap is required, Cascade refactors; Codex adds modules/tests.
