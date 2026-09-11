/**
 * AgentiQ OS — Bounded Delegation Lifecycle (CFS-024 multi-agent model,
 * rewritten 2026-08-23).
 *
 * POST   /api/codex/chat/agentiq-os/delegation          — Grant delegation (one agent, or a batch)
 * GET    /api/codex/chat/agentiq-os/delegation           — Read active delegation state
 * GET    /api/codex/chat/agentiq-os/delegation?events=1  — Audit log (last 10 events)
 * DELETE /api/codex/chat/agentiq-os/delegation           — Revoke a named agent's grant, or ALL (explicit)
 *
 * Canonical model (operator ruling, 2026-08-23): a persona may have MANY
 * structurally assigned agents, exactly ONE designated `aigentMe`, and MANY
 * simultaneously active bounded delegation grants — one independently
 * bounded grant PER AGENT. `aigentMe` is a role/designation, never an
 * exclusivity constraint on runtime authority. Granting one agent MUST NEVER
 * revoke another agent's unrelated, independent grant.
 *
 * Active delegation state: in-memory store (server restart clears), keyed by
 * `(persona_id, agent_root_did)` — never persona alone, so two agents' cached
 * records never collide or overwrite each other.
 * Durable backing: `delegation_grants` (services/delegation/delegationGrantStore.ts),
 * itself agent-scoped end to end (`readActiveGrants`/`readActiveGrantForAgent`/
 * `revokeGrantForAgent`/`revokeAllActiveGrants`).
 * Audit trail: Supabase orchestration_events table (receipt-eligible).
 *
 * All lifecycle events are emitted to Supabase with receipt_eligible metadata.
 * DVN receipt anchor: did:iqube:aigent-c-os-root (agent Root DiD).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { AgentRoleId, PolicyEnvelope, HandoffPayload, OrchestrationEvent } from '@/types/orchestration';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  persistDelegationGrant,
  readActiveGrants,
  readActiveGrantForAgent,
  revokeGrantForAgent,
  revokeAllActiveGrants,
  markGrantExpired,
  type DelegationGrantRow,
} from '@/services/delegation/delegationGrantStore';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { enqueueActivityReceiptAnchor } from '@/services/dvn/activityReceiptDvnPipeline';
import {
  resolveDelegateAgentIdByDid,
  readDelegateStanding,
  delegateStandingAllowsBand,
} from '@/services/homecoming/delegateStanding';
import { FOUNDER_COMMAND_CENTER_ACTIONS } from '@/services/delegation/delegatedActionVocabulary';

// ============================================================================
// Types
// ============================================================================

interface DelegationRecord {
  handoff: HandoffPayload;
  agent_root_did: string;
  expires_at: string;
  max_actions: number;
  actions_taken: number;
  created_at: string;
}

// Active delegation state — in-memory keyed by `${persona_id}::${agent_root_did}`
// (never persona alone — a persona may hold many simultaneously active grants,
// one independently bounded grant per agent; a persona-only key would let one
// agent's cached record silently overwrite another's).
const delegationStore = new Map<string, DelegationRecord>();

function recordKey(personaId: string, agentRootDid: string): string {
  return `${personaId}::${agentRootDid}`;
}

const AIGENT_C_OS_ROOT_DID = 'did:iqube:aigent-c-os-root';

type TrustBand =
  | 'L1_EXPERIMENTAL'
  | 'L2_VERIFIED_COMMUNITY'
  | 'L3_PRODUCTION_CANDIDATE'
  | 'L4_PRODUCTION_APPROVED'
  | 'L5_CORE_SOVEREIGN';

// Founder Command Center actions (Homecoming Closeout WP-C1, operator brief
// 2026-08-17) are additive across every band: the connectors backing them
// already carry their own requiresApproval gate (services/google/connectors.ts,
// services/marketa/marketaConnector.ts) — that per-connector approval gate is
// the safety boundary for externalizing actions, not the AgentiQ OS registry
// trust-band tier, which governs a different axis (registry submission/
// publish authority). Available at every band so a conservative/experimental
// grant (L1) already covers them, per the closeout's "operationally useful
// tomorrow" target.
const TRUST_BAND_ACTIONS: Record<TrustBand, string[]> = {
  L1_EXPERIMENTAL: ['knowledge_retrieval', ...FOUNDER_COMMAND_CENTER_ACTIONS],
  L2_VERIFIED_COMMUNITY: ['knowledge_retrieval', 'draft_document', ...FOUNDER_COMMAND_CENTER_ACTIONS],
  L3_PRODUCTION_CANDIDATE: ['knowledge_retrieval', 'draft_document', 'registry_submission_proposal', ...FOUNDER_COMMAND_CENTER_ACTIONS],
  L4_PRODUCTION_APPROVED: ['knowledge_retrieval', 'draft_document', 'registry_submission_proposal', 'registry_publish', ...FOUNDER_COMMAND_CENTER_ACTIONS],
  L5_CORE_SOVEREIGN: ['knowledge_retrieval', 'draft_document', 'registry_submission_proposal', 'registry_publish', 'full_delegation', ...FOUNDER_COMMAND_CENTER_ACTIONS],
};

// Minimum reputation score required to grant each trust band.
// The client sends its known reputation_score; the server enforces the threshold.
const BAND_MIN_SCORE: Record<TrustBand, number> = {
  L1_EXPERIMENTAL: 0,
  L2_VERIFIED_COMMUNITY: 20,
  L3_PRODUCTION_CANDIDATE: 50,
  L4_PRODUCTION_APPROVED: 75,
  L5_CORE_SOVEREIGN: 100,
};

const BASE_FORBIDDEN_ACTIONS = [
  'write_to_aigency_pack',
  'access_supabase_service_role',
  'push_to_registry_live',
  'read_wallet_credentials',
  'modify_other_persona',
  'read_sovereign_iqube',
];

// ============================================================================
// Helpers
// ============================================================================

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key, { auth: { persistSession: false } });
}

function isExpired(record: DelegationRecord): boolean {
  return new Date(record.expires_at) < new Date();
}

function buildHandoffId(): string {
  return `handoff_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function buildEventId(): string {
  return `delg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function emitDelegationEvent(
  eventType: OrchestrationEvent['event_type'],
  personaId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  // MUST be awaited by callers — on serverless the function freezes after the
  // response returns, so a fire-and-forget insert is cut off before it lands
  // (symptom: "No delegation events recorded" in the DVN audit log).
  await emitOrchestrationEvent({
    event_id: buildEventId(),
    timestamp: new Date().toISOString(),
    event_type: eventType,
    from_role: 'aigent-z',
    to_role: 'aigent-c',
    reason: String(metadata.reason ?? eventType),
    journey_stage: 'acolyte',
    active_cartridge: 'agentiq-os-cartridge',
    active_codex: 'agentiq-os-cartridge',
    receipt_eligible: true,
    metadata: {
      persona_id: personaId,
      agent_root_did: AIGENT_C_OS_ROOT_DID,
      ...metadata,
    },
  });
}

/** T1-safe, per-agent projection shape the new multi-grant surfaces (BoundedDelegationTab) consume. */
interface ActiveDelegationView {
  agent_root_did: string;
  active: boolean;
  suspended: boolean;
  handoff_id: string;
  trust_band: string;
  allowed_actions: string[];
  allowed_surfaces: string[];
  disclosure_class: string;
  expires_at: string;
  actions_taken: number;
  max_actions: number;
  created_at: string;
  policy_envelope: PolicyEnvelope | undefined;
}

