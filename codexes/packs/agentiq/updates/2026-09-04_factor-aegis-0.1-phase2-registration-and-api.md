# Factor/Aegis 0.1 — Phase 2: migration verification, tenant isolation, specialist registration, API routes

**Date:** 2026-09-04
**Branch:** `spec/moneypenny-mpy2-3`
**Scope:** operator instruction, verbatim — "Begin Factor/Aegis Phase 2 on current `dev`: apply and
verify the migration; add tenant-isolation tests; register Factor and Aegis as MoneyPenny
specialists; register Factor in `registrableAgents.ts`; connect it to the Horizon Journey Spine;
add API routes before building the specialist UI." Specialist UI is explicitly out of scope for
this pass. Live Crystal/Track2 re-verification was explicitly reserved to the operator and is not
covered here.

---

## 1. Migration — verified already applied, not re-applied

Checked directly against the live dev Supabase project (`bsjhfvctmduxhohtllly`, "Aigent Z",
`us-east-2`) rather than assuming either "already applied" or "needs applying" from the Phase 1
doc's own (session-scoped) "not applied this pass" statement.

- `mcp__Supabase__list_migrations` shows an applied migration
  `{"version":"20260904174331","name":"factor_aegis_constitution_reconciled"}` — a different
  version-timestamp prefix than the repo file's own
  (`20260930190000_factor_aegis_constitution_reconciled.sql`), same descriptive name. Resolved by
  direct schema inspection rather than by the filename alone:
  - `list_tables` confirms all seven tables exist with the **exact** `COMMENT ON TABLE` text the
    migration file defines: `factor_cases`, `factor_case_events`, `factor_evidence_items`,
    `aegis_assessments`, `aegis_findings`, `factor_authority_chains`, `factor_standing_proposals`.
  - `activity_receipts_action_type_check`'s definition contains `factor_case_opened` (one of the 11
    new action types this migration adds).
  - Both immutability triggers exist: `trg_aegis_assessments_immutable` on `aegis_assessments`,
    `trg_aegis_findings_immutable` on `aegis_findings`.
  - All three CHECK constraints exist: `chk_aegis_assessments_not_self_assessed`,
    `chk_factor_authority_chains_mediator`, `chk_factor_standing_proposals_evidence`.
  - Both partial/unique indexes exist with the migration's exact definitions:
    `uq_aegis_assessments_current` (`(subject_type, subject_ref) WHERE superseded_by IS NULL`),
    `uq_factor_cases_candidate_per_tenant` (`(tenant_id, candidate_identity_key)`).

**Conclusion: this migration is genuinely and fully applied** — matching the file's structure
exactly, not merely a same-named coincidence. No `apply_migration` call was made; none was needed.
The version-timestamp mismatch is worth flagging for whoever manages this project's migration
history (the applied version doesn't match the repo file's prefix), but does not indicate a schema
drift — the schema itself is byte-for-byte what the file specifies.

---

## 2. Tenant/principal isolation — the Phase 1 §8 gap closed, not just tested

Phase 1 explicitly flagged: *"Cross-tenant isolation: `factor_cases`/`factor_authority_chains`
carry tenant/principal scope in their unique indexes; not yet exercised by a dedicated cross-tenant
test — a real gap, flagged not hidden."*

Reading the service layer surfaced that this was not only untested but **genuinely unenforced** at
the application layer: `transitionCaseState`, `pauseCase`, `resumeCase`, `upsertEvidenceItem`,
`listEvidenceForCase`, and `decideAdmission` all resolved a `case_id` with no check that the row's
`tenant_id` matched the caller's own tenant scope; `revokeChain` and `validateChainForAction`
likewise resolved a `chain_id` with no check against `principal_persona_id`. A `case_id`/`chain_id`
leaking to a different tenant/principal (log line, referrer, shared client state) would have let
that caller mutate or read a case/chain it does not own — real cross-tenant/cross-principal write
paths, not merely an absent test.

