/**
 * /api/video/invariant-brief — invariant-grounded video brief (CFS-011 §6, CFS-012).
 *
 * POST { groundings: { collectionId?, invariantIds?, role }[], segmentCount,
 *        productionTitle?, useLlm? }
 *
 * groundings: role='style' → one shared continuity block; role='narrative'
 * → sequential beats mapped proportionally onto segments (fixed arc order);
 * any other role → semantic invariants distributed round-robin. Output is
 * for direct use as SkillVideoPlayer's `segment_prompts`. Spine-gated; any
 * authenticated persona may compose a brief (a Studio creative tool, not a
 * constitutional write) — publishing/canonizing invariants remains
 * admin-gated elsewhere.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { buildVideoInvariantBrief, type GroundingRef } from '@/services/video/invariantVideoBrief';

export const dynamic = 'force-dynamic';

interface BriefBody {
  groundings?: GroundingRef[];
  segmentCount?: number;
  productionTitle?: string;
  useLlm?: boolean;
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: BriefBody;
  try {
    body = (await request.json()) as BriefBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

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
  const segmentCount = Number(body.segmentCount);
  if (!Number.isInteger(segmentCount) || segmentCount < 1 || segmentCount > 8) {
    return NextResponse.json({ error: 'segmentCount must be an integer between 1 and 8' }, { status: 400 });
  }

  try {
    const brief = await buildVideoInvariantBrief({
      groundings: body.groundings,
      segmentCount,
      productionTitle: body.productionTitle,
      useLlm: body.useLlm,
    });
    return NextResponse.json({ ok: true, brief });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'brief_failed';
    console.error('[api/video/invariant-brief] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
