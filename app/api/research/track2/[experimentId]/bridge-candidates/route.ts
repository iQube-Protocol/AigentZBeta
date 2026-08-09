/**
 * GET /api/research/track2/[experimentId]/bridge-candidates — Stage 9's
 * "Find valid bridge relationships" affordance (operator direction,
 * 2026-08-05: "identify candidate relationships between members in
 * different components using their existing evidence and invariant
 * content... Never invent an edge simply to satisfy readiness.").
 *
 * Reads the SAME intra-crystal edge set the readiness engine itself computes
 * (`fetchIntraCrystalEdges`/`connectedComponents`,
 * services/research/crystalReadiness.ts) — never a second graph read that
 * could disagree with what graph-connectivity actually measured. For each
 * non-largest component, asks `suggestRelationships` (Stage 7's existing
 * engine, unmodified) whether any of its members genuinely relate to a
 * member of the LARGEST component. Read-only advice; nothing is written
 * here — Accept goes through the existing `POST /api/invariants/[id]/edges`,
 * or the batch `POST .../accept-bridges` below for "Accept all".
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { listInvariants } from '@/services/invariants/store';
import { fetchIntraCrystalEdges, connectedComponents } from '@/services/research/crystalReadiness';
import { suggestRelationships } from '@/services/invariants/relationshipSuggestion';
import type { InvariantEdgeType } from '@/types/invariants';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Bounds how many members of smaller components get an LLM suggestion call per request. */
const MEMBER_SCAN_LIMIT = 10;
/** How many bridge proposals the queue renders. */
const MAX_RESULTS = 5;

export interface BridgeCandidateView {
  invariantAId: string;
  invariantAStatement: string;
  invariantBId: string;
  invariantBStatement: string;
  relationType: InvariantEdgeType;
  rationale: string;
  confidence: number;
  /** [smaller component's size, largest component's size] — what accepting this would join. */
  componentsJoined: [number, number];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  }

  const { experimentId } = await params;
  const declaration = crystalDomainForExperiment(experimentId);
  if (!declaration) {
    return NextResponse.json(
      { ok: false, error: `no crystal domain is declared for experiment '${experimentId}'` },
      { status: 404 },
    );
  }

  let invariants: Awaited<ReturnType<typeof listInvariants>>;
  try {
    invariants = await listInvariants({ domain: declaration.domain, status: ['validated', 'canonical'] });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `the crystal could not be read: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }

  const idToStatement = new Map(invariants.map((inv) => [inv.id, inv.statement]));
  const { pairs } = await fetchIntraCrystalEdges(invariants);
  const components = connectedComponents(invariants.map((inv) => inv.id), pairs).sort((a, b) => b.length - a.length);

  if (components.length <= 1) {
    return NextResponse.json(
      { ok: true, componentCount: components.length, largestComponentSize: components[0]?.length ?? 0, candidates: [] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const [largest, ...others] = components;
  const largestPool = largest.map((id) => ({ id, statement: idToStatement.get(id) ?? '' }));

  const results: BridgeCandidateView[] = [];
  let scanned = 0;
  outer: for (const component of others) {
    for (const memberId of component) {
      if (results.length >= MAX_RESULTS || scanned >= MEMBER_SCAN_LIMIT) break outer;
      scanned++;
      const candidate = { id: memberId, statement: idToStatement.get(memberId) ?? '' };
      const suggestion = await suggestRelationships(candidate, largestPool);
      if (!suggestion.ok) continue;
      for (const s of suggestion.suggestions) {
        if (results.length >= MAX_RESULTS) break outer;
        results.push({
          invariantAId: memberId,
          invariantAStatement: candidate.statement,
          invariantBId: s.relatedInvariantId,
          invariantBStatement: s.relatedLabel,
          relationType: s.relationType,
          rationale: s.rationale,
          confidence: s.confidence,
          componentsJoined: [component.length, largest.length],
        });
      }
    }
  }

  return NextResponse.json(
    {
      ok: true,
      componentCount: components.length,
      largestComponentSize: largest.length,
      invariantCount: invariants.length,
      candidates: results,
      scanned,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
