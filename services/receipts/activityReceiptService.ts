/**
 * ActivityReceiptService — Aigent Me Phase 6.
 *
 * Per PRD v0.2 §11 (ActivityReceipt data object) and §10 FR12 — every
 * meaningful Aigent Me action produces a receipt.
 *
 * This is the canonical writer + reader. Routes that need to record an
 * action call `createActivityReceipt(...)`; the receipts list endpoint
 * calls `listActivityReceiptsForPersona(...)`.
 *
 * Anchoring lifecycle:
 *   - alpha: receipts are local (`receipt_status: 'local'`)
 *   - 6.b: DVN-pending → DVN-recorded as the batch finalizer runs
 *
 * Privacy:
 *   - persona_id is T0. Never serialise to a JSON response.
 *   - context_shared is a list of category labels ("brief context",
 *     "experience-goals", "campaign extracts"); it MUST NOT contain
 *     payload values.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

// ─────────────────────────────────────────────────────────────────────────
// Types.
// ─────────────────────────────────────────────────────────────────────────

export type ActivityActionType =
  | 'intent_queued'
  | 'specialist_consulted'
  | 'artifact_created'
  // Artifact Runtime constitutional publication (CFS-025 Phase 2; DVN-anchorable).
  // The one production-receipt action type: a constitutional-tier artifact was
  // PUBLISHED (not merely created). Added to ANCHORABLE_ACTION_TYPES so the
  // publication commitment lands in tamper-evident memory. See
  // services/artifact/receiptReconciliation.md.
  | 'artifact_published'
  | 'artifact_sent'
  | 'approval_granted'
  | 'approval_rejected'
  | 'experience_model_updated'
  | 'session_started'
  | 'session_completed'
  // Polity Passport Bureau (DVN-anchorable; see activityReceiptDvnPipeline)
  | 'passport_application_submitted'
  | 'passport_issued'
  | 'passport_status_changed'
  | 'passport_revoked'
  | 'passport_privilege_changed'
  | 'passport_infraction_recorded'
  // Governance (DVN-anchorable; Operation Chrysalis Phase 0A)
  | 'governance_decision_ratified'
  | 'governance_decision_amended'
  | 'governance_authority_exercised'
  | 'governance_escalation_triggered'
  // Consumer task runner (DVN-anchorable; Workstream C-b)
  | 'experience_task_completed'
  // Autonomous agent lifecycle (DVN-anchorable; Option A revocation framework)
  | 'agent_revocation_state_changed'
  // Operator-logged work + standing documents (DVN-anchorable). The feedback
  // loop: an action the operator took (on- or off-platform) or a proof-of-work
  // document uploaded becomes a verified Standing signal that grounded progress
  // reports read as PROGRESS from the ingested baseline.
  | 'operator_action_logged'
  | 'standing_document_added'
  // Partner agent evidence (DVN-anchorable; metaProof × Horizen Labs pilot,
  // operator ruling 2026-07-28). A correlated EXTERNAL agent identity —
  // registry record + optional Pulse/validation proof — recorded as a metaMe
  // constitutional evidence record. See services/horizen/evidence.ts.
  | 'partner_agent_evidence_recorded'
  // Bounded delegation lifecycle (DVN-anchorable)
  | 'agent_delegated'
  | 'agent_delegation_revoked'
  // Plan subscription lifecycle (DVN-anchorable)
  | 'plan_purchased'
  | 'plan_renewed'
  // Invariant lifecycle (Chrysalis Foundation Phase 1; CFS-001 §7).
  // validated/canonized/superseded are DVN-anchorable constitutional-memory
  // events; discovered stays local (high volume, pre-validation).
  | 'invariant_discovered'
  | 'invariant_validated'
  | 'invariant_canonized'
  | 'invariant_superseded'
  // InvariantQube publication (Chrysalis Foundation Phase 2; CFS-004 §3) —
  // compressed expertise published into constitutional memory. DVN-anchorable.
  | 'invariant_qube_published'
  // Consequence Operating Model stages (Chrysalis Foundation Phase 3; CFS-006a).
  // forecast + evolved are DVN-anchorable (the flywheel's constitutional arc);
  // curated stays local (high volume, pre-decision).
  | 'knowledge_curated'
  | 'consequence_forecast_recorded'
  | 'knowledge_evolved'
  | 'experience_render_validated'
  | 'implementation_pack_generated'
  // DCC implementation dispatch (2026-07-14) — the platform hands the generated
  // pack to Claude Code running in CI (repository_dispatch → claude-implement
  // workflow). Provenance that implementation was INITIATED from the platform;
  // execution stays human at the PR-merge gate (CFS-016 D1). DVN-anchorable.
  | 'implementation_dispatched'
  | 'deployment_proposed'
  // Constitutional Development Environment (CFS-020 CDE) — the three Dev
  // Receipts classes. constitutional_validation_recorded + remediation_recorded
  // are the Constitutional class; deployment_authorized is the Deployment class
  // (alongside deployment_proposed). All DVN-anchorable.
  | 'constitutional_validation_recorded'
  | 'remediation_recorded'
  | 'deployment_authorized'
  // Merge validation-gate override (2026-07-14): an admin merged a pack PR
  // WITHOUT a passing validation record, with a stated reason. The override
  // is never silent — this receipt is the tamper-evident record of it.
  | 'validation_override_granted'
  // Constitutional Acceptance (CFS-032 §4, 2026-07-16): a shipped capability
  // was admitted into the Capability Registry as a governed constitutional
  // asset — the capability-level equivalent of constitutional ratification.
  // capability_operationally_validated (CFS-032 §5) is the Standing accrual
  // trigger: evidence the deployed capability actually functions in
  // production. Both DVN-anchorable.
  | 'capability_registered'
  | 'capability_operationally_validated'
  // Capability lifecycle — Archive (SPEC-MMC-002 §6.3 Phase 3, 2026-07-24): a
  // capability's own registrant transitioned its lifecycle_state to
  // 'deprecated' (a pure status-flag update — no execution, no deployment,
  // no external side effect). DVN-anchorable, same tamper-evident-memory
  // rationale as capability_registered/capability_operationally_validated.
  | 'capability_deprecated'
  | 'research_lifecycle_transition'
  // Foundational Validation Series — canonical result publication (Experiment
  // Lab). Summary carries the sha256 content commitment of the results JSON;
  // DVN-anchorable so the commitment lands in tamper-evident memory.
  | 'experiment_result_published'
  // Invariant Engine ratification (CFS-035 §11) — an Invariant Decision Node was
  // flipped between shadow and authoritative (the runtime now serves its
  // projection, or reverts to the incumbent). The ratification act is
  // consequential + operator-gated, so it lands in tamper-evident memory.
  // DVN-anchorable. Summary carries a sha256 commitment of the flip act.
  | 'invariant_node_flipped'
  // Constitutional Agreement (CRP-003a N1 / CFI-002, 2026-07-17) — the
  // intent→agent→authority binding before delegated execution. agreement_formed
  // fires on acceptance (the acceptance commitment + optional external anchor
  // ride the summary); agreement_authorized fires when the requesting operator
  // authorizes delegated execution under it (the 409 gate opens). DVN is the
  // constitutional anchor of record; x409/Consenti is the acceptance-proof
  // provider. Both DVN-anchorable.
  | 'agreement_formed'
  | 'agreement_authorized'
  // QubeTalk Peer Exchange (Phase 1 Increment 3, 2026-07-21) — consequential
  // acts on a personhood-bound peer channel. shared = a sharer delivered an
  // artifact reference into a channel; opened = the recipient viewed it;
  // copied = the recipient materialised it into their own locker. All three
  // carry ONLY T2-safe references (counterparty Polity Public Reference +
  // sha256/16 channel & artifact commitments — never raw UUIDs). DVN-anchorable.
  | 'qubetalk_artifact_shared'
  | 'qubetalk_artifact_opened'
  | 'qubetalk_artifact_copied'
  // MoneyPenny Runtime (PRD-MPY-001 Phase 4, P4-4) — an authoritative run of
  // the constitutional service pattern completed on Domain 3 (Financial
  // Intelligence). Real Reach accrual happened (step 11), never a fund
  // movement (Domain 3 carries no settlement terms). DVN-anchorable so the
  // financial-services execution trail is tamper-evident.
  | 'finance_authoritative_execution'
  // Declared 2026-07-26 — these four were ALREADY being written by live
  // `createActivityReceipt` call sites while absent from this union. Adding
  // them here is not new behaviour; it makes the type describe what the code
  // already does.
  //
  // The two that were also missing from the DB CHECK constraint
  // (`canonical_plate_composed`, `plan_cancelled`) were silently losing every
  // receipt: `next.config` sets `typescript.ignoreBuildErrors`, so the type
  // error never failed a build, and both call sites wrap the write in an EMPTY
  // catch, so the check-violation was discarded with no log. Fixed by
  // supabase/migrations/20260726120000_receipt_check_drift_fix_compose_and_cancel.sql.
  //
  // None of the four is DVN-anchorable, so no chain-of-provenance gap was
  // involved — the loss was the internal audit receipt only.
  //
  // `tests/activity-receipts-action-type-parity.test.ts` now enforces BOTH
  // directions, so an actionType written at a call site but left out of this
  // union fails the build instead of failing silently at write time.
  | 'canonical_plate_composed'   // app/api/constitutional/canonical-plates/route.ts
  | 'plan_cancelled'             // services/billing/planRenewal.ts
  | 'venture_blueprint_handoff'  // services/venture/blueprintHandoff.ts
  | 'standing_accrued'           // services/crm/standingAccrualService.ts
  // An ATTRIBUTABLE correction to Capability Standing under a superseded
  // scoring formula. Distinct from `standing_accrued` on purpose: ordinary
  // accrual is monotone and can only raise; only a correction may lower, and
  // only by naming the defective formula version it corrects. One shared
  // action type would make the two indistinguishable in the receipt trail.
  | 'standing_corrected'         // services/crm/standingAccrualService.ts
  // Aigent Z's administration of an ExperimentWorkspace — the daily wakeup and
  // the weekly report (Horizen Phase 3). Anchorable.
  | 'workspace_report_published'  // services/experiments/workspaceReport.ts
  // VL-CT-001 venture substrate (charter R-6, 2026-07-29) — the nine
  // consequential events of the opportunity→liability→settlement chain. The
  // canonical accounting unit is the OPPORTUNITY, so refused and never-executed
  // opportunities receipt on exactly the same footing as executed ones:
  // `venture_refusal_recorded` records a COMPLETED constitutional service with
  // execution declined, never a failed trade. Compensation-bearing receipts
  // carry the versioned partner-service compensation extension (R-8) built by
  // services/venture/trading/compensationExtension.ts. All nine DVN-anchorable;
  // ordinary cost lines are batch-checkpointed instead of individually
  // receipted. See services/venture/trading/receipts.ts.
  | 'venture_opportunity_opened'
  | 'venture_service_completed'
  | 'venture_completion_assessed'
  | 'venture_refusal_recorded'
  | 'venture_obligation_earned'
  | 'venture_obligation_approved'
  | 'venture_settlement_simulated'
  | 'venture_obligation_reversed'
  | 'venture_opportunity_closed'
  // QriptoCENT cross-denomination settlement (2026-07-29) — the DVN-mediated
  // inter-ledger settlement substrate. Nine SETTLEMENT acts, one LIQUIDITY
  // ASSURANCE act, and two ISSUANCE acts. The three groups are constitutionally
  // separate mechanisms and carry separate action types on purpose: this
  // architecture has NO lock pool, so the receipt chain is the only evidence
  // that a destination credit was backed by a finalised source debit, and a
  // mint recorded under a settlement type would let new native supply be read
  // as a payment. See services/qriptocent/settlement/receipts.ts.
  | 'qriptocent_payment_instruction_accepted'
  | 'qriptocent_settlement_authority_verified'
  | 'qriptocent_source_debit_initiated'
  | 'qriptocent_source_debit_finalised'
  | 'qriptocent_settlement_message_verified'
  | 'qriptocent_destination_liquidity_reserved'
  | 'qriptocent_destination_credit_completed'
  | 'qriptocent_settlement_reconciled'
  | 'qriptocent_settlement_exception_recorded'
  | 'qriptocent_liquidity_proof_verified'
  | 'qriptocent_replenishment_authorised'
  | 'qriptocent_native_issuance_executed'
  // IRL-REVIEW-001 — an independent review of an experiment asset completed.
  // The receipt records the review EVENT: reviewer assignments, requested and
  // resolved model ids, package hash, raw/parsed output commitments and the
  // agreement/contested tally. It carries explicit `ratifiesAsset: false`,
  // `grantsStanding: false`, `changesLifecycle: false` and `freezesAsset: false`
  // in its payload, because a consumer that treats the presence of a review
  // receipt as approval is behaving reasonably unless the record says otherwise.
  | 'independent_review_completed'
  // Bitcent (B¢) treasury etch (2026-07-30, pilot treasury authority gate) — a
  // real Bitcoin Runes etching transaction was broadcast under an authorised
  // treasury mandate (operator passcode + Aigent Nakamoto required-signatory
  // approval + Aigent Kn0w1 observation). The receipt records the mandate
  // commitment, the transaction hash, and the ratified governed-reserve
  // tokenomics — never the operator's passcode or the custodian's key.
  // See services/treasury/bitcentTreasuryReceipts.ts.
  | 'bitcent_treasury_etch_executed'
  // PRD-GJR-001 (Guided Journey Runtime) — the Horizen x MoneyPenny constitutional
  // admission pilot. Reconciled against this union 2026-07-31: six of the PRD's
  // eighteen proposed types already existed here under different names and are
  // reused directly (agent_delegated, partner_agent_evidence_recorded,
  // finance_authoritative_execution, standing_accrued, agreement_authorized) —
  // see the PRD's §22 for the full mapping. These nine are genuinely new; each
  // corresponds one-to-one with a step in the journey's ten-step canonical
  // sequence (§3.5) and its seven-stage bar (§7). See services/journey/.
  | 'agent_card_discovered'
  | 'horizen_agent_registered'
  | 'horizen_pnl_transparency_enabled'
  | 'agent_card_enriched'
  | 'agent_control_proven'
  | 'marketa_eligibility_recommended'
  | 'operator_passport_validated'
  | 'agent_sponsorship_recorded'
  | 'agent_delegate_passport_issued'
  // aigentMe's activation as the principal's constitutional companion, and the
  // principal's recorded disposition on the onboarding agent's domain focus for
  // their ExperienceQube population (§5.10 — the onboarding agent never silently
  // decides this for the principal).
  | 'aigentme_activated'
  | 'experienceqube_focus_disposition_recorded'
  | 'journey_completed'
  // GJR-VFY-001 (Horizen Transparency Authorization and Wallet-Signing
  // Capability), Phase 1, 2026-07-31 — the confirmed Pulse-monitoring
  // authorization event: locally signed, Horizen accepted, reread confirms
  // enabled. horizen_pnl_transparency_enabled and agent_card_enriched already
  // existed (added by the PRD-GJR-001 migration); this is the third and last
  // canonical GJR-VFY-001 receipt type. See services/horizen/authorizationClient.ts.
  | 'horizen_pulse_authorized'
  // GJR-MKT-001 (Marketa External-Agent Constitutional Eligibility Engine),
  // Phase 4, 2026-07-31 — the three canonical receipt types not already
  // present (marketa_eligibility_recommended already existed). `assessed`
  // fires for every assessment; `refused`/`quarantined` fire additionally
  // when the decision is REFUSED/QUARANTINED. Never issue `recommended` for
  // a DRAFT assessment. See services/marketa/admissionAssessmentEngine.ts.
  | 'marketa_eligibility_assessed'
  | 'marketa_eligibility_refused'
  | 'marketa_eligibility_quarantined'
  // Wallet Signing Topology (operator ruling 2026-08-01), Register vertical
  // slice — five INDEPENDENT evidence types, one per ceremony step, so
  // Register can only reach COMPLETE once every step of the wallet-mediated
  // ceremony (principal mandate → agent-wallet approval → broadcast →
  // Horizen reread → binding recorded) has actually happened — never
  // collapsed into the single horizen_agent_registered receipt, which
  // remains as the pre-ceremony completion evidence for backward
  // compatibility. See services/horizen/registerCeremony.ts.
  | 'principal_registration_mandate_signed'
  | 'agent_registry_transaction_signed'
  | 'horizen_registration_submitted'
  | 'horizen_registration_confirmed'
  | 'agent_registry_binding_recorded'
  // Trust dimensions (operator ruling, 2026-08-03): transparency willingness
  // (Pulse/P&L authorization) and evidence-backed accuracy/reliability are
  // distinct signals from the formal capability/trust-band score — each
  // increment to metadata.trust_dimensions is receipted here, carrying the
  // signal type, evidence ref, previous/new score and rationale on
  // actionInput, never folded silently into the score alone. See
  // services/registry/trustDimensions.ts.
  | 'trust_dimension_incremented'
  // Population Reconciliation Board (al, 2026-08-04, Track 2 Stage 5): the
  // two treatments an operator applies to a promoted candidate the
  // Stage 4 → Stage 5 handover could not account for. One receipt per
  // resolved record — never a single batch receipt — so a partial batch
  // failure discloses exactly which records were treated and which were
  // not. See services/research/populationReconciliation.ts and
  // services/invariants/discoveryEngine.ts's repairPromotedCandidateInvariantLink /
  // excludeCandidateFromCrystal.
  | 'population_record_repaired'
  | 'population_record_excluded'
  // Governed capability invocation (Phase 4, 2026-08-06 — see
  // services/registry/invocationGateway.ts::invokeCapability and
  // codexes/packs/agentiq/updates/2026-08-06_governed-capability-invocation-design.md
  // §8/§9). authorized/refused/completed are DVN-anchorable — each is a
  // constitutional decision (or its execution outcome) worth a tamper-evident
  // record; requested stays local (pre-decision, high volume by design).
  | 'capability_invocation_requested'
  | 'capability_invocation_authorized'
  | 'capability_invocation_refused'
  | 'capability_invocation_completed'
  // Receipted constitutional state (operator directive, 2026-08-08 —
  // "Replace external-state-as-runtime-authority with receipted
  // constitutional state"). `pulse_enrollment_verified`/
  // `pulse_commitment_verified` are Pulse-specific EVENT TYPES, first proven
  // out for the Horizen admission journey — each carries the evidence that
  // justified it (network, agent/token reference, verified source values,
  // source-response commitment, verification timestamp, verifier/policy
  // version) — see services/horizen/authorizationClient.ts's
  // writeConfirmedPulseActivation. `reconciliation_discrepancy_recorded` is
  // deliberately PROTOCOL-LEVEL, not partner-prefixed (corrected same day,
  // operator: "I would not let the underlying reconciliation architecture
  // become Horizen-specific") — written by reconcilePulseConstitutionalState
  // when a LATER external read disagrees with already-receipted evidence;
  // it is itself a new event, never a rewrite of the transition it compares
  // against, and the same type will serve any future partner's
  // reconciliation writes.
  | 'pulse_enrollment_verified'
  | 'pulse_commitment_verified'
  | 'reconciliation_discrepancy_recorded'
  // P&L is an independent, asynchronous capability transition, deliberately
  // kept as its own state machine from Pulse admission (operator directive,
  // 2026-08-08: "Absence of optional downstream evidence must not invalidate
  // already-proven upstream constitutional state"). pnl_service_verified is
  // issued ONLY when a read-only Horizen correlation independently produces
  // and attributes a genuine Verifiable-PnL record for the exact agent/
  // token/chain — see services/horizen/pnlServiceVerification.ts. Additive
  // alongside horizen_pnl_transparency_enabled (a materially WEAKER claim:
  // disclosure scope was authorized, issued unconditionally alongside Pulse
  // confirmation) and partner_agent_evidence_recorded (a DIFFERENT
  // constitutional question: identity-binding attribution) — never replaces
  // either.
  | 'pnl_service_verified'
  // Threshold Journey — Orient stage (operator spec, 2026-08-09). The
  // operator's explicit acknowledgment of the contextually-resolved
  // orientation ritual (which of the two ritual kinds applies is resolved
  // from state, never from agent name) — never issued merely for viewing
  // the stage. See services/journey/orientationContext.ts.
  | 'orientation_ritual_completed'
  // Horizen Pilot Closure, part C (2026-08-09) — the THIRD, genuinely new
  // P&L fact, distinct from both existing types above:
  //   horizen_pnl_transparency_enabled — the OPERATOR's disclosure/scope
  //     permission grant. Never implies Horizen registered anything.
  //   pnl_service_registered (this type) — HORIZEN's own Verifiable-PnL
  //     onboarding (`POST /v1/register`) has SUCCEEDED for this agent —
  //     an `agentId` (Horizen's internal PnL UUID) now exists. Says nothing
  //     about whether any proof evidence exists yet.
  //   pnl_service_verified — independently REDISCOVERED, correlated proof
  //     evidence (unchanged; issued only by the read-only
  //     discoverAndReceiptPnlServiceEvidence, never by the registration
  //     mutation itself — registering is not self-certifying).
  // See services/horizen/pnlOnboardingClient.ts.
  | 'pnl_service_registered'
  // Constitutional State Model Correction (operator-ratified, 2026-08-11):
  // the agent became an accountable, active participant in the iQube
  // Registry. Derived from, and ONLY from, iQubeRegistryPresent ∧
  // sponsorBindingEstablished ∧ agentPassportIssued — never from Delegate,
  // Operate, or `capability_registered` (Factory/Ingest evidence, which
  // stays technical and is never conflated with this constitutional fact).
  // Awards no Standing. Issued exactly once per agent via the settled-fact
  // idempotency in `services/journey/agentRegistryActivation.ts`'s
  // `ensureAgentRegistryActivation`. `actionInput.provenance` distinguishes
  // a fresh establishment from a legacy agent whose predicates were already
  // true before this mechanism existed ('freshly-established' |
  // 'legacy-reconciled').
  | 'agent_registry_activated'
  // VELA-001 — Constitutional Commerce Authorisation/Execution/Consequence
  // planes (operator-directed, 2026-08-22, downstream of Slice 2F's Gate 2
  // work). Distinct from capability_invocation_* (the GOVERNANCE-layer
  // dispatch permission) — these are the FINANCIAL-DOMAIN outcomes
  // deriveActionAuthorisation()/bindExecution()/recordObservedConsequence()
  // produce, one level downstream, per services/constitutionalCommerce/. All
  // five DVN-anchorable: an AUTHORISED/REFUSED/UNRESOLVED authorisation, a
  // bound-or-refused execution, and a recorded observed consequence are each
  // a constitutional decision or its outcome, never routine/high-volume.
  // `commerce_action_unresolved` exists as its own type (not folded into
  // `commerce_action_refused`) because PRD §31's fail-closed requirement
  // ("UNRESOLVED projection produces an UNRESOLVED outcome") must stay
  // auditably distinguishable from a REFUSED action that was actually
  // established as unacceptable — the same UNACCEPTABLE-vs-UNRESOLVED
  // discipline carried down from ConsequenceProjection/ActionAuthorisation.
  // See services/constitutionalCommerce/boundedExecution.ts,
  // services/constitutionalCommerce/observedConsequence.ts,
  // services/constitutionalCommerce/causalChain.ts.
  | 'commerce_action_authorised'
  | 'commerce_action_refused'
  | 'commerce_action_unresolved'
  | 'commerce_execution_bound'
  | 'commerce_execution_refused'
  | 'commerce_consequence_recorded'
  // Chrysalis Homecoming (CFS-023) mechanical stand-up (operator-directed,
  // 2026-08-15 Aletheon Homecoming Stage 1 preflight): a Homecoming delegate's
  // agent_root_identity and/or agent_persona was newly created this call via
  // POST /api/homecoming/agent/stand-up (services/homecoming/agentHomecoming.ts
  // ::standUpDelegate). Records the completed L0→L2 mechanical transition; it
  // is emitted best-effort AFTER the state writes succeed and never gates
  // them. Fired only when at least one of the two rows was freshly created in
  // this call — an idempotent re-run where both already existed emits no
  // second event. Carries agent-scoped identifiers only (agent_root_id,
  // agent_id, agent_card_slug, agent_class) — no sponsor persona/passport id.
  | 'agent_delegate_stood_up'
  // Chrysalis Homecoming (CFS-023) constitutional anchoring repair
  // (operator-directed, 2026-08-15) — a legacy polity-bound delegate whose
  // mechanical stand-up completed but whose sponsor never resolved through
  // provisionAgentPersona.ts's root_did string match (see that file's own
  // "flag it for later backfill" comment) had its
  // delegation_user_root_id/delegation_persona_id filled via
  // services/agents/repairDelegationAnchor.ts. Forward-looking only — this
  // describes the REPAIR act, dated to when it happened, never a fabricated
  // historical genesis receipt for the original stand-up.
  | 'agent_delegation_anchor_repaired'
  // Legacy Passport/personhood linkage reconciliation (operator-directed,
  // 2026-08-15) — a Citizen or Participant Passport issued before its
  // kybe_identity_id/root_identity_id anchors were written (the same
  // issuance gap loadUsablePassportByKybe's own header documents) had those
  // two columns filled via services/passport/legacyPassportLinkageRepair.ts,
  // resolved through the persona-cluster walk in
  // resolveClusterPrincipalForPersona — never a status transition, never a
  // new Passport, never §A.5 consolidation/reissuance. Forward-looking only:
  // describes the RECONCILIATION act, dated to when it happened. Carries the
  // public passport_id and two booleans only — no root/kybe/persona ids.
  | 'legacy_passport_linkage_reconciled'
  // DevOn Phase F bounded-execution repair (operator-directed, 2026-08-16) —
  // the observation ledger for one implementation-actor dispatch: which
  // provider/model actually ran, turns, wall-clock, tokens, observed cost,
  // permission-denial count, and the resulting execution state
  // (proceeding/awaiting-escalation/complete). Never the live governor
  // (`evaluateBudget` in services/constitutional/executionBudget.ts is) —
  // this is durable observation only, extracted from the actor's own
  // terminal result JSON via services/constitutional/executionTelemetry.ts.
  | 'implementation_execution_observed'
  // Homecoming Phase II WP-B (operator-directed, 2026-08-16) — the manual/
  // external-actor counterpart to `implementation_execution_observed` above:
  // a human-reviewed, qualitative account of what an implementation actor
  // executed (branch, commits, PR, files changed, validation results,
  // deviations, discoveries) submitted via the Execution Return ingestion
  // route (services/constitutional/executionReturn.ts) and verified against
  // an existing `implementation_pack_generated` receipt's `pack_id` before
  // acceptance. Never authorizes deployment by itself — no
  // `deployment_authorized` receipt is ever written by this path; it is
  // evidence a stage-transition gate later reads, not an authority grant.
  | 'implementation_execution_returned'
  // Reciprocal Artifact Exchange (PRD-IRL-AX-001, 2026-08-23) — the generic
  // bilateral, receipted exchange of independently frozen research artifacts.
  // See services/research/reciprocalExchange.ts. `exchange_crossed` is the
  // DVN-anchorable bilateral Exchange Receipt event (ANCHORABLE_ACTION_TYPES);
  // the rest are local provenance of the surrounding ritual.
  | 'exchange_created'
  | 'exchange_counterparty_joined'
  | 'exchange_artifact_deposited'
  | 'exchange_artifact_replaced'
  | 'exchange_freeze_declared'
  | 'exchange_instrument_signed'
  | 'exchange_crossed'
  | 'exchange_receipt_acknowledged'
  | 'exchange_comparison_opened'
  | 'exchange_derivative_created'
  | 'exchange_withdrawn'
  | 'exchange_access_revoked'
  // QubeTalk Communications Membrane (2026-08-25) — the consequential acts
  // named in domain spec §17's candidate list beyond what Phase 1's three
  // qubetalk_artifact_* types already cover, using the spec's own literal
  // names verbatim (message_agent_sent, not agent_message_sent — corrected
  // 2026-08-25 against the canonical doc after an initial reconstruction
  // drifted from it). publication_published/withdrawn = a PublicationQube
  // projection changes public-facing state (withdrawn is a justified
  // addition beyond §17's own candidate list — §14's publication lifecycle
  // has an explicit 'withdrawn' state, so a receipt for it is warranted);
  // message_agent_sent/group_message_agent_sent = an Agent sent a
  // communication under a bounded delegation grant (never fires for a
  // human-authored message); conversation_context_disclosure = the
  // disclosure-policy gate (services/qubetalk/disclosurePolicy.ts) let
  // protected context reach a wider audience than it originated in, an
  // explicit act, never implicit; publication_projection_failed/
  // agent_approval_used/endpoint_linked/group_federated are §17's remaining
  // named candidates, registered even though no current code path emits them
  // yet (a CHECK-constraint value existing ahead of use matches this
  // migration's own established convention). All carry ONLY T2-safe
  // references, same discipline as the existing qubetalk_artifact_* types.
  // DVN-anchorable.
  | 'qubetalk_publication_published'
  | 'qubetalk_publication_withdrawn'
  | 'qubetalk_publication_projection_failed'
  | 'qubetalk_publication_projection_published'
  // Locker / RoomQube / Share Pack (2026-08-25 Phase 1, spec §18). New
  // literals only — the DVN submission mechanism, state machine, and
  // canister interaction in services/dvn/activityReceiptDvnPipeline.ts are
  // untouched, per CLAUDE.md's DVN Pipeline Protection "one permitted
  // unilateral change" rule.
  | 'locker_asset_registered'
  | 'locker_asset_version_created'
  | 'locker_roomqube_created'
  | 'locker_roomqube_member_invited'
  | 'locker_roomqube_asset_added'
  | 'locker_roomqube_conversation_opened'
  | 'locker_share_pack_composed'
  | 'locker_share_pack_approved'
  | 'locker_share_pack_sent'
  | 'qubetalk_message_agent_sent'
  | 'qubetalk_group_message_agent_sent'
  | 'qubetalk_agent_approval_used'
  | 'qubetalk_endpoint_linked'
  | 'qubetalk_group_federated'
  | 'qubetalk_conversation_context_disclosure';

export type ReceiptStatus = 'local' | 'dvn_pending' | 'dvn_recorded' | 'dvn_failed';

export interface SpecialistResponsePayload {
  title: string;
  summary: string;
  recommendations: string[];
  suggestedArtifacts: string[];
  confidence: 'low' | 'medium' | 'high';
  source: 'llm' | 'template';
}

export interface ActivityReceiptRecord {
  id: string;
  sessionId: string | null;
  intentId: string | null;
  /**
   * When the receipt's intent is a child spawned from another intent's
   * recommendation, this is the direct parent's intentId. Set by the
   * receipts API after enrichment; null for receipts on root intents.
   */
  parentIntentId?: string | null;
  /**
   * The root ancestor's intentId — the origin intent at the top of the
   * generation chain (grandparent of grandchildren, parent of children,
   * self for roots). Used by myLedger to fold all generations into one
   * capsule. Set by the receipts API enrichment; null for root receipts.
   */
  rootIntentId?: string | null;
  activeCartridge: string;
  actionType: ActivityActionType;
  summary: string;
  agentsInvoked: string[];
  toolsUsed: string[];
  iqubesUsed: string[];
  /**
   * Invariant ids this receipted act was grounded in (CFS-008 §2 reuse-count
   * instrumentation, Chrysalis Phase 5). Empty for ungrounded acts.
   */
  invariantsUsed: string[];
  contextShared: string[];
  artifactsCreated: string[];
  approvalsGranted: string[];
  policyEnvelopeId: string | null;
  receiptStatus: ReceiptStatus;
  dvnReceiptId: string | null;
  /**
   * Shared-commitment dual-leg anchoring state (2026-08-08 migration). Null
   * on every row predating that migration and on any row whose leg has never
   * been attempted — never fabricated, never backfilled. `posStatus` is the
   * proof_of_state/Bitcoin leg ONLY (pending|batched|broadcast|anchored|failed);
   * it is independent of `receiptStatus`/`dvnReceiptId`, which describe the
   * DVN leg. A receipt can be fully DVN-recorded while its Bitcoin leg is
   * dark (POS_LEG_SUBMISSION_ENABLED=false) — that is the expected, current
   * state platform-wide, not a defect to hide.
   */
  commitmentHash: string | null;
  posStatus: 'pending' | 'batched' | 'broadcast' | 'anchored' | 'failed' | null;
  dvnStatus: 'submitted' | 'ready' | 'failed' | null;
  btcAnchorTxid: string | null;
  btcBatchRoot: string | null;
  /**
   * SpecialistResponse body persisted on the receipt — title, summary,
   * recommendations, suggestedArtifacts, confidence, source. Present on
   * specialist_consulted receipts; null elsewhere.
   */
  specialistResponse: SpecialistResponsePayload | null;
  /** Connector to call when the operator clicks Send on this artifact. */
  actionConnectorId: string | null;
  actionConnectorLabel: string | null;
  actionInput: Record<string, unknown> | null;
  createdAt: string;
}

