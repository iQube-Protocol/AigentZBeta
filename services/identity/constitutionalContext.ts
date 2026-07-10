/**
 * resolveConstitutionalContext — the CFS-024 single source of truth.
 *
 * Every surface that today independently resolves "active persona", "active
 * aigentMe", or "active delegation" (Wallet, Delegation Bureau, persona
 * dropdown, Founder Office, …) SHOULD instead call this resolver once and render
 * from the returned ConstitutionalContext. That closes the observed disagreement
 * where the Wallet showed one aigentMe and the Bureau another — they were each
 * resolving their own view of "who is active".
 *
 * The load-bearing correction (CFS-024): an agent is BOUND to the constitutional
 * PERSON (permanent), not to a persona. So `boundAgents` is gathered across
 * EVERY persona the caller owns (all personas sharing the auth profile), not
 * just the active one. This is why a delegate sponsored under one persona (e.g.
 * Aletheon, stood up under the passport-holder persona) must still appear when a
 * DIFFERENT persona is active. The per-persona ASSIGNMENT (which bound agent is
 * this persona's aigentMe / delegate right now) is `assignedAgent` /
 * `currentAigentMe` — resolved for the active persona only.
 *
 * COMPOSITION, NOT A FORK. This resolver calls the canonical spine
 * (`getActivePersona`) and the existing durable stores (delegation_grants,
 * agent_root_identity, polity_passport_records). It never re-implements identity
 * resolution. Per CLAUDE.md the spine files remain the canonical contract; this
 * is additive read-only composition.
 *
 * T0 discipline: persona ids and auth profile ids stay server-internal. The
 * returned context carries T0 ids because it is a SERVER value — routes that
 * serialise it to the browser MUST project to the T1 surface first.
 */

import type { NextRequest } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getMergedLinkedAuthProfileIds } from '@/services/wallet/multiEmailIdentity';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { readActiveGrant, type DelegationGrantRow } from '@/services/delegation/delegationGrantStore';
import {
  emptyConstitutionalContext,
  type BoundAgent,
  type ConstitutionalContext,
  type PersonaAssignment,
} from '@/types/constitutionalContext';

/**
 * The browser-safe (T1) projection of a ConstitutionalContext. The active
 * persona id and the auth profile id (both T0) are stripped; only display
 * labels, the public passport ref/grade, the public agent dids + roster
 * metadata, and the current-assignment shape travel. Agent row ids (agentId)
 * are already treated as T1 handles elsewhere in this codebase
 * (/api/persona/sponsored-agents returns them), so they are retained as the
 * client's stable selection key; sponsor_persona_id (T0) is never included.
 */
export interface ConstitutionalContextT1 {
  passport: { passportId: string | null; grade: string | null };
  persona: { displayLabel: string | null };
  boundAgents: BoundAgent[];
  assignedAgent: {
    agentId: string;
    role: PersonaAssignment['role'];
    delegatedAuthority: string[];
    active: boolean;
    validUntil: string | null;
  } | null;
  currentAigentMe: string | null;
}

/** Project a server ConstitutionalContext to its browser-safe T1 shape. Pure. */
export function projectConstitutionalContextT1(ctx: ConstitutionalContext): ConstitutionalContextT1 {
  return {
    passport: { passportId: ctx.passport.passportId, grade: ctx.passport.grade },
    persona: { displayLabel: ctx.persona.displayLabel },
    boundAgents: ctx.boundAgents,
    assignedAgent: ctx.assignedAgent
      ? {
          agentId: ctx.assignedAgent.agentId,
          role: ctx.assignedAgent.role,
          delegatedAuthority: ctx.assignedAgent.delegatedAuthority,
          active: ctx.assignedAgent.active,
          validUntil: ctx.assignedAgent.validUntil,
        }
      : null,
    currentAigentMe: ctx.currentAigentMe,
  };
}

// ── Pure row → contract mappers (canary-covered) ────────────────────────────

/**
 * Map an agent_root_identity row to a BoundAgent (the PERMANENT citizen↔agent
 * relationship). `passportBound` is true once the agent's participant passport
 * is issued + bound (`bound_passport_id` set).
 */
export function mapBoundAgentRow(row: Record<string, unknown>): BoundAgent {
  return {
    agentId: String(row.id ?? row.agent_id ?? ''),
    agentDid: String(row.did_uri ?? ''),
    displayName: String(row.display_name ?? 'Agent'),
    agentClass: String(row.agent_class ?? 'polity_bound'),
    passportBound: Boolean(row.bound_passport_id),
    relationship: 'binding',
  };
}

/**
 * Map the active delegation_grants row to a PersonaAssignment (the TEMPORARY
 * persona↔agent relationship). The grant is the AUTHORITY half of an
 * assignment; `role` is inferred as 'aigentMe' when the granted agent is the
 * persona's designated aigentMe, else 'delegate'. `PersonaAssignment` as a
 * first-class persisted record is CFS-024 Phase 3 — until then it is derived.
 */
export function mapGrantToAssignment(
  grant: DelegationGrantRow,
  personaId: string,
  role: 'aigentMe' | 'delegate',
): PersonaAssignment {
  return {
    personaId,
    agentId: grant.agent_root_did,
    role,
    delegatedAuthority: Array.isArray(grant.allowed_actions) ? grant.allowed_actions : [],
    active: grant.status === 'active',
    validFrom: grant.created_at ?? null,
    validUntil: grant.expires_at ?? null,
    relationship: 'assignment',
  };
}

