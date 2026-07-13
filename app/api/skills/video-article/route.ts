/**
 * POST /api/skills/video-article — the 24-second video + corresponding article
 * skill (Implementation Pack executed 2026-07-13, CFS-015 pipeline).
 *
 * Two modes (the pack's receipt plan maps one receipt to each):
 *   • default / `{ mode: 'plan' }` — build the 2-segment/24s invariant-grounded
 *     brief + coherence validation + the corresponding article (drafted from
 *     the SAME brief). Emits the ARTICLE receipt (`artifact_created`) on
 *     success — receipt plan item 2. The client then drives the (fixed)
 *     SkillVideoPlayer with { duration: 24, segment_prompts }.
 *   • `{ mode: 'video-complete', videoUrl, productionTitle? }` — called by the
 *     runner when the player reports the stitched video URL. Emits the VIDEO
 *     receipt (`artifact_created`) — receipt plan item 1.
 *
 * Gate: same as /api/video/invariant-brief — any authenticated persona (spine);
 * this is a Studio creative tool, not a constitutional write. T2-safe receipts:
 * titles, segment counts, url hosts — never a persona identifier.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import {
  buildVideoArticlePlan,
  VIDEO_ARTICLE_TOTAL_SECONDS,
  VIDEO_ARTICLE_SEGMENT_COUNT,
} from '@/services/skills/videoArticleSkill';
import type { GroundingRef } from '@/services/video/invariantVideoBrief';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface Body {
  mode?: string;
  groundings?: GroundingRef[];
  productionTitle?: string;
  useLlm?: boolean;
  videoUrl?: string;
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // ── Video completion — receipt plan item 1 ──
  if (body.mode === 'video-complete') {
    const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';
    if (!videoUrl) return NextResponse.json({ ok: false, error: 'videoUrl is required' }, { status: 400 });
    const receipt = await createActivityReceipt({
      personaId: persona.personaId,
      activeCartridge: 'studio',
      actionType: 'artifact_created',
      summary: `video-article skill: ${VIDEO_ARTICLE_TOTAL_SECONDS}s video generated (${VIDEO_ARTICLE_SEGMENT_COUNT} segments, stitched)${body.productionTitle ? ` — "${String(body.productionTitle).slice(0, 80)}"` : ''}`,
      contextShared: ['video-article-skill', 'video'],
    }).catch(() => null);
    return NextResponse.json({ ok: receipt !== null, videoReceiptId: receipt?.id ?? null });
  }

  // ── Plan — brief + article + coherence; receipt plan item 2 ──
  if (!Array.isArray(body.groundings) || body.groundings.length === 0) {
    return NextResponse.json({ error: 'groundings must be a non-empty array' }, { status: 400 });
  }
  for (const g of body.groundings) {
    if (!g || typeof g.role !== 'string' || (!g.collectionId && !g.invariantIds?.length)) {
      return NextResponse.json(
        { error: 'each grounding needs a role and either collectionId or invariantIds' },
        { status: 400 },
      );
    }
  }

  try {
    const plan = await buildVideoArticlePlan({
      groundings: body.groundings,
      productionTitle: typeof body.productionTitle === 'string' ? body.productionTitle : undefined,
      useLlm: body.useLlm,
    });

    // Article receipt — emitted only when the article actually exists.
    const receipt = plan.article.body
      ? await createActivityReceipt({
          personaId: persona.personaId,
          activeCartridge: 'studio',
          actionType: 'artifact_created',
          summary: `video-article skill: corresponding article generated (${plan.article.composedBy}${plan.article.model ? ` · ${plan.article.model}` : ''}) — "${plan.article.title.slice(0, 80)}"`,
          contextShared: ['video-article-skill', 'article'],
        }).catch(() => null)
      : null;

    return NextResponse.json({ ok: true, articleReceiptId: receipt?.id ?? null, ...plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'video_article_plan_failed';
    console.error('[api/skills/video-article] plan failed:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
