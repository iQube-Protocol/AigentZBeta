/**
 * POST /api/public/irl/resolve — the PUBLIC, read-only projection of the
 * Invariant Resolution Engine (IRE, CFS-037) + Invariant Projection Engine
 * (IPE, CFS-039) for an arbitrary intent. Anonymous-safe sibling of the
 * spine-gated `/api/invariants/resolve` (CFS-041 / PRD-CFO-001).
 *
 * WHY THIS IS A NEW ROUTE, NOT A WEAKENED GATE (CLAUDE.md PARAMOUNT):
 * the gated `/api/invariants/resolve` stays exactly as-is (it resolves the
 * caller through the spine ONLY for the auth check, never to filter the data —
 * see its own header: "the resolved field carries no persona data"). This is a
 * NEW public surface that calls the SAME `resolveConstitutionalField` and
 * returns the SAME T2-safe projection (invariant statements/scores/coordinates
 * only — never a personaId or any T0 identifier). No access gate is removed;
 * a read-only endpoint publishes already-persona-free data through a live API,
 * exactly as `/api/public/irl/{invariants,invariant-field}` do.
 *
 * Purpose: lets the Stage-0 instrument-validation harness (IRV-001 / IPV-001)
 * and any independent replicator (EXP-P1 §13) run the IRE/IPE without IRL
 * mediation. READ-ONLY, no writes, no credentials, no persona resolution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveConstitutionalField, describeResolvedField } from '@/services/invariants/resolution';
import { operationalBasis, researchBasis, vectorsByClass } from '@/services/invariants/coordinates';
import { compareProjection, describeProjection } from '@/services/invariants/projectionBridge';
import { DIMENSION_INVARIANT_SEED } from '@/services/invariants/nodes/discoveryRanking';

export const dynamic = 'force-dynamic';

const PUBLIC_INTENT_MAXLEN = 2000;

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const intent = String(body?.intent ?? '').trim().slice(0, PUBLIC_INTENT_MAXLEN);
  if (!intent) {
    return NextResponse.json({ ok: false, error: 'intent required' }, { status: 400 });
  }
  const domains = Array.isArray(body?.domains)
    ? (body?.domains as unknown[]).filter((d): d is string => typeof d === 'string')
    : undefined;

  const field = await resolveConstitutionalField(intent, domains ? { domains } : undefined);
  const ipe = compareProjection(field, DIMENSION_INVARIANT_SEED);

  return NextResponse.json({
    ok: true,
    public: true,
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
      constitutional: c.constitutional,
    })),
    invariantCount: field.coordinates.length,
    citedCount: field.citedIds.length,
    citedIds: field.citedIds,
    describe: describeResolvedField(field),
    ipeProjection: {
      node: 'discovery.ranking',
      standing: ipe.standing,
      coordinates: ipe.coordinates,
      meanAbsDelta: Math.round(ipe.meanAbsDelta * 10000) / 10000,
      diverges: ipe.diverges,
      describe: describeProjection(ipe),
    },
    basis: {
      operational: operationalBasis().map((v) => ({ key: v.key, class: v.class })),
      researchCount: researchBasis().length,
      byClass: {
        structural: vectorsByClass('structural').length,
        constitutional: vectorsByClass('constitutional').length,
        operational: vectorsByClass('operational').length,
      },
    },
    note: 'Public IRE/IPE resolve (CFS-037/039/041) — persona-free, read-only. For instrument validation (IRV-001/IPV-001) + independent replication.',
  });
}
