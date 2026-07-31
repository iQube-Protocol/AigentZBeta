/**
 * personaAssignmentStore — durable per-persona agent ASSIGNMENTS (CFS-024 Phase 3).
 *
 * The Persona↔Agent ASSIGNMENT relationship: which citizen-bound agents act for
 * a persona, and which ONE is its aigentMe. Distinct from:
 *   • the BINDING (agent_root_identity → the person) — permanent, and
 *   • the GRANT (delegation_grants) — the runtime authority envelope.
 *
 * A persona may assign MANY agents; exactly one carries role 'aigentMe' (DB
 * partial-unique enforced). Assigning does NOT grant authority — that stays with
 * the bounded-delegation grant. This store is the structural layer only.
 *
 * Validity rule: an agent may be assigned to a persona ONLY if it is in that
 * person's bound roster (sponsored by one of the caller's personas). The caller
 * owning the persona is enforced upstream in the route via the spine.
 *
 * Best-effort + soft-fail: if the 20260710000000 migration is not yet applied,
 * every call no-ops/soft-fails and callers fall back to is_aigent_me — exactly
 * like delegationGrantStore. T0 discipline: persona_id + agent_root_id are
 * server-internal.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export type AssignmentRole = 'aigentMe' | 'delegate';

export interface PersonaAgentAssignmentRow {
  id: string;
  persona_id: string;
  agent_root_id: string;
  role: AssignmentRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const MISSING = 'persona_agent_assignments';

function softFail(scope: string, message: string): void {
  if (message.includes(MISSING)) {
    console.warn(`[persona assignments] migration 20260710000000 not applied; ${scope} skipped`);
  } else {
    console.error(`[persona assignments] ${scope} failed:`, message);
  }
}

/** List a persona's active assignments (aigentMe first, then newest). */
export async function listAssignments(personaId: string): Promise<PersonaAgentAssignmentRow[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  try {
    const { data, error } = await admin
      .from('persona_agent_assignments')
      .select('*')
      .eq('persona_id', personaId)
      .eq('active', true)
      .order('role', { ascending: true }) // 'aigentMe' < 'delegate' alphabetically
      .order('created_at', { ascending: false });
    if (error) {
      softFail('list', error.message);
      return [];
    }
    return (data ?? []) as PersonaAgentAssignmentRow[];
  } catch (e) {
    softFail('list', e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * The set of agent_root_identity ids the caller may assign to a persona — the
 * PERSON's bound roster (agents sponsored by any of the given owned personas).
 * The route passes the resolved owned-persona ids; assignment is refused for any
 * agent not in this set.
 */
async function personBoundAgentIds(ownedPersonaIds: string[]): Promise<Set<string>> {
  const admin = getSupabaseServer();
  if (!admin || ownedPersonaIds.length === 0) return new Set();
  const { data } = await admin
    .from('agent_root_identity')
    .select('id')
    .in('sponsor_persona_id', ownedPersonaIds);
  return new Set((data ?? []).map((r) => String(r.id)));
}

export type AssignResult =
  | { ok: true; assignment: PersonaAgentAssignmentRow }
  | { ok: false; code: 'not_bound' | 'migration_pending' | 'error'; error: string };

/**
 * Assign a bound agent to a persona. If role='aigentMe', the persona's prior
 * aigentMe (if any) is first demoted to 'delegate' so the single-aigentMe
 * invariant holds. Idempotent per (persona, agent): re-assigning updates role.
 */
export async function assignAgent(params: {
  personaId: string;
  agentRootId: string;
  role: AssignmentRole;
  ownedPersonaIds: string[];
}): Promise<AssignResult> {
  const { personaId, agentRootId, role, ownedPersonaIds } = params;
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, code: 'error', error: 'Supabase configuration missing' };

  // Validity: the agent must belong to the person (bound roster).
  const bound = await personBoundAgentIds(ownedPersonaIds);
  if (!bound.has(agentRootId)) {
    return { ok: false, code: 'not_bound', error: 'Agent is not bound to your citizen; it cannot be assigned.' };
  }

  try {
    // Enforce single aigentMe: demote the persona's current aigentMe first.
    if (role === 'aigentMe') {
      const demote = await admin
        .from('persona_agent_assignments')
        .update({ role: 'delegate', updated_at: new Date().toISOString() })
        .eq('persona_id', personaId)
        .eq('role', 'aigentMe')
        .neq('agent_root_id', agentRootId);
      if (demote.error && !demote.error.message.includes(MISSING)) {
        return { ok: false, code: 'error', error: demote.error.message };
      }
    }

    const { data, error } = await admin
      .from('persona_agent_assignments')
      .upsert(
        {
          persona_id: personaId,
          agent_root_id: agentRootId,
          role,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'persona_id,agent_root_id' },
      )
      .select('*')
      .single();
    if (error) {
      if (error.message.includes(MISSING)) return { ok: false, code: 'migration_pending', error: 'Assignment table not yet provisioned.' };
      return { ok: false, code: 'error', error: error.message };
    }
    return { ok: true, assignment: data as PersonaAgentAssignmentRow };
  } catch (e) {
    return { ok: false, code: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

/** Remove an agent's assignment from a persona. */
export async function unassignAgent(personaId: string, agentRootId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase configuration missing' };
  try {
    const { error } = await admin
      .from('persona_agent_assignments')
      .delete()
      .eq('persona_id', personaId)
      .eq('agent_root_id', agentRootId);
    if (error) {
      softFail('unassign', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
