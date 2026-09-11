# PAS-001 Phase 2 — SmartWalletDrawer now offers Passport-native connect

**Status: IMPLEMENTED (Phase 0 verification + Phase 2 wiring).** Operator disposition
("finish it now so we don't have to revisit it") treated as ratification to proceed with
PAS-001's own phased plan (§20), gated on the spec's own zero-protected-file-impact
discipline, not as license to touch anything beyond it. `PAS-001` itself remains
`DRAFT — PENDING OPERATOR RATIFICATION` in its own header; this change executes only the
phases its own accounting already marks zero-protected-file-impact.

## What changed

`app/components/content/SmartWalletDrawer.tsx` — the estate's one remaining raw
email/password-only sign-in door (PAS-001 §0.3's headline finding) — now mounts
`PassportConnectPanel` (`components/companion/PassportConnectPanel.tsx`) directly inside
its persona dropdown, `world="application"` (the same top-level-mount mode
`app/passport-connect/page.tsx` already uses — no Companion iframe partition here, so
Ruling A.7's handoff-tab dance does not apply). It is offered **unconditionally while
signed out**, ahead of and alongside — never replacing — the legacy email/password form,
which is untouched and still fully functional.

This is composition, not a fork (inv.engineering.036/037): the drawer does not
re-implement the `/api/passport-connect/{challenge,proof,finalize,resolved-persona}`
sequence — it reuses the exact same component the Companion embed and the standalone
`/passport-connect` page already mount.

**One integration detail required handling.** `PassportConnectPanel`'s own
`finalizeWithPersona` pins the chosen persona via a direct
`window.localStorage.setItem('currentPersonaId', …)` — correct for its own callers, but a
same-tab `localStorage` write does not fire the native `storage` event
`PersonaContext`'s same-tab listener needs (only *other* tabs receive that event for a
same-document write). `SmartWalletDrawer`'s `onConnected` callback reads the pinned id
back out and re-applies it through the existing `ctxSetActivePersonaId` — the same
write+dispatch+broadcast path every other persona switch in this file already uses — so
the drawer's own persona resolution converges on the just-chosen persona instead of
silently keeping a stale one.

## Phase 0 verification findings (both open items PAS-001 §0.2/§16 flagged)

### 1. Amendment B's execution status — confirmed NOT independently executed

`app/api/passport/identity/bind/route.ts` is **not** Amendment B's charter. Read in full:
it resolves the caller via `getCallerIdentityContext` (an *already-signed-in* Bureau
applicant), takes a Supabase Bearer token, and calls
`bureauIdentityService.bindBureauIdentity` to create/bind a persona + KybeDID + root
identity for that applicant. Its own header cites "PRD §9" — this is the Bureau's own
issuance-time identity binding for someone going *through* the Bureau intake flow, not
Amendment B's specific charter (an *existing* account holder, entirely outside the Bureau
flow, proving control of a wallet holding a Passport they already have, via the same
`connectionChallenge`/`resolvePassportPrincipal` walk §A.4 uses, gated on an active
session per B.2.1).

Searching the codebase for that specific flow found only §A.11.1's *first-contact*
variant (`establishWalletBindingForRoot`, called from `/api/passport-connect/proof` when
`resolvePassportPrincipal` returns `wallet_unknown` and a live World ID proof is
presented) — which its own comments explicitly describe as covering the case "Amendment
B's own chartered scope explicitly assumes away" (no session, ever). No route or service
function was found that performs Amendment B's actual B.2.1–B.2.5 sequence (session
already exists → prove wallet control via a fresh challenge → resolve Passport → refuse
on conflict with a *different* existing binding → step-up gate → receipt) for an already
signed-in account holder. **Conclusion: Amendment B is chartered but not executed as its
own surface.** This was not touched in this pass — it is Phase 5 in PAS-001's own
sequencing, sequenced after the Phase 2 wiring this change delivers, and building it now
would be scope creep beyond what was asked.

### 2. Qriptopian's SmartWalletDrawer — confirmed independent duplicate, not reconciled in this pass

`apps/theqriptopian-web/src/components/wallet/SmartWalletDrawer.tsx` does **not** itself
render a password form — it redirects (`window.location.href = '/auth'`) to
`apps/theqriptopian-web/src/pages/Auth.tsx`, which **is** a fully independent, second
implementation: its own `supabase.auth.signInWithPassword` / `supabase.auth.signUp` calls,
its own email/password/confirm-password form, no shared component with the main app's
`SmartWalletDrawer.tsx` or with `PassportConnectPanel`. This is a genuine CS-001
duplicate-capability defect per this repo's "Extend, Don't Duplicate" principle.

