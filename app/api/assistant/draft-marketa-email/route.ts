/**
 * POST /api/assistant/draft-marketa-email
 *
 * Aigent Me Phase 6.b Part 3 — Marketa drafter route.
 * Body: { prompt: string; intentId?: string }
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getExperienceQube } from '@/services/iqube/experienceQube';
import { getIntentQube } from '@/services/iqube/intentQube';
import { draftMarketaEmail, type DraftMarketaContext } from '@/services/agents/draftMarketaEmail';

export const dynamic = 'force-dynamic';

interface PostBody {
  prompt?: string;
  intentId?: string;
  /** See /api/assistant/draft-email for shape — same contract; the
   *  drafter inlines URLs when the body references them. */
  relatedArtifacts?: Array<{
    artifactType?: unknown;
    title?: unknown;
    locationUrl?: unknown;
  }>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  const prompt = (body.prompt ?? '').trim();
  if (!prompt) return NextResponse.json({ error: 'missing-prompt' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

  const ctx: DraftMarketaContext = {};
  try {
    const experience = await getExperienceQube(context.personaId);
    if (experience) {
      ctx.experience = {
        experienceName: experience.meta.experienceName,
        primaryGoal: experience.meta.primaryGoal,
        experienceType: experience.meta.experienceType,
        currentStage: experience.meta.currentStage,
      };
      if (experience.meta.activeCartridges?.length) ctx.activeCartridge = experience.meta.activeCartridges[0];
    }
  } catch { /* soft-fail */ }
  if (body.intentId) {
    try {
      const intent = await getIntentQube(body.intentId);
      if (intent) ctx.intentName = intent.intentName;
    } catch { /* soft-fail */ }
  }

  // Sanitise relatedArtifacts — mirror the draft-email route shape.
  if (Array.isArray(body.relatedArtifacts) && body.relatedArtifacts.length > 0) {
    const cleaned = body.relatedArtifacts
      .map((a) => ({
        artifactType: typeof a?.artifactType === 'string' ? a.artifactType.trim() : '',
        title: typeof a?.title === 'string' ? a.title.trim() : '',
        locationUrl: typeof a?.locationUrl === 'string' ? a.locationUrl.trim() : '',
      }))
      .filter(
        (a) =>
          a.artifactType.length > 0 &&
          a.title.length > 0 &&
          /^https?:\/\//i.test(a.locationUrl),
      )
      .slice(0, 5);
    if (cleaned.length > 0) ctx.relatedArtifacts = cleaned;
  }

  const draft = await draftMarketaEmail({ prompt, context: ctx });
  return NextResponse.json(draft, { headers: { 'Cache-Control': 'no-store' } });
}
