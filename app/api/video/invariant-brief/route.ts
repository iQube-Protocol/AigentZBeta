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
import { validateVideoBriefCoherence } from '@/services/coherence';
import { buildVideoInvariantBrief, type GroundingRef } from '@/services/video/invariantVideoBrief';
import { resolveOntology } from '@/services/constitutional/ontologyResolver';
import { citeInvariants } from '@/services/invariants/grounding';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

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
    // CFS-014 §7 — the Coherence Engine sits between Composition and
    // Rendering: the brief ships with its CoherenceResult so the renderer
    // (and the operator) see pass/violations before any generation runs.
    const coherence = validateVideoBriefCoherence(brief);

    // Phase 1B (CFS-015): the rendering surface completes the constitutional
    // cycle — Ontology (output-side drift check over the COMPOSED prose),
    // Validation (coherence above), Receipt (invariants_used), Learning
    // (Reach citation). All best-effort: the brief never blocks on them.
    const composedProse = [
      brief.continuityBlock,
      ...brief.segments.map((seg) => seg.prompt),
    ].join('\n');
    const ontology = await resolveOntology(composedProse).catch((err) => {
      console.warn('[api/video/invariant-brief] ontology resolution failed (non-fatal):', err);
      return null;
    });
    if (ontology && ontology.unresolved.length > 0) {
      console.warn(
        `[api/video/invariant-brief] non-canonical terms in composed brief: ${ontology.unresolved.join(', ')}`,
      );
    }

    const invariantsUsed = Array.from(
      new Set([
        ...brief.styleInvariantIds,
        ...brief.narrativeInvariantIds,
        ...brief.semanticInvariantIds,
      ]),
    );
    // Reach (Law XII): a render that consumes invariants is adoption.
    void citeInvariants(invariantsUsed).catch(() => {});
    // Receipt: T2-safe summary — counts + CCS only, no identifiers.
    void createActivityReceipt({
      personaId: persona.personaId,
      actionType: 'experience_render_validated',
      summary: `invariant video brief validated — segments=${brief.segments.length} ccs=${coherence.constitutionalScore ?? 'n/a'} pass=${coherence.pass} invariants=${invariantsUsed.length}${ontology ? ` ontologyUnresolved=${ontology.unresolved.length}` : ''}`,
      activeCartridge: 'agentiq',
      invariantsUsed,
    }).catch((err) => {
      console.warn('[api/video/invariant-brief] receipt failed (non-fatal):', err);
      return null;
    });

    return NextResponse.json({
      ok: true,
      brief,
      coherence,
      ...(ontology
        ? { ontology: { resolvedTerms: ontology.resolvedTerms, unresolved: ontology.unresolved, canonVersion: ontology.canonVersion } }
        : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'brief_failed';
    console.error('[api/video/invariant-brief] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
