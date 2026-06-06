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
  | 'artifact_sent'
  | 'approval_granted'
  | 'approval_rejected'
  | 'experience_model_updated'
  | 'session_started'
  | 'session_completed';

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

  async function insertWith(row: Record<string, unknown>) {
    return admin.from('activity_receipts').insert(row).select('*').single();
  }

  let { data, error } = await insertWith({ ...baseRow, ...optionalRow });

  if (error && isMissingColumn(error) && Object.keys(optionalRow).length > 0) {
    console.warn(
      '[ActivityReceipts] optional column missing — retrying without it. ' +
        'Apply supabase/migrations/20260606120000_activity_receipts_connector_fields.sql to enable dispatch persistence.',
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
