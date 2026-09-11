# Commit Brief: `c6f70de` — Add gated runtime session diagnostics for the cross-runtime ~3s reset investigation (Bug B)

| Field | Value |
|-------|-------|
| SHA | [`c6f70de`](https://github.com/iQube-Protocol/AigentZBeta/commit/c6f70de7796fcaa54f93a0fbc11f2cc80979f9cb) |
| Author | Claude |
| Date | 2026-08-29T14:20:07Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add gated runtime session diagnostics for the cross-runtime ~3s reset investigation (Bug B)

New utils/runtimeSessionDiagnostics.ts: a single shared logRuntimeEvent()
helper, activated only by ?debug_runtime_session=1 (persisted to
sessionStorage so it survives the very navigation/remount events under
investigation). No-op — zero behavior change — in every other case. Never
logs tokens, refresh tokens, or session objects.

Instrumented, fire-and-forget, every call site's return value discarded:
- utils/supabaseBrowser.ts — getSession()/getSupabaseAccessToken() start,
  end, and the GET_SESSION_TIMEOUT_MS (3000ms) timeout firing
- utils/personaSpine.tsx — doFetch() start/end, status transitions,
  TOKEN_REFRESHED/SIGNED_IN/postMessage invalidation triggers
- components/journey/JourneyRunSurface.tsx — mount/unmount and every
  refresh() call site, each now labeled with its trigger source
- app/bridge/ocsga/page.tsx — mount/unmount, PassportConnect onConnected
- components/companion/PassportConnectPanel.tsx — session-completion entry
  point (covers every onConnected call site) plus the username/password branch
- components/metame/MetaMeRuntimeClient.tsx — aigentMe init/reinit and its
  own onAuthStateChange
- services/companion/sidePanelTabBridge.ts — the parent-window tab-open request
- app/(embed)/triad/embed/companion/page.tsx — the literal
  window.location.reload() on PassportConnect onConnected

Live-verified in a real headless Chromium session against a local dev
server: zero [runtime-diag] lines with the flag absent; with it present,
observed the exact 3000ms GET_SESSION_TIMEOUT_MS firing, and found that its
setTimeout in the Promise.race is never cleared when getSession() wins the
race first — a genuine, narrower, newly-found defect (a harmless-but-real
timer leak) distinct from the full stall->cascade hypothesis, which this
run's dummy backend did not exercise (getSession() resolved fast with no
real Supabase session to contend a lock over).

refresh()'s new optional `source` label required updating three structural
canaries (cfs-055-coherence-canaries, cfs-055-passport-state-invalidation,
knyts-bridge-remix-passport-race) that asserted its exact prior call-site
text — the call sites and behavior they guard are unchanged, only the
literal text matched.
```

## Body

New utils/runtimeSessionDiagnostics.ts: a single shared logRuntimeEvent()
helper, activated only by ?debug_runtime_session=1 (persisted to
sessionStorage so it survives the very navigation/remount events under
investigation). No-op — zero behavior change — in every other case. Never
logs tokens, refresh tokens, or session objects.

Instrumented, fire-and-forget, every call site's return value discarded:
- utils/supabaseBrowser.ts — getSession()/getSupabaseAccessToken() start,
  end, and the GET_SESSION_TIMEOUT_MS (3000ms) timeout firing
- utils/personaSpine.tsx — doFetch() start/end, status transitions,
  TOKEN_REFRESHED/SIGNED_IN/postMessage invalidation triggers
- components/journey/JourneyRunSurface.tsx — mount/unmount and every
  refresh() call site, each now labeled with its trigger source
- app/bridge/ocsga/page.tsx — mount/unmount, PassportConnect onConnected
- components/companion/PassportConnectPanel.tsx — session-completion entry
  point (covers every onConnected call site) plus the username/password branch
- components/metame/MetaMeRuntimeClient.tsx — aigentMe init/reinit and its
  own onAuthStateChange
- services/companion/sidePanelTabBridge.ts — the parent-window tab-open request
- app/(embed)/triad/embed/companion/page.tsx — the literal
  window.location.reload() on PassportConnect onConnected

Live-verified in a real headless Chromium session against a local dev
server: zero [runtime-diag] lines with the flag absent; with it present,
observed the exact 3000ms GET_SESSION_TIMEOUT_MS firing, and found that its
setTimeout in the Promise.race is never cleared when getSession() wins the
race first — a genuine, narrower, newly-found defect (a harmless-but-real
timer leak) distinct from the full stall->cascade hypothesis, which this
run's dummy backend did not exercise (getSession() resolved fast with no
real Supabase session to contend a lock over).

refresh()'s new optional `source` label required updating three structural
canaries (cfs-055-coherence-canaries, cfs-055-passport-state-invalidation,
knyts-bridge-remix-passport-race) that asserted its exact prior call-site
text — the call sites and behavior they guard are unchanged, only the
literal text matched.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(embed)/triad/embed/companion/page.tsx` |
| Modified | `app/bridge/ocsga/page.tsx` |
| Modified | `components/companion/PassportConnectPanel.tsx` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |
| Modified | `services/companion/sidePanelTabBridge.ts` |
| Modified | `tests/cfs-055-coherence-canaries.test.ts` |
| Modified | `tests/cfs-055-passport-state-invalidation.test.ts` |
| Modified | `tests/knyts-bridge-remix-passport-race.test.ts` |
| Added | `tests/runtime-session-diagnostics.test.ts` |
| Modified | `utils/personaSpine.tsx` |
| Added | `utils/runtimeSessionDiagnostics.ts` |
| Modified | `utils/supabaseBrowser.ts` |

## Stats

 13 files changed, 458 insertions(+), 19 deletions(-)
