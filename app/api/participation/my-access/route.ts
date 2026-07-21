/**
 * GET /api/participation/my-access — the caller's OWN participation state
 * (Constitutional Access Service, participant self-view). Spine-authenticated.
 *
 * Powers the IRL Welcome home screen's observer awareness AND the accession
 * progress bar: which access domains/roles the signed-in persona holds, whether
 * they have a passport, and whether they have an active delegation — so the
 * onboarding surfaces stop re-surfacing done steps and instead point deeper.
 *
 * This is the SINGLE active-persona source of truth for those surfaces. It
 * exists because the progress bar previously read passport (wallet), access
 * (here), and delegation (a persona_id-keyed route) from THREE endpoints with
 * three persona resolutions — the delegation one took a CLIENT-supplied
 * persona_id that mismatched the server's active persona, leaving the Delegate
 * step stuck even with an active delegation (operator report 2026-07-20).
 * Resolving all three from getActivePersona here removes that whole class.
 *
 * Owner self-view: returns the caller's own state only, as booleans/roles. No
 * persona identifier of any tier is serialised — everything is keyed to the
 * caller themselves.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolvePersonhood } from '@/services/identity/personhoodResolver';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { hasActiveDelegation } from '@/services/delegation/delegationGrantStore';

export const dynamic = 'force-dynamic';

/**
 * DidQube observation levels (operator ratification 2026-07-20): each
 * credential is observed at ITS DidQube class, never flattened onto the
 * active persona:
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
 * Flattening passport/access onto the active persona was the 2026-07-20
 * observer regression: switching personas made a genuinely-held passport
 * read as absent. Composition only — no spine file is modified here.
 */
export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json(
      { ok: true, authenticated: false, grants: [], passportIssued: false, delegationActive: false },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  // Personhood set — T0, server-internal only. Never serialised; every field
  // returned below is a boolean or role string keyed to the caller themselves.
  const personhood = await resolvePersonhood(req, admin, {
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
  const grants = error ? [] : (data ?? []).map((g) => ({
    accessDomain: String(g.access_domain),
    role: String(g.role),
    grantedAt: String(g.granted_at),
  }));

  // PASSPORT — kybe/personhood-level. A record is the person's when EITHER
  // key matches: spine persona_id (spine-path issuance) OR did_persona_id
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
  // person's personas = delegated. Active persona first (fast path); the
  // acting context — and the identifiability the agent inherits — remains
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

  return NextResponse.json(
    { ok: true, authenticated: true, grants, passportIssued, delegationActive },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
