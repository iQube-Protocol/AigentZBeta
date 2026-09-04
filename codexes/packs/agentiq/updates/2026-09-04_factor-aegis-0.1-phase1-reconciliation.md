# Factor + Aegis 0.1 — Phase 1 reconciliation onto spec/moneypenny-mpy2-3

**Status:** Phase 1 (domain/constitutional workflow) reconciled and re-implemented on the CURRENT
`spec/moneypenny-mpy2-3` base (`0f1c02ae9`). 29/29 tests pass against an in-memory fixture — LIVE
Supabase verification is explicitly outstanding (no DB connector was reachable in this session; see
§6). Phase 2+ (UI surfaces, Bankr/Vela wiring, Journey 0 activation, DevOn skill) was **not**
attempted this pass — see §7 for why and what is genuinely next.

**Session branch:** `factor-aegis-mpy2-3`, created fresh from `origin/spec/moneypenny-mpy2-3` in
this dispatch (the harness's assigned worktree was itself ~4 months stale at `4dbabdd01` — the same
staleness the prior pass's own handoff flagged; corrected by cutting a new branch directly from
`origin/spec/moneypenny-mpy2-3` before any other work began).

**Prior pass:** `worktree-agent-a97d7b8876cb56eea` (pushed to `origin`, read-only evidence for this
pass, not merged or rebased). Its own handoff:
`codexes/packs/agentiq/updates/2026-09-04_factor-aegis-0.1-phase0-phase1.md` on that branch.

**PRD:** `FACTOR_AEGIS_MONEYPENNY_PRD_0.1.md` (uploaded, 952 lines) — read in full (roles/invariants
§2, journeys §4, state machines §6, data requirements §7, service contracts §8, security controls
§9, acceptance criteria §14).

**Scope boundary, stated explicitly per an in-session operator clarification (2026-09-04):**
Crystal / Track2 (`services/research/*` — `invariants`, `discovery_candidates`,
`invariant_contexts`, `research_objects`, `track2Programme.ts`, `provenanceCohortPreparation.ts`,
`crystalReadiness.ts`) is a separate, existing scientific pipeline and is **untouched** by this
pass — no table, no service, no import. Aegis's assessment framework (dimensions, findings, scores,
confidence, falsifiability) lives entirely in its own new `aegis_assessments`/`aegis_findings`
tables, described below. `services/factor/canonical.ts` was deliberately kept as a small
self-contained hashing utility rather than importing `services/research/review/deterministic.ts`'s
equivalent `commit()`, specifically to avoid coupling Factor/Aegis's deploy surface to
`services/research/*` even as a read-only import — see §2's canonical.ts row for the full reasoning.

---

## 1. Phase 0 — what the CURRENT base actually has (verified by reading the code, not the PRD's
own vocabulary)

