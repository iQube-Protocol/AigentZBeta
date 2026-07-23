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
  | 'finance_authoritative_execution';

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

  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`listActivityReceiptsForPersona failed: ${error.message}`);
  }
  if (!data) return [];
  return (data as DbRow[]).map(rowToRecord);
}
