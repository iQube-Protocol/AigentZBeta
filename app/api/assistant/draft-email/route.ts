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
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

interface PostBody {
  prompt?: string;
  intentId?: string;
  /**
   * Optional list of artifacts already produced in the current workflow
   * (e.g. a Slides deck created by the operator moments before clicking
   * "Draft for me" on the Gmail composer). The drafter weaves their
   * URLs inline when the body references them — see the ATTACHMENT URL
   * RULE in services/agents/draftEmail.ts.
   */
  relatedArtifacts?: Array<{
    artifactType?: unknown;
    title?: unknown;
    locationUrl?: unknown;
  }>;
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

  // Sanitise relatedArtifacts — only carry forward entries where all
  // three fields are present and locationUrl is a real http(s) URL.
  // Anything else is dropped silently so a malformed entry can't
  // poison the LLM prompt.
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
    if (cleaned.length > 0) draftCtx.relatedArtifacts = cleaned;
  }

  // Contact lookup — extract candidate names from the prompt and resolve
  // email address from persona_contacts so the To field pre-populates.
  // Pattern: "to <Name>", "for <Name>", words starting with uppercase.
  // We take the first contact match (most-relevant contact for the prompt).
  if (!draftCtx.recipientEmail) {
    try {
      const supabase = getSupabaseServer();
      // Strip common email meta-words and extract capitalised tokens as name candidates
      const stopWords = /\b(draft|send|email|an?|the|to|for|re|about|regarding|follow|up|again|resend|reply|write|compose|create|from|with|on|of|at|and|or|message|note|letter)\b/gi;
      const nameCandidates = prompt
        .replace(stopWords, ' ')
        .replace(/[^\w\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 2)
        .slice(0, 6);

      if (nameCandidates.length > 0) {
        const q = nameCandidates.map(w => w + ':*').join(' | ');
        const { data } = await supabase
          .from('persona_contacts')
          .select('display_name, email')
          .eq('persona_id', context.personaId)
          .not('email', 'is', null)
          .textSearch('fts', q, { config: 'english', type: 'plain' })
          .limit(1);
        if (data && data[0]?.email) {
          draftCtx.recipientEmail = data[0].email as string;
          draftCtx.recipientName = data[0].display_name as string | undefined;
        }
      }
    } catch {
      // Soft-fail — draft still works without the lookup.
    }
  }

  const draft = await draftEmail({ prompt, context: draftCtx });

  return NextResponse.json(draft, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
