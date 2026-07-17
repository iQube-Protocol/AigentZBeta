/**
 * POST /api/invariants/resolve — the Constitutional Field Observatory's
 * Resolved-Field backbone (CFS-041 / PRD-CFO-001, Phase 0).
 *
 * Surfaces the Invariant Resolution Engine's output for an arbitrary intent
 * (CFS-037): the resolved region of the constitutional field + its calibrated
 * coordinates + the operational estimates + the CCR basis summary. Read-only,
 * observe-only — it RESOLVES a field (the IRE), it changes nothing.
 *
 * Spine-gated (any authenticated persona may observe — operators + researchers),
 * mirroring /api/invariants/observatory. T1-safe: invariant statements/scores +
 * coordinates only, never a personaId (the resolved field carries no persona data).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveConstitutionalField, describeResolvedField } from '@/services/invariants/resolution';
import { operationalBasis, researchBasis, vectorsByClass } from '@/services/invariants/coordinates';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const intent = String(body?.intent ?? '').trim();
  if (!intent) {
    return NextResponse.json({ ok: false, error: 'intent required' }, { status: 400 });
  }
  const domains = Array.isArray(body?.domains)
    ? (body?.domains as unknown[]).filter((d): d is string => typeof d === 'string')
    : undefined;

  const field = await resolveConstitutionalField(intent, domains ? { domains } : undefined);

  // T1-safe projection — statements/scores/coordinates only.
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    phase: field.phase,
    resolvedIntent: {
      text: field.resolvedIntent.text,
      domains: field.resolvedIntent.extraction.domains,
      qualificationConfidence: field.resolvedIntent.extraction.confidence,
    },
    confidence: field.confidence,
    operational: field.operational,
    coordinates: field.coordinates.map((c) => ({
      invariantId: c.invariantId,
      seedId: c.seedId,
      structural: c.structural,
      constitutional: c.constitutional, // null in Phase 0 (needs actor context — never faked)
    })),
    invariantCount: field.coordinates.length,
    citedCount: field.citedIds.length,
    describe: describeResolvedField(field),
    // The CCR basis summary — what the topography renders against (CFS-038).
    basis: {
      operational: operationalBasis().map((v) => ({ key: v.key, class: v.class, question: v.question })),
      researchCount: researchBasis().length,
      byClass: {
        structural: vectorsByClass('structural').length,
        constitutional: vectorsByClass('constitutional').length,
        operational: vectorsByClass('operational').length,
      },
    },
    note: 'CFO Resolved-Field view v0 (CFS-041) — the IRE-resolved region + coordinate calibration. Constitutional-class coordinates are null until the CCR supplies actor context (never faked). Read-only.',
  });
}