// ── Impure composition ──────────────────────────────────────────────────────

const AGENT_COLS =
  'id, agent_id, did_uri, agent_class, display_name, bound_passport_id, is_aigent_me, sponsor_persona_id, created_at';

/**
 * Resolve the single constitutional context for the caller. Read-only. Returns
 * an empty (all-null) context for an unauthenticated / persona-less caller —
 * honest nulls, never faked.
 */
export async function resolveConstitutionalContext(
  request: NextRequest,
): Promise<ConstitutionalContext> {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return emptyConstitutionalContext();

  const admin = getSupabaseServer();
  if (!admin) {
    // Authenticated but no DB — surface the persona we DO know, empty rosters.
    const ctx = emptyConstitutionalContext();
    ctx.citizen.personId = persona.authProfileId;
    ctx.persona.personaId = persona.personaId;
    ctx.persona.displayLabel = persona.fioHandle ?? null;
    return ctx;
  }

  // The person's full persona roster (all personas sharing the auth profile,
  // incl. multi-email-merged linked profiles). Bound agents are gathered across
  // ALL of these — that is the CFS-024 correction.
  const linked = await getMergedLinkedAuthProfileIds(persona.authProfileId).catch(() => []);
  const profileIds = Array.from(new Set([persona.authProfileId, ...linked]));
  const { data: personaRows } = await admin
    .from('personas')
    .select('id, display_name, fio_handle')
    .in('auth_profile_id', profileIds)
    .eq('status', 'active');
  const ownedPersonaIds = Array.from(
    new Set([persona.personaId, ...((personaRows ?? []).map((r) => String(r.id)))]),
  );
  // Authoritative display label for the active persona — the persona's chosen
  // display_name (what the Wallet renders), falling back to its fio_handle.
  const activeRow = (personaRows ?? []).find((r) => String(r.id) === persona.personaId);
  const activeDisplayLabel =
    (typeof activeRow?.display_name === 'string' && activeRow.display_name.trim()) ||
    persona.fioHandle ||
    null;

  // Bound agents — the PERSON's permanent roster (across every owned persona).
  // is_aigent_me is a later migration; soft-fall to the base query if absent.
  let agentRows: Record<string, unknown>[] = [];
  const enriched = await admin
    .from('agent_root_identity')
    .select(AGENT_COLS)
    .in('sponsor_persona_id', ownedPersonaIds)
    .order('created_at', { ascending: false });
  if (enriched.error && enriched.error.message.includes('is_aigent_me')) {
    const fallback = await admin
      .from('agent_root_identity')
      .select('id, agent_id, did_uri, agent_class, display_name, bound_passport_id, sponsor_persona_id, created_at')
      .in('sponsor_persona_id', ownedPersonaIds)
      .order('created_at', { ascending: false });
    agentRows = fallback.data ?? [];
  } else {
    agentRows = enriched.data ?? [];
  }
  const boundAgents: BoundAgent[] = agentRows.map(mapBoundAgentRow);

  // The active persona's aigentMe designation (its default assignment target).
  const aigentMeRow = agentRows.find(
    (r) => Boolean(r.is_aigent_me) && String(r.sponsor_persona_id) === persona.personaId,
  );
  const aigentMeDid = aigentMeRow ? String(aigentMeRow.did_uri) : null;

  // The active persona's live delegation grant → the current assignment.
  const grant = await readActiveGrant(persona.personaId).catch(() => null);
  let assignedAgent: PersonaAssignment | null = null;
  let currentAigentMe: string | null = null;
  if (grant) {
    const isAigentMe =
      aigentMeDid != null &&
      (grant.agent_root_did === aigentMeDid || grant.agent_root_did === (aigentMeRow?.id as string));
    assignedAgent = mapGrantToAssignment(grant, persona.personaId, isAigentMe ? 'aigentMe' : 'delegate');
    currentAigentMe = grant.agent_root_did;
  }

  // Citizen passport across the person's personas — the personhood credential.
  const { data: passportRows } = await admin
    .from('polity_passport_records')
    .select('passport_id, passport_grade, citizen_status, issued_at')
    .in('persona_id', ownedPersonaIds)
    .eq('passport_class', 'citizen')
    .in('citizen_status', ['active', 'renewal_due'])
    .order('issued_at', { ascending: false })
    .limit(1);
  const passport = passportRows?.[0] ?? null;

  const ctx = emptyConstitutionalContext();
  ctx.citizen.personId = persona.authProfileId;
  ctx.passport.passportId = passport ? String(passport.passport_id) : null;
  ctx.passport.grade = passport?.passport_grade ? String(passport.passport_grade) : null;
  // standing lanes are composed by the Bureau today; Phase 1 leaves them null
  // rather than duplicate the CRM reputation join here (Phase 2 threads it in).
  ctx.persona.personaId = persona.personaId;
  ctx.persona.displayLabel = activeDisplayLabel;
  ctx.boundAgents = boundAgents;
  ctx.assignedAgent = assignedAgent;
  ctx.currentAigentMe = currentAigentMe;
  return ctx;
}