interface DbRow {
  id: string;
  persona_id: string;
  session_id: string | null;
  intent_id: string | null;
  active_cartridge: string;
  action_type: ActivityActionType;
  summary: string;
  agents_invoked: string[];
  tools_used: string[];
  iqubes_used: string[];
  invariants_used: string[];
  context_shared: string[];
  artifacts_created: string[];
  approvals_granted: string[];
  policy_envelope_id: string | null;
  receipt_status: ReceiptStatus;
  dvn_receipt_id: string | null;
  commitment_hash: string | null;
  pos_status: 'pending' | 'batched' | 'broadcast' | 'anchored' | 'failed' | null;
  dvn_status: 'submitted' | 'ready' | 'failed' | null;
  btc_anchor_txid: string | null;
  btc_batch_root: string | null;
  specialist_response: SpecialistResponsePayload | null;
  action_connector_id: string | null;
  action_connector_label: string | null;
  action_input: Record<string, unknown> | null;
  created_at: string;
}

function rowToRecord(row: Partial<DbRow> & { id: string; created_at: string }): ActivityReceiptRecord {
  return {
    id: row.id,
    sessionId: row.session_id ?? null,
    intentId: row.intent_id ?? null,
    activeCartridge: row.active_cartridge ?? 'metame',
    actionType: row.action_type as ActivityActionType,
    summary: row.summary ?? '',
    agentsInvoked: row.agents_invoked ?? [],
    toolsUsed: row.tools_used ?? [],
    iqubesUsed: row.iqubes_used ?? [],
    invariantsUsed: row.invariants_used ?? [],
    contextShared: row.context_shared ?? [],
    artifactsCreated: row.artifacts_created ?? [],
    approvalsGranted: row.approvals_granted ?? [],
    policyEnvelopeId: row.policy_envelope_id ?? null,
    receiptStatus: (row.receipt_status as ReceiptStatus) ?? 'local',
    dvnReceiptId: row.dvn_receipt_id ?? null,
    commitmentHash: row.commitment_hash ?? null,
    posStatus: row.pos_status ?? null,
    dvnStatus: row.dvn_status ?? null,
    btcAnchorTxid: row.btc_anchor_txid ?? null,
    btcBatchRoot: row.btc_batch_root ?? null,
    specialistResponse: row.specialist_response ?? null,
    actionConnectorId: row.action_connector_id ?? null,
    actionConnectorLabel: row.action_connector_label ?? null,
    actionInput: row.action_input ?? null,
    createdAt: row.created_at,
  };
}

