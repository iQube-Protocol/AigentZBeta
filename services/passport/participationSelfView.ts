/**
 * participationSelfView.ts — the caller's OWN participation state, resolved once.
 *
 * This is the extracted body of `GET /api/participation/my-access` (2026-07-20),
 * lifted verbatim into a service so a SECOND consumer (the SPEC-COS-001
 * substrate-state resolver, `services/onboarding/substrateState.ts`) reads the
 * same passport / access / delegation observation instead of re-deriving it.
 * Re-deriving it would be exactly the CS-001 duplicate-capability defect class,
 * and the 2026-07-20 incident this logic exists to fix (three endpoints, three
 * persona resolutions, a Delegate step stuck green-less) is the proof of what
 * that costs.
 *
 * DidQube observation levels (operator ratification 2026-07-20): each credential
 * is observed at ITS DidQube class, never flattened onto the active persona:
 *
 *   - PASSPORT — KYBE-driven (proof-of-life class; World ID as humanity
 *     verification). Held by the PERSON: observed across the kybe chain
 *     (root_identity → did_persona) AND the person's spine personas (legacy
 *     persona_id-keyed records) — see services/identity/personhoodResolver.
 *   - ACCESS — citizen-level access rights sit at the PERSONHOOD level →
 *     observed across the person's personas.
 *   - DELEGATION — the bounded agent is BOUND TO THE CITIZEN'S PASSPORT
 *     (person-level binding) but ACTS THROUGH a persona and inherits that
 *     persona's identifiability state. Observation ("has the person
 *     delegated?") is therefore person-level; the acting context — and the
 *     identifiability the agent inherits — is persona-scoped at act time.
 *
 * Doctrine (operator, 2026-07-20): the person remains ANONYMOUS by default —
 * identity is surfaced only via the persona — while STANDING ACCRUES TO THE
 * PERSON. The passport is what enables continuity of personhood anonymously.
 *
 * Owner self-view: every field returned is a boolean or a role string keyed to
 * the caller themselves. No persona identifier of any tier is returned.
 * Composition only — no spine file is modified here.
 */

import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolvePersonhood } from '@/services/identity/personhoodResolver';
import { hasActiveDelegation } from '@/services/delegation/delegationGrantStore';

export interface ParticipationGrantView {
  accessDomain: string;
  role: string;
  grantedAt: string;
}

export interface ParticipationSelfView {
  grants: ParticipationGrantView[];
  passportIssued: boolean;
  delegationActive: boolean;
}

/**
 * Resolve the caller's own participation state. The caller MUST already have
 * been resolved through the spine (`getActivePersona`) — this function takes the
 * resolved T0 ids rather than re-resolving, so there is exactly one persona
 * resolution per request and two consumers can never disagree about who asked.
 */
export async function resolveParticipationSelfView(
  request: NextRequest,
  admin: SupabaseClient,
  persona: { personaId: string; authProfileId: string },
): Promise<ParticipationSelfView> {
  // Personhood set — T0, server-internal only. Never serialised.
  const personhood = await resolvePersonhood(request, admin, {
    authProfileId: persona.authProfileId,
    activePersonaId: persona.personaId,
  });

  // ACCESS — person-level (grant issued to the person via persona/passport).
  const { data, error } = await admin
    .from('access_grants')
    .select('access_domain, role, status, granted_at')
    .in('persona_id', personhood.spinePersonaIds)
    .eq('status', 'active');

  // Pre-migration / no grants → clean empty state (still "authenticated").
  const grants: ParticipationGrantView[] = error
    ? []
    : (data ?? []).map((g) => ({
        accessDomain: String(g.access_domain),
        role: String(g.role),
        grantedAt: String(g.granted_at),
      }));

  // PASSPORT — kybe/personhood-level. A record is the person's when EITHER key
  // matches: spine persona_id (spine-path issuance) OR did_persona_id
  // (bureau-minted kybe chain). Best-effort — a missing table pre-migration
  // reads as "no passport".
  let passportIssued = false;
  try {
    let q = admin.from('polity_passport_records').select('passport_id').limit(1);
    if (personhood.didPersonaIds.length > 0) {
      q = q.or(
        `persona_id.in.(${personhood.spinePersonaIds.join(',')}),did_persona_id.in.(${personhood.didPersonaIds.join(',')})`,
      );
    } else {
      q = q.in('persona_id', personhood.spinePersonaIds);
    }
    const { data: pp } = await q;
    passportIssued = Array.isArray(pp) && pp.length > 0;
  } catch {
    /* pre-migration → false */
  }

  // DELEGATION — the bounded agent is bound to the citizen's PASSPORT
  // (person-level), so observation is person-level: delegated via ANY of the
  // person's personas = delegated. Active persona first (fast path); the acting
  // context — and the identifiability the agent inherits — remains
  // persona-scoped at act time.
  let delegationActive = await hasActiveDelegation(persona.personaId);
  if (!delegationActive) {
    for (const pid of personhood.spinePersonaIds) {
      if (pid === persona.personaId) continue;
      if (await hasActiveDelegation(pid)) {
        delegationActive = true;
        break;
      }
    }
  }

  return { grants, passportIssued, delegationActive };
}
