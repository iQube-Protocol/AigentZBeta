/**
 * POST /api/financial-services/handoffs — the Differ × Financial Services
 * Bridge pilot, part 4 (issuance side).
 *
 * Same two-layer auth as the projection endpoint (Differ integration key +
 * spine principal resolution) — see
 * app/api/public/financial-services/projection/route.ts's header for why.
 * Body carries ONLY `{ actionRef, returnUrl }`; every other field on the
 * issued handoff is server-derived from a fresh observer read (see
 * services/handoffs/nativeActionHandoff.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { issueNativeActionHandoff } from '@/services/handoffs/nativeActionHandoff';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function differIntegrationAuthorized(req: NextRequest): boolean {
  const expected = process.env.DIFFER_INTEGRATION_API_KEY;
  if (!expected) return false;
  const presented = req.headers.get('x-differ-integration-key');
  return typeof presented === 'string' && presented.length > 0 && presented === expected;
}

export async function POST(req: NextRequest) {
  if (!differIntegrationAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: 'Differ integration not authorized for this environment.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const persona = await getActivePersona(req);
  if (!persona?.personaId || !persona.authProfileId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'Handoff issuance is unavailable — no data store configured in this environment.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { actionRef?: string; returnUrl?: string; projectionId?: string };
  const actionRef = body.actionRef?.trim();
  const returnUrl = body.returnUrl?.trim();
  if (!actionRef || !returnUrl) {
    return NextResponse.json(
      { ok: false, error: 'actionRef and returnUrl are required.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await issueNativeActionHandoff(
    admin,
    { personaId: persona.personaId, authProfileId: persona.authProfileId },
    { actionRef, returnUrl, projectionRef: body.projectionId ?? null },
  );

  if (!result.ok) {
    const status = result.reason === 'action-not-eligible' || result.reason === 'invalid-return-url' ? 400 : 500;
    return NextResponse.json({ ok: false, error: result.detail, reason: result.reason }, { status, headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json(
    { ok: true, handoffId: result.handoffId, expiresAt: result.expiresAt },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  );
}