function getAdminClient() {
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase configuration missing for ActivityReceiptService');
  return client;
}

// ─────────────────────────────────────────────────────────────────────────
// Create.
// ─────────────────────────────────────────────────────────────────────────

export interface CreateActivityReceiptInput {
  personaId: string;
  sessionId?: string | null;
  intentId?: string | null;
  activeCartridge?: string;
  actionType: ActivityActionType;
  summary: string;
  agentsInvoked?: string[];
  toolsUsed?: string[];
  iqubesUsed?: string[];
  /** CFS-008 §2 — invariant ids this act was grounded in (reuse-count instrumentation). */
  invariantsUsed?: string[];
  contextShared?: string[];
  artifactsCreated?: string[];
  approvalsGranted?: string[];
  policyEnvelopeId?: string | null;
  specialistResponse?: SpecialistResponsePayload | null;
  actionConnectorId?: string | null;
  actionConnectorLabel?: string | null;
  actionInput?: Record<string, unknown> | null;
}

const TABLE_MISSING_CODES = new Set(['42P01', 'PGRST205']);
const COLUMN_MISSING_CODES = new Set(['42703', 'PGRST204']);

function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code && TABLE_MISSING_CODES.has(err.code)) return true;
  return typeof err.message === 'string' && /relation .* does not exist/i.test(err.message);
}

function isMissingColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code && COLUMN_MISSING_CODES.has(err.code)) return true;
  return typeof err.message === 'string' && /column .* does not exist|could not find the .* column/i.test(err.message);
}

export async function createActivityReceipt(
  input: CreateActivityReceiptInput,
): Promise<ActivityReceiptRecord | null> {
  if (!input.personaId) throw new Error('createActivityReceipt: personaId required');
  if (!input.actionType) throw new Error('createActivityReceipt: actionType required');
  if (!input.summary) throw new Error('createActivityReceipt: summary required');

  const admin = getAdminClient();
  // Base row — present on every install since the original migration.
  const baseRow = {
    persona_id: input.personaId,
    session_id: input.sessionId ?? null,
    intent_id: input.intentId ?? null,
    active_cartridge: input.activeCartridge ?? 'metame',
    action_type: input.actionType,
    summary: input.summary.slice(0, 1000),
    agents_invoked: input.agentsInvoked ?? [],
    tools_used: input.toolsUsed ?? [],
    iqubes_used: input.iqubesUsed ?? [],
    context_shared: input.contextShared ?? [],
    artifacts_created: input.artifactsCreated ?? [],
    approvals_granted: input.approvalsGranted ?? [],
    policy_envelope_id: input.policyEnvelopeId ?? null,
    receipt_status: 'local' as ReceiptStatus,
  };
  // Optional columns — only included when caller passed a value AND only
  // attempted on first try. If the schema migration hasn't been applied
  // yet, the insert is retried with just the base row so receipt writes
  // never go down system-wide due to a pending migration.
  const optionalRow: Record<string, unknown> = {};
  if (input.specialistResponse !== undefined) optionalRow.specialist_response = input.specialistResponse;
  if (input.actionConnectorId !== undefined) optionalRow.action_connector_id = input.actionConnectorId;
  if (input.actionConnectorLabel !== undefined) optionalRow.action_connector_label = input.actionConnectorLabel;
  if (input.actionInput !== undefined) optionalRow.action_input = input.actionInput;
  if (input.invariantsUsed !== undefined && input.invariantsUsed.length > 0) {
    optionalRow.invariants_used = input.invariantsUsed;
  }

  async function insertWith(row: Record<string, unknown>) {
    return admin.from('activity_receipts').insert(row).select('*').single();
  }

  let { data, error } = await insertWith({ ...baseRow, ...optionalRow });

  if (error && isMissingColumn(error) && Object.keys(optionalRow).length > 0) {
    console.warn(
      '[ActivityReceipts] optional column missing — retrying without it. ' +
        'Apply supabase/migrations/20260606120000_activity_receipts_connector_fields.sql (dispatch persistence) ' +
        'and/or 20260704100000_activity_receipts_invariants_used.sql (CFS-008 measurement).',
    );
    ({ data, error } = await insertWith(baseRow));
  }

  if (error) {
    if (isMissingTable(error)) {
      console.warn(
        '[ActivityReceipts] activity_receipts table missing — receipt dropped. ' +
          'Apply supabase/migrations/20260514000000_activity_receipts.sql.',
      );
      return null;
    }
    throw new Error(`createActivityReceipt failed: ${error.message}`);
  }
  if (!data) return null;
  const record = rowToRecord(data as DbRow);

  // Phase 6.b Part 4 — fire-and-forget DVN anchoring for high-value
  // action types. The enqueue itself returns synchronously and runs the
  // canister submission on a background promise; the receipt row is
  // updated to dvn_pending (or dvn_failed) by that background task. When
  // CROSS_CHAIN_SERVICE_CANISTER_ID is unset (dev / alpha) the enqueue
  // is a no-op and the receipt stays 'local'. Wrapped in try/catch so a
  // missing import or dynamic load failure never breaks the create path.
  try {
    // Dynamic import avoids a require-cycle between activityReceiptService
    // and the DVN pipeline (which imports the record type from here).
    void import('@/services/dvn/activityReceiptDvnPipeline')
      .then(({ enqueueActivityReceiptAnchor }) =>
        enqueueActivityReceiptAnchor(record, input.personaId),
      )
      .catch(() => undefined);
  } catch {
    // Ignore — receipt is already persisted; anchoring is best-effort.
  }
  return record;
}

