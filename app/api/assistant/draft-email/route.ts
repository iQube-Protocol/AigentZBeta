/**
 * POST /api/assistant/draft-email
 *
 * Aigent Me Phase 6.b Part 2.5b — chief-of-staff drafting.
 *
 * Body:
 *   { prompt: string;             // "thank Alice for the call yesterday"
 *     intentId?: string;          // links to a queued NBE for intent context
 *   }
 *
 * Returns:
 *   { to, cc, bcc, subject, bodyText, rationale, source: 'llm' | 'template' }
 *
 * The route assembles the persona's T1-safe context (display label,
 * ExperienceQube meta slice, optional intent name) and calls the
 * draftEmail service. The service tries the live OpenAI call first and
 * degrades to a deterministic template when no key is present.
 *
 * Privacy: personaId is T0; never returned. Only T1 surface is used in
 * the LLM prompt.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getExperienceQube } from '@/services/iqube/experienceQube';
import { getIntentQube } from '@/services/iqube/intentQube';
import { draftEmail, type DraftEmailContext } from '@/services/agents/draftEmail';

export const dynamic = 'force-dynamic';

interface PostBody {
  prompt?: string;
  intentId?: string;
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
    return NextResponse.json(
      { error: 'invalid-json' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  const prompt = (body.prompt ?? '').trim();
  if (!prompt) {
    return NextResponse.json(
      { error: 'missing-prompt', detail: 'prompt is required (one sentence describing the email).' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Assemble T1-safe context. All lookups degrade to undefined on missing
  // tables — the draft service handles partial context cleanly. The
  // persona display label is deferred to a follow-up; the spine resolves
  // it separately from ActivePersonaContext.
  const draftCtx: DraftEmailContext = {};

  try {
    const experience = await getExperienceQube(context.personaId);
    if (experience) {
      draftCtx.experience = {
        experienceName: experience.meta.experienceName,
        primaryGoal: experience.meta.primaryGoal,
        experienceType: experience.meta.experienceType,
        currentStage: experience.meta.currentStage,
      };
      // Surface the first active cartridge for tone hint.
      if (experience.meta.activeCartridges?.length) {
        draftCtx.activeCartridge = experience.meta.activeCartridges[0];
      }
    }
  } catch {
    // Soft-fail; LLM still drafts on whatever context is available.
  }

  if (body.intentId) {
    try {
      const intent = await getIntentQube(body.intentId);
      if (intent) draftCtx.intentName = intent.intentName;
    } catch {
      // Soft-fail.
    }
  }

  const draft = await draftEmail({ prompt, context: draftCtx });

  return NextResponse.json(draft, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
