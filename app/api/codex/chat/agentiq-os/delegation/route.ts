/**
 * AgentiQ OS — Bounded Delegation Lifecycle
 *
 * POST   /api/codex/chat/agentiq-os/delegation          — Grant delegation
 * GET    /api/codex/chat/agentiq-os/delegation           — Read active delegation state
 * GET    /api/codex/chat/agentiq-os/delegation?events=1  — Audit log (last 10 events)
 * DELETE /api/codex/chat/agentiq-os/delegation           — Revoke delegation
 *
 * Active delegation state: in-memory store (server restart clears).
 * Audit trail: Supabase orchestration_events table (receipt-eligible).
 *
 * All lifecycle events are emitted to Supabase with receipt_eligible metadata.
 * DVN receipt anchor: did:iqube:aigent-c-os-root (agent Root DiD).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { PolicyEnvelope, HandoffPayload, OrchestrationEvent } from '@/types/orchestration';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';
import {
  persistDelegationGrant,
  readActiveGrant,
  revokeActiveGrant,
  markGrantExpired,
} from '@/services/delegation/delegationGrantStore';

// ============================================================================
// Types
// ============================================================================

interface DelegationRecord {
  handoff: HandoffPayload;
  expires_at: string;
  max_actions: number;
  actions_taken: number;
  created_at: string;
}

// Active delegation state — in-memory keyed by persona_id
const delegationStore = new Map<string, DelegationRecord>();

const AIGENT_C_OS_ROOT_DID = 'did:iqube:aigent-c-os-root';

type TrustBand =
  | 'L1_EXPERIMENTAL'
  | 'L2_VERIFIED_COMMUNITY'
  | 'L3_PRODUCTION_CANDIDATE'
  | 'L4_PRODUCTION_APPROVED'
  | 'L5_CORE_SOVEREIGN';

const TRUST_BAND_ACTIONS: Record<TrustBand, string[]> = {
  L1_EXPERIMENTAL: ['knowledge_retrieval'],
  L2_VERIFIED_COMMUNITY: ['knowledge_retrieval', 'draft_document'],
  L3_PRODUCTION_CANDIDATE: ['knowledge_retrieval', 'draft_document', 'registry_submission_proposal'],
  L4_PRODUCTION_APPROVED: ['knowledge_retrieval', 'draft_document', 'registry_submission_proposal', 'registry_publish'],
  L5_CORE_SOVEREIGN: ['knowledge_retrieval', 'draft_document', 'registry_submission_proposal', 'registry_publish', 'full_delegation'],
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

// ============================================================================
// GET — Delegation state OR audit event log
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const persona_id = searchParams.get('persona_id');

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

  // Default — return active delegation state
  let record = delegationStore.get(persona_id);

  // Durable rehydration: if the in-memory cache lost state (server restart),
  // read the active grant from the delegation_grants ledger first. The stored
  // handoff JSON rehydrates the record exactly. Falls through to the
  // orchestration_events reconstruction below if the table is absent/empty.
  if (!record) {
    const grant = await readActiveGrant(persona_id);
    if (grant?.handoff) {
      record = {
        handoff: grant.handoff,
        expires_at: grant.expires_at,
        max_actions: grant.max_actions,
        actions_taken: grant.actions_taken,
        created_at: grant.created_at,
      };
      delegationStore.set(persona_id, record);
    }
  }

  // Fallback: if in-memory store lost state (server restart), reconstruct from latest
  // z_delegated event in orchestration_events if it has not yet expired.
  if (!record) {
    try {
      const db = getDb();
      const { data: latest } = await db
        .from('orchestration_events')
        .select('metadata, created_at')
        .eq('event_type', 'z_delegated')
        .eq('active_cartridge', 'agentiq-os-cartridge')
        .filter('metadata->>persona_id', 'eq', persona_id)
        .filter('metadata->>handoff_id', 'not.is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest?.metadata) {
        const meta = latest.metadata as Record<string, unknown>;
        const expiresAt = typeof meta.expires_at === 'string' ? meta.expires_at : null;
        const handoffId = typeof meta.handoff_id === 'string' ? meta.handoff_id : null;
        const allowedActions = Array.isArray(meta.allowed_actions)
          ? (meta.allowed_actions as string[])
          : ['knowledge_retrieval'];
        const trustBand = typeof meta.trust_band === 'string' ? meta.trust_band : 'L2_VERIFIED_COMMUNITY';

        if (expiresAt && handoffId && new Date(expiresAt) > new Date()) {
          // Reconstruct minimal record from event metadata and re-hydrate the store
          record = {
            handoff: {
              handoff_id: handoffId,
              from_agent: 'aigent-z',
              to_agent: 'aigent-c',
              reason: `Restored from DVN event. Trust band: ${trustBand}.`,
              user_context_summary: '',
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
              policy_envelope: {
                tenant_id: 'default',
                persona_id,
                allowed_surfaces: ['agentiq-os-cartridge'],
                forbidden_actions: BASE_FORBIDDEN_ACTIONS,
                disclosure_class: 'tenant',
                requires_guardian_approval: false,
                cartridge_scope: 'agentiq-os-cartridge',
              },
              open_tasks: allowedActions,
              return_conditions: ['task_complete', 'session_end', 'policy_escalation', 'user_exit'],
              timestamp: latest.created_at,
            },
            expires_at: expiresAt,
            max_actions: 20,
            actions_taken: 0,
            created_at: latest.created_at,
          };
          delegationStore.set(persona_id, record);
        }
      }
    } catch {
      // Fallback reconstruction is non-fatal — return inactive state if it fails
    }
  }

  if (!record) {
    return NextResponse.json({
      active: false,
      persona_id,
      agent_root_did: AIGENT_C_OS_ROOT_DID,
    });
  }

  if (isExpired(record)) {
    delegationStore.delete(persona_id);
    await markGrantExpired(record.handoff.handoff_id);
    await emitDelegationEvent('control_returned_to_metame', persona_id, {
      handoff_id: record.handoff.handoff_id,
      reason: 'TTL expired',
    });
    return NextResponse.json({
      active: false,
      expired: true,
      persona_id,
      agent_root_did: AIGENT_C_OS_ROOT_DID,
    });
  }

  const suspended = record.actions_taken >= record.max_actions;

  return NextResponse.json({
    active: !suspended,
    suspended,
    persona_id,
    handoff_id: record.handoff.handoff_id,
    trust_band: record.handoff.reason.match(/Trust band: (\S+)\./)?.[ 1] ?? 'L2_VERIFIED_COMMUNITY',
    allowed_actions: record.handoff.open_tasks,
    allowed_surfaces: record.handoff.policy_envelope?.allowed_surfaces ?? ['agentiq-os-cartridge'],
    disclosure_class: record.handoff.policy_envelope?.disclosure_class ?? 'tenant',
    expires_at: record.expires_at,
    actions_taken: record.actions_taken,
    max_actions: record.max_actions,
    created_at: record.created_at,
    agent_root_did: record.handoff.to_agent ?? AIGENT_C_OS_ROOT_DID,
    policy_envelope: record.handoff.policy_envelope,
  });
}

// ============================================================================
// POST — Grant delegation
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      persona_id,
      agent_root_did: bodyAgentDid,
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

    const agentRootDid = bodyAgentDid || AIGENT_C_OS_ROOT_DID;

    if (!persona_id || typeof persona_id !== 'string') {
      return NextResponse.json({ error: 'persona_id is required' }, { status: 400 });
    }

    if (trust_band === 'L5_CORE_SOVEREIGN') {
      return NextResponse.json(
        { error: 'L5_CORE_SOVEREIGN delegation requires metaMe guardian approval. Not available in Phase 1.' },
        { status: 403 },
      );
    }

    // Trust band gating: if the client provides a reputation_score, enforce the minimum.
    const minScore = BAND_MIN_SCORE[trust_band] ?? 0;
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
      expires_at: expiresAt,
      max_actions: resolvedMaxActions,
      actions_taken: 0,
      created_at: new Date().toISOString(),
    };

    delegationStore.set(persona_id, record);

    // Durable persistence — survives serverless cold starts and gives Delegated
    // Standing a real ledger. Best-effort: soft-fails if the migration is
    // pending (the in-memory grant above keeps the flow working regardless).
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

    return NextResponse.json({
      ok: true,
      handoff_id: handoffId,
      persona_id,
      trust_band,
      allowed_actions: allowedActions,
      allowed_surfaces: resolvedSurfaces,
      disclosure_class: resolvedDisclosure,
      expires_at: expiresAt,
      max_actions: resolvedMaxActions,
      agent_root_did: agentRootDid,
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
// DELETE — Revoke delegation
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const persona_id = searchParams.get('persona_id');

    if (!persona_id) {
      return NextResponse.json({ error: 'persona_id query param is required' }, { status: 400 });
    }

    const record = delegationStore.get(persona_id);

    // Always flip the durable ledger, even when the in-memory cache is cold —
    // a grant rehydrated from the table (or never cached this instance) must
    // still be revocable.
    await revokeActiveGrant(persona_id, 'User revoked delegation');

    if (!record) {
      // The cache may be cold while a durable grant existed; the revoke above
      // covers that case. Nothing more to emit without a handoff_id.
      return NextResponse.json({ ok: true, message: 'No active delegation to revoke.' });
    }

    delegationStore.delete(persona_id);

    await emitDelegationEvent('control_returned_to_metame', persona_id, {
      handoff_id: record.handoff.handoff_id,
      reason: 'User revoked delegation',
      actions_taken: record.actions_taken,
    });

    return NextResponse.json({
      ok: true,
      message: 'Delegation revoked. Control returned to metaMe.',
      handoff_id: record.handoff.handoff_id,
      agent_root_did: AIGENT_C_OS_ROOT_DID,
    });
  } catch (err) {
    console.error('[Delegation DELETE] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