// ─────────────────────────────────────────────────────────────────────────
// Read.
// ─────────────────────────────────────────────────────────────────────────

export interface ListReceiptsOptions {
  limit?: number;
  cartridge?: string;
  actionTypes?: ActivityActionType[];
  /**
   * Narrow to receipts naming this AGENT as a subject (overlap match against
   * `agents_invoked`), on top of the persona scope — the same `.contains()`
   * shape `findAgentReceiptRefs`/`findAgentRegistrationReceipts` already use.
   *
   * Added 2026-08-03: a persona-only, `limit`-bounded read of a shared action
   * type (e.g. `agent_control_proven`) can silently miss one agent's receipt
   * when another agent under the same persona has more recent ones of the
   * same type. Passing this closes that window without a second reader.
   */
  agentsInvoked?: string[];
  /**
   * Narrow to this EXACT set of receipt ids (CFS-055 coherence pass,
   * 2026-08-10 — inv.engineering.258 "Receipts Prove; State Resolves").
   * Lets a caller hydrate the specific receipts a canonical POSIT projection
   * already named (`resolution.stages[stageId].receiptRefs`, a sub-predicate
   * projection's own `receiptRefs`) — never a fresh type/agent search that
   * would re-decide whether evidence exists a second way. Still persona-
   * scoped like every other option here: an id the caller does not own
   * simply matches nothing.
   */
  ids?: string[];
}