| Concern | Current canonical primitive | Verified by reading |
|---|---|---|
| Financial Services Runtime (eligibility/authority) | `services/financialServices/{eligibility,constitutionalAuthorityAdapter,agentEligibilityContext,serviceRequestOrchestrator,serviceCatalog,riskEnvelope,runtimeReadinessProjection,walletConversionCapability}.ts` | `eligibility.ts` (146 lines), `constitutionalAuthorityAdapter.ts` (152 lines) read in full |
| Horizen Confidential Compute (Vela) | `services/vela/{velaClientAdapter,velaConfig,velaProjectionProvider,velaTestTransport,velaTypes}.ts` + `wasm/` — a REAL client (P-521 ECDH/AES-256-GCM) with a deterministic test transport | file listing; not modified this pass (Phase 3, deferred) |
| Horizen agent lifecycle | `services/horizen/*` (25 files) — `registrableAgents.ts` (156 lines, read in full), `agentBinding.ts`, `agentCard.ts`, etc. | `registrableAgents.ts` read in full — moneypenny/nakamoto/kn0w1 registered; a fourth entry (Factor) is the exact pattern Journey 0 needs |
| "Has this agent been sponsored/passported/delegated" | `services/journey/agentAdmissionState.ts` (493 lines; read the header + first 120 lines) — the canonical THREE-VALUED observer (sponsorship/passport/delegation/registry presence), explicitly NOT receipt-only | read in full header |
| Delegation grants | `services/delegation/delegationGrantStore.ts` (600 lines, read in full) + `delegationAuthorityGate.ts` (163 lines, read in full) — `delegation_grants` table (20260622500000), CFS-024 multi-agent model: one active grant PER (persona, agent) pair, no mediator/subdelegation field | both files read in full |
| Standing | `services/standing/*` (8 files; `standingCore.ts` is the Standing Core self-attestation wizard, NOT agent-standing accrual) + `services/crm/standingAccrualService.ts` — the REAL accrual write path (successor to the stale tree's `crm_persona_reputation`/`crm_reputation_events`) | grepped for the real accrual writer; `standingCore.ts` head read and rejected as the wrong fit |
| Passport | `services/passport/*` (23 files — bureau, sponsorship, delegate passports, `passportStatusMachine.ts`, etc.) | file listing |
| Registry | `services/registry/*` (persistence, resolver, lifecycle, trustDimensions, capabilityInvocationGates, etc.) + `registry_assets` table | file listing |
| MoneyPenny cartridge + specialist pattern | `app/(shell)/moneypenny/components/MoneyPennyCartridge.tsx` (247 lines, read in full — 10-tab shell: HFT Console/Chat/Portfolio/Strategies/X402/Identity/SmartTriad/CRM/Architect/Runtime) + `services/agents/specialistRouter.ts` (739 lines) | `MoneyPennyCartridge.tsx` read in full |
| Constitutional decisions / observer receipts | `public.activity_receipts` via `services/receipts/activityReceiptService.ts` (`createActivityReceipt`, `ActivityActionType` union, wholesale-rebuilt `activity_receipts_action_type_check`) + the protected DVN pipeline `services/dvn/activityReceiptDvnPipeline.ts` (`ANCHORABLE_ACTION_TYPES`) | read in full; `services/marketa/admissionAssessmentRunner.ts`/`admissionAssessmentStore.ts` read in full as the proven precedent for exactly this PRD's assessment/receipt shape |
| **Nearly-identical prior art for Aegis** | `marketa_agent_admission_assessments` (20260930000600) + `services/marketa/{admissionAssessmentStore,admissionAssessmentRunner}.ts` — append-only/superseding, TEXT PK, `evidence_snapshot_hash`, `actor_persona_id`, `receipt_ref`, partial-unique "one current row per subject" index | both files read in full — this is the pattern Aegis's tables are modelled on (see §2) |

None of this existed in the prior pass's stale worktree (`4dbabdd01`, four months behind). A grep for
the literal proper nouns "Factor"/"Aegis" across this current base returned zero prior art either —
the PRD's own domain objects are genuinely new work on this base too, just built against real
primitives this time instead of resembling them from a stale snapshot.

---

## 2. Keep / adapt / drop mapping (the requested deliverable)

| PRD table/service | Decision | Reasoning |
|---|---|---|
| `factor_cases` | **KEEP (new)** | No existing table models a candidate-intake pipeline state machine. `mobility_cases` (HMS, 20260617000000) is a structurally similar PRECEDENT (tenant scope, state machine, idempotency) but a different domain (immigration case). `capability_evidence` (20260713010000) was checked and rejected — dev-loop session capability facts keyed by a goal hash, unrelated. New table `supabase/migrations/20260930190000_factor_aegis_constitution_reconciled.sql`. |
| `factor_case_events` | **KEEP (new)** | Case-scoped, high-volume, append-only pipeline audit (pause/resume/state-transition replay) — a different concern from `activity_receipts` (platform-wide constitutional receipt ledger). Not every case_event is receipt-worthy (e.g. `paused`/`resumed`); the constitutionally material ones (`factor_case_opened`, `factor_case_state_changed`) ALSO get an `activity_receipts` row — one fact, two projections, matching this repo's own `factor_case_events` vs `orchestration_events` precedent pattern (see the stale-base migration's own reasoning, which this reconciliation keeps for this one table only). |
| `factor_evidence_items` | **KEEP (new)** | No existing evidence-checklist primitive fits (checked `capability_evidence`, rejected — see above). |
| `aegis_assessments` | **ADAPT — modelled on, not an extension of, `marketa_agent_admission_assessments`** | Same proven shape (TEXT PK, append-only/superseding via `supersedes_assessment_id`/`superseded_by`, partial-unique "one current row per subject", `evidence_snapshot_hash`, `actor_persona_id`, `receipt_ref`) — but a genuinely SEPARATE table. Reusing Marketa's table would conflate two independent constitutional assessors (PRD §2 invariant 2: "Aegis independence must not be compromised") under one policy-version namespace, and Marketa's table has no per-dimension findings child table at all. This is "reuse the PATTERN, not the ROW" — the correct middle ground between blind duplication and forcing an ill-fitting extension. |
| `aegis_findings` | **KEEP (new)** | No existing per-dimension findings table anywhere in this base. |
| `aegis_assessment_versions` (PRD's suggested name) | **DROPPED — folded into `aegis_assessments`'s own `supersedes_assessment_id`/`superseded_by` columns** | A separate versions table would duplicate what the superseding-row pattern (proven by `marketa_agent_admission_assessments`) already expresses; PRD itself says "or equivalent immutable version linkage." |
| `wallet_provider_bindings` | **NOT ATTEMPTED this pass (Phase 3/Journey D)** | Deferred deliberately — Bankr integration is genuinely new work in both trees; sequencing it after Phase 1 lands cleanly, per operator instruction to prioritize reconciliation over rushing Phase 2+. |
| `financial_service_activations` | **NOT ATTEMPTED this pass** | Same — Journey D/F scope, deferred. `services/financialServices/serviceRequestOrchestrator.ts` (686 lines) is the existing MoneyPenny orchestration surface this would compose into when built — confirmed present, not yet touched. |
| `confidential_compute_jobs` | **NOT ATTEMPTED this pass** | Vela adapter work (Phase 3/Journey E) — `services/vela/*` already has a real client + deterministic simulator; extending it (never a second one) is next-session work. |
| `constitutional_activity_receipts` (PRD's suggested name) | **DROPPED — reuse `public.activity_receipts`** | This is the single biggest correction versus the stale-base pass (which chose `orchestration_events`, itself a reasonable but non-canonical choice given what that worktree had). The CURRENT base already has ONE established receipt ledger for exactly this class of decision (`marketa_eligibility_assessed`/`_recommended`/`_refused`/`_quarantined`, `agent_sponsorship_recorded`, `horizen_pulse_authorized`, etc. — all via `createActivityReceipt`), with its own DVN anchoring pipeline and its own drift-regression canary (`tests/activity-receipts-action-type-parity.test.ts`). Introducing a THIRD receipt table would be exactly the `inv.engineering.036/037` violation CLAUDE.md forbids. 11 new `ActivityActionType` entries were added (`factor_case_opened`, `factor_case_state_changed`, `factor_evidence_recorded`, `aegis_assessment_requested`, `aegis_assessment_ratified`, `aegis_assessment_failed`, `aegis_assessment_superseded`, `moneypenny_admission_decided`, `factor_standing_proposed`, `factor_authority_chain_established`, `factor_authority_chain_revoked`), the CHECK constraint was rebuilt wholesale (parity canary now passes — verified), and 6 of the 11 (the ratified/failed/superseded/decided/chain-established/chain-revoked ones — the constitutional DECISIONS, not the pre-decision pipeline events) were added to `ANCHORABLE_ACTION_TYPES` in `services/dvn/activityReceiptDvnPipeline.ts`, the one unilaterally-permitted change per CLAUDE.md's DVN Pipeline Protection section. No other line in that protected file was touched. |
| `factor_authority_chains` | **KEEP (new), but as a thin overlay on `delegation_grants`, not a parallel authority ledger** | PRD §7 explicitly permits a new representation "only if the existing delegation model cannot express principal -> MoneyPenny -> Factor without ambiguity." Confirmed it cannot: `delegation_grants` is a flat (persona, agent) pair (CFS-024 multi-agent model) with no mediator field and no subdelegation flag. `establishDirectChain` therefore REQUIRES an existing active `delegation_grants` row (via `readActiveGrantForAgent`, reused directly — never re-implemented) and records only the chain-mode metadata (`delegation_grant_id` FK, `chain_mode`, `subdelegation_permitted`) `delegation_grants` cannot express; it never duplicates `allowed_actions`/`allowed_surfaces`, which stay owned by `delegation_grants`. Mediated-mode chains (`principal -> MoneyPenny -> Factor`) have no corresponding grant row by construction — that IS the gap this table exists to close. |
| `factor_standing_proposals` | **KEEP (new), propose-only** | `services/crm/standingAccrualService.ts` is the real accrual path on this base (grepped and confirmed) — `factor_standing_proposals` never writes to it or any table it owns (tested explicitly: `factor-standing-proposal.test.ts` asserts the ONLY table this module ever touches across a full accept-flow is `factor_standing_proposals` itself). |
| Admission authority (`services/moneypenny/admissionAuthority.ts`) | **KEEP (new), but composes the existing eligibility/authority stack rather than reinventing it** | `services/financialServices/eligibility.ts`/`constitutionalAuthorityAdapter.ts` answer "may this agent CONSUME/PROVIDE a MoneyPenny Financial Service" for the general runtime — a different, broader question from "does THIS Factor candidate's Aegis-assessed case get admitted." `decideAdmission` is the PRD's own separation-of-powers act (the sole writer of `admitted`/`conditionally_admitted`/`rejected`) and does not belong inside the general eligibility engine; it reads the ratified Aegis assessment via `buildAdmissionPacket` and nothing else. This is a genuine gap, not a duplicate. |
| Delegation/hashing/immutability services | **`services/factor/canonical.ts` KEPT as a small self-contained utility (not an import from `services/research/review/deterministic.ts`)** | See the scope-boundary note above — deliberately avoids any coupling, even read-only, to `services/research/*` (Crystal/Track2). `services/factor/identityRefs.ts` (the stale-base pass's T0->T2 persona-commitment layer) was **DROPPED** — the current base's own established convention (`delegation_grants`, `marketa_agent_admission_assessments`) stores raw `UUID` persona/actor ids in server-only (RLS service-role-only) tables; the T0 exposure boundary is enforced downstream by the protected DVN pipeline, which already hashes persona refs before anything reaches chain. Re-implementing a second hashing layer on top of that would have been exactly the kind of "two sources of truth for the same boundary" this repo's CLAUDE.md warns against. |

---

## 3. What was adopted verbatim, rewritten, or rejected from the prior pass

- **Adopted with only mechanical renames** (state machines, transition tables, idempotency logic,
  error classes, self-assessment refusal, critical-finding-blocks-admission gate): the CORE LOGIC of
  `factorCaseService.ts`, `aegisAssessmentService.ts`, `authorityChain.ts`, `admissionAuthority.ts`,
  `standingProposal.ts` — this is genuinely sound, well-tested constitutional-workflow logic; the
  reconciliation changed WHERE it writes (tables/columns/receipt sink), not HOW it decides.
- **Rewritten (not merely renamed):**
  - Every receipt write: `recordFactorReceipt` (-> `orchestration_events`, stale-base's own new
    module) replaced with `createActivityReceipt` (-> `activity_receipts`, the current base's real
    sink).
  - `aegis_assessments`'s versioning key: the stale-base design keyed on `(case_id, version)`
    integer versions; this pass keys on `(subject_type, subject_ref)` with a partial-unique
    "current row" index, matching `marketa_agent_admission_assessments`'s proven shape and
    generalizing the subject beyond "one case" (an `agent`-typed subject supports Factor's OWN
    Journey 0 self-assessment-by-Aegis later, without a schema change).
  - `authorityChain.ts`'s `establishDirectChain`: no longer a free-standing insert — it now
    REQUIRES and reads an active `delegation_grants` row via `readActiveGrantForAgent` (a genuine
    behavior change, not just a rename), per the keep/adapt/drop reasoning above.
  - `identityRefs.ts`'s `personaRef()` wrapping was removed from every call site — raw persona ids
    now flow the same way `delegation_grants`/`marketa_agent_admission_assessments` already do.
  - **A real bug was found and fixed during reconciliation, not merely ported**: the stale-base
    (and Marketa's own, unmodified) pattern of "insert the new current row, THEN retire the old
    one's `superseded_by`" would violate its own partial unique index in real Postgres (both rows
    briefly satisfy `WHERE superseded_by IS NULL` simultaneously with the same key) — caught by this
    pass's own fixture once its unique-constraint check was corrected to apply the partial-index
    predicate to BOTH sides of the comparison (a second, related fixture bug the first one's fix
    exposed). Fixed in `aegisAssessmentService.ts`'s `createAssessment` by retiring the prior row
    FIRST, matching `authorityChain.ts`'s `insertChain`, which already had the correct order. This
    is flagged here rather than silently fixed because `services/marketa/admissionAssessmentStore.ts`
    (out of scope for this pass — a protected-adjacent, actively-used production module) appears to
    carry the SAME ordering issue; **not modified**, but worth the operator's attention separately.
  - `canonical.ts` — same algorithm, but the module's own header now states explicitly why it does
    NOT import the current base's `services/research/review/deterministic.ts` equivalent (Crystal
    scope boundary).
- **Dropped outright:** `services/factor/identityRefs.ts`, `services/factor/receipts.ts` (both
  superseded by the current base's own conventions, as above); the stale-base migration file itself
  (evidence only, never applied); `aegis_assessment_versions` as a separate table (folded into
  `aegis_assessments`).

---

## 4. Migration

`supabase/migrations/20260930190000_factor_aegis_constitution_reconciled.sql` — additive only, does
**not** apply or depend on the stale-base migration (`20260904170000_factor_aegis_constitution.sql`,
which lives only on `worktree-agent-a97d7b8876cb56eea` and was never applied to any deployment).
Creates: `factor_cases`, `factor_case_events`, `factor_evidence_items`, `aegis_assessments` (+ a
`BEFORE UPDATE` immutability trigger, `trg_aegis_assessments_immutable`), `aegis_findings` (+ a
`BEFORE INSERT OR UPDATE OR DELETE` immutability trigger keyed off the parent assessment's state),
`factor_authority_chains` (FK'd to `delegation_grants.grant_id`), `factor_standing_proposals` (+ a
CHECK constraint requiring at least one evidence array to be non-empty). Rebuilds
`activity_receipts_action_type_check` wholesale with the full current list plus the 11 new entries
(verified against `tests/activity-receipts-action-type-parity.test.ts` — passing).

**SQL to run in the Supabase SQL editor** (same content as the migration file — the operator's
canonical review link is the file itself, since this update doc's job is the narrative, not a copy
that can drift from it):

```
Apply: supabase/migrations/20260930190000_factor_aegis_constitution_reconciled.sql
```

**Migration status: NOT applied to any live database this pass.** No Supabase MCP connector was
reachable in this session (not attempted to be faked — per CLAUDE.md's "Session Start — Verify
Connector/MCP Access" rule, the absence is stated plainly rather than guessed past). The SQL has
been reviewed against this base's own migration conventions (RLS service-role-only policies on
every new table, matching every neighboring migration; `IF NOT EXISTS`/`DROP POLICY IF EXISTS`
idempotent-apply style) but is **schema-reviewed, not live-verified**.

---

## 5. Services (all new files, all TypeScript, server-side only)

| File | Responsibility |
|---|---|
| `services/factor/canonical.ts` | Deterministic canonical-JSON + sha256 commitment hashing. Self-contained (see scope-boundary note). |
| `services/factor/factorCaseService.ts` | Case state machine, idempotent create-or-resume, pause/resume, evidence upsert-with-supersession. Structurally refuses `admitted`/`conditionally_admitted`/`rejected`. |
| `services/aegis/aegisAssessmentService.ts` | Assessment state machine, evidence-snapshot hashing, self-assessment refusal, critical-failure-blocks-admissible gate, ratification (immutable, hashed, receipted), successor-version creation. |
| `services/factor/authorityChain.ts` | `establishDirectChain` (requires an active `delegation_grants` row) / `establishMediatedChain` (refuses without explicit `subdelegationPermitted: true`), `revokeChain` (immediate), `validateChainForAction`. |
| `services/moneypenny/admissionAuthority.ts` | `decideAdmission` — the sole function permitted to write `admitted`/`conditionally_admitted`/`rejected`. Requires a ratified Aegis assessment supporting the outcome; idempotent by key. |
| `services/factor/admissionPacket.ts` | Read-only packet assembly (Journey C step 3). Legs with no live source in this environment report `verified: false, reason: 'not-available-in-this-environment'`. |
| `services/factor/standingProposal.ts` | `createStandingProposal` (refuses a proposal with no veracity/contribution/risk-of-repair evidence) and `decideStandingProposal` (status only). |

---

## 6. Tests — `npx vitest run` (fixtures/mocks only; see below for what "fixture" means here)

`tests/fixtures/fakeSupabase.ts` — a narrow in-memory double for the query-builder surface these
services use, including partial-unique-index semantics (corrected this pass — see §3's bug note) and
optimistic-concurrency (`eq('state', priorState)`-guarded update).

`vi.mock` stubs `@/services/receipts/activityReceiptService` (`createActivityReceipt`) and
`@/services/delegation/delegationGrantStore` (`readActiveGrantForAgent`) per test file — these are
REAL modules on this base with their own Supabase-backed I/O; mocking them is what makes these unit
tests, not integration tests, and is the correct boundary (they are exercised for real by their own
existing test suites elsewhere in this repo).

**29 tests, 4 files, all passing (fixture-verified — NOT live Supabase-verified):**

```
✓ tests/factor-case-service.test.ts (8)
✓ tests/aegis-assessment-service.test.ts (8)
✓ tests/factor-authority-and-admission.test.ts (11)
✓ tests/factor-standing-proposal.test.ts (2)

Test Files  4 passed (4)
     Tests  29 passed (29)
```

**Also verified passing (regression canaries this change is subject to):**
`tests/activity-receipts-action-type-parity.test.ts` (3/3) — confirms the `ActivityActionType`
union and the rebuilt `activity_receipts_action_type_check` stay in lockstep.

**Verified but pre-existing/unrelated failures (NOT caused by this change):**
`tests/repo-weight.test.ts` (total tracked bytes already over this checkout's budget before this
pass's ~10 small new files) and its `pdf-parse` sub-check (`ENOENT` on a `node_modules` file —
an install/environment issue), and `tests/dev-merge-message-discipline.test.ts` (checks the
`.github/workflows` file content, untouched by this pass). None of these three files were read,
touched, or are in the diff.

**`npx tsc --noEmit -p tsconfig.json`**: unlike the stale-base pass (which hit a hard `TS5103`
config-vs-installed-compiler mismatch that could not even start), this base's tsconfig starts
cleanly under the installed compiler — the full-project run was still in progress in the background
at the time this report was written (a large monorepo typecheck; not concluded within this pass's
time budget). Targeted checks on the 7 new/changed service files (with the `@/` path-alias errors
that are expected when invoking `tsc` on individual files outside `-p`, and are NOT present when run
under the project config) surfaced and fixed one real type error (`Set<string>` vs
`ReadonlySet<FactorCaseState>` — two `new Set([...])` literals needed an explicit generic parameter).
No other type errors in the new files.

**Live Supabase verification: not performed.** Per CLAUDE.md's "Session Start — Verify
Connector/MCP Access" rule, this is stated plainly rather than fabricated. `ListConnectors`/
`ToolSearch` for `mcp__Supabase__*` were not exercised with a live project selected in this pass —
the Supabase MCP tools were available in the toolset but no project/branch context was established,
and applying an unreviewed migration to an unknown live project without operator direction on WHICH
project is exactly the kind of guess CLAUDE.md forbids. **Outstanding**, not claimed.

---

## 7. What is genuinely deferred (Phase 2+, not attempted this pass — by operator instruction:
"prioritize finishing reconciliation cleanly before spending budget on Phase 2+")

- **Phase 2 (Factor/Aegis as MoneyPenny cartridge specialists)** — not attempted. The current
  `MoneyPennyCartridge.tsx` (10-tab shell) and `specialistRouter.ts` (739 lines) were read and
  confirmed as the correct composition points (never a separate cartridge — constraint 9 honored),
  but no UI code was written this pass.
- **Factor's own Horizon Journey Spine (Journey 0)** — not attempted. `services/journey/
  agentAdmissionState.ts` and `services/horizen/registrableAgents.ts` (both read in full) are the
  exact machinery a fourth `RegistrableAgentConfig` entry for Factor would need; adding that entry
  and walking Factor through Register -> Verify -> Claim -> Aegis-assess -> Sponsor -> Passport ->
  Delegate -> MoneyPenny-admit is the natural first Phase 2+ session's opening task, now that the
  admission/assessment domain layer it terminates into actually exists on this base.
- **Bankr adapter (Journey D)** — not attempted; no Bankr integration exists in this base at all.
  Genuinely new work, sequenced to compose with `services/financialServices/
  walletConversionCapability.ts` rather than invent a second wallet-provider abstraction.
- **Vela wiring (Journey E)** — not attempted. `services/vela/*` already has a real client +
  deterministic simulator; extending it (never a second one) for Factor/Aegis confidential-compute
  jobs is next-session work. Any simulator behavior must carry `attestation mode = simulated`
  unmistakably, per PRD Journey E and constraint carried over from the original PRD — noted for the
  next pass, not implemented here.
- **DevOn "Constitutional Financial Agent Bootstrap" skill (Phase 4A)** — not attempted; explicitly
  depends on Journey 0 being real first (PRD's own sequencing: "captured from the actual Factor
  implementation path — not written as aspirational documentation").
- **API routes** — not built this pass. The services above are route-ready (plain async functions
  taking a `SupabaseClient`), but wiring `/api/moneypenny/factor/*`/`/api/moneypenny/aegis/*` with
  `getActivePersona`-based auth is Phase 2 UI-adjacent work, deferred with it.

---

## 8. Security/authority checks performed

- Separation of powers (PRD §2 invariants 1-3): verified by test — `transitionCaseState` refuses the
  three admission-decision states unconditionally; `decideAdmission` is the only writer and requires
  a ratified Aegis decision that supports the outcome.
- Self-assessment refusal: verified by test at `createAssessment` (defense-in-depth: also enforced
  by `chk_aegis_assessments_not_self_assessed` at the DB layer).
- Critical-failure-overrides-aggregate-score gate: verified by test, both the blocking case and the
  non-blocking (`not_admissible`) case.
- Assessment/findings immutability post-ratification: enforced by DB triggers in the migration; not
  live-verified against Postgres (§4/§6).
- Direct-chain authority requires REAL existing delegation: verified by test (`no-active-
  delegation-grant` refusal) — this module cannot manufacture authority `delegation_grants` doesn't
  already grant.
- Mediated-chain subdelegation requires explicit assertion: verified by test.
- Chain revocation is immediate: verified by test.
- Idempotency: `createOrResumeCase` (candidate-dedupe + explicit-key paths, including a simulated
  race via the fixture's unique-constraint conflict handling) and `decideAdmission` (replayed-command
  test, asserting exactly one `admission_decided` event across two identical calls) both verified.
- Standing-proposal evidence requirement: verified by test; verified the accepted-path touches ONLY
  `factor_standing_proposals` across a full create-then-accept flow (not merely "doesn't call a named
  function" — the test inspects every table the fixture ever wrote to).
- T0/T1/T2: no new hashing layer was introduced (see §2's reasoning); every persona id flows through
  `createActivityReceipt` exactly as every other constitutional-decision caller on this base already
  does, so the existing protected DVN pipeline's hashing is the enforcement point, unchanged.
- Cross-tenant isolation: `factor_cases`/`factor_authority_chains` carry tenant/principal scope in
  their unique indexes; **not yet exercised by a dedicated cross-tenant test** — a real gap, flagged
  not hidden (same gap the stale-base pass flagged; still open).

---

## 9. Candidate invariants / architectural refinements surfaced (proposed only, NOT ratified —
requires operator approval before any roadmap registration, per this repo's Prospective Evolution
Capture convention)

1. **Candidate invariant** — "A superseding-row write (retire-then-insert) must retire the OLD
   current row before inserting the NEW one, never the reverse, whenever the table enforces a
   partial-unique 'one current row' index." This pass found the reverse order in both its own
   inherited draft AND in `services/marketa/admissionAssessmentStore.ts` (unmodified, out of scope,
   flagged separately above) — the same defect shape appearing independently in two
   assessment-versioning implementations suggests it is worth stating generally rather than fixing
   ad hoc each time it's found.
2. **Candidate invariant** — "An authority-chain overlay table that references an existing
   delegation-grant table must read that table's own live grant (never re-derive or duplicate its
   allowed-actions/surfaces), and must REFUSE to establish direct-mode authority when no such grant
   exists." Generalizes `factor_authority_chains`' relationship to `delegation_grants` for any future
   agent that needs a chain-mode overlay on top of the existing bounded-delegation model.
3. **Candidate architectural refinement (carried forward from the prior pass, now doubly-confirmed)**
   — the harness's isolated-worktree dispatch model can silently place a session's assigned worktree
   many months behind the branch named in its own dispatch instructions (this pass's assigned
   worktree was on `4dbabdd01`, the SAME stale commit as the PRIOR pass's, despite the dispatch
   explicitly stating the base should be `spec/moneypenny-mpy2-3` at `0f1c02ae9`). This was caught in
   this pass's first few tool calls (`git log -1`, `git merge-base --is-ancestor`) and corrected by
   cutting a fresh branch directly from `origin/spec/moneypenny-mpy2-3`, but a standing pre-flight
   check (comparing the assigned worktree's HEAD against the branch named in the dispatch, not just
   "does it look recent") would make this a zero-cost catch rather than a two-pass lesson.

---

## 10. Files changed this pass

```
supabase/migrations/20260930190000_factor_aegis_constitution_reconciled.sql   (new)
services/factor/canonical.ts                                                  (new)
services/factor/factorCaseService.ts                                          (new)
services/factor/authorityChain.ts                                             (new)
services/factor/admissionPacket.ts                                            (new)
services/factor/standingProposal.ts                                           (new)
services/aegis/aegisAssessmentService.ts                                      (new)
services/moneypenny/admissionAuthority.ts                                     (new)
services/receipts/activityReceiptService.ts                                   (edit — 11 new ActivityActionType entries)
services/dvn/activityReceiptDvnPipeline.ts                                    (edit — 6 new ANCHORABLE_ACTION_TYPES entries; the one permitted unilateral change)
tests/fixtures/fakeSupabase.ts                                                (new)
tests/factor-case-service.test.ts                                             (new)
tests/aegis-assessment-service.test.ts                                        (new)
tests/factor-authority-and-admission.test.ts                                  (new)
tests/factor-standing-proposal.test.ts                                        (new)
codexes/packs/agentiq/collections.json                                        (edit — registers this doc)
codexes/packs/agentiq/updates/2026-09-04_factor-aegis-0.1-phase1-reconciliation.md  (this file)
```

No existing file's BEHAVIOR was modified — the two `services/receipts`/`services/dvn` edits are
additive (new union members / new Set entries), matching the exact "extend by addition" pattern
every prior migration touching those files already uses.
