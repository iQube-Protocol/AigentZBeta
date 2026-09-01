/**
 * POST /api/journey/experience-observation
 *
 * AEE-XP-001 §10/XP-6 (2026-09-01) — the ONE generic HTTP boundary for
 * promoting an observed experience interaction into durable evidence
 * (services/journey/experienceObservationPromotion.ts). Every surface that
 * needs "the person actually interacted with this experience" evidence
 * calls this SAME route with its own journeyId/stageId — never a
 * stage-specific endpoint.
 *
 * Auth required: an observation is attributed to the caller's own persona,
 * never a passed-in personaId (that would let one caller write evidence
 * for another). Same pattern as every other persona-scoped write route in
 * this codebase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { promoteExperienceObservation } from '@/services/journey/experienceObservationPromotion';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    return await postImpl(req);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error: `This request threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}.`,
      },
      { status: 500 },
    );
  }
}

async function postImpl(req: NextRequest) {
  const persona = await getActivePersona(req).catch(() => null);
  if (!persona?.personaId) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'PERSONA_REQUIRED',
        error: 'Observing an experience interaction requires an active persona.',
      },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const journeyId = typeof body?.journeyId === 'string' ? body.journeyId : null;
  const stageId = typeof body?.stageId === 'string' ? body.stageId : null;
  const surfaceRef = typeof body?.surfaceRef === 'string' ? body.surfaceRef : null;

  if (!journeyId || !stageId) {
    return NextResponse.json(
      { ok: false, refusalCode: 'MISSING_FIELDS', error: 'journeyId and stageId are required.' },
      { status: 400 },
    );
  }

  await promoteExperienceObservation({
    personaId: persona.personaId,
    journeyId,
    stageId,
    surfaceRef,
  });

  return NextResponse.json({ ok: true });
}