export async function listActivityReceiptsForPersona(
  personaId: string,
  options?: ListReceiptsOptions,
): Promise<ActivityReceiptRecord[]> {
  if (!personaId) return [];
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);

  const admin = getAdminClient();
  let q = admin
    .from('activity_receipts')
    .select('*')
    .eq('persona_id', personaId);

  if (options?.cartridge) q = q.eq('active_cartridge', options.cartridge);
  if (options?.actionTypes && options.actionTypes.length > 0) {
    q = q.in('action_type', options.actionTypes);
  }
  if (options?.agentsInvoked && options.agentsInvoked.length > 0) {
    q = q.contains('agents_invoked', options.agentsInvoked);
  }
  if (options?.ids && options.ids.length > 0) {
    q = q.in('id', options.ids);
  }

  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`listActivityReceiptsForPersona failed: ${error.message}`);
  }
  if (!data) return [];
  return (data as DbRow[]).map(rowToRecord);
}

/**
 * List receipts naming this AGENT as a subject (`agents_invoked` containment)
 * — no `persona_id` scope at all, unlike `listActivityReceiptsForPersona`.
 *
 * Why a separate function rather than `listActivityReceiptsForPersona` with
 * `agentsInvoked`: that function ALWAYS scopes by `persona_id` first, and an
 * agent's receipted contribution history is not reliably confined to one
 * persona_id — some receipts are written under the agent's own canonical
 * identity persona (e.g. `standing_accrued`), others under whichever HUMAN
 * operator persona performed the act while naming the agent as subject (e.g.
 * `horizen_agent_registered`). This mirrors `findAgentReceiptRefs`'s exact
 * query shape (agents_invoked containment, no persona filter) but returns
 * full `ActivityReceiptRecord`s for display, not the lightweight evidence
 * projection shape.
 */
export async function listActivityReceiptsForAgent(
  runtimeAgentId: string,
  options?: { limit?: number; actionTypes?: ActivityActionType[] },
): Promise<ActivityReceiptRecord[]> {
  if (!runtimeAgentId) return [];
  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);

  const admin = getAdminClient();
  let q = admin.from('activity_receipts').select('*').contains('agents_invoked', [runtimeAgentId]);
  if (options?.actionTypes && options.actionTypes.length > 0) {
    q = q.in('action_type', options.actionTypes);
  }

  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`listActivityReceiptsForAgent failed: ${error.message}`);
  }
  if (!data) return [];
  return (data as DbRow[]).map(rowToRecord);
}

