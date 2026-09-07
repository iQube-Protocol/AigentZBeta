/**
 * provisionAgentPersona — shared agent-persona genesis core.
 *
 * After a citizen sponsors an agent (sponsorPolityAgent writes agent_root_identity),
 * this provisions the agent's persona-layer row (agent_persona) bound to the
 * sponsoring citizen under bounded delegation. Extracted from the inline
 * /api/identity/persona/agent route so BOTH that route AND Agent Homecoming's
 * stand-up chain provision personas identically (Extend-Don't-Duplicate).
 *
 * ── Principal-first resolution (DiDQube Phase 2.5, 2026-09-07) ──────────────
 *
 * FK resolution (spine-critical, T0):
 *   - delegation_user_root_id → root_identity(id): resolved via
 *     `resolveRootPrincipalForAuthUser(sponsorAuthUserId)` — the SAME
 *     auth_user_id → root_identity → kybe_id walk `passportPrincipal.ts`
 *     already exports and `services/passport/legacyPassportLinkageRepair.ts`
 *     already uses as its reference pattern (composed, not re-derived —
 *     inv.engineering.036/037). NEVER via `personas.root_did` — that column
 *     is semantically overloaded (see `passportPrincipal.ts`'s own SUPERSEDED
 *     comment) and was never a reliable link: `did:fio:<handle>` strings and
 *     other disposable persona-level identifiers vastly outnumber genuine
 *     `root_identity.did_uri` values in that column. The prior walk here
 *     read it directly and left 2 of 3 live `agent_persona` rows unanchored
 *     (DiDQube Phase 0 inventory, 2026-09-07).
 *   - `sponsorPersonaId` is now AUTHORIZATION/PROVENANCE ONLY (does this
 *     persona sponsor the agent? — the existing check below, unchanged) —
 *     never the identity-resolution mechanism. Persona membership and
 *     principal identity are deliberately kept as two separate questions
 *     (mirrors `legacyPassportLinkageRepair.ts`'s `LegacyLinkageRepairCaller`
 *     shape: `authUserId` resolves identity, `authProfileId`/persona
 *     ownership gates authorization — never conflated).
 *   - delegation_persona_id → did_persona(id): the sponsor's Bureau did_persona
 *     (root_id + app_origin='polity-passport-bureau'); nullable. Unchanged —
 *     already fed by the resolved root, not by `personas.root_did`.
 *
 * `allowUnanchored` is REMOVED. It existed only to route around the OLD
 * walk's failure mode (a sponsor's `did:fio:<handle>` root_did matching no
 * real `root_identity` row) — principal-first resolution has no equivalent
 * failure mode for a real, Bureau-bound citizen (every Passport-issued
 * `root_identity` row is anchored to an `auth_user_id`;
 * `bureauIdentityService.ts`'s own "find-or-create root_identity by
 * auth_user_id" pattern guarantees it). A human-sponsored call that cannot
 * resolve now fails closed (409), rather than silently provisioning
 * unanchored — this is the fix, not a workaround to reintroduce.
 *
 * `isPlatformAuthority` replaces `allowUnanchored` for the ONE case
 * principal-first resolution cannot and should not cover: a machine-to-
 * machine sponsor with no human auth session at all (e.g.
 * `/api/ops/agents/provision-platform-agent`'s CRON_TRIGGER_TOKEN path,
 * sponsoring under the shared platform sponsor persona). Mirrors
 * `sponsorPolityAgent`'s own `isPlatformAuthority` flag for the identical
 * semantic distinction — never settable from a request body; the caller
 * sets it only after its own authority check has already succeeded.
 *
 * T0 discipline: sponsorPersonaId, sponsorAuthUserId, and the resolved
 * root/did ids are server-only, never serialised.
 * Idempotent: one production persona per agent root (returns the existing row).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRootPrincipalForAuthUser } from '@/services/identity/passportPrincipal';

const BUREAU_APP_ORIGIN = 'polity-passport-bureau';

export interface ProvisionAgentPersonaInput {
  admin: SupabaseClient;
  /** Caller persona (T0) — must sponsor the agent. Authorization/provenance only. */
  sponsorPersonaId: string;
  /** agent_root_identity.id returned by genesis. */
  agentRootId: string;
  personaRole?: string;
  /**
   * The sponsoring citizen's authenticated Supabase auth.users id — the
   * ONLY source of the delegation anchor (`resolveRootPrincipalForAuthUser`).
   * Required unless `isPlatformAuthority` is true. Never a caller-supplied
   * rootIdentityId/kybeId, and never derived from `sponsorPersonaId` or
   * `personas.root_did`.
   */
  sponsorAuthUserId?: string;
  /**
   * True ONLY for machine-to-machine platform-authority provisioning (no
   * human auth session exists) — mirrors `sponsorPolityAgent`'s own
   * `isPlatformAuthority` flag. The delegation anchor is honestly left NULL
   * (there is no human principal to resolve), never guessed at.
   */
  isPlatformAuthority?: boolean;
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
  const { admin, sponsorPersonaId, agentRootId, personaRole: roleInput, sponsorAuthUserId, isPlatformAuthority = false } = input;
  if (!isPlatformAuthority && !sponsorAuthUserId?.trim()) {
    return {
      ok: false,
      status: 400,
      error: 'sponsorAuthUserId is required for principal-first delegation anchoring (unless isPlatformAuthority is true)',
    };
  }
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

  // 3. Resolve the sponsor's root_identity — principal-first, from the
  //    AUTHENTICATED caller's own auth_user_id. NEVER from personas.root_did.
  //    Platform-authority calls have no human principal at all: the anchor
  //    is honestly NULL, not guessed at.
  let sponsorRootId: string | null = null;
  if (!isPlatformAuthority) {
    const principal = await resolveRootPrincipalForAuthUser(sponsorAuthUserId!);
    if (!principal.ok) {
      return {
        ok: false,
        status: 409,
        error: `Sponsor principal could not be resolved (${principal.reason}) — cannot anchor bounded delegation`,
      };
    }
    sponsorRootId = principal.rootIdentityId;
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
