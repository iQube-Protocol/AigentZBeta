/**
 * GET/POST /api/contactgraph/people — ContactGraph's real, callable list
 * surface for aigentMe's People capsule (QubeTalk Fast-Follow, priority
 * step 3). GET goes through the SAME contained-capability projection seam
 * QubeTalk's own /api/qubetalk/projection route uses
 * (services/contactGraph/projection.ts, capability:'contacts') — never a
 * direct read of contact_persons/contact_personas/contact_endpoints.
 *
 * Before projecting, GET lazily reconciles a bounded PAGE of newly-confirmed
 * persona_contacts rows that have not yet been projected into ContactGraph
 * (reconcileConfirmedPersonaContacts is idempotent and endpoint-aware — it
 * only touches rows with projection_state = 'pending', so repeated calls are
 * cheap and never re-attempt rows already known 'ineligible'/'ambiguous').
 * This is what makes aigentMe's People view show REAL data (the operator's
 * existing saved contacts) from the first load, without requiring a
 * separate manual backfill step.
 *
 * The call is intentionally bounded (a fixed page size, no cursor threaded
 * through this route) rather than either the old unbounded full-backlog scan
 * or dropping reconciliation from this route entirely: because a projected
 * row's projection_state flips to 'projected' and stops matching the
 * 'pending' filter, each subsequent GET naturally reconciles the NEXT page
 * of the backlog — the projection_state column itself is the resume point,
 * with no cursor to persist across requests. For a persona with a large
 * backlog (1,200+ rows observed live), the People view still shows whatever
 * has been projected so far immediately, and catches up incrementally over
 * a handful of page loads rather than blocking one request on the whole
 * backlog.
 *
 * Auth: spine (getActivePersona) — the resolved caller IS the owning
 * principal; ownership is further resolved to owner_auth_profile_id
 * (services/contactGraph/ownerResolution.ts) before touching any
 * ContactGraph table, exactly as every ContactGraph service requires.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveOwnerAuthProfileId } from '@/services/contactGraph/ownerResolution';
import { reconcileConfirmedPersonaContacts } from '@/services/contactGraph/reconciliation';
import { requestContactGraphProjection } from '@/services/contactGraph/projection';
import { createContactPerson } from '@/services/contactGraph/contactPersons';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const owner = await resolveOwnerAuthProfileId(persona.personaId);
  if (!owner.ok) return NextResponse.json({ ok: false, error: owner.error }, { status: 500, headers: NO_STORE });

  // Lazy backfill — bounded to one page per request; best-effort, a failure
  // here must not block the read (the read still returns whatever
  // ContactGraph already has). See the header above for why no cursor needs
  // to be threaded through this route.
  await reconcileConfirmedPersonaContacts(owner.value, persona.personaId, { limit: 200 });

  const result = await requestContactGraphProjection(persona.personaId, {
    capability: 'contacts',
    projection: 'full',
    scope: { contactPersonIds: 'all' },
    requestingSurface: 'aigentme',
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ ok: true, people: result.value.people }, { headers: NO_STORE });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  const body = await req.json().catch(() => null);
  const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
  if (!displayName) return NextResponse.json({ ok: false, error: 'displayName is required' }, { status: 400, headers: NO_STORE });

  const owner = await resolveOwnerAuthProfileId(persona.personaId);
  if (!owner.ok) return NextResponse.json({ ok: false, error: owner.error }, { status: 500, headers: NO_STORE });

  const created = await createContactPerson(owner.value, { displayName });
  if (!created.ok) return NextResponse.json({ ok: false, error: created.error }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ ok: true, person: created.value }, { headers: NO_STORE });
}