/**
 * A registration receipt's own narrow facts, found by AGENT rather than by
 * persona (Aigent Nakamoto's live registration, 2026-08-03).
 *
 * ── The bug this exists to close ───────────────────────────────────────────
 *
 * A `horizen_agent_registered` receipt is written with `personaId:
 * actorPersonaId` — the OPERATOR who acted (ArkAgent), NOT the agent being
 * registered. Anything trying to find "Nakamoto's registration receipt" by
 * looking up Nakamoto's own persona therefore searches a persona that never
 * holds it, finds nothing, and concludes she is unregistered. The receipt was
 * right there the whole time under a different persona_id.
 *
 * Finding it needs a query keyed on `agents_invoked`, which is the only field
 * that names the SUBJECT of the registration. That crosses persona scope, so
 * this deliberately returns ONLY the registration facts — never the receipt
 * body, which stays persona-scoped (same boundary `readReceiptAnchorStatus`
 * observes: answer the narrow question asked, hand back nothing else).
 *
 * `tokenId` is `null` for receipts written before the structured
 * `actionInput.registration` block existed. That is honest, not a failure —
 * the caller recovers it from the chain via `txHash`, which is the one fact
 * every such receipt does carry.
 */
export interface AgentRegistrationReceiptFacts {
  receiptId: string;
  txHash: string;
  network: string | null;
  /** From the structured `registration` block; null on pre-enrichment receipts. */
  tokenId: string | null;
  registryAddress: string | null;
  ownerAddress: string | null;
  createdAt: string;
}

/**
 * Which of `actionTypes` this AGENT has receipts for, and their ids — the
 * subject-keyed counterpart to `listActivityReceiptsForPersona`.
 *
 * Same reason as `findAgentRegistrationReceipts` below: a journey receipt is
 * written against the acting OPERATOR's persona, so asking "what has this
 * agent done?" by resolving the agent's own persona finds nothing. Returns
 * ONLY `{id, actionType}` — enough to answer existence and to reference the
 * receipt, never the persona-scoped body.
 *
 * ── Per-action-type coverage, not one global scan (2026-08-09) ─────────────
 *
 * This used to be ONE query — `action_type IN (...) AND agents_invoked
 * CONTAINS agent`, ordered by `created_at DESC`, `LIMIT options.limit` —
 * applied across the WHOLE filtered set at once. That limit is a ceiling on
 * TOTAL rows across every requested action type combined, so a caller asking
 * for 20 action types with a limit of 100 could see a single action type's
 * one relevant (and possibly `dvn_recorded`) receipt silently pushed out of
 * the returned set by >100 more RECENT receipts of the OTHER 19 types for the
 * same agent — a real, observed failure mode: an old `standing_accrued:
 * dvn_recorded` receipt crowded out by newer unrelated receipts, so the
 * consequence fork read `bestReceiptStatus([])` (nothing found) instead of
 * the true strongest status, and a constitutional fact disappeared because
 * unrelated receipt volume grew, not because anything about that fact
 * changed.
 *
 * Fixed by resolving each action type INDEPENDENTLY, each with its own
 * bounded slice — so the return set is guaranteed to include every
 * requested action type's own most-recent rows regardless of how many
 * receipts of OTHER types exist for this agent. `options.limit` now means
 * "how many of THIS type's own rows", not "how many rows total".
 */
export interface AgentReceiptRef {
  id: string;
  actionType: ActivityActionType;
  receiptStatus: ReceiptStatus;
  /**
   * Added 2026-08-09 (Horizen Pilot Closure — Standing tier classification +
   * sequencing hardening) — the receipt's OWN structured evidence, read here
   * rather than via a second, parallel query. This is what lets a caller
   * classify a `standing_accrued` receipt as `tier: 'initial'` vs a genuine
   * contribution accrual (services/journey/registrationStandingSeed.ts's own
   * `basis`/`tier` fields), or recover a `reconciliation_discrepancy_recorded`
   * receipt's superseded receipt ids — without inventing a raw query per
   * caller. Never inferred from timing, amount or summary text; null when
   * the receipt carries no structured action_input at all.
   */
  actionInput: Record<string, unknown> | null;
  createdAt: string;
  /**
   * Added 2026-08-09 (Horizen Pilot Closure — Part B1, DVN liveness). The
   * DVN message id this receipt was submitted under (`activity_receipts.
   * dvn_receipt_id`) — what a caller needs to classify the receipt's DVN
   * message via `get_dvn_message`/`get_message_attestations` without a
   * second, parallel query. Null for a receipt never submitted (still
   * `local`) or predating DVN submission.
   */
  dvnReceiptId: string | null;
}

export async function findAgentReceiptRefs(
  runtimeAgentId: string,
  actionTypes: readonly ActivityActionType[],
  options?: { limit?: number },
): Promise<AgentReceiptRef[]> {
  if (!runtimeAgentId || actionTypes.length === 0) return [];
  const perTypeLimit = Math.min(Math.max(options?.limit ?? 20, 1), 100);

  const admin = getAdminClient();
  const results = await Promise.all(
    actionTypes.map(async (actionType) => {
      const { data, error } = await admin
        .from('activity_receipts')
        // `receipt_status` added 2026-08-09 (Horizen Journey Consequence Fork
        // projection) — an EXISTING column on this table, never a new source
        // of truth. Lets a caller distinguish "evidence present" from "DVN
        // final" (services/journey/consequenceForkProjection.ts) without a
        // second read. `action_input`/`created_at` added the same day for
        // the Standing tier/sequencing fix described above.
        .select('id, action_type, receipt_status, action_input, created_at, dvn_receipt_id')
        .eq('action_type', actionType)
        .contains('agents_invoked', [runtimeAgentId])
        .order('created_at', { ascending: false })
        .limit(perTypeLimit);

      if (error) {
        if (isMissingTable(error)) return [];
        throw new Error(`findAgentReceiptRefs failed for action_type "${actionType}": ${error.message}`);
      }
      return (data ?? []) as {
        id: string;
        action_type: ActivityActionType;
        receipt_status: ReceiptStatus | null;
        action_input: Record<string, unknown> | null;
        created_at: string;
        dvn_receipt_id: string | null;
      }[];
    }),
  );

  return results.flat().map((r) => ({
    id: r.id,
    actionType: r.action_type,
    receiptStatus: r.receipt_status ?? 'local',
    actionInput: r.action_input ?? null,
    createdAt: r.created_at,
    dvnReceiptId: r.dvn_receipt_id ?? null,
  }));
}

/**
 * Every receipt of ONE action type, across ALL personas — the infra/ops-scoped
 * counterpart to `listActivityReceiptsForPersona` (which requires a persona
 * and therefore cannot answer "which registrations are still pending,
 * regardless of who submitted them"). Same shape of need as
 * `finalizeReadyActivityReceipts` (services/dvn/activityReceiptDvnPipeline.ts),
 * which queries `activity_receipts` directly for the same reason: a scheduled
 * reconciler has no persona to scope to. Lives here, not as a second raw
 * query, so this stays the one place that reads `activity_receipts` by shape
 * (inv.engineering.036/037).
 */
export interface ReceiptByActionType {
  id: string;
  personaId: string;
  agentsInvoked: string[];
  actionInput: Record<string, unknown> | null;
  createdAt: string;
}

export async function findReceiptsByActionType(
  actionType: ActivityActionType,
  options?: { limit?: number },
): Promise<ReceiptByActionType[]> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('activity_receipts')
    .select('id, persona_id, agents_invoked, action_input, created_at')
    .eq('action_type', actionType)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`findReceiptsByActionType failed: ${error.message}`);
  }
  if (!data) return [];
  return (data as Array<{ id: string; persona_id: string; agents_invoked: string[] | null; action_input: Record<string, unknown> | null; created_at: string }>).map((r) => ({
    id: r.id,
    personaId: r.persona_id,
    agentsInvoked: r.agents_invoked ?? [],
    actionInput: r.action_input,
    createdAt: r.created_at,
  }));
}