function toView(record: DelegationRecord): ActiveDelegationView {
  const suspended = record.actions_taken >= record.max_actions;
  return {
    agent_root_did: record.agent_root_did,
    active: !suspended,
    suspended,
    handoff_id: record.handoff.handoff_id,
    trust_band: record.handoff.reason.match(/Trust band: (\S+)\./)?.[1] ?? 'L2_VERIFIED_COMMUNITY',
    allowed_actions: record.handoff.open_tasks,
    allowed_surfaces: record.handoff.policy_envelope?.allowed_surfaces ?? ['agentiq-os-cartridge'],
    disclosure_class: record.handoff.policy_envelope?.disclosure_class ?? 'tenant',
    expires_at: record.expires_at,
    actions_taken: record.actions_taken,
    max_actions: record.max_actions,
    created_at: record.created_at,
    policy_envelope: record.handoff.policy_envelope,
  };
}

function grantToRecord(grant: DelegationGrantRow): DelegationRecord | null {
  if (!grant.handoff) return null;
  return {
    handoff: grant.handoff,
    agent_root_did: grant.agent_root_did,
    expires_at: grant.expires_at,
    max_actions: grant.max_actions,
    actions_taken: grant.actions_taken,
    created_at: grant.created_at,
  };
}

/** Rehydrate (or return the cached) in-memory record for one (persona, agent) pair from the durable ledger. */
async function resolveRecordForAgent(personaId: string, agentRootDid: string): Promise<DelegationRecord | null> {
  const key = recordKey(personaId, agentRootDid);
  let record = delegationStore.get(key);
  if (record) return record;

  const grant = await readActiveGrantForAgent(personaId, agentRootDid);
  const fromGrant = grant ? grantToRecord(grant) : null;
  if (fromGrant) {
    delegationStore.set(key, fromGrant);
    return fromGrant;
  }
  return null;
}