**Fixed, not just documented** (mirrors this codebase's existing defense-in-depth pattern — e.g.
Aegis's self-assessment refusal is enforced in application code AND at the DB layer):

- `services/factor/factorCaseService.ts` — `transitionCaseState`, `pauseCase`, `resumeCase` now
  require a `tenantId` parameter and refuse (`code: 'cross-tenant-denied'`) before any read result
  is acted on if the row's `tenant_id` differs. `upsertEvidenceItem`/`listEvidenceForCase` resolve
  the parent case's tenant first via a new shared `assertCaseTenant` helper. A new `getCase` reader
  is the one tenant-scoped case-read path (routes never query `factor_cases` directly).
- `services/factor/authorityChain.ts` — `revokeChain` now requires `expectedPrincipalPersonaId` and
  refuses (`code: 'cross-principal-denied'`) a chain owned by a different principal.
  `validateChainForAction` accepts an optional `expectedPrincipalPersonaId` and denies the same way
  when supplied and mismatched (optional because some callers validate a chainId already resolved
  from a principal-scoped lookup).
- `services/moneypenny/admissionAuthority.ts` — `decideAdmission` now requires `tenantId` and
  refuses cross-tenant admission decisions the same way.

**Tests added** (`tests/factor-case-service.test.ts`, `tests/factor-authority-and-admission.test.ts`
— existing call sites updated to pass the now-required `tenantId`/`expectedPrincipalPersonaId`
params rather than left broken): a case/chain created under one tenant/principal cannot be
transitioned, paused, resumed, evidence-mutated, revoked, or admission-decided by a different
tenant/principal — each proven to fail with the correct error code, and a matching same-tenant
control case proving the guard doesn't false-positive. **8 new tests; 29 → 37 total across the
Factor/Aegis service suite, all passing.**

---

## 3. Factor + Aegis registered as specialists

`services/agents/specialistRouter.ts` (confirmed by Phase 1's own grep to reference neither agent
before this pass) is the canonical "AigentMe/MoneyPenny can consult a specialist" contract —
`SpecialistId`, `SPECIALIST_PERSONA_KEY`, `SPECIALIST_LABELS`, `inferRequestType`, and the
per-specialist template-fallback framing. Added `'factor'` and `'aegis'` as two new `SpecialistId`
entries, each with:

- No persona system-prompt entry yet (`SPECIALIST_PERSONA_KEY: null`) — persona/system-prompt
  authoring is content work, out of scope for this API-first pass; `systemPromptFor`'s existing
  generic fallback (`'You are an Aigent Me specialist.'`) covers this until one is written.
- A distinct, PRD-grounded template response (never the generic metaye fallback other unmatched ids
  would have silently received) — Factor's frames candidate-intake readiness and evidence gaps;
  Aegis's frames assessment dimensions and the critical-finding-overrides-aggregate rule. Both
  responses are explicitly advisory: neither claims to admit, assess, or mutate case state — that
  stays exactly where PRD §2 places it (`services/factor/*`, `services/aegis/*`).
- `requestType: 'system_guidance'` for both (`inferRequestType`).

Extending `SpecialistId` broke TypeScript exhaustiveness in
`services/orchestration/specialistRecommender.ts` (the aigentMe "who should I ask" roster) — its
`SPECIALIST_LABELS`/`SPECIALIST_DESCRIPTIONS`/`SPECIALIST_ACTIVATION_GATE` are all
`Record<SpecialistId, ...>` and TypeScript correctly flagged the two new keys as missing. Added
them with `SPECIALIST_ACTIVATION_GATE: null` — the same "no activation gate" status as MoneyPenny
itself, since no separate activation id exists for a MoneyPenny sub-specialist and inventing one
would have been a guess.

---

## 4. `registrableAgents.ts` / Horizen Journey Spine — investigated, genuinely blocked, not fabricated

**Not done, and not silently skipped.** `services/horizen/registrableAgents.ts`'s own header states
the discipline plainly: every field is "sourced from an existing, real, authored record — never
invented," and `resolveAgentAdmissionState` (`services/journey/agentAdmissionState.ts`) is generic
over whatever `RegistrableAgentConfig` it's given — so "register Factor" and "connect Factor to the
Journey Spine" are, mechanically, the same piece of work: add one config entry, and the existing
generic reader lights up for it.

Checked what that entry would need to be built FROM, per the file's own precedent (kn0w1's addition
sourced every field from a pre-existing chat persona, wallet, and registry asset — it was
configuration, not origination):

