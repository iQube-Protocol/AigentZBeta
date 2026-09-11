# PAS-001 — Passport-First Constitutional Access: spec authored, PRD-PAG-001 superseded

**Date:** 2026-07-29
**Branch:** `claude/tokenqube-minting-integration-ms2yjd`
**Scope:** Docs only. No code changed. Produces a specification + reconciliation + phased plan for
operator review; nothing here is built.

---

## What was asked

The operator drafted a 19-section estate-wide authentication rearchitecture ("Passport-First
Constitutional Access") that would eventually touch the six protected identity/access spine files
plus the DVN pipeline files, and migrates every existing user's authentication. Per `CLAUDE.md`'s
protection rules, this pass is docs-only: produce the reconciled specification and a phased
implementation plan for the operator to review and ratify **before** any protected file is touched.

## What this pass found — the headline result

**Most of the backend mechanics the operator's draft calls for already exist and are already
ratified**, under `PRD-PAG-001_polity-access-gateway.md` and its Amendments A, A.11, B, and C —
built between 2026-07-22 and 2026-07-28, all with **zero protected-file impact**, confirmed by
reading each amendment's own protected-file-impact table (§A.9.1, §A.11.6) against the actual
code. Specifically already shipped:

- Session established by presenting a Passport, no password, no prior account required at all
  (`services/identity/passportPrincipal.ts`, `services/identity/passportPendingAuth.ts`,
  `app/api/passport-connect/*`).
- Passkey/WebAuthn enrolment + unlock (`services/passport/passkeyService.ts` + 4 routes) — shipped
  2026-07-27, later than PRD-PAG-001's own body text (which still called it "genuinely unbuilt").
- A risk-graded step-up policy (`services/passport/stepUpPolicy.ts`).
- The three-level persona reference model (`services/identity/personaReferences.ts`) — pre-dates
  PRD-PAG-001, unchanged.
- Session issuance as a receipt via the existing unified writer (no new DVN action type).
- A shared "Continue with Polity Passport" button component
  (`components/passport/ContinueWithPassportButton.tsx`) and a full Companion-side passwordless
  Connect panel (`components/companion/PassportConnectPanel.tsx`).

**What is genuinely new, concentrated almost entirely in one place:** none of the above has been
wired into the estate's actual primary sign-in surface. `app/components/content/SmartWalletDrawer.tsx`
(the canonical embedded wallet, mounted estate-wide) still renders only a raw email/password
Sign In / Sign Up form as its sole entry point — confirmed by reading the file directly (lines
~2318–2470). `ContinueWithPassportButton.tsx`'s own header states plainly: *"NOT wired into any
existing login page — integrating live login surfaces is a separate, deliberate pass."*
`PassportConnectPanel.tsx` is mounted only inside the Companion embed and a standalone
`/passport-connect` page — never inside `SmartWalletDrawer` or any cartridge's inline sign-in.

A repo-wide search for the wallet's `signInWithEmail`/`signUpWithEmail` calls found exactly **one**
call site (`SmartWalletDrawer.tsx`) — a positive finding: there is no proliferation of duplicate
raw-password forms across the estate to consolidate. There is exactly one, and it is the one that
needs to become passport-first.

## Two things this pass could not fully verify (stated honestly)

1. **Amendment B's execution status** (an existing Supabase account holder binding their account to
   a Passport they already hold) is unconfirmed. Found `app/api/passport/identity/bind/route.ts`,
   but its header cites a different PRD ("PRD §9") and reads as the Bureau's own issuance-time
   identity binding, not Amendment B's specific charter. No route explicitly labelled as Amendment
   B's execution was found.
2. **`apps/theqriptopian-web/src/components/wallet/SmartWalletDrawer.tsx`** is a separate file from
   the main wallet component. Whether it independently duplicates the email/password form (a CS-001
   duplicate-capability defect if so) was not audited in this pass.

Both are flagged as required verification steps (Phase 0) before any implementation begins.

## Where the new spec depends on unratified prior work

`PRD-PAG-001` Amendment C (Passport issuance with **no prior account at all**) remains unratified —
its own ratification checklist (§C.3) is unchecked, and `services/passport/bureauIdentityService.ts`
still requires a non-null `auth_user_id` at issuance today. This blocks the operator's §6/§7 promise
("existing users are never asked to create a new account... No Passport? Claim Passport") for the
case of a citizen who has never touched metaMe and has no account to migrate from. This is the
single most important open ratification gate PAS-001 inherits and flags rather than resolves.

## The one place a future implementation pass may need a protected file

Section 5/14 of the operator's draft ("does this action require a constitutional session?")
implies a possible new "Account-tier vs. Constitutional-tier" distinction. Whether this can be
read at the API-route/service layer (composing existing session-issuance receipts, no protected
file touched) or requires a genuinely new decision input inside `evaluateAccess.ts` /
`policyResolvers.ts` is an open fork that PAS-001 does not resolve — it requires an explicit
operator decision before any code is written, per `CLAUDE.md`'s "Security — Access Gates" section.
This is the only place in the entire 20-section plan flagged as potentially protected-file-touching.

## Deliverables produced

1. **`codexes/packs/irl/foundation/PAS-001_passport-first-constitutional-access.md`** — the new
   spec, DRAFT status pending operator ratification, reproducing the operator's 19 sections + the
   "Passport as the Estate Root Principal" addition verbatim, each with a reconciliation subsection
   citing exact files/functions, and a §20 phased implementation plan (7 phases, protected-file
   impact stated per phase).
2. **`PRD-PAG-001_polity-access-gateway.md`** — annotated (not rewritten) with a top-of-file
   supersession note pointing to PAS-001, following the same annotate-don't-rewrite convention used
   elsewhere in this pack (e.g. the RESOLVED addendum in
   `2026-07-28_horizen-slice-b-joined-evidence-chain.md`).
3. **`SPEC-COS-001_constitutional-onboarding-specification.md`** — given a cross-reference note
   (not a supersession — its onboarding-substrate scope is unaffected and requires no correction).
4. This update doc, registered in `codexes/packs/agentiq/collections.json`'s `col_updates`.

## Deep links

- Repo file: `codexes/packs/irl/foundation/PAS-001_passport-first-constitutional-access.md`
- Repo file (superseded): `codexes/packs/irl/foundation/PRD-PAG-001_polity-access-gateway.md`
- Repo file (cross-referenced): `codexes/packs/irl/foundation/SPEC-COS-001_constitutional-onboarding-specification.md`
- AgentiQ cartridge → Updates tab (once this doc is registered in `collections.json`, deployed
  build): `dev-beta.aigentz.me` — AgentiQ → Updates.

No SQL, no migration, no deploy — this pass is docs-only and is not pushed to `dev`.