/**
 * Every currently active delegation record for a persona — durable ledger
 * first (authoritative for the live multi-agent model), rehydrating each
 * agent's own in-memory cache entry as it goes. This does NOT attempt the
 * legacy orchestration_events single-record reconstruction (see the LIST
 * fallback note below) — that fallback predates the delegation_grants ledger
 * and only ever reconstructed ONE record at a time, which is honest for the
 * single-agent world it was built for but cannot enumerate a multi-agent
 * roster; the durable ledger is the actual source of truth for that today.
 */
async function resolveAllRecords(personaId: string): Promise<DelegationRecord[]> {
  const grants = await readActiveGrants(personaId);
  const records: DelegationRecord[] = [];
  for (const grant of grants) {
    const fromGrant = grantToRecord(grant);
    if (!fromGrant) continue;
    delegationStore.set(recordKey(personaId, grant.agent_root_did), fromGrant);
    records.push(fromGrant);
  }
  return records;
}

// ============================================================================
// GET — Delegation state OR audit event log
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const persona_id = searchParams.get('persona_id');
  const agent_root_did = searchParams.get('agent_root_did');

  if (!persona_id) {
    return NextResponse.json({ error: 'persona_id query param is required' }, { status: 400 });
  }

  // ?events=1 — return Supabase audit log for this persona in agentiq-os-cartridge
  if (searchParams.get('events') === '1') {
    try {
      const db = getDb();
      const { data } = await db
        .from('orchestration_events')
        .select('event_id, event_type, receipt_eligible, metadata, created_at')
        .eq('active_cartridge', 'agentiq-os-cartridge')
        .filter('metadata->>persona_id', 'eq', persona_id)
        .order('created_at', { ascending: false })
        .limit(10);

      return NextResponse.json({ events: data ?? [] });
    } catch {
      return NextResponse.json({ events: [] });
    }
  }

  let records: DelegationRecord[];
  if (agent_root_did) {
    const one = await resolveRecordForAgent(persona_id, agent_root_did);
    records = one ? [one] : [];

    // Legacy single-record fallback (pre-ledger orchestration_events
    // reconstruction) — only attempted when a specific agent was asked for,
    // since it can only ever reconstruct one record at a time.
    if (records.length === 0) {
      const legacy = await reconstructFromEventsFallback(persona_id, agent_root_did);
      if (legacy) records = [legacy];
    }
  } else {
    records = await resolveAllRecords(persona_id);
  }

  // Lazily expire any stale cached records this request touched.
  const live: DelegationRecord[] = [];
  for (const record of records) {
    if (isExpired(record)) {
      const key = recordKey(persona_id, record.agent_root_did);
      delegationStore.delete(key);
      await markGrantExpired(record.handoff.handoff_id);
      await emitDelegationEvent('control_returned_to_metame', persona_id, {
        handoff_id: record.handoff.handoff_id,
        agent_root_did: record.agent_root_did,
        reason: 'TTL expired',
      });
    } else {
      live.push(record);
    }
  }

  const activeDelegations = live.map(toView);

  // Legacy compatibility projection (2026-08-23 CFS-024 multi-agent repair
  // pass): older callers (SmartWalletDrawer, PassportRegistryTab) read a
  // SINGLE top-level `{active, agent_root_did, ...}` shape rather than
  // `activeDelegations`. When exactly one agent was asked for, project THAT
  // one; when none was specified, project the most-recently-created active
  // grant — explicitly a legacy convenience, never the canonical multi-agent
  // answer (that is always `activeDelegations`).
  const legacyRecord = agent_root_did
    ? live[0] ?? null
    : live.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;

  if (!legacyRecord) {
    return NextResponse.json({
      active: false,
      persona_id,
      agent_root_did: AIGENT_C_OS_ROOT_DID,
      activeDelegations,
    });
  }

  const legacyView = toView(legacyRecord);
  return NextResponse.json({
    active: legacyView.active,
    suspended: legacyView.suspended,
    persona_id,
    handoff_id: legacyView.handoff_id,
    trust_band: legacyView.trust_band,
    allowed_actions: legacyView.allowed_actions,
    allowed_surfaces: legacyView.allowed_surfaces,
    disclosure_class: legacyView.disclosure_class,
    expires_at: legacyView.expires_at,
    actions_taken: legacyView.actions_taken,
    max_actions: legacyView.max_actions,
    created_at: legacyView.created_at,
    agent_root_did: legacyRecord.agent_root_did,
    policy_envelope: legacyView.policy_envelope,
    activeDelegations,
  });
}

