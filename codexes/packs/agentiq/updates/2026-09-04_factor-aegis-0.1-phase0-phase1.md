# Factor + Aegis 0.1 — Phase 0 reconnaissance + Phase 1 domain layer

**Status:** Phase 0 complete. Phase 1 (domain/constitutional workflow) implemented and tested for
the case/assessment/authority-chain/admission/standing-proposal core. Phase 2-5 not attempted this
pass — see "What is genuinely deferred" below.
**Session branch:** `worktree-agent-a97d7b8876cb56eea` (isolated worktree; NOT merged with, and does
not depend on, the primary session's `spec/moneypenny-mpy2-3` branch).
**PRD:** `FACTOR_AEGIS_MONEYPENNY_PRD_0.1.md` (uploaded, 952 lines).

---

## 0. Critical finding — this worktree is a stale snapshot (read this first)

Before any design work, `git log`/`git branch` confirmed this session's isolated worktree is based
on commit `4dbabdd01`, which is **far behind** the shared checkout the harness also exposes at
`/home/user/AigentZBeta` (outside `.claude/worktrees/...`) — that shared checkout is on
`spec/moneypenny-mpy2-3` and carries roughly **four more months of platform evolution**: 412
migrations vs. this worktree's 155, a CLAUDE.md with ~15 additional major sections (HMS Identifier
Isolation, DVN Pipeline Protection, Resolution→Invariant Loop, Companion Menu invariants, Canonical
Surface Styling, aigentMe Capsule↔Layout Contract, etc. — none of which exist in this worktree's own
CLAUDE.md), and, most relevant to this PRD, an already-substantial **MoneyPenny financial-services
runtime** that this worktree does not have at all:

| Primitive the shared checkout already has | This worktree |
|---|---|
| `services/financialServices/{eligibility,orchestration,constitutionalAuthorityAdapter,agentEligibilityContext,serviceCatalog,serviceRequestOrchestrator,riskEnvelope,runtimeReadinessProjection,walletConversionCapability}.ts` | absent |
| `services/vela/*` — a **real** Horizen Confidential Compute Engine client (`velaClientAdapter.ts`, live P-521 ECDH + AES-256-GCM crypto matching the on-chain contract byte-for-byte) + `velaTestTransport.ts` (deterministic in-memory double) + `velaProjectionProvider.ts` + an `AttestationMode` type (`NO_ATTESTATION_LOCAL` / `NITRO_ATTESTED`) | absent |
| `services/horizen/*` (25 files: agent binding, registration, Presence, Pulse endpoint, P&L onboarding/verification, register-ceremony) | absent |
| `services/journey/agentAdmissionState.ts` — the canonical "has this agent been sponsored/passported/delegated" resolver, and `services/horizen/registrableAgents.ts` — the exact per-agent config shape (MoneyPenny, Nakamoto, Know1 are already registered) that Factor's own Journey 0 would need a fourth entry in | absent |
| `services/delegation/{delegationAuthorityGate,delegationGrantStore}.ts` + `delegation_grants` table (persona→agent bounded-delegation grants, durable, RLS'd) | absent |
| `services/standing/*` (8 files), `standing_keystone`/`standing_tier`/`capability_standing` migrations | absent |
| `services/passport/*` (23 files — Polity Passport Bureau, sponsorship, delegate passports) | absent |
| `services/identity/personaReferences.ts` (`personaPublicRef`/`constitutionalRef` T2-commitment helpers) | absent |
| A richer MoneyPenny cartridge (`ServiceOrchestrationPanel`, `RuntimePanel`, `X402Dashboard`, `HFTConsole`, financial-profile compute/review routes) | this worktree has only the earlier `MoneyPennyCartridge`/`MoneyPennyChat`/`useMoneyPennyClient` base |

A full-repo grep for the literal agent names **"Factor" / "Aegis"** (as this PRD's proper nouns, not
the common English words) returned **zero prior art** in either tree — so the PRD's own domain
objects are genuinely new work either way. But the *surrounding* financial-services/authority
scaffolding this PRD explicitly instructs "reuse first" against already exists — just not in the
branch this session is permitted to commit to.

**This is reported per PRD instruction 16.10 ("if an architectural conflict is discovered, stop
before creating a parallel source of truth and report the precise conflict with a recommended
resolution") even though it is not a same-repo duplication in the classic CLAUDE.md sense — it is a
harness-level branch-staleness conflict with the same practical consequence: building Factor/Aegis's
authority/eligibility/service-activation layer against this stale snapshot risks producing a second,
incompatible implementation of concepts `services/financialServices/*` already names
(`constitutionalAuthorityAdapter`, `eligibility`, `agentEligibilityContext`,
`serviceRequestOrchestrator`) once the branches are reconciled.**

**Recommended resolution:** before Phase 2 (UI) or Phase 3 (Bankr/Vela provider wiring) proceeds,
rebase or re-dispatch this work against a worktree cut from `spec/moneypenny-mpy2-3` (or its merge
target), so Factor/Aegis's admission/eligibility/service-activation logic is written against the
services that already exist there instead of resembling them from a stale base. Scoping decision
made for *this* pass, given that constraint (see §2 below): implement only the parts of Factor/Aegis
that are genuinely absent from *both* trees (the case/assessment/authority-chain domain objects
themselves — confirmed zero prior art), and explicitly defer anything that would duplicate the
richer branch's financial-services/Vela/Bankr/delegation/standing/Horizen primitives.

---

## 1. Phase 0 — implementation map (primitives inspected, in THIS worktree)

| PRD need | Reused primitive (this worktree) | Notes |
|---|---|---|
| Immutable observer/audit receipt ledger | `public.orchestration_events` (`supabase/migrations/20260402000000_experience_model_journey_state.sql`) | Generic `event_type`/`metadata jsonb`, no CHECK constraint, already RLS'd service-role-only, `receipt_eligible` flag. Reused verbatim via `services/factor/receipts.ts` — the PRD's suggested `constitutional_activity_receipts` table would duplicate this. |
| Aigent Me's own activity ledger | `public.activity_receipts` | Left **untouched** — a different, already call-site-committed ledger (session/persona daily-driver activity) with an enumerated `action_type` CHECK constraint. Widening its CHECK for Factor/Aegis-specific types was judged higher collision risk than reusing `orchestration_events` for the constitutional-receipt need, so it was not touched. |
| Registry presence | `public.registry_assets` (`20260402010000_registry_ingestion_factory_v1.sql`) + `services/registry/*` | `factor_cases.candidate_registry_asset_id` is a plain reference column; no new Registry table introduced. |
| Content/credential access gate | `services/access/evaluateAccess.ts`, `types/access.ts` | Domain-specific (free/credential/payment content gating) — not a fit for Factor/Aegis's authorization model, so NOT reused directly; `getActivePersona`'s `cartridgeFlags.isAdmin` pattern is the intended fit for feature-flag/admin gating in Phase 2+ (not yet wired — no route layer built this pass). |
| Standing accrual | `crm_persona_reputation` / `crm_reputation_events` (`20251130010000_task_contribution_engine.sql`, `20251128173200_agentiq_crm_enhanced.sql`) | Confirmed as the ONLY place standing is actually accrued in this worktree. `services/factor/standingProposal.ts` writes to a **new** `factor_standing_proposals` table only, and is tested to assert it never touches these two tables (PRD §10 "Factor may emit standing proposals, not standing awards"). |
| AgentMe specialist-invocation pattern | `services/agents/specialistRouter.ts` (`SpecialistId`, `askSpecialist`, template+LLM response shape) | Confirmed present in this worktree. It is a **lightweight advisory Q&A pattern** (one JSON response card), materially thinner than what PRD §5.1/§5.2 ask for (a full case/assessment pipeline with 9 and 7 dedicated right-pane views respectively). Reusable as the entry point for a "MoneyPenny copilot asks Factor/Aegis a question" quick-consult, but the PRD's richer state views need new UI beyond what this router alone provides — deferred to Phase 2 (see §3). |
| Canonicalized-payload hashing | none found in this worktree (`services/simulation/journal.ts` and `services/research/review/deterministic.ts`, which provide this in the more current tree, are absent here) | New, minimal, self-contained `services/factor/canonical.ts` — deliberately mirrors the more current tree's exact contract (sha256 hex over recursively key-sorted JSON) so a later reconciliation can replace its body with a re-export without invalidating any hash already computed and stored. |
| T0→T2 persona/identifier commitments | none found in this worktree (`services/identity/personaReferences.ts` is absent here) | New, minimal `services/factor/identityRefs.ts` — mirrors the more current tree's `personaPublicRef`/`constitutionalRef` derivation exactly (sha256 hex, first 16 chars) for the same reconciliation reason. |
| Delegation model | **absent** — no `delegation_grants` table or equivalent exists in this worktree at all | This directly triggered PRD §7's explicit permission: "introduce an authority-chain/subdelegation representation only if the existing delegation model cannot express principal → MoneyPenny → Factor without ambiguity." With no delegation model present at all, a new `factor_authority_chains` table was introduced (§2 below) — self-contained, not layered on a nonexistent table. |
| Horizon Journey Spine (Journey 0) | **absent** — `services/journey/agentAdmissionState.ts`, `services/horizen/registrableAgents.ts`, `services/homecoming/*`, `services/agents/sponsorPolityAgent.ts` all live only in the more current tree | Factor's own Journey 0 dogfooding (Register→Verify→Claim→Sponsor→Passport→Delegate→RegistryActivated) has **no machinery to dogfood against in this worktree**. This is the single largest genuine gap and the strongest argument for the rebase recommended in §0 before Phase 1's Journey-0 acceptance criteria (21/22) can be met for real — see §4. |

---

## 2. Phase 1 — what was implemented (this pass)

Scope deliberately narrowed to the domain objects confirmed to have **zero prior art in either
tree** (the Factor/Aegis-specific pipeline, assessment engine, and the one delegation-chain shape
this worktree's total absence of a delegation model actually requires) — see §0's reasoning.

### Migration

`supabase/migrations/20260904170000_factor_aegis_constitution.sql` — additive only. Creates:

- `factor_cases` — Journey A/§6.1 pipeline state machine (`discovered → … → active`, `paused` from
  any nonterminal state), tenant/owner scope, idempotency key, dedupe key
  (`candidate_identity_key`, unique per tenant — enforces "create-or-resume ONE case" at the DB
  layer, not just in application code).
- `factor_case_events` — append-only, case-scoped, idempotent-by-`(case_id, idempotency_key)` audit
  trail (distinct from `orchestration_events`: domain-scoped pipeline view vs. platform-wide
  observer ledger — one fact, two projections, never two sources of truth for it).
- `factor_evidence_items` — evidence checklist (`missing/requested/supplied/stale/contradicted`),
  versioned via `superseded_by` rather than in-place edits once evidence has fed a locked assessment.
- `aegis_assessments` — versioned (`supersedes_assessment_id`), evidence-snapshot-hashed, state
  machine `draft → evidence_locked → running → review_required → ratified|failed`. A `BEFORE UPDATE`
  trigger (`trg_aegis_assessments_immutable`) refuses any change to the decision-bearing columns once
  a row is `ratified`/`immutable` — enforced at the DB layer, not only in application code (defense
  in depth per PRD's "never silently weaken an invariant because an integration is inconvenient").
- `aegis_findings` — per-dimension findings (claim/evidence/method/result/confidence/limitations/
  falsification condition/`is_critical`). A companion trigger blocks INSERT/UPDATE/DELETE once the
  parent assessment is ratified.
- `factor_authority_chains` — `direct` (principal→Factor) or `moneypenny_mediated`
  (principal→MoneyPenny→Factor), a CHECK constraint enforcing the mediator is present iff the mode
  is mediated, and an explicit `subdelegation_permitted` boolean that is never inferred from session
  presence.
- `factor_standing_proposals` — Factor's PROPOSE-only standing queue; explicitly never writes
  `crm_persona_reputation`/`crm_reputation_events` (tested).

All tables: RLS enabled, service-role-only policies (matching every existing table in this
worktree), `created_at`/`updated_at`, and comments documenting the T0/T1/T2 discipline applied.

### Services

| File | Responsibility |
|---|---|
| `services/factor/identityRefs.ts` | T2-safe persona/identifier commitments (sha256-hex16), mirroring the more current tree's `personaReferences.ts` derivation. |
| `services/factor/canonical.ts` | Deterministic canonical-JSON + sha256 commitment hashing (mirrors the more current tree's `deterministic.ts`/`journal.ts` contract). |
| `services/factor/factorCaseService.ts` | Case state machine (server-side-validated forward-transition table), idempotent create-or-resume, pause/resume, evidence upsert-with-supersession. **Structurally refuses** to set `admitted`/`conditionally_admitted`/`rejected` — those three target states throw `admission-requires-moneypenny-authority` unconditionally, so no Factor-side code path can reach them. |
| `services/aegis/aegisAssessmentService.ts` | Assessment state machine, evidence-snapshot hashing, self-assessment refusal (`subjectAgentRef === requestedByAgentRef`), critical-failure-blocks-admissible gate (checked against `aegis_findings` at ratification time, independent of any aggregate score), ratification (immutable, hashed, receipted), successor-version creation. |
| `services/factor/authorityChain.ts` | `establishDirectChain` / `establishMediatedChain` (refuses mediated mode without an explicit `subdelegationPermitted: true`), `revokeChain` (immediate), `validateChainForAction` (status/expiry/subdelegation/allowed-action checks). |
| `services/moneypenny/admissionAuthority.ts` | `decideAdmission` — the **sole** function permitted to write `admitted`/`conditionally_admitted`/`rejected`. Requires `admission_pending` state; requires a **ratified** Aegis assessment whose decision supports the requested outcome for `admitted`/`conditionally_admitted` (MoneyPenny may still `reject` an admissible candidate — its own judgment call — but may never manufacture an admission Aegis never recommended); idempotent by key (a replayed command returns the same outcome without re-deciding). |
| `services/factor/admissionPacket.ts` | Read-only packet assembly (Journey C step 3). Readiness legs this worktree has no live source for (Horizen Presence, Pulse/P&L, wallet-control proof) are reported as `verified: false, reason: 'not-available-in-this-environment'` rather than fabricated as passing — per PRD instruction 5 / CLAUDE.md "No Guessing". |
| `services/factor/standingProposal.ts` | `createStandingProposal` (refuses a proposal carrying no veracity/contribution/risk-of-repair evidence — PRD §10's "positive economic outcome alone is insufficient" as a hard gate, not just a written rule) and `decideStandingProposal` (status only — never touches the real accrual tables). |
| `services/factor/receipts.ts` | The one write path into `orchestration_events` for Factor/Aegis/MoneyPenny-admission constitutional receipts; asserts every `actorPersonaRef` is already a commitment, never a raw UUID. |

### Tests — `npm test` (vitest), fixtures/mocks only (no live Supabase credentials in this
environment — reported as outstanding, not fabricated, per PRD instruction 8)

`tests/fixtures/fakeSupabase.ts` — a narrow in-memory double for exactly the query-builder surface
these services use (not a general Postgres emulator), including unique-constraint and
optimistic-concurrency (`eq('state', priorState)`-guarded update) semantics.

27 tests, 4 files, **all passing**:

- `tests/factor-case-service.test.ts` (7) — create/resume idempotency, duplicate-candidate
  prevention, valid/invalid state transitions, the admission-state refusal, pause/resume
  losslessness, terminal-state refusal.
- `tests/aegis-assessment-service.test.ts` (7) — self-assessment refusal, deterministic
  evidence-set hashing (key-order-independent), critical-failure blocks `admissible` (but not
  `not_admissible`), clean ratification + stable hash, ratify-from-wrong-state refusal, no
  post-ratification findings, successor versioning without mutating the prior row.
- `tests/factor-authority-and-admission.test.ts` (11) — mediated mode refused without explicit
  subdelegation, mediated chain recorded correctly, direct chain recorded correctly, immediate
  revocation, expiry, active-grant supersession, admission refused outside `admission_pending`,
  admission refused without a ratified assessment, successful admission, MoneyPenny rejecting an
  admissible candidate (its prerogative), idempotent replay of an admission command.
- `tests/factor-standing-proposal.test.ts` (2) — evidence-required refusal, accepted proposal never
  touching `crm_persona_reputation`/`crm_reputation_events`.

```
Test Files  4 passed (4)
     Tests  27 passed (27)
```

Typecheck: `npx tsc --noEmit` against this worktree's own `tsconfig.json` fails to even start
(`error TS5103: Invalid value for '--ignoreDeprecations'` — a **pre-existing** mismatch between the
repo's tsconfig, which expects a TypeScript ≥6.0-aware compiler, and the installed `typescript@5.9.3`;
unrelated to this change). Re-run against a copy of the same tsconfig with only that one flag
corrected: **276 pre-existing errors elsewhere in the repo** (e.g. `components/registry/
IngestionFactoryPanel.tsx`), **zero** in any file this session added (`services/factor/*`,
`services/aegis/*`, `services/moneypenny/admissionAuthority.ts`, all four new test files, the fake
Supabase fixture).

---

## 3. What is genuinely deferred (not attempted this pass, and why)

- **Phase 2 (UI surfaces)** — not attempted. The PRD requires Factor/Aegis to be surfaced through
  "the established AgentMe specialist invocation pattern and MoneyPenny cartridge's existing
  left/right-pane composition" (instruction 3). This worktree's MoneyPenny cartridge is the earlier,
  thinner version (§0 table); building the 9-view Factor pipeline / 7-view Aegis dossier UI against
  it risks producing UI that has to be substantially rebuilt once reconciled with the richer
  `spec/moneypenny-mpy2-3` MoneyPenny surface. Recommend deferring Phase 2 until after the rebase in
  §0.
- **Phase 3 (Bankr adapter, Vela simulator)** — not attempted. The more current tree already has a
  **real** Vela client (`services/vela/velaClientAdapter.ts`) with a deterministic test transport and
  an `AttestationMode` concept; building a second, simulator-only Vela adapter in this stale worktree
  would be exactly the "parallel source of truth" CLAUDE.md and this PRD both forbid. No Bankr
  adapter exists in either tree — genuinely new work, but sequenced after the rebase so it can sit
  behind the same provider-neutral wallet interface `services/financialServices/
  walletConversionCapability.ts` already gestures at, rather than inventing a second one.
- **Phase 4 (Pulse/P&L evidence, activity ledger, service matching)** — `services/horizen/
  pulseEndpoint.ts`, `pnlOnboardingClient.ts`, `pnlServiceVerification.ts` all live only in the more
  current tree. `factor_standing_proposals.pulse_pnl_refs` is a plain `jsonb` array ready to receive
  references once that integration exists; no Pulse/P&L call was fabricated.
- **Phase 4A (DevOn bootstrap skill)** — not attempted. Depends on Journey 0 (Factor's own activation
  through a real Horizon Journey Spine) being demonstrable first, which in turn depends on `services/
  journey/agentAdmissionState.ts` and `services/horizen/registrableAgents.ts` — both absent here
  (§1/§4).
- **API routes** — not built this pass. The services above are route-ready (plain async functions
  taking a `SupabaseClient`), but wiring them behind `/api/moneypenny/factor/*` /
  `/api/moneypenny/aegis/*` endpoints with `getActivePersona`-based auth was left for the same reason
  as Phase 2: this worktree's identity-spine surface predates several of the more current tree's
  route conventions, and route-layer work is cheap to redo correctly post-rebase but expensive to redo
  if built twice.

---

## 4. Factor's Journey Spine state (PRD §16.11 requirement — implemented / simulated / migrated /
activated / live-verified, kept strictly separate)

| Stage | State | Detail |
|---|---|---|
| Domain schema (case/assessment/authority-chain/standing-proposal tables + triggers) | **implemented, not yet migrated live** | SQL written and reviewed against this worktree's existing migration conventions; **not applied to any database** — no Supabase credentials/connector available in this environment (verified: `ListConnectors`/`ToolSearch` were not exercised because no live DB access was offered this session; stated here as outstanding rather than assumed). |
| Case/assessment/authority-chain/admission/standing-proposal service logic | **implemented and unit-tested** (27/27 passing) against an in-memory fixture | Not exercised against a real Postgres instance — RLS policies, the `BEFORE UPDATE` immutability triggers, and the partial unique index on `factor_authority_chains` are written but **not live-verified**. |
| Factor's own agent identity / Registry record / Participant Passport / metaMe wallet / Horizen Presence / Pulse / P&L / Aegis self-assessment / MoneyPenny admission (Journey 0, PRD §4/acceptance criteria 21-22) | **not started** | No `RegistrableAgentConfig` entry, no agent-card route, no sponsorship. Blocked on the missing Journey Spine machinery (§1's `services/journey/agentAdmissionState.ts` row) which exists only in the more current tree — this is the top item for the very first post-rebase session. |
| DevOn "Constitutional Financial Agent Bootstrap" skill (Phase 4A) | **not started** | Depends on Journey 0 above being real, per PRD's own sequencing ("captured from the actual Factor implementation path — not written as aspirational documentation"). |
| Live Bankr / live Horizen Vela verification | **not attempted; explicitly outstanding** | No Bankr integration exists in either tree. Vela exists only in the more current tree and was not touched here (§3). Per PRD instructions 8-9, this is reported as outstanding rather than fabricated. |

---

## 5. Security/authority checks performed

- Separation of powers (PRD §2 invariants 1-3): verified by test — `transitionCaseState` refuses the
  three admission-decision states unconditionally (code `admission-requires-moneypenny-authority`);
  `decideAdmission` is the only writer of those states and requires a *ratified* Aegis decision that
  supports the outcome.
- Self-assessment refusal (Factor cannot assess itself; Aegis independence): verified by test at both
  `createAssessment` and (defense-in-depth) `ratifyAssessment`.
- Critical-failure gate overriding aggregate score: verified by test (`critical-failure-blocks-admission`).
- Assessment immutability post-ratification: enforced by a DB trigger (migration) in addition to the
  application never issuing such an update; not live-verified against Postgres (§4).
- T0/T1/T2 discipline: every `factor_case_events`/`aegis_assessments`/`factor_authority_chains`/
  `orchestration_events` write that could carry a persona/agent identifier uses `personaRef()` (or an
  already-resolved agent ref) — `assertNotRawPersonaId` throws if a raw UUID reaches
  `recordFactorReceipt` or `ratifyAssessment`.
- Idempotency: `createOrResumeCase` (duplicate-candidate + explicit-key paths, including a
  simulated race via the fixture's unique-constraint conflict handling) and `decideAdmission`
  (replayed-command test) both verified.
- Standing-proposal evidence requirement: verified by test; verified the accepted-path never writes
  `crm_persona_reputation`/`crm_reputation_events`.
- Cross-tenant isolation: `factor_cases`/`factor_authority_chains` carry `tenant_id` and the
  candidate-dedupe/active-grant uniqueness is scoped by it; **not yet exercised by a dedicated
  cross-tenant test** in this pass (a real gap — flagged, not hidden).

---

## 6. Candidate invariants / architectural refinements surfaced (flagged per this repo's Prospective
Evolution Capture convention — proposed only, NOT ratified; requires operator approval before any
roadmap registration)

1. **Candidate invariant** — "A ratified/ratification-bearing constitutional record must be immutable
   at the database layer, not only the application layer" (the `aegis_assessments`/`aegis_findings`
   triggers here). This generalises a pattern this worktree does not yet apply anywhere else it was
   checked (DVN/orchestration receipts here rely on application discipline alone).
2. **Candidate architectural refinement** — the harness's "isolated worktree" dispatch model can put a
   session multiple months behind a fast-moving primary branch without any in-band signal until a
   file-existence check is actually run. Worth a standing pre-flight (e.g. compare migration counts /
   CLAUDE.md section counts between the assigned worktree and the shared checkout) so a dispatched
   session discovers this in its first few tool calls rather than partway through reconnaissance.
3. **Candidate invariant** — "Aegis's ratification decision and MoneyPenny's admission decision must
   be independently, structurally unreachable by the proposing agent's own code path" (not just
   policy-gated) — the pattern `transitionCaseState`'s hard refusal + `decideAdmission`'s separate
   module demonstrates. Worth stating generally for any future constitutional-authority pair in this
   codebase.

---

## 7. Files changed this pass

```
supabase/migrations/20260904170000_factor_aegis_constitution.sql   (new)
services/factor/identityRefs.ts                                     (new)
services/factor/canonical.ts                                        (new)
services/factor/receipts.ts                                         (new)
services/factor/factorCaseService.ts                                 (new)
services/factor/authorityChain.ts                                    (new)
services/factor/admissionPacket.ts                                   (new)
services/factor/standingProposal.ts                                  (new)
services/aegis/aegisAssessmentService.ts                             (new)
services/moneypenny/admissionAuthority.ts                            (new)
tests/fixtures/fakeSupabase.ts                                       (new)
tests/factor-case-service.test.ts                                    (new)
tests/aegis-assessment-service.test.ts                                (new)
tests/factor-authority-and-admission.test.ts                          (new)
tests/factor-standing-proposal.test.ts                                (new)
codexes/packs/agentiq/collections.json                                (edit — registered this doc)
codexes/packs/agentiq/updates/2026-09-04_factor-aegis-0.1-phase0-phase1.md  (this file)
```

No existing file's behavior was modified. No migration or table already present in this worktree was
altered.
