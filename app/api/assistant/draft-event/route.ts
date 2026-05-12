/**
 * POST /api/assistant/draft-event
 *
 * Aigent Me Phase 6.b Part 2.5c — Calendar drafter.
 *
 * Body: { prompt: string; intentId?: string; timeZone?: string }
 *
 * Returns the DraftCalendarOutput shape. Privacy: only T1 context flows
 * to the LLM; personaId stays server-side.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getExperienceQube } from '@/services/iqube/experienceQube';
import { getIntentQube } from '@/services/iqube/intentQube';
import { draftCalendarEvent, type DraftCalendarContext } from '@/services/agents/draftCalendarEvent';

export const dynamic = 'force-dynamic';

interface PostBody {
  prompt?: string;
  intentId?: string;
  timeZone?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  const prompt = (body.prompt ?? '').trim();
  if (!prompt) {
    return NextResponse.json(
      { error: 'missing-prompt' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const draftCtx: DraftCalendarContext = {};
  try {
    const experience = await getExperienceQube(context.personaId);
    if (experience) {
      draftCtx.experience = {
        experienceName: experience.meta.experienceName,
        primaryGoal: experience.meta.primaryGoal,
        experienceType: experience.meta.experienceType,
        currentStage: experience.meta.currentStage,
      };
      if (experience.meta.activeCartridges?.length) {
        draftCtx.activeCartridge = experience.meta.activeCartridges[0];
      }
    }
  } catch { /* soft-fail */ }
  if (body.intentId) {
    try {
      const intent = await getIntentQube(body.intentId);
      if (intent) draftCtx.intentName = intent.intentName;
    } catch { /* soft-fail */ }
  }

  const draft = await draftCalendarEvent({
    prompt,
    context: draftCtx,
    timeZone: body.timeZone,
  });
  return NextResponse.json(draft, { headers: { 'Cache-Control': 'no-store' } });
}
