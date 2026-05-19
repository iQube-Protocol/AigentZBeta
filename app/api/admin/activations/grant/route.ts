/**
 * POST /api/admin/activations/grant
 *
 * Admin-only. Grants a gated activation to a target persona. Cohort
 * grants are the same operation with a `cohortId` set (the CRM-side
 * cohort table is stubbed for now — this just stamps a string).
 *
 * Body: { targetPersonaId: string; activationId: string; cohortId?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { adminGrant } from '@/services/activations/personaActivations';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context || !context.cartridgeFlags?.isAdmin) {
    return NextResponse.json(
      { error: 'admin-required' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  let body: { targetPersonaId?: unknown; activationId?: unknown; cohortId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: 'invalid-json' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const targetPersonaId = typeof body.targetPersonaId === 'string' ? body.targetPersonaId : null;
  const activationId = typeof body.activationId === 'string' ? body.activationId : null;
  const cohortId = typeof body.cohortId === 'string' ? body.cohortId : undefined;
  if (!targetPersonaId || !activationId) {
    return NextResponse.json(
      { error: 'missing-fields', detail: 'targetPersonaId and activationId are required' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const result = await adminGrant(targetPersonaId, activationId, {
    cohortId,
    inviterPersonaId: context.personaId,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: 'grant-failed', detail: result.reason },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
