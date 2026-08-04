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
  | 'population_record_excluded';

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

  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`listActivityReceiptsForPersona failed: ${error.message}`);
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
 */
export async function findAgentReceiptRefs(
  runtimeAgentId: string,
  actionTypes: readonly ActivityActionType[],
  options?: { limit?: number },
): Promise<{ id: string; actionType: ActivityActionType }[]> {
  if (!runtimeAgentId || actionTypes.length === 0) return [];
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200);

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('activity_receipts')
    .select('id, action_type')
    .in('action_type', actionTypes as ActivityActionType[])
    .contains('agents_invoked', [runtimeAgentId])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`findAgentReceiptRefs failed: ${error.message}`);
  }
  if (!data) return [];
  return (data as { id: string; action_type: ActivityActionType }[]).map((r) => ({
    id: r.id,
    actionType: r.action_type,
  }));
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
