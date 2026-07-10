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
import { listAssignments } from '@/services/identity/personaAssignmentStore';
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
export interface ConstitutionalContextAssignmentT1 {
  agentId: string;
  role: PersonaAssignment['role'];
  delegatedAuthority: string[];
  active: boolean;
  validUntil: string | null;
}

export interface ConstitutionalContextT1 {
  passport: { passportId: string | null; grade: string | null };
  persona: { displayLabel: string | null };
  boundAgents: BoundAgent[];
  assignedAgents: ConstitutionalContextAssignmentT1[];
  currentAigentMe: string | null;
}

/** Project a server ConstitutionalContext to its browser-safe T1 shape. Pure. */
export function projectConstitutionalContextT1(ctx: ConstitutionalContext): ConstitutionalContextT1 {
  return {
    passport: { passportId: ctx.passport.passportId, grade: ctx.passport.grade },
    persona: { displayLabel: ctx.persona.displayLabel },
    boundAgents: ctx.boundAgents,
    assignedAgents: ctx.assignedAgents.map((a) => ({
      agentId: a.agentId,
      role: a.role,
      delegatedAuthority: a.delegatedAuthority,
      active: a.active,
      validUntil: a.validUntil,
    })),
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

export interface OwnedPersonaRow {
  id: string;
  displayName: string | null;
  fioHandle: string | null;
}

/**
 * The person's full persona roster — every active persona sharing the caller's
 * auth profile (incl. multi-email-merged linked profiles). This is the set a
 * caller OWNS; bound agents and passports are gathered across all of them (the
 * CFS-024 person-scoping correction). Shared by the resolver + the assignment
 * route so ownership is enforced from one place.
 */
export async function listOwnedPersonaRows(authProfileId: string): Promise<OwnedPersonaRow[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  const linked = await getMergedLinkedAuthProfileIds(authProfileId).catch(() => []);
  const profileIds = Array.from(new Set([authProfileId, ...linked]));
  const { data } = await admin
    .from('personas')
    .select('id, display_name, fio_handle')
    .in('auth_profile_id', profileIds)
    .eq('status', 'active');
  return (data ?? []).map((r) => ({
    id: String(r.id),
    displayName: (r.display_name as string | null) ?? null,
    fioHandle: (r.fio_handle as string | null) ?? null,
  }));
}

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
  const personaRows = await listOwnedPersonaRows(persona.authProfileId);
  const ownedPersonaIds = Array.from(
    new Set([persona.personaId, ...personaRows.map((r) => r.id)]),
  );
  // Authoritative display label for the active persona — the persona's chosen
  // display_name (what the Wallet renders), falling back to its fio_handle.
  const activeRow = personaRows.find((r) => r.id === persona.personaId);
  const activeDisplayLabel =
    (activeRow?.displayName && activeRow.displayName.trim()) || persona.fioHandle || null;

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

  // The active persona's aigentMe designation via the legacy is_aigent_me flag
  // (fallback when no persisted assignment exists yet).
  const aigentMeRow = agentRows.find(
    (r) => Boolean(r.is_aigent_me) && String(r.sponsor_persona_id) === persona.personaId,
  );
  const aigentMeDid = aigentMeRow ? String(aigentMeRow.did_uri) : null;

  // The active persona's live delegation grant → runtime authority for whichever
  // assigned agent it targets.
  const grant = await readActiveGrant(persona.personaId).catch(() => null);
  const byDid = new Map(boundAgents.map((b) => [b.agentDid, b] as const));
  const grantAgentRowId = grant ? (byDid.get(grant.agent_root_did)?.agentId ?? null) : null;

  // Persisted per-persona assignments (CFS-024 Phase 3) — the structural layer.
  // Many agents may be assigned; exactly one is aigentMe. delegatedAuthority /
  // validUntil are filled from the active grant only for the agent it targets.
  const assignmentRows = await listAssignments(persona.personaId).catch(() => []);
  let assignedAgents: PersonaAssignment[] = assignmentRows.map((a) => {
    const matchesGrant = grant != null && a.agent_root_id === grantAgentRowId;
    return {
      personaId: persona.personaId,
      agentId: a.agent_root_id,
      role: a.role,
      delegatedAuthority:
        matchesGrant && Array.isArray(grant!.allowed_actions) ? grant!.allowed_actions : [],
      active: a.active,
      validFrom: a.created_at ?? null,
      validUntil: matchesGrant ? (grant!.expires_at ?? null) : null,
      relationship: 'assignment',
    };
  });

  // Back-compat: no persisted assignments (migration pending / none) but a live
  // grant exists → synthesize one so the surface still reflects reality.
  if (assignedAgents.length === 0 && grant) {
    const rowId = grantAgentRowId ?? grant.agent_root_did;
    const isAigentMe =
      aigentMeDid != null &&
      (grant.agent_root_did === aigentMeDid || rowId === (aigentMeRow?.id as string));
    assignedAgents = [
      {
        personaId: persona.personaId,
        agentId: rowId,
        role: isAigentMe ? 'aigentMe' : 'delegate',
        delegatedAuthority: Array.isArray(grant.allowed_actions) ? grant.allowed_actions : [],
        active: grant.status === 'active',
        validFrom: grant.created_at ?? null,
        validUntil: grant.expires_at ?? null,
        relationship: 'assignment',
      },
    ];
  }

  // currentAigentMe = the aigentMe assignment's agent (row id), else the legacy
  // is_aigent_me designation, else null.
  const currentAigentMe =
    assignedAgents.find((a) => a.role === 'aigentMe')?.agentId ??
    (aigentMeRow ? String(aigentMeRow.id) : null);

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
  ctx.assignedAgents = assignedAgents;
  ctx.currentAigentMe = currentAigentMe;
  return ctx;
}