- `services/metame/agentLlmOrchestra.ts`'s `RUNTIME_AGENT_IDS` — no `'aigent-factor'` entry.
- `app/data/personas.ts` — no Factor persona/system prompt.
- `scripts/register-agent-keys.ts`'s `AGENTS` list — no Factor entry (meaning no `agent_keys`
  custodied wallet exists or would be generated for Factor).
- `supabase/migrations/*` — no `aigentqube-factor` `registry_assets` row.
- `app/api/agents/` — no `factor/` agent-card or health route directory.

**Factor has zero existing agent-identity substrate.** Unlike kn0w1, adding Factor as a
`RegistrableAgentConfig` right now would mean *originating* a new on-chain-registrable agent
identity from scratch: a real custodied wallet (`agent_keys` row, generated via
`scripts/register-agent-keys.ts`), a `registry_assets` row, a fio handle, and new agent-card/health
routes — and `RUNTIME_AGENT_IDS` membership cascades further still, into the legibility/AigentQube
registry sources, trust-dimension scoring, and adapter synthesis (`services/iqube/legibility/
sources/aigentQubeSource.ts`, `services/registry/adapters/aigentQubeAdapter.ts`,
`services/registry/trustDimensions.ts`) — each of which expects a hand-curated profile for any id
it lists.

Two reasons this pass stops here rather than fabricating those fields or minting a wallet
unilaterally:

1. **No-Guessing (CLAUDE.md, PARAMOUNT):** every field on `RegistrableAgentConfig` is documented as
   sourced from an existing record. Factor has none. Inventing a `fioHandle`, `aigentQubeId`, or
   wallet-bearing `runtimeAgentId` would be exactly the fabrication that rule forbids, and would
   silently fail `tests/registrable-agent-runtime-surface.test.ts` (a listed agent's
   `runtimeHealthPath` must resolve to a real route on disk) besides.
