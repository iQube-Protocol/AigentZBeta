/**
 * provisionAgentPersona — shared agent-persona genesis core.
 *
 * After a citizen sponsors an agent (sponsorPolityAgent writes agent_root_identity),
 * this provisions the agent's persona-layer row (agent_persona) bound to the
 * sponsoring citizen under bounded delegation. Extracted from the inline
 * /api/identity/persona/agent route so BOTH that route AND Agent Homecoming's
 * stand-up chain provision personas identically (Extend-Don't-Duplicate).
 *
 * FK resolution (spine-critical, T0):
 *   - delegation_user_root_id → root_identity(id): via personas.root_did →
 *     root_identity.did_uri (the link bindBureauIdentity writes; NOT authProfileId).
 *   - delegation_persona_id → did_persona(id): the sponsor's Bureau did_persona
 *     (root_id + app_origin='polity-passport-bureau'); nullable.
 *
 * T0 discipline: sponsorPersonaId and the resolved root/did ids are server-only.
 * Idempotent: one production persona per agent root (returns the existing row).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const BUREAU_APP_ORIGIN = 'polity-passport-bureau';

export interface ProvisionAgentPersonaInput {
  admin: SupabaseClient;
  /** Caller persona (T0) — must sponsor the agent. */
  sponsorPersonaId: string;
  /** agent_root_identity.id returned by genesis. */
  agentRootId: string;
  personaRole?: string;
  /**
   * When true, provision even if the sponsor's root_identity can't be resolved —
   * with delegation_user_root_id NULL (a schema-permitted, RLS-recognised state),
   * flagged `sponsorRootResolved: false` for later backfill. Default false keeps
   * the strict behaviour the /api/identity/persona/agent route relies on; Agent
   * Homecoming passes true so a delegate reaches L2 when the sponsor's FIO-style
   * root_did has no root_identity row (a common human-persona gap).
   */
  allowUnanchored?: boolean;
}

export interface AgentPersonaResult {
  agentPersonaId: string;
  didUri: string;
  agentRootId: string;
  personaRole: string | null;
  maxIdentifiability: string;
  createdAt: string;
}

export interface ProvisionAgentPersonaOutcome {
  ok: boolean;
  status: number;
  agentPersona?: AgentPersonaResult;
  alreadyExists?: boolean;
  delegationAnchored?: { sponsorRootResolved: boolean; sponsorDidPersonaResolved: boolean };
  error?: string;
}

