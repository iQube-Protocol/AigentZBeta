/**
 * IntentQube service — bounded task scope for an Aigent Me session.
 *
 * Aigent Me Phase 2 (metaMe Personal Assistant Alpha).
 * Per PRD v0.2 §7.2.
 *
 * An IntentQube defines:
 *   - what task is in flight (intent_name, intent_type)
 *   - which cartridge is active
 *   - which agents may receive scoped context
 *   - which tools may be invoked
 *   - whether approval is required before any consequential action
 *   - the source-context references that produced this intent
 *
 * Storage strategy (Phase 2 — lean):
 *   The existing `nbe_plans` table is the canonical home for system-resolved
 *   "what should the user do next" recommendations (disposition: ask/act/
 *   wait/escalate/deny). An IntentQube is a richer object — it bundles the
 *   recommendation with the bounded permission scope.
 *
 *   Rather than introduce a new `intent_qubes` table now, Phase 2 stores
 *   the IntentQube as:
 *     - an `nbe_plans` row for the disposition + rationale + persona link
 *     - an `assistant_sessions` row for the bounded scope (created in
 *       Phase 1; columns mode + active_cartridge + policy_envelope_id
 *       already exist)
 *   plus a `metadata` jsonb (held in nbe_plans.rationale prefixed by a
 *   sentinel) for the agents/tools/approval list.
 *
 *   When Phase 5 (specialist routing) lands and the BlakQube payload
 *   needs richer typing, this service will pivot to a dedicated
 *   `intent_qubes` table without changing its public API. Callers should
 *   not depend on the underlying row layout.
 *
 * Server-only.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

// ─────────────────────────────────────────────────────────────────────────
// Types — public surface.
// ─────────────────────────────────────────────────────────────────────────

export type IntentType =
  | 'create_artifact'
  | 'ask_specialist'
  | 'draft_email'
  | 'schedule'
  | 'venture_review'
  | 'brief'
  | 'move_forward'
  | 'experience_setup';

export type IntentStatus =
  | 'in_progress'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type SpecialistAgentId =
  | 'aigent-me'
  | 'marketa'
  | 'quill'
  | 'kn0w1'
  | 'aigent-z'
  | 'aigent-c';

export type ToolId =
  | 'gmail'
  | 'calendar'
  | 'drive'
  | 'docs'
  | 'slides'
  | 'studio_skills'
  | 'runtime_card';

export interface IntentQubeRecord {
  id: string;
  sessionId: string | null;
  personaId: string;
  intentName: string;
  intentType: IntentType;
  activeCartridge: string;
  targetAgents: SpecialistAgentId[];
  allowedTools: ToolId[];
  approvalRequired: boolean;
  status: IntentStatus;
  rationale: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Sentinel + serialisation (until the dedicated table lands).
//
// We pack the IntentQube extras into nbe_plans.rationale as a JSON blob
// prefixed with the sentinel below. Routes never see this — they get the
// shaped IntentQubeRecord. The sentinel lets us round-trip without adding
// a column.
// ─────────────────────────────────────────────────────────────────────────

const RATIONALE_SENTINEL = '__intent_qube_v1__:';

interface PackedIntentExtras {
  intentName: string;
  intentType: IntentType;
  targetAgents: SpecialistAgentId[];
  allowedTools: ToolId[];
  approvalRequired: boolean;
  status: IntentStatus;
  sessionId: string | null;
  activeCartridge: string;
  /** Free-form human rationale (unpacked into the record's `rationale`). */
  rationaleText: string | null;
}

function packRationale(extras: PackedIntentExtras): string {
  return RATIONALE_SENTINEL + JSON.stringify(extras);
}

function unpackRationale(raw: string | null): PackedIntentExtras | null {
  if (!raw || !raw.startsWith(RATIONALE_SENTINEL)) return null;
  try {
    return JSON.parse(raw.slice(RATIONALE_SENTINEL.length)) as PackedIntentExtras;
  } catch {
    return null;
  }
}

interface NbePlanRow {
  id: string;
  persona_id: string;
  experience_id: string | null;
  disposition: string;
  next_experience_depth: string | null;
  rationale: string | null;
  expires_at: string | null;
  created_at: string;
}

function rowToRecord(row: NbePlanRow): IntentQubeRecord {
  const extras = unpackRationale(row.rationale);
  return {
    id: row.id,
    sessionId: extras?.sessionId ?? null,
    personaId: row.persona_id,
    intentName: extras?.intentName ?? row.experience_id ?? 'untitled-intent',
    intentType: extras?.intentType ?? 'brief',
    activeCartridge: extras?.activeCartridge ?? 'metame',
    targetAgents: extras?.targetAgents ?? ['aigent-me'],
    allowedTools: extras?.allowedTools ?? [],
    approvalRequired: extras?.approvalRequired ?? true,
    status: extras?.status ?? 'in_progress',
    rationale: extras?.rationaleText ?? null,
    createdAt: row.created_at,
  };
}

