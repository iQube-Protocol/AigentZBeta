/**
 * GET /api/access/whoami
 *
 * Operator/dev debug endpoint. Returns the full ActivePersonaContext (T0)
 * for the calling operator ONLY — so the operator can see exactly what
 * getActivePersona resolved for their session.
 *
 * Privacy stance: this endpoint deliberately exposes T0 (personaId,
 * authProfileId, etc.) to its OWN caller. The caller already has
 * implicit knowledge of their own identity — the endpoint never returns
 * another persona's context. Useful for debugging cases like
 * "I'm signed in as admin but isAdmin=false" without invasive log
 * harvesting.
 *
 * Auth: 401 unauthenticated.
 *
 * NOT a replacement for the public surface contract:
 *   - Routes that produce normal JSON responses must NEVER include T0.
 *     They return ActivePersonaSurface (T1 + flags only).
 *   - This endpoint is the single, deliberate exception, scoped to the
 *     authenticated caller's own context, and gated behind an admin-
 *     visible URL not published in product surfaces.
 *
 * Phase 1.4 helper. Intended for the dev-beta operator console only.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getMergedLinkedAuthProfileIds } from '@/services/wallet/multiEmailIdentity';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await getActivePersona(req);
  if (!ctx) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Surface the linked auth profile ids the multi-email merge produced —
  // useful when 'why is isAdmin=false?' needs to be traced.
  const linkedAuthProfileIds = await getMergedLinkedAuthProfileIds(ctx.authProfileId).catch(() => []);

  return NextResponse.json(
    {
      // T0 — exposed deliberately for the calling operator's own debug.
      personaId: ctx.personaId,
      authProfileId: ctx.authProfileId,
      linkedAuthProfileIds,
      identifiability: ctx.identifiability,
      cartridgeFlags: ctx.cartridgeFlags,
      cohortMemberships: ctx.cohortMemberships,
      source: ctx.source,
      hint:
        'If cartridgeFlags.isAdmin is false but you expect admin, check that ' +
        'crm_admin_roles has a row with is_active=true and auth_profile_id IN (' +
        [ctx.authProfileId, ...linkedAuthProfileIds].join(', ') + ').',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
