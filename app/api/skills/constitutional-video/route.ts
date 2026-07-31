/**
 * POST /api/skills/constitutional-video — the Constitutional Video experience
 * (Studio skill, ratified 2026-07-19). Grammar-bound micro-film plans at
 * 24/36/48 seconds; the operator supplies the content direction (blank
 * canvas), the grammar supplies the rules.
 *
 * Two modes (mirrors /api/skills/video-article):
 *   • default / `{ mode: 'plan' }` — build the grammar-bound plan (brief +
 *     cadence-scaffolded segment prompts + thresholds + voiceover + CTA
 *     ceremony) with coherence validation. Emits a plan receipt + operational
 *     artifact record. The client then drives SkillVideoPlayer with
 *     { duration: totalSeconds, segment_prompts } and the audio mux flow.
 *   • `{ mode: 'video-complete', videoUrl, ... }` — called by the runner when
 *     the stitched (voiced) video URL exists. Emits the video receipt +
 *     operational artifact record; accepts an optional `evaluation` evidence
 *     payload (bundle coherence score / opt-in judgement) to ride on the
 *     record.
 *
 * Gate: any authenticated persona (spine) — a Studio creative tool, not a
 * constitutional write. Operational tier + later promotion (operator decision
 * 2026-07-19). T2-safe receipts: titles, counts, grammar verdicts — never a
 * persona identifier.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { citeInvariants } from '@/services/invariants/grounding';
import {
  buildConstitutionalVideoPlan,
  CONSTITUTIONAL_DURATIONS,
  type ConstitutionalCta,
  type ConstitutionalDuration,
  type ContentDirection,
} from '@/services/skills/constitutionalVideoSkill';
import type { GroundingRef } from '@/services/video/invariantVideoBrief';
import { tierStudioArtifact, type StudioEvidenceFields } from '@/services/composer/studioArtifactTiering';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface Body {
  mode?: string;
  groundings?: GroundingRef[];
  contentDirection?: ContentDirection;
  durationSeconds?: number;
  cta?: ConstitutionalCta;
  productionTitle?: string;
  useLlm?: boolean;
  videoUrl?: string;
  segments?: number;
  evaluation?: StudioEvidenceFields | null;
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

  // ── Video completion ──
  if (body.mode === 'video-complete') {
    const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';
    if (!videoUrl) return NextResponse.json({ ok: false, error: 'videoUrl is required' }, { status: 400 });
    const segments = typeof body.segments === 'number' ? body.segments : null;
    const receipt = await createActivityReceipt({
      personaId: persona.personaId,
      activeCartridge: 'studio',
      actionType: 'artifact_created',
      summary: `constitutional video completed — ${segments ? `${segments} segments, ` : ''}stitched + voiced${body.productionTitle ? ` — "${String(body.productionTitle).slice(0, 80)}"` : ''}`,
      contextShared: ['constitutional-video-skill', 'video'],
    }).catch(() => null);
    const videoTier = await tierStudioArtifact({
      kind: 'studio.video.constitutional.completed',
      title: typeof body.productionTitle === 'string' ? body.productionTitle : 'Constitutional video',
      outputs: [{ url: videoUrl, label: 'stitched constitutional video' }],
      segments,
      evaluation: body.evaluation ?? null,
    });
    return NextResponse.json({
      ok: receipt !== null,
      videoReceiptId: receipt?.id ?? null,
      studioArtifactRecordId: videoTier.artifactRecordId ?? null,
    });
  }

  // ── Plan ──
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
  if (!CONSTITUTIONAL_DURATIONS.includes(body.durationSeconds as ConstitutionalDuration)) {
    return NextResponse.json({ error: `durationSeconds must be one of ${CONSTITUTIONAL_DURATIONS.join('/')}` }, { status: 400 });
  }
  if (typeof body.contentDirection?.subject !== 'string' || !body.contentDirection.subject.trim()) {
    return NextResponse.json(
      { error: 'contentDirection.subject is required — the skill is a blank canvas; describe what the video is about' },
      { status: 400 },
    );
  }
  if (typeof body.cta?.target !== 'string' || !body.cta.target.trim() || typeof body.cta?.claimLine !== 'string' || !body.cta.claimLine.trim()) {
    return NextResponse.json({ error: 'cta.target and cta.claimLine are required (operator-supplied)' }, { status: 400 });
  }

  try {
    const plan = await buildConstitutionalVideoPlan({
      groundings: body.groundings,
      contentDirection: body.contentDirection,
      durationSeconds: body.durationSeconds as ConstitutionalDuration,
      cta: body.cta,
      productionTitle: typeof body.productionTitle === 'string' ? body.productionTitle : undefined,
      useLlm: body.useLlm,
    });

    const invariantsUsed = [
      ...new Set([
        ...plan.brief.styleInvariantIds,
        ...plan.brief.narrativeInvariantIds,
        ...plan.brief.semanticInvariantIds,
      ]),
    ];
    // Reach (Law XII): a render that consumes invariants is adoption.
    void citeInvariants(invariantsUsed).catch(() => {});

    const receipt = await createActivityReceipt({
      personaId: persona.personaId,
      activeCartridge: 'studio',
      actionType: 'artifact_created',
      summary: `constitutional video plan — ${plan.totalSeconds}s/${plan.segmentCount} segments, grammar ${plan.grammar.pass ? 'pass' : `review (${plan.grammar.violations.length})`}${plan.coherence ? ` ccs=${plan.coherence.constitutionalScore ?? 'n/a'}` : ''} — "${plan.contentDirection.subject.slice(0, 80)}"`,
      contextShared: ['constitutional-video-skill', 'plan'],
    }).catch(() => null);

    const planTier = await tierStudioArtifact({
      kind: 'studio.video.constitutional.plan.completed',
      title: plan.contentDirection.subject.slice(0, 120),
      prompt: plan.contentDirection.subject,
      brief: plan.brief.continuityBlock,
      segments: plan.segmentCount,
      evaluation: body.evaluation ?? null,
    });

    return NextResponse.json({
      ok: true,
      planReceiptId: receipt?.id ?? null,
      studioArtifactRecordId: planTier.artifactRecordId ?? null,
      ...plan,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'constitutional_video_plan_failed';
    console.error('[api/skills/constitutional-video] plan failed:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