function getAdminClient() {
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase configuration missing for IntentQube service');
  return client;
}

// ─────────────────────────────────────────────────────────────────────────
// Create.
// ─────────────────────────────────────────────────────────────────────────

export interface IntentQubeCreateInput {
  sessionId?: string | null;
  personaId: string;
  intentName: string;
  intentType: IntentType;
  activeCartridge: string;
  targetAgents?: SpecialistAgentId[];
  allowedTools?: ToolId[];
  approvalRequired?: boolean;
  rationale?: string;
  /** TTL — defaults to 24h from creation. */
  expiresInMs?: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export async function createIntentQube(
  input: IntentQubeCreateInput,
): Promise<IntentQubeRecord> {
  if (!input.personaId) throw new Error('createIntentQube: personaId is required');
  if (!input.intentName) throw new Error('createIntentQube: intentName is required');

  const admin = getAdminClient();

  const extras: PackedIntentExtras = {
    intentName: input.intentName,
    intentType: input.intentType,
    targetAgents: input.targetAgents ?? ['aigent-me'],
    allowedTools: input.allowedTools ?? [],
    approvalRequired: input.approvalRequired ?? true,
    status: 'in_progress',
    sessionId: input.sessionId ?? null,
    activeCartridge: input.activeCartridge,
    rationaleText: input.rationale ?? null,
  };

  const expiresAt = new Date(Date.now() + (input.expiresInMs ?? DEFAULT_TTL_MS)).toISOString();

  const insert = {
    persona_id: input.personaId,
    experience_id: input.intentName.slice(0, 200),
    disposition: 'ask' as const, // user-bounded — gates on approval
    next_experience_depth: input.activeCartridge,
    rationale: packRationale(extras),
    expires_at: expiresAt,
  };

  const { data, error } = await admin
    .from('nbe_plans')
    .insert(insert)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`createIntentQube failed: ${error?.message ?? 'no row returned'}`);
  }

  return rowToRecord(data as NbePlanRow);
}

// ─────────────────────────────────────────────────────────────────────────
// Read.
// ─────────────────────────────────────────────────────────────────────────

export async function getIntentQube(intentId: string): Promise<IntentQubeRecord | null> {
  if (!intentId) return null;
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('nbe_plans')
    .select('*')
    .eq('id', intentId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToRecord(data as NbePlanRow);
}

// ─────────────────────────────────────────────────────────────────────────
// Status update — minimum needed for Phase 6 approval flows.
// ─────────────────────────────────────────────────────────────────────────

export async function setIntentQubeStatus(
  intentId: string,
  status: IntentStatus,
): Promise<IntentQubeRecord | null> {
  const admin = getAdminClient();
  const current = await getIntentQube(intentId);
  if (!current) return null;

  const extras: PackedIntentExtras = {
    intentName: current.intentName,
    intentType: current.intentType,
    targetAgents: current.targetAgents,
    allowedTools: current.allowedTools,
    approvalRequired: current.approvalRequired,
    status,
    sessionId: current.sessionId,
    activeCartridge: current.activeCartridge,
    rationaleText: current.rationale,
  };

  const { data, error } = await admin
    .from('nbe_plans')
    .update({ rationale: packRationale(extras) })
    .eq('id', intentId)
    .select('*')
    .single();

  if (error || !data) return null;
  return rowToRecord(data as NbePlanRow);
}

// ─────────────────────────────────────────────────────────────────────────
// List — recent IntentQubes for a persona.
//
// Used by the Venture Progress builder (Phase 4) to surface "recent
// activity" without requiring the full receipt pipeline. Filters on the
// sentinel-prefixed rationale so only Aigent Me intents come back; legacy
// nbe_plans rows are excluded.
// ─────────────────────────────────────────────────────────────────────────

export async function listRecentIntentsForPersona(
  personaId: string,
  options?: { limit?: number; cartridge?: string },
): Promise<IntentQubeRecord[]> {
  if (!personaId) return [];
  const limit = Math.min(options?.limit ?? 10, 50);
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('nbe_plans')
    .select('*')
    .eq('persona_id', personaId)
    .like('rationale', `${RATIONALE_SENTINEL}%`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const rows = data as NbePlanRow[];
  const records = rows.map(rowToRecord);
  if (options?.cartridge) {
    return records.filter((r) => r.activeCartridge === options.cartridge);
  }
  return records;
}
