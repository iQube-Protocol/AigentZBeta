# PAS-001 status check — still DRAFT, wiring gap confirmed live, backlog (not started)

**Status: BACKLOG — operator-directed, explicitly NOT started.** ("Add it to the backlog to revisit
... I don't want to get derailed", 2026-07-31.) No implementation work in this change — status check
+ backlog record only.

## Why this exists

Testing the Horizen pilot's Passport stage (2026-07-31), the operator noted `PassportBureauApplyTab`'s
Citizen-Passport eligibility check behaved as if a claimed Citizen Passport didn't exist, and asked
"shouldn't I even have to be signed in — my wallet is active, it should be passport-aware?" — i.e.
wallet connection should itself resolve identity/passport state, not require a separate explicit
sign-in. The operator recalled this being addressed platform-wide already and asked for a check before
assuming it wasn't, rather than re-deriving or guessing.

## What this check found

**It was addressed at the spec + backend-mechanics level, not at the wiring level.** `PAS-001 —
Passport-First Constitutional Access` (`codexes/packs/irl/foundation/PAS-001_passport-first-
constitutional-access.md`) was authored in this same session on 2026-07-29 — a full estate-wide
authentication architecture reconciling the operator's own 19-section draft against the shipped
codebase. Its header status today, unchanged since authoring: **`DRAFT — PENDING OPERATOR
RATIFICATION`**.

Its own headline finding (§0, verbatim): roughly 70% of the session-minting and passport-native access
mechanics the operator's draft calls for **already exist and are already ratified**, under
`PRD-PAG-001` and its Amendments A, A.11, B, and C:

- Session established by presenting a Passport, no password, no prior account required at all
  (`services/identity/passportPrincipal.ts`, `services/identity/passportPendingAuth.ts`,
  `app/api/passport-connect/*`).
- Passkey/WebAuthn enrolment + unlock (`services/passport/passkeyService.ts` + 4 routes).
- A risk-graded step-up policy (`services/passport/stepUpPolicy.ts`).
- The three-level persona reference model (`services/identity/personaReferences.ts`).
- Session issuance as a receipt via the existing unified writer.
- A shared "Continue with Polity Passport" button (`components/passport/
  ContinueWithPassportButton.tsx`) and a full Companion-side passwordless Connect panel
  (`components/companion/PassportConnectPanel.tsx`).

**What is genuinely new, and still missing:** none of the above is wired into the estate's actual
primary sign-in surface. `app/components/content/SmartWalletDrawer.tsx` (the canonical embedded
wallet, mounted estate-wide) still renders only a raw email/password Sign In/Sign Up form as its sole
entry point (confirmed by reading the file directly, PAS-001 §0 lines ~40-46).
`ContinueWithPassportButton.tsx`'s own header states plainly: *"NOT wired into any existing login page
— integrating live login surfaces is a separate, deliberate pass."* `PassportConnectPanel.tsx` is
mounted only inside the Companion embed and a standalone `/passport-connect` page — never inside
`SmartWalletDrawer` or any cartridge's inline sign-in.

Today's symptom (`PassportBureauApplyTab`'s Citizen-Passport check, fixed 2026-07-31 for
`personaIdHint` correctness — see the same day's earlier commit) is a live, concrete instance of
exactly this gap: the component's identity resolution assumed an explicit signed-in session because
that is still the only path the estate's actual sign-in surfaces produce. Fixing the `personaIdHint`
plumbing made the check resolve the RIGHT persona once one exists; it does not make wallet connection
alone sufficient to resolve one, because no primary sign-in surface offers that path yet.

## Two items PAS-001 itself flagged as unverified (carried forward, not re-checked here)

1. Amendment B's execution status (an existing Supabase account holder binding their account to a
   Passport they already hold) — unconfirmed; `app/api/passport/identity/bind/route.ts` was found but
   reads as the Bureau's own issuance-time binding, not Amendment B's specific charter.
2. Whether `apps/theqriptopian-web/src/components/wallet/SmartWalletDrawer.tsx` (a separate file from
   the main wallet component) independently duplicates the email/password form — a CS-001
   duplicate-capability defect if so. Not audited in this pass either.

## Backlog action

- **Ratify or revise PAS-001** (`codexes/packs/irl/foundation/PAS-001_passport-first-constitutional-
  access.md`) — it already contains a phased implementation plan (§20, 7 phases, protected-file impact
  stated per phase). Ratification is the blocking step before any wiring work begins.
- **Phase 1 wiring target**: `app/components/content/SmartWalletDrawer.tsx` — replace/augment the
  email/password-only entry point with the already-shipped passport-native session path
  (`ContinueWithPassportButton.tsx` + the Amendment A/A.11 mechanics), so wallet connection resolves an
  active persona/passport without a separate explicit sign-in step.
- Resolve the two unverified items above before or during that phase.
- Re-audit `PassportBureauApplyTab` (and any other journey-embedded component) once SmartWalletDrawer
  is passport-first — some of today's `personaId`-prop-threading fix may become unnecessary if identity
  resolution moves fully to the wallet-connection layer, but should not be reverted speculatively ahead
  of that actually shipping.

Explicitly deferred per operator direction — no code changes in this pass.
