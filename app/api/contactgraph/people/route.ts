/**
 * GET/POST /api/contactgraph/people — ContactGraph's real, callable list
 * surface for aigentMe's People capsule (QubeTalk Fast-Follow, priority
 * step 3). GET goes through the SAME contained-capability projection seam
 * QubeTalk's own /api/qubetalk/projection route uses
 * (services/contactGraph/projection.ts, capability:'contacts') — never a
 * direct read of contact_persons/contact_personas/contact_endpoints.
 *
 * Before projecting, GET lazily reconciles any newly-confirmed
 * persona_contacts rows that have not yet been projected into ContactGraph
 * (reconcileConfirmedPersonaContacts is idempotent — it only touches rows
 * with promoted_contact_person_id IS NULL, so repeated calls are cheap).
 * This is what makes aigentMe's People view show REAL data (the operator's
 * existing saved contacts) from the first load, without requiring a
 * separate manual backfill step.
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

  // Lazy backfill — best-effort; a failure here must not block the read
  // (the read still returns whatever ContactGraph already has).
  await reconcileConfirmedPersonaContacts(owner.value, persona.personaId);

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