/**
 * Legacy fallback: reconstruct ONE agent's delegation record from the latest
 * `z_delegated`/`control_returned_to_metame` orchestration_events pair, for
 * the case the delegation_grants ledger migration is not yet applied. Scoped
 * to a single (persona, agent) pair — this predates the multi-agent model
 * and was never meant to enumerate a roster.
 */
async function reconstructFromEventsFallback(personaId: string, agentRootDid: string): Promise<DelegationRecord | null> {
  try {
    const db = getDb();
    const { data: latestAny } = await db
      .from('orchestration_events')
      .select('event_type, metadata, created_at')
      .eq('active_cartridge', 'agentiq-os-cartridge')
      .filter('metadata->>persona_id', 'eq', personaId)
      .filter('metadata->>agent_root_did', 'eq', agentRootDid)
      .in('event_type', ['z_delegated', 'control_returned_to_metame'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestAny?.event_type !== 'z_delegated' || !latestAny.metadata) return null;
    const meta = latestAny.metadata as Record<string, unknown>;
    const expiresAt = typeof meta.expires_at === 'string' ? meta.expires_at : null;
    const handoffId = typeof meta.handoff_id === 'string' ? meta.handoff_id : null;
    const allowedActions = Array.isArray(meta.allowed_actions) ? (meta.allowed_actions as string[]) : ['knowledge_retrieval'];
    const trustBand = typeof meta.trust_band === 'string' ? meta.trust_band : 'L2_VERIFIED_COMMUNITY';
    if (!expiresAt || !handoffId || new Date(expiresAt) <= new Date()) return null;

    const record: DelegationRecord = {
      handoff: {
        handoff_id: handoffId,
        from_agent: 'aigent-z',
        // HandoffPayload.to_agent is typed AgentRoleId (a closed role set),
        // but this route (pre-existing, unrelated to this pass — see the two
        // identical casts already accepted elsewhere in this file's POST
        // handler) uses it to carry the actual delegated agent's DID/root id,
        // not a role name. Not tightened here — out of scope for this repair.
        to_agent: agentRootDid as AgentRoleId,
        reason: `Restored from DVN event. Trust band: ${trustBand}.`,
        user_context_summary: '',
        journey_state_summary: {
          persona_id: personaId,
          journey_stage: 'acolyte',
          experience_depth: 'codex',
          active_cartridge: 'agentiq-os-cartridge',
          active_codex: 'agentiq-os-cartridge',
          blocked_reasons: [],
          next_likely_step: null,
          session_id: handoffId,
        },
        policy_envelope: {
          tenant_id: 'default',
          persona_id: personaId,
          allowed_surfaces: ['agentiq-os-cartridge'],
          forbidden_actions: BASE_FORBIDDEN_ACTIONS,
          disclosure_class: 'tenant',
          requires_guardian_approval: false,
          cartridge_scope: 'agentiq-os-cartridge',
        },
        open_tasks: allowedActions,
        return_conditions: ['task_complete', 'session_end', 'policy_escalation', 'user_exit'],
        timestamp: latestAny.created_at,
      },
      agent_root_did: agentRootDid,
      expires_at: expiresAt,
      max_actions: 20,
      actions_taken: 0,
      created_at: latestAny.created_at,
    };
    delegationStore.set(recordKey(personaId, agentRootDid), record);
    return record;
  } catch {
    return null;
  }
}

// ============================================================================
// POST — Grant delegation (one agent, or a batch — each independently sealed)
// ============================================================================

interface GrantResult {
  agent_root_did: string;
  handoff_id: string;
  trust_band: TrustBand;
  allowed_actions: string[];
  allowed_surfaces: string[];
  disclosure_class: string;
  expires_at: string;
  max_actions: number;
}

interface GrantRefusal {
  agent_root_did: string;
  error: string;
}

export async function POST(request: NextRequest) {
  try {
    /*
     * SPINE AUTH — THIS ROUTE MINTS AUTHORITY (2026-08-02).
     *
     * ── The defect ────────────────────────────────────────────────────────
     *
     * There was none. `persona_id` came from the request BODY and nothing
     * checked who was asking, so anyone holding a persona UUID could grant or
     * revoke that persona's delegation at any band below L5_CORE_SOVEREIGN.
     * A delegation is a grant of authority to act; issuing one for a persona
     * you are not is the whole of the harm.
     *
     * The identity spine is the single authority on "who is asking"
     * (CLAUDE.md — Identity & Access Spine). A body-supplied persona_id is a
     * CLAIM, never a credential, and is now only accepted when it agrees with
     * the persona the spine resolved.
     */
    const caller = await getActivePersona(request);
    if (!caller?.personaId) {
      return NextResponse.json(
        {
          error:
            'Not authenticated. A delegation grants authority to act on a persona\'s behalf, so it can only ' +
            'be issued by that persona.',
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const {
      persona_id,
      agent_root_did: bodyAgentDid,
      agent_root_dids: bodyAgentDids,
      trust_band = 'L2_VERIFIED_COMMUNITY',
      selected_actions,
      ttl_hours = 4,
      tenant_id,
      reputation_score,
      allowed_surfaces: bodySurfaces,
      disclosure_class: bodyDisclosure,
      max_actions: bodyMaxActions,
      spend_autonomy,
      show_receipts,
      curated_skills_only,
      explain_before_acting,
    } = body as {
      persona_id?: string;
      agent_root_did?: string;
      /** Batch shape (CFS-024 multi-agent model, 2026-08-23): each entry receives its own independently sealed grant, under the SAME shared configuration below. A batch is a UX convenience only — it creates no shared authority between the agents. */
      agent_root_dids?: string[];
      trust_band?: TrustBand;
      selected_actions?: string[];
      ttl_hours?: number;
      tenant_id?: string;
      reputation_score?: number;
      allowed_surfaces?: string[];
      disclosure_class?: string;
      max_actions?: number;
      spend_autonomy?: string;
      show_receipts?: boolean;
      curated_skills_only?: boolean;
      explain_before_acting?: boolean;
    };

    // One or many target agents — a single-agent request behaves exactly as
    // before (agent_root_did, defaulting to the AgentiQ OS system agent);
    // agent_root_dids opts into the batch path. The two are mutually
    // exclusive inputs to the SAME per-agent grant logic below — never a
    // second implementation.
    const targetAgentDids = Array.isArray(bodyAgentDids) && bodyAgentDids.length > 0
      ? Array.from(new Set(bodyAgentDids.filter((d): d is string => typeof d === 'string' && d.length > 0)))
      : [bodyAgentDid || AIGENT_C_OS_ROOT_DID];

    if (!persona_id || typeof persona_id !== 'string') {
      return NextResponse.json({ error: 'persona_id is required' }, { status: 400 });
    }

    // A body-supplied persona is a claim, not a credential. Accepted only when
    // it agrees with the caller the spine resolved; a mismatch is reported
    // rather than silently rewritten, because quietly retargeting a grant of
    // authority hides exactly the act that needs to be visible.
    if (persona_id !== caller.personaId) {
      return NextResponse.json(
        {
          error:
            'The delegation names a persona other than the authenticated caller. A delegation may only be ' +
            'issued for your own persona.',
        },
        { status: 403 },
      );
    }

    if (trust_band === 'L5_CORE_SOVEREIGN') {
      return NextResponse.json(
        { error: 'L5_CORE_SOVEREIGN delegation requires metaMe guardian approval. Not available in Phase 1.' },
        { status: 403 },
      );
    }

    /*
     * THE BAND GATE WAS OPT-IN (2026-08-02).
     *
     * `if (typeof reputation_score === 'number' && …)` — omit the field and
     * the check never runs. The comment said "if the client provides a
     * reputation_score", which is an accurate description of a gate that
     * cannot hold: the party being gated chooses whether it applies.
     *
     * Note the inconsistency INSIDE THIS FILE: the DELEGATE side below
     * resolves its ceiling server-side and says so in its own comment —
     * "server-resolved — never client-asserted". The grantor side did the
     * opposite. One route, two postures, and the weaker one guarding the
     * higher-privilege direction.
     *
     * Now fail-closed: a band with a minimum requires a score to evaluate, and
     * an absent score is a refusal rather than a pass. No score is invented —
     * refusing names what is missing. Resolving the grantor's score
     * server-side (personaAssetGraph reads it from CRM) is the follow-up that
     * removes the client's involvement entirely; until then the gate at least
     * cannot be skipped by omission. This gate is PERSONA-scoped (not
     * per-agent) so it runs once, before the per-agent loop below.
     */
    const minScore = BAND_MIN_SCORE[trust_band] ?? 0;
    if (minScore > 0 && typeof reputation_score !== 'number') {
      return NextResponse.json(
        {
          error:
            `${trust_band} requires a reputation of at least ${minScore}, and no reputation score was ` +
            'supplied to evaluate. This is a refusal to skip the check, not a statement that you fall short.',
          required_score: minScore,
          trust_band,
        },
        { status: 403 },
      );
    }
    if (typeof reputation_score === 'number' && reputation_score < minScore) {
      return NextResponse.json(
        {
          error: `Insufficient reputation for ${trust_band}. Required: ${minScore}, current: ${reputation_score}.`,
          required_score: minScore,
          current_score: reputation_score,
          trust_band,
        },
        { status: 403 },
      );
    }

    const clampedTtl = Math.min(Math.max(ttl_hours, 1), 8);
    const expiresAt = new Date(Date.now() + clampedTtl * 60 * 60 * 1000).toISOString();

    const bandActions = TRUST_BAND_ACTIONS[trust_band] ?? TRUST_BAND_ACTIONS.L2_VERIFIED_COMMUNITY;
    const allowedActions = selected_actions
      ? selected_actions.filter((a) => bandActions.includes(a))
      : bandActions;

    const resolvedSurfaces = Array.isArray(bodySurfaces) && bodySurfaces.length > 0
      ? bodySurfaces
      : ['agentiq-os-cartridge'];
    const resolvedDisclosure = bodyDisclosure || 'tenant';
    const resolvedMaxActions = typeof bodyMaxActions === 'number' && bodyMaxActions > 0
      ? Math.min(bodyMaxActions, 200)
      : 20;

    // ── Per-agent grant — each target agent gets its OWN independently
    //    sealed PolicyEnvelope, handoff/grant id, expiry, counters and
    //    receipts. A batch is a UX convenience only; it creates NO shared
    //    authority, action count, mandate or receipt chain between agents —
    //    every agent below runs the full per-agent gate + grant exactly as a
    //    lone single-agent request would. ──────────────────────────────────
    const grants: GrantResult[] = [];
    const refusals: GrantRefusal[] = [];

    for (const agentRootDid of targetAgentDids) {
      // Dual grant gate, DELEGATE side (operator decision 2026-07-12, option
      // (c)): L1/L2 stay grantor-gated only (the bootstrap floor — a new
      // agent can be delegated and then EARN its climb by producing). L3+
      // additionally require the delegate's OWN earned trust-band ceiling
      // (the CFS-023×CFS-025 Standing loop; server-resolved — never
      // client-asserted) to reach the requested band. Per-agent: each agent
      // in a batch is judged on ITS OWN earned standing, never the batch's.
      if (!delegateStandingAllowsBand(trust_band, 'L1_EXPERIMENTAL')) {
        const delegateAgentId = await resolveDelegateAgentIdByDid(agentRootDid);
        const delegateStanding = delegateAgentId ? await readDelegateStanding(delegateAgentId) : null;
        const earnedCeiling = delegateStanding?.trustBandCeiling ?? 'L1_EXPERIMENTAL';
        if (!delegateStandingAllowsBand(trust_band, earnedCeiling)) {
          refusals.push({
            agent_root_did: agentRootDid,
            error:
              `Delegate has not earned ${trust_band}. Earned ceiling: ${earnedCeiling}` +
              ` (standing ${delegateStanding?.overall ?? 0}). Standing accrues by producing` +
              ` consequential artifacts; an admin can accelerate it for testing.`,
          });
          continue;
        }
      }

      const envelope: PolicyEnvelope = {
        tenant_id: tenant_id ?? 'default',
        persona_id,
        allowed_surfaces: resolvedSurfaces,
        forbidden_actions: BASE_FORBIDDEN_ACTIONS,
        disclosure_class: resolvedDisclosure,
        requires_guardian_approval: false,
        cartridge_scope: resolvedSurfaces[0] ?? 'agentiq-os-cartridge',
      };

      const handoffId = buildHandoffId();

      const handoff: HandoffPayload = {
        handoff_id: handoffId,
        from_agent: 'aigent-z',
        to_agent: agentRootDid,
        reason: `Bounded delegation granted. Trust band: ${trust_band}. Agent: ${agentRootDid}.`,
        user_context_summary: `Persona ${persona_id} granted delegation to ${agentRootDid}. Allowed: ${allowedActions.join(', ')}. Surfaces: ${resolvedSurfaces.join(', ')}. Disclosure: ${resolvedDisclosure}. Expires: ${expiresAt}.`,
        journey_state_summary: {
          persona_id,
          journey_stage: 'acolyte',
          experience_depth: 'codex',
          active_cartridge: 'agentiq-os-cartridge',
          active_codex: 'agentiq-os-cartridge',
          blocked_reasons: [],
          next_likely_step: null,
          session_id: handoffId,
        },
        policy_envelope: envelope,
        open_tasks: allowedActions,
        return_conditions: ['task_complete', 'session_end', 'policy_escalation', 'user_exit'],
        timestamp: new Date().toISOString(),
      };

      const record: DelegationRecord = {
        handoff,
        agent_root_did: agentRootDid,
        expires_at: expiresAt,
        max_actions: resolvedMaxActions,
        actions_taken: 0,
        created_at: new Date().toISOString(),
      };

      delegationStore.set(recordKey(persona_id, agentRootDid), record);

      // Durable persistence — survives serverless cold starts and gives
      // Delegated Standing a real ledger. Best-effort: soft-fails if the
      // migration is pending (the in-memory grant above keeps the flow
      // working regardless). Supersedes ONLY this agent's own prior active
      // grant for this persona — never any other agent's independent grant
      // (delegationGrantStore.ts's own agent-scoped supersession).
      await persistDelegationGrant({
        grantId: handoffId,
        personaId: persona_id,
        agentRootDid,
        tenantId: tenant_id ?? 'default',
        trustBand: trust_band,
        allowedActions,
        allowedSurfaces: resolvedSurfaces,
        forbiddenActions: BASE_FORBIDDEN_ACTIONS,
        disclosureClass: resolvedDisclosure,
        maxActions: resolvedMaxActions,
        spendAutonomy: spend_autonomy ?? 'low',
        showReceipts: show_receipts ?? true,
        curatedSkillsOnly: curated_skills_only ?? true,
        explainBeforeActing: explain_before_acting ?? false,
        handoff,
        expiresAt: expiresAt,
      });

      await emitDelegationEvent('z_delegated', persona_id, {
        handoff_id: handoffId,
        agent_root_did: agentRootDid,
        trust_band,
        allowed_actions: allowedActions,
        allowed_surfaces: resolvedSurfaces,
        disclosure_class: resolvedDisclosure,
        max_actions: resolvedMaxActions,
        expires_at: expiresAt,
        ttl_hours: clampedTtl,
        spend_autonomy: spend_autonomy ?? 'low',
        show_receipts: show_receipts ?? true,
        curated_skills_only: curated_skills_only ?? true,
        explain_before_acting: explain_before_acting ?? false,
      });

      // Create an activity receipt so the delegation is anchored in the DVN
      // pipeline — one independent receipt PER agent, never a shared batch
      // receipt (each grant is its own constitutional act).
      try {
        const receipt = await createActivityReceipt({
          personaId: persona_id,
          activeCartridge: 'agentiq-os-cartridge',
          actionType: 'agent_delegated',
          summary: `Bounded delegation granted to ${agentRootDid} (trust band: ${trust_band}, allowed: ${allowedActions.join(', ')})`,
          agentsInvoked: [agentRootDid],
          toolsUsed: allowedActions,
          contextShared: [`handoff_id:${handoffId}`, `trust_band:${trust_band}`, `expires_at:${expiresAt}`],
        });
        if (receipt) enqueueActivityReceiptAnchor(receipt, persona_id);
      } catch (receiptErr) {
        // Soft-fail — the delegation itself succeeded; only the receipt is affected.
        console.error('[Delegation POST] Activity receipt creation failed:', receiptErr);
      }

      grants.push({
        agent_root_did: agentRootDid,
        handoff_id: handoffId,
        trust_band,
        allowed_actions: allowedActions,
        allowed_surfaces: resolvedSurfaces,
        disclosure_class: resolvedDisclosure,
        expires_at: expiresAt,
        max_actions: resolvedMaxActions,
      });
    }

    if (grants.length === 0) {
      // Every targeted agent was refused — no partial legacy-shape response
      // to fall back to.
      return NextResponse.json(
        { ok: false, error: 'No delegation could be granted.', refusals },
        { status: 403 },
      );
    }

    // Legacy single-agent response shape, preserved for existing callers
    // (PassportBureauApplyTab) that POST one agent and read the top-level
    // fields directly — projected from grants[0] when exactly one agent was
    // requested. `grants`/`refusals` are always present (the canonical,
    // multi-agent-aware shape new callers should read).
    const single = grants.length === 1 && targetAgentDids.length === 1 ? grants[0] : null;

    return NextResponse.json({
      ok: true,
      persona_id,
      grants,
      refusals,
      ...(single
        ? {
            handoff_id: single.handoff_id,
            trust_band: single.trust_band,
            allowed_actions: single.allowed_actions,
            allowed_surfaces: single.allowed_surfaces,
            disclosure_class: single.disclosure_class,
            expires_at: single.expires_at,
            max_actions: single.max_actions,
            agent_root_did: single.agent_root_did,
          }
        : {}),
    });
  } catch (err) {
    console.error('[Delegation POST] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// ============================================================================
// DELETE — Revoke a named agent's grant, or ALL (explicit)
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const persona_id = searchParams.get('persona_id');
    const agent_root_did = searchParams.get('agent_root_did');
    const revokeAll = searchParams.get('all') === '1';

    if (!persona_id) {
      return NextResponse.json({ error: 'persona_id query param is required' }, { status: 400 });
    }
    if (!agent_root_did && !revokeAll) {
      return NextResponse.json(
        {
          error:
            'agent_root_did query param is required to revoke a named agent\'s grant. Pass all=1 explicitly to ' +
            'revoke every active grant this persona holds.',
        },
        { status: 400 },
      );
    }

    if (revokeAll) {
      const records = await resolveAllRecords(persona_id);
      await revokeAllActiveGrants(persona_id, 'User revoked all delegations');
      for (const record of records) {
        delegationStore.delete(recordKey(persona_id, record.agent_root_did));
        await emitDelegationEvent('control_returned_to_metame', persona_id, {
          handoff_id: record.handoff.handoff_id,
          agent_root_did: record.agent_root_did,
          reason: 'User revoked all delegations',
          actions_taken: record.actions_taken,
        });
        try {
          const revokeReceipt = await createActivityReceipt({
            personaId: persona_id,
            activeCartridge: 'agentiq-os-cartridge',
            actionType: 'agent_delegation_revoked',
            summary: `Delegation revoked for ${record.agent_root_did} after ${record.actions_taken} of ${record.max_actions} actions (revoke-all)`,
            agentsInvoked: [record.agent_root_did],
            contextShared: [`handoff_id:${record.handoff.handoff_id}`, `actions_taken:${record.actions_taken}`],
          });
          if (revokeReceipt) enqueueActivityReceiptAnchor(revokeReceipt, persona_id);
        } catch (receiptErr) {
          console.error('[Delegation DELETE] Activity receipt creation failed:', receiptErr);
        }
      }
      return NextResponse.json({ ok: true, message: 'All delegations revoked.', revoked: records.length });
    }

    // Named-agent revoke — never touches any OTHER agent's independent grant
    // under the same persona (CFS-024 multi-agent model, 2026-08-23 repair
    // pass — the exact single-slot defect this corrects).
    const key = recordKey(persona_id, agent_root_did!);
    const record = delegationStore.get(key) ?? (await resolveRecordForAgent(persona_id, agent_root_did!));

    // Always flip the durable ledger, even when the in-memory cache is cold —
    // a grant rehydrated from the table (or never cached this instance) must
    // still be revocable.
    await revokeGrantForAgent(persona_id, agent_root_did!, 'User revoked delegation');

    if (!record) {
      // The durable ledger was revoked above, but we MUST still emit
      // control_returned_to_metame. The GET handler's orchestration_events
      // fallback (for cold-start rehydration) finds the most recent event of
      // either type — if no revoke event exists, it reconstructs from the stale
      // z_delegated event and incorrectly returns active: true.
      await emitDelegationEvent('control_returned_to_metame', persona_id, {
        agent_root_did,
        reason: 'User revoked delegation',
      });
      return NextResponse.json({ ok: true, message: 'Delegation revoked.', agent_root_did });
    }

    delegationStore.delete(key);

    await emitDelegationEvent('control_returned_to_metame', persona_id, {
      handoff_id: record.handoff.handoff_id,
      agent_root_did: record.agent_root_did,
      reason: 'User revoked delegation',
      actions_taken: record.actions_taken,
    });

    // Activity receipt for revocation — anchored in the DVN pipeline.
    try {
      const revokeReceipt = await createActivityReceipt({
        personaId: persona_id,
        activeCartridge: 'agentiq-os-cartridge',
        actionType: 'agent_delegation_revoked',
        summary: `Delegation revoked for ${record.handoff.to_agent} after ${record.actions_taken} of ${record.max_actions} actions`,
        agentsInvoked: [record.handoff.to_agent],
        contextShared: [`handoff_id:${record.handoff.handoff_id}`, `actions_taken:${record.actions_taken}`],
      });
      if (revokeReceipt) enqueueActivityReceiptAnchor(revokeReceipt, persona_id);
    } catch (receiptErr) {
      console.error('[Delegation DELETE] Activity receipt creation failed:', receiptErr);
    }

    return NextResponse.json({
      ok: true,
      message: 'Delegation revoked. Control returned to metaMe.',
      handoff_id: record.handoff.handoff_id,
      agent_root_did: record.agent_root_did,
    });
  } catch (err) {
    console.error('[Delegation DELETE] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