**Not reconciled in this pass, and here is why, stated rather than silently skipped:**
`apps/theqriptopian-web` is a separate Vite + `react-router` single-page app, a different
framework from the main Next.js app `PassportConnectPanel`/`ContinueWithPassportButton`
live in. `theqriptopian-web`'s own `apiFetch` helper does call the main app's API routes
with relative paths (`/api/wallet/persona`, implying same-origin deployment in
production), so the *mechanics* (`/api/passport-connect/*`) are reachable from that app in
principle — but reconciling this properly means either (a) building a from-scratch
wallet-signature + World ID connect UI natively inside that SPA (there is currently none
of that machinery there at all — no injected-provider handling, no World ID SDK
integration), or (b) a larger architectural decision about whether Qriptopian should keep
its own auth surface at all versus embedding the Companion/main-app flow. Both are
distinct, larger-scoped engineering efforts than "wire the existing component into the
existing wallet," and attempting either as a side effect of this change risked a rushed,
security-sensitive auth implementation in an app this pass did not otherwise touch.
**Flagged for the operator to scope as its own follow-on phase**, not silently deferred —
the finding itself is definitive (yes, it duplicates), only the fix is deferred.

## Protected-file impact

**Zero.** No file in the Identity & Access Spine list, the DVN pipeline list, or
`types/access.ts` was read for modification, let alone changed. The only files touched are
`app/components/content/SmartWalletDrawer.tsx` (UI wiring) and
`tests/passport-connection-challenge.test.ts` (canaries). `PassportConnectPanel.tsx`
itself was not modified — it was mounted as-is.

## Phases explicitly NOT attempted in this pass, and why

- **Phase 1's net-new shared-component files** (`PassportBadge.tsx`,
  `PassportStatusChip.tsx`, `ClaimPassportButton.tsx`) were not built as separate files.
  The Phase 2 wiring reused `PassportConnectPanel` directly rather than wrapping it in a
  new component — the stronger form of "don't duplicate" for this specific integration.
  §10's Passport-status prominence and §13's Persona Menu restructure remain open, scoped,
  low-risk follow-ons.
- **Phase 3 (Credential Manager, §9)**, **Phase 4 (Continuation, §15)**, **Phase 5
  (Amendment B closure)** and **Phase 6 (Amendment C)** were not started — Phase 6 is
  explicitly gated on its own separate ratification per PAS-001 §20, and Phase 5 depends
  on the operator confirming Amendment B's scope per the finding above.
- **Phase 7 (Constitutional vs. Account tier / route guards, §5/§14)** was correctly not
  touched — PAS-001 §20 names this as the one phase with genuine protected-file risk,
  requiring an explicit operator decision (composition vs. a change to
  `evaluateAccess.ts`/`policyResolvers.ts`) before any code is written. Nothing in this
  pass required that decision.

## Verification

- `npx vitest --config vitest.config.mjs run` — 3556 passed, 1 failed (a pre-existing,
  unrelated `companion-observer.test.ts` assertion) across 214 files; 4 test *files* fail
  to import in this sandbox because `SUPABASE_URL`/`SUPABASE_ANON_KEY` are not set here
  (no `.env.local` in this environment) — confirmed pre-existing by reproducing the same
  failures on the pre-change commit. None of the 5 failures touch
  `SmartWalletDrawer.tsx` or the modified test file.
- `node scripts/verify-spine.mjs` reached `https://dev-beta.aigentz.me` through the sandbox
  proxy but failed closed (403s) because this pass has no operator JWT/persona credential
  to authenticate with — expected and stated rather than faked; it was not skipped.
- New canaries added to `tests/passport-connection-challenge.test.ts` (5 tests, all
  passing): the drawer imports the shared panel rather than re-implementing the fetch
  sequence; mounts it `world="application"`; offers it unconditionally ahead of the legacy
  form; the legacy form still exists; and a successful connect re-pins the persona through
  the existing context setter.

## Where this lives

Implemented on worktree branch `worktree-agent-acaab8988859f07eb`
(`.claude/worktrees/agent-acaab8988859f07eb`), not pushed — a coordinating session merges
it. Files: `app/components/content/SmartWalletDrawer.tsx`,
`tests/passport-connection-challenge.test.ts`.