/**
 * A full `ActivityReceiptRecord` still `receipt_status: 'local'` with no
 * `dvn_receipt_id` on file, paired with its OWN `personaId` — the durable-
 * liveness counterpart to `createActivityReceipt()`'s fire-and-forget
 * hot-path submission (Horizen Pilot Closure, "close the DVN lifecycle
 * completely", 2026-08-09).
 *
 * `createActivityReceipt()` persists the row and then invokes
 * `enqueueActivityReceiptAnchor` through an un-awaited background promise —
 * latency-friendly, but not durable in a request/serverless environment: a
 * receipt whose request ended before that background work ran is stranded at
 * `local` forever with nothing left checking on it. This is that check: the
 * SAME full-row shape `rowToRecord` already produces for every other reader,
 * so the caller (a scheduled reconciler) can feed each result straight into
 * the existing `enqueueReceiptLeg(record, personaId, 'dvn')` — never a second
 * row-to-record mapping, never a parallel query shape. `personaId` is
 * returned alongside the record rather than folded into it — `rowToRecord`
 * deliberately never carries `persona_id` (it is T0; see this file's header),
 * and `enqueueReceiptLeg` already takes it as its own explicit argument.
 */
export interface LocalReceiptPendingDvnAnchor {
  record: ActivityReceiptRecord;
  personaId: string;
}

/**
 * Same {record, personaId} shape as `findLocalReceiptsPendingDvnAnchor`, but
 * for a caller-supplied, EXACT set of ids — never a status/backlog scan.
 *
 * Exists for targeted, bounded recovery of specific known-stranded receipts
 * (Horizen Pilot Closure, part B3, 2026-08-09) without touching the wider
 * historical `local` backlog that `reconcileLocalReceiptsToDvn`'s oldest-first
 * scan may need many bounded runs to reach — the operator's explicit
 * instruction was to assess duplicate-submission risk per receipt BEFORE any
 * resubmission, which a blind broad rescan cannot do surgically.
 */
export async function findReceiptsByIds(ids: string[]): Promise<LocalReceiptPendingDvnAnchor[]> {
  if (ids.length === 0) return [];
  const admin = getAdminClient();
  const { data, error } = await admin.from('activity_receipts').select('*').in('id', ids);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`findReceiptsByIds failed: ${error.message}`);
  }
  if (!data) return [];
  return (data as DbRow[]).map((row) => ({ record: rowToRecord(row), personaId: row.persona_id }));
}

export async function findLocalReceiptsPendingDvnAnchor(options?: {
  limit?: number;
  /** Keyset cursor — only rows created strictly after this ISO timestamp. Lets a
   * caller page forward past a run of non-anchorable rows instead of re-reading
   * the same oldest page forever (see reconcileLocalReceiptsToDvn). */
  afterCreatedAt?: string;
}): Promise<LocalReceiptPendingDvnAnchor[]> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const admin = getAdminClient();
  let query = admin
    .from('activity_receipts')
    .select('*')
    .eq('receipt_status', 'local')
    .is('dvn_receipt_id', null);
  if (options?.afterCreatedAt) {
    query = query.gt('created_at', options.afterCreatedAt);
  }
  const { data, error } = await query.order('created_at', { ascending: true }).limit(limit);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`findLocalReceiptsPendingDvnAnchor failed: ${error.message}`);
  }
  if (!data) return [];
  return (data as DbRow[]).map((row) => ({ record: rowToRecord(row), personaId: row.persona_id }));
}

export async function findAgentRegistrationReceipts(
  runtimeAgentId: string,
  options?: { limit?: number },
): Promise<AgentRegistrationReceiptFacts[]> {
  if (!runtimeAgentId) return [];
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('activity_receipts')
    .select('id, action_input, created_at')
    .eq('action_type', 'horizen_agent_registered')
    .contains('agents_invoked', [runtimeAgentId])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`findAgentRegistrationReceipts failed: ${error.message}`);
  }
  if (!data) return [];

  const out: AgentRegistrationReceiptFacts[] = [];
  for (const row of data as { id: string; action_input: Record<string, unknown> | null; created_at: string }[]) {
    const input = row.action_input ?? {};
    const txHash = input.txHash;
    // No txHash means nothing downstream can verify this receipt against the
    // chain — an unverifiable row is not evidence, so it is skipped entirely.
    if (typeof txHash !== 'string' || !txHash) continue;
    const reg = input.registration as Record<string, unknown> | undefined;
    out.push({
      receiptId: row.id,
      txHash,
      network:
        typeof reg?.network === 'string' ? reg.network : typeof input.network === 'string' ? input.network : null,
      tokenId: typeof reg?.tokenId === 'string' && reg.tokenId ? reg.tokenId : null,
      registryAddress: typeof reg?.registryAddress === 'string' ? reg.registryAddress : null,
      ownerAddress: typeof reg?.ownerAddress === 'string' ? reg.ownerAddress : null,
      createdAt: row.created_at,
    });
  }
  return out;
}

/**
 * The DVN anchoring state of ONE receipt, by id.
 *
 * Added for the Horizen evidence chain (Slice B), which has to say whether the
 * ingestion receipt is `recorded` / `pending` / `anchor-failed` — a surface
 * that can only say "a receipt exists" leaves the operator to open a SQL
 * console to learn whether provenance actually landed (the Terminal Outcome
 * defect). It lives HERE because this module is the canonical receipt reader;
 * a route reading `activity_receipts` directly would be the parallel
 * implementation inv.engineering.037 names.
 *
 * THREE-VALUED, deliberately, mirroring the binding model one layer up:
 *   - a status string  — read successfully
 *   - `null`           — read successfully, no such receipt (a FACT)
 *   - `undefined`      — could NOT read (missing table, query error) — an
 *                        admission of ignorance, never reported as "no receipt"
 *
 * It returns the status ONLY. The receipt body is persona-scoped and the caller
 * here is asking an anchoring question, not a content one; returning the row
 * would hand a caller receipt content it never established a right to read.
 */
export async function readReceiptAnchorStatus(
  receiptId: string,
): Promise<ReceiptStatus | null | undefined> {
  if (!receiptId) return null;
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('activity_receipts')
      .select('receipt_status')
      .eq('id', receiptId)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) return undefined;
      return undefined;
    }
    if (!data) return null;
    return ((data as { receipt_status?: ReceiptStatus }).receipt_status ?? 'local') as ReceiptStatus;
  } catch {
    return undefined;
  }
}

/**
 * A receipt's `actionInput`, by id — the read half of the receipted-
 * constitutional-state model (operator directive, 2026-08-08). A canonical
 * transition (e.g. `horizen_pulse_authorized`) is written with its
 * `receiptRef` stored on the caller's own row (see
 * `partner_authorization_requests.receiptRef`); reading the evidence back
 * later — for display, or for `reconcilePulseConstitutionalState`'s
 * comparison — goes through this function rather than a second, parallel
 * `activity_receipts` query (inv.engineering.036/037).
 *
 * THREE-VALUED, same discipline as `readReceiptAnchorStatus` immediately
 * above: `null` means "read successfully, no such receipt" (a fact);
 * `undefined` means "could not read" (an admission of ignorance). Returns
 * `actionInput` alone, never the full receipt body — this reader exists for
 * evidence lookup, not general receipt display.
 */
export async function getActivityReceiptActionInput(
  receiptId: string | null | undefined,
): Promise<Record<string, unknown> | null | undefined> {
  if (!receiptId) return null;
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('activity_receipts')
      .select('action_input')
      .eq('id', receiptId)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) return undefined;
      return undefined;
    }
    if (!data) return null;
    return (data as { action_input: Record<string, unknown> | null }).action_input ?? null;
  } catch {
    return undefined;
  }
}
