# Commit Brief: `10db221` — feat: thin-client active-persona integration — surface ownFioHandle + parent broadcast + integration doc

| Field | Value |
|-------|-------|
| SHA | [`10db221`](https://github.com/iQube-Protocol/AigentZBeta/commit/10db221fa89fb080e0fcee2a4aa7ca514bfd461b) |
| Author | Claude |
| Date | 2026-05-08T01:45:25Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat: thin-client active-persona integration — surface ownFioHandle + parent broadcast + integration doc

Operator question: 'what should lovable call from the API or iframe to
get active persona? Any time a persona is activated or deactivated we
need to send a message to the thin client so it can also render the
active persona's handle.'

Three changes:

app/api/wallet/active-persona/route.ts
  Surface response now includes ownFioHandle (the caller's OWN
  persona's fio_handle, e.g. 'aigentz@aigent'). Privacy contract
  preserved: this is the caller's own handle, surfaced to themselves
  only. Cross-persona handle resolution remains forbidden. Lovable
  can render either displayLabel (user pet name) or ownFioHandle
  (FIO handle) per their UI conventions.

app/contexts/PersonaContext.tsx
  setActivePersonaId now broadcasts aa-persona-change-v1 in TWO
  directions:
    - Down to all child iframes (existing behaviour)
    - UP to the parent window when the platform itself is iframed
      inside a thin client like metame.live (new)

  Without the upward broadcast, the thin client never learned about
  persona switches initiated inside the platform iframe — its
  header/handle would stay stuck on the previous persona indefinitely.

  No-op when not iframed (window.parent === window). Cross-origin
  postMessage('*') is intentional; allow-listed thin-client origins
  listen for this event and ignore others.

codexes/packs/agentiq/updates/2026-05-07_thin-client-active-persona-integration.md (NEW)
  Full integration contract for Lovable / any thin-client surface:
    1. GET /api/wallet/active-persona endpoint spec — request, response,
       authorization, privacy contract, render fallback chain
    2. aa-persona-change-v1 postMessage listener pattern with origin
       validation
    3. End-to-end sample flow (TypeScript)
    4. Sign-out / persona-deactivation behaviour (intentionally does
       NOT broadcast a separate event — falls through to thin client's
       own auth-state listener)
    5. Forbidden / common pitfalls table
    6. File index for further reading

  Registered in agentiq pack col_updates.

Operator note 'not working' (persona-stuck regression) — push DID
land on origin/dev (verified via git log). Amplify deploy may not
have completed yet; once it has, the previous fix (ce218a5) plus
this commit should hold across token refresh failures.

If the persona-stuck regression persists AFTER this redeploy, paste
the DevTools console logs around a persona-switch attempt — there
may be a fourth resolver path I haven't found yet, but these are
the loudest culprits handled now.
```

## Body

Operator question: 'what should lovable call from the API or iframe to
get active persona? Any time a persona is activated or deactivated we
need to send a message to the thin client so it can also render the
active persona's handle.'

Three changes:

app/api/wallet/active-persona/route.ts
  Surface response now includes ownFioHandle (the caller's OWN
  persona's fio_handle, e.g. 'aigentz@aigent'). Privacy contract
  preserved: this is the caller's own handle, surfaced to themselves
  only. Cross-persona handle resolution remains forbidden. Lovable
  can render either displayLabel (user pet name) or ownFioHandle
  (FIO handle) per their UI conventions.

app/contexts/PersonaContext.tsx
  setActivePersonaId now broadcasts aa-persona-change-v1 in TWO
  directions:
    - Down to all child iframes (existing behaviour)
    - UP to the parent window when the platform itself is iframed
      inside a thin client like metame.live (new)

  Without the upward broadcast, the thin client never learned about
  persona switches initiated inside the platform iframe — its
  header/handle would stay stuck on the previous persona indefinitely.

  No-op when not iframed (window.parent === window). Cross-origin
  postMessage('*') is intentional; allow-listed thin-client origins
  listen for this event and ignore others.

codexes/packs/agentiq/updates/2026-05-07_thin-client-active-persona-integration.md (NEW)
  Full integration contract for Lovable / any thin-client surface:
    1. GET /api/wallet/active-persona endpoint spec — request, response,
       authorization, privacy contract, render fallback chain
    2. aa-persona-change-v1 postMessage listener pattern with origin
       validation
    3. End-to-end sample flow (TypeScript)
    4. Sign-out / persona-deactivation behaviour (intentionally does
       NOT broadcast a separate event — falls through to thin client's
       own auth-state listener)
    5. Forbidden / common pitfalls table
    6. File index for further reading

  Registered in agentiq pack col_updates.

Operator note 'not working' (persona-stuck regression) — push DID
land on origin/dev (verified via git log). Amplify deploy may not
have completed yet; once it has, the previous fix (ce218a5) plus
this commit should hold across token refresh failures.

If the persona-stuck regression persists AFTER this redeploy, paste
the DevTools console logs around a persona-switch attempt — there
may be a fourth resolver path I haven't found yet, but these are
the loudest culprits handled now.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/wallet/active-persona/route.ts` |
| Modified | `app/contexts/PersonaContext.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-07_thin-client-active-persona-integration.md` |

## Stats

 4 files changed, 259 insertions(+), 12 deletions(-)
