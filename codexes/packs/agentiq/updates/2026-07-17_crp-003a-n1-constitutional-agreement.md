# CRP-003a Increment 1 (N1) — the Constitutional Agreement primitive, built

**Date:** 2026-07-17
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Spec:** `codexes/packs/irl/foundation/CRP-003a_constitutional-financial-services-programme.md` (§2, §7 Increment 1)

The one load-bearing greenfield of the Constitutional Financial Services
Programme is built: the **Constitutional Agreement** (CFI-002 · Workstream 2 ·
canonical-service-pattern step 3) — the attributable, machine-readable record
binding {requesting operator · capability · agent · delegated authority ·
constraints · verification · settlement terms} **before** delegated execution.
Everything else in the pilot composes shipped primitives; this was the hole.

## What shipped

- **`services/constitutional/constitutionalAgreement.ts`** — the primitive,
  mirroring `capabilityRegistry.ts` exactly. The Agreement is a
  `ConstitutionalObject` (new kind `'agreement'`), T2-safe by construction
  (`findForbiddenObjectKey` refusal on any leak). Lifecycle
  `proposed → accepted → authorized → executed → settled → reconstitutable`;
  N1 implements the first three. It **composes** existing seams — `capabilityRef`
  is a capability_registry id, `delegatedAuthority` is the PolicyEnvelope shape,
  `settlementTerms` is optional (null for Domain 3). Three operations
  (`formAgreement` → `acceptAgreement` → `authorizeAgreement`) + the **409 gate**
  `requireAuthorizedAgreement` that refuses delegated execution unless an
  authorized agreement binds the (operator, capability, agent) triple. The gate
  **fails closed** (refuse, never silent-allow) on a missing store — money-
  adjacent execution never proceeds on an unverifiable gate.
- **`services/constitutional/agreementProviders.ts`** — the swappable
  acceptance-proof adapter seam (ratification decision #3): `local` (deterministic
  sha256 commitment, the functional default) + `x409`/Consenti (env-gated adapter;
  honest failure when unconfigured — never a silent fake). **DVN is the
  constitutional anchor of record** (the receipts); a provider supplies the
  acceptance proof + its own optional external anchor. Providers are
  interchangeable by `AGREEMENT_ACCEPTANCE_PROVIDER` env or per-call.
- **`app/api/constitutional/agreement/route.ts`** — spine-authenticated (the
  caller is the requesting operator; `authorize` re-checks owner-commitment).
  POST `form|accept|authorize|gate`; GET lists the caller's own agreements
  (admins: all) or runs a gate check. No personaId stored — the operator is a
  one-way `ownerCommitment`.
- **Receipts + anchor** — `agreement_formed` (on acceptance) and
  `agreement_authorized` (on authorization) added to `ActivityActionType` and to
  `ANCHORABLE_ACTION_TYPES` (the one permitted unilateral DVN change). DVN anchors
  the agreement trail.
- **Migration `20260719000000_constitutional_agreements.sql`** — the durable
  ledger (service-role RLS, T2-safe) **and** the activity_receipts CHECK rebuilt
  with the complete union + the two new types. Dated to sort **after**
  `20260718020000` so it is the latest action-type migration (constraint-drift
  discipline — a type added without a full CHECK rebuild silently fails to
  persist).
- **`types/constitutionalObject.ts`** — new object kind `'agreement'` (additive).

## Verification

- 23/23 pure-logic drill (`scratchpad/n1_logic_harness.mjs`): lifecycle
  transition legality (incl. the illegal proposed→authorized skip), the 409
  gate open-status set, acceptance-commitment determinism + tamper-detection +
  wrong-ref rejection, ownerCommitment one-wayness/16-hex, built-object
  T2-safety + the personaId leak canary.
- The two pure real modules (`constitutionalObject.ts`, `agreementProviders.ts`)
  parse + execute clean under Node type-stripping.
- Confirmed no exhaustive `Record<ActivityActionType, …>` — the two new action
  types are additive-safe for the Amplify tsc build.

## Honest limits (N1 scope)

- **Domain 3, read-only.** `executed / settled / reconstitutable` are later
  increments; no fund movement, so the delegated authority's enforced
  `valueCeiling` (P3) is carried but unused.
- **x409 live wire is a follow-on.** The adapter shape + env contract ship now;
  the actual POST to the Consenti `acceptance_endpoint` + `@consenti-ai/verifier`
  check is the named next step. `local` is fully functional today.
- **The gate isn't wired into an execution surface yet** — Increment 2 runs the
  canonical 12-step pipeline (shadow) on a Domain-3 Financial Intelligence
  capability, where `requireAuthorizedAgreement` gates the delegated call.

## Operator step

Run migration `supabase/migrations/20260719000000_constitutional_agreements.sql`
(creates `constitutional_agreements` + rebuilds the activity_receipts CHECK).
Until applied, agreement writes soft-fail with an honest note (never silently).