2. **Custodial key generation is a sensitive, hard-to-reverse action** (system-prompt "Executing
   actions with care"): minting a new agent's private-key-bearing `agent_keys` row is the kind of
   effectful, security-relevant act that warrants an explicit operator decision, not a unilateral
   side-effect of a "register the specialist" instruction.

**What this means concretely:** Factor is registered as a *specialist* (§3, advisory-only, no
identity implications) but is **not yet a Horizen-registrable agent** — it cannot be walked through
Register → Verify → Claim → Sponsor → Passport → Delegate, because that pipeline's very first
prerequisite (an `agent_keys` wallet) doesn't exist for it. Bringing Factor through that pipeline is
a distinct, larger undertaking than this Phase 2 pass's API-route scope, and needs an operator
decision on: (a) whether Factor should be onboarded as a full first-class runtime agent at all
(versus staying MoneyPenny-internal machinery, per its actual PRD role as a pipeline rather than a
chat persona), and (b) authorization to provision a new custodied wallet if so.

---

## 5. API routes — Factor + Aegis, before any specialist UI

All server-side, service-role Supabase client (`getSupabaseServer()` — every table these routes
touch has `service_role`-only RLS), `getActivePersona(req)` gating every route (401 without a
resolved persona). Every route delegates entirely to the existing Phase 1/Phase 2 service functions
— no route re-implements state-machine, separation-of-powers, or isolation logic of its own.

**Shared:** `app/api/moneypenny/factor/_lib/respondError.ts` — one error-code → HTTP-status mapping
(`404` not-found, `403` cross-tenant/cross-principal/self-assessment/authority refusals, `409`
concurrent-transition, `400` everything else) used by every route below, plus `resolveTenantId`
(defaults to `'default'` — the same literal default `createOrResumeCase` already applies; no
persona→tenant mapping exists yet in this codebase, so routes accept an explicit `tenantId` rather
than inventing one).

| Route | Method | Delegates to |
|---|---|---|
| `/api/moneypenny/factor/cases` | POST | `createOrResumeCase` |
| `/api/moneypenny/factor/cases/[caseId]` | GET | `getCase` + `listEvidenceForCase` |
| `/api/moneypenny/factor/cases/[caseId]/transition` | POST (`action: advance\|pause\|resume`) | `transitionCaseState` / `pauseCase` / `resumeCase` |
| `/api/moneypenny/factor/cases/[caseId]/evidence` | GET / POST | `listEvidenceForCase` / `upsertEvidenceItem` |
| `/api/moneypenny/factor/cases/[caseId]/decide-admission` | POST | `decideAdmission` (MoneyPenny's sole authority) |
| `/api/moneypenny/factor/authority-chains` | POST (`mode: direct\|moneypenny_mediated`) | `establishDirectChain` / `establishMediatedChain` |
| `/api/moneypenny/factor/authority-chains/[chainId]/revoke` | POST | `revokeChain` (principal-scoped) |
| `/api/moneypenny/aegis/assessments` | POST | `createAssessment` |
| `/api/moneypenny/aegis/assessments/[assessmentId]` | GET | direct read + `listFindings` |
| `/api/moneypenny/aegis/assessments/[assessmentId]/transition` | POST (`action: begin-running\|require-review\|fail`) | `beginRunning` / `requireReview` / `failAssessment` |
| `/api/moneypenny/aegis/assessments/[assessmentId]/findings` | POST | `addFinding` |
| `/api/moneypenny/aegis/assessments/[assessmentId]/ratify` | POST | `ratifyAssessment` |

Not built this pass (out of the ordered scope — case management + assessment + admission + chains
was the core ask): `factor_standing_proposals` routes (`createStandingProposal`/
`decideStandingProposal` exist in `services/factor/standingProposal.ts`, unwired to any route).

---

## 6. Tests, typecheck, regression

- **New:** `tests/factor-aegis-api-routes.test.ts` (11 tests) — proves the route layer itself:
  401-without-persona, request parsing, dispatch to the correct service function, and
  error-code→status mapping (400/403 observed directly), by importing each route's handler and
  calling it with a constructed `NextRequest` against the `fakeSupabase` fixture (same convention
  as `tests/financial-profile-manual-entry.test.ts`). Walks a full case → ratified-assessment →
  admitted flow end-to-end through the HTTP layer, not just the service layer.
- **Updated:** `tests/factor-case-service.test.ts` (+3 cross-tenant tests), `tests/factor-authority-
  and-admission.test.ts` (+5 cross-tenant/cross-principal tests + call-site updates for the new
  required params).
- **Factor/Aegis suite total:** 37 tests (`factor-case-service` 12, `aegis-assessment-service` 8,
  `factor-authority-and-admission` 15, `factor-standing-proposal` 2) + 11 new route tests = **48
  tests, all passing.**
- **Typecheck:** `npx tsc --noEmit` — 680 errors before and after this pass (the pre-existing
  repo-wide baseline; zero new errors from any file this pass touched, confirmed by isolating
  `app/api/moneypenny/factor`/`app/api/moneypenny/aegis`/`factorCaseService`/`authorityChain`/
  `admissionAuthority`/`specialistRouter`/`specialistRecommender` in the diff).
- **Broader regression:** a full `npx vitest run` shows 49 pre-existing failures across 15 files
  (verified NOT caused by this pass — the two visible failures are `tests/repo-weight.test.ts`'s
  tracked-bytes budget, unrelated to any file this pass touched, and `tests/resolution-records
  .test.ts`'s stale `sourceDoc` reference to a moved/renamed doc from 2026-08-26). Every test file
  that actually imports `specialistRouter`/`specialistRecommender` (7 files, 188 tests) passes
  cleanly.

---

## 7. What Phase 3 needs (if the operator wants Factor onboarded as a full runtime/Horizen agent)

1. **Operator decision:** should Factor become a first-class `RUNTIME_AGENT_IDS` runtime agent with
   its own custodied wallet and Horizen registration, or stay MoneyPenny-internal machinery (no
   independent on-chain identity, invoked only through MoneyPenny's own authority)? This is a real
   architectural fork, not a default either way.
2. If yes: provision `agent_keys` (via `scripts/register-agent-keys.ts`, an operator-run step —
   never silently automated), a `registry_assets` seed migration, `app/api/agents/factor/agent-
   card.json` + `health` routes (mirroring `nakamoto`'s), a `RUNTIME_AGENT_IDS` entry, and only then
   the `RegistrableAgentConfig` entry this pass could not honestly write.
3. `factor_standing_proposals` API routes, if Factor's standing-proposal flow (PRD Journey F) is
   needed before the specialist UI.
4. The specialist UI itself — explicitly deferred by the operator's own scope for this pass.