export async function provisionAgentPersona(
  input: ProvisionAgentPersonaInput,
): Promise<ProvisionAgentPersonaOutcome> {
  const { admin, sponsorPersonaId, agentRootId, personaRole: roleInput, allowUnanchored = false } = input;
  if (!agentRootId?.trim()) {
    return { ok: false, status: 400, error: 'agentRootId is required — the id returned by /api/agents/genesis' };
  }

  // 1. Load the agent root identity and verify the caller sponsors it.
  const { data: agentRoot, error: agentErr } = await admin
    .from('agent_root_identity')
    .select('id, agent_id, did_uri, agent_class, agent_card_slug, sponsor_persona_id, sponsor_passport_id, display_name')
    .eq('id', agentRootId)
    .maybeSingle();
  if (agentErr) {
    if (agentErr.message.includes('sponsor_persona_id') || agentErr.message.includes('agent_card_slug')) {
      return {
        ok: false,
        status: 503,
        error: 'Pending migration: 20260613200000_agent_genesis_polity_bound.sql must be applied before agent persona genesis.',
      };
    }
    return { ok: false, status: 500, error: agentErr.message };
  }
  if (!agentRoot) return { ok: false, status: 404, error: 'Agent root identity not found' };
  if (agentRoot.sponsor_persona_id !== sponsorPersonaId) {
    return { ok: false, status: 403, error: 'Caller does not sponsor this agent' };
  }
  if (!agentRoot.agent_card_slug) {
    return { ok: false, status: 409, error: 'Agent has no card slug — re-run genesis before creating its persona' };
  }

  // 2. Idempotency — one production persona per agent root.
  const { data: existing } = await admin
    .from('agent_persona')
    .select('id, did_uri, agent_root_id, persona_role, max_identifiability, created_at')
    .eq('agent_root_id', agentRootId)
    .limit(1);
  if (existing && existing.length > 0) {
    const row = existing[0];
    return {
      ok: true,
      status: 200,
      alreadyExists: true,
      agentPersona: {
        agentPersonaId: String(row.id),
        didUri: String(row.did_uri),
        agentRootId: String(row.agent_root_id),
        personaRole: row.persona_role ?? null,
        maxIdentifiability: String(row.max_identifiability),
        createdAt: row.created_at,
      },
    };
  }

  // 3. Resolve the sponsor's root_identity via personas.root_did →
  //    root_identity.did_uri (best-effort). Human personas often carry a
  //    did:fio:<handle> root_did with no matching root_identity row; when
  //    allowUnanchored is set we provision an UN-anchored persona
  //    (delegation_user_root_id NULL — schema-permitted, RLS-recognised) rather
  //    than blocking, and flag it for later backfill.
  const { data: sponsorPersona, error: sponsorPersonaErr } = await admin
    .from('personas')
    .select('root_did')
    .eq('id', sponsorPersonaId)
    .maybeSingle();
  if (sponsorPersonaErr) return { ok: false, status: 500, error: sponsorPersonaErr.message };
  const sponsorRootDid = sponsorPersona?.root_did ?? null;

  let sponsorRootId: string | null = null;
  if (sponsorRootDid) {
    const { data: rootRow, error: rootErr } = await admin
      .from('root_identity')
      .select('id')
      .eq('did_uri', sponsorRootDid)
      .maybeSingle();
    if (rootErr) return { ok: false, status: 500, error: rootErr.message };
    sponsorRootId = rootRow?.id ?? null;
  }
  if (!sponsorRootId && !allowUnanchored) {
    return {
      ok: false,
      status: 409,
      error: sponsorRootDid
        ? 'Sponsor root identity not found — cannot anchor bounded delegation'
        : 'Sponsor persona has no root DID — cannot anchor bounded delegation',
    };
  }

  // 4. Resolve the sponsor's Bureau did_persona (nullable; only with a root).
  let sponsorDidPersonaId: string | null = null;
  if (sponsorRootId) {
    const { data: didPersonaRows } = await admin
      .from('did_persona')
      .select('id')
      .eq('root_id', sponsorRootId)
      .eq('app_origin', BUREAU_APP_ORIGIN)
      .limit(1);
    sponsorDidPersonaId =
      didPersonaRows && didPersonaRows.length > 0 ? String(didPersonaRows[0].id) : null;
  }

  // 5. Provision the agent persona.
  const didUri = `did:agent:persona:${agentRoot.agent_card_slug}:production`;
  const personaRole = roleInput?.trim() || 'polity_bound_delegate';

  const { data: created, error: createErr } = await admin
    .from('agent_persona')
    .insert({
      agent_root_id: agentRootId,
      did_uri: didUri,
      persona_role: personaRole,
      delegation_user_root_id: sponsorRootId,
      delegation_persona_id: sponsorDidPersonaId,
      max_identifiability: 'anonymous',
      delegation_scopes: {},
    })
    .select('id, did_uri, agent_root_id, persona_role, max_identifiability, created_at')
    .single();
  if (createErr) {
    if (createErr.message.includes('agent_persona')) {
      return {
        ok: false,
        status: 503,
        error: 'Pending migration: 20260427000001_agent_did_schema.sql must be applied before agent persona genesis.',
      };
    }
    return { ok: false, status: 500, error: createErr.message };
  }

  return {
    ok: true,
    status: 200,
    agentPersona: {
      agentPersonaId: String(created.id),
      didUri: String(created.did_uri),
      agentRootId: String(created.agent_root_id),
      personaRole: created.persona_role ?? null,
      maxIdentifiability: String(created.max_identifiability),
      createdAt: created.created_at,
    },
    delegationAnchored: { sponsorRootResolved: sponsorRootId !== null, sponsorDidPersonaResolved: sponsorDidPersonaId !== null },
  };
}
