/**
 * GET /api/participation/my-access — the caller's OWN participation state
 * (Constitutional Access Service, participant self-view). Spine-authenticated.
 *
 * Powers the IRL Welcome home screen's observer awareness: which access
 * domains/roles the signed-in persona holds, so the surface can stop
 * re-surfacing onboarding once they're in and instead point deeper.
 *
 * Owner self-view: returns the caller's own roles/domains only. No persona
 * identifier of any tier is serialised — the roles are the caller's, keyed
 * to nothing but themselves.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: true, authenticated: false, grants: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const { data, error } = await admin
    .from('access_grants')
    .select('access_domain, role, status, granted_at')
    .eq('persona_id', persona.personaId)
    .eq('status', 'active');

  // Pre-migration / no grants → clean empty state (still "authenticated").
  const grants = error ? [] : (data ?? []).map((g) => ({
    accessDomain: String(g.access_domain),
    role: String(g.role),
    grantedAt: String(g.granted_at),
  }));

  return NextResponse.json(
    { ok: true, authenticated: true, grants },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
