# Commit Brief: `738b6cc` — fix: migrate remaining persona ID reads to usePersonaSafe() context

| Field | Value |
|-------|-------|
| SHA | [`738b6cc`](https://github.com/iQube-Protocol/AigentZBeta/commit/738b6cc2f8af0fc183971d7a35b53d4fe902bf6c) |
| Author | Claude |
| Date | 2026-05-01T14:30:15Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: migrate remaining persona ID reads to usePersonaSafe() context

Four components were still reading the active persona ID from legacy sources:

- PersonaSelector.tsx: called getActivePersonaId() which reads 'active_persona_id'
  (legacy localStorage key). Replaced with contextPersonaId from usePersonaSafe().

- offer/page.tsx: same getActivePersonaId() call. Replaced with usePersonaSafe()
  directly; removed unused useMemo import.

- DevPersonaTab.tsx: read localStorage('currentPersonaId') on mount, then wired
  up 'persona-switched' CustomEvent and storage event listeners to keep in sync.
  All 30 lines replaced with one usePersonaSafe() call — context already handles
  cross-tab sync via storage events.

- ConnectionsIQubeDrawer.tsx: fallback read of localStorage('activePersonaId')
  when the /api/persona/active fetch fails. Replaced with ctxPersonaId from
  usePersonaSafe().

MetaMeRuntimeClient.tsx intentionally skipped — it is the shell host that
WRITES 'currentPersonaId' to localStorage (which PersonaContext picks up via
its own storage listener), so it operates correctly as-is.

apps/theqriptopian-web/ skipped — separate Next.js app that cannot share the
main PersonaProvider; needs its own migration.
```

## Body

Four components were still reading the active persona ID from legacy sources:

- PersonaSelector.tsx: called getActivePersonaId() which reads 'active_persona_id'
  (legacy localStorage key). Replaced with contextPersonaId from usePersonaSafe().

- offer/page.tsx: same getActivePersonaId() call. Replaced with usePersonaSafe()
  directly; removed unused useMemo import.

- DevPersonaTab.tsx: read localStorage('currentPersonaId') on mount, then wired
  up 'persona-switched' CustomEvent and storage event listeners to keep in sync.
  All 30 lines replaced with one usePersonaSafe() call — context already handles
  cross-tab sync via storage events.

- ConnectionsIQubeDrawer.tsx: fallback read of localStorage('activePersonaId')
  when the /api/persona/active fetch fails. Replaced with ctxPersonaId from
  usePersonaSafe().

MetaMeRuntimeClient.tsx intentionally skipped — it is the shell host that
WRITES 'currentPersonaId' to localStorage (which PersonaContext picks up via
its own storage listener), so it operates correctly as-is.

apps/theqriptopian-web/ skipped — separate Next.js app that cannot share the
main PersonaProvider; needs its own migration.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/metame/runtime/offer/page.tsx` |
| Modified | `app/components/wallet/PersonaSelector.tsx` |
| Modified | `app/triad/components/codex/tabs/DevPersonaTab.tsx` |
| Modified | `components/iqube/ConnectionsIQubeDrawer.tsx` |

## Stats

 4 files changed, 11 insertions(+), 30 deletions(-)
