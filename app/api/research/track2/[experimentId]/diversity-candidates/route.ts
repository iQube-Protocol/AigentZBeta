/**
 * GET /api/research/track2/[experimentId]/diversity-candidates — Stage 9's
 * "Find diversity candidates" affordance (operator direction, 2026-08-05:
 * "search the already-admitted evidence and previously extracted candidates
 * for material capable of producing a different legitimate semantic type...
 * Do not relabel an existing invariant merely to pass the check.").
 *
 * Resolves the crystal's CURRENT dominant semantic type server-side (never
 * client-supplied), then classifies extracted-but-not-yet-promoted candidates
 * (`discovery_candidates`, status='candidate') in the same domain via
 * `suggestSemanticType`, keeping only the ones whose proposed type genuinely
 * differs from the dominant one. Read-only advice — nothing is promoted
 * here; that happens only through the steward's explicit Accept
 * (POST .../diversity-candidates/[candidateId]/accept).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { listInvariants } from '@/services/invariants/store';
import { listCandidates } from '@/services/invariants/discoveryEngine';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { suggestSemanticType } from '@/services/invariants/semanticTypeSuggestion';
import type { InvariantSemanticType } from '@/types/invariants';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Candidates are stored under the DISCOVERY/acquisition domain (`promoteCandidate`
 *  tags them with `c.domain`, never the crystal domain) — same distinction the
 *  existing suggest-relationships and crystal/assign routes already draw. */
const DEFAULT_ACQUISITION_DOMAIN = 'financial-services';
/** Bounds how many unpromoted candidates get an LLM classification call per request. */
const CANDIDATE_SCAN_LIMIT = 15;
/** How many distinct-shape proposals the queue renders. */
const MAX_RESULTS = 5;

export interface DiversityCandidateView {
  candidateId: string;
  statement: string;
  evidenceSummary: string;
  proposedSemanticType: InvariantSemanticType;
  confidence: number;
  reason: string;
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

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });
  }

  const acquisitionDomain =
    req.nextUrl.searchParams.get('acquisitionDomain')?.trim() || DEFAULT_ACQUISITION_DOMAIN;
  const [crystalMembers, allCandidates] = await Promise.all([
    listInvariants({ domain: declaration.domain, status: ['validated', 'canonical'] }).catch(() => null),
    listCandidates(admin, acquisitionDomain).catch(() => null),
  ]);
  if (!crystalMembers) {
    return NextResponse.json({ ok: false, error: 'the crystal could not be read' }, { status: 502 });
  }
  if (!allCandidates) {
    return NextResponse.json({ ok: false, error: 'the candidate pool could not be read' }, { status: 502 });
  }

  const shapeGroups = new Map<string, number>();
  for (const inv of crystalMembers) {
    const key = inv.semanticType ?? 'unspecified';
    shapeGroups.set(key, (shapeGroups.get(key) ?? 0) + 1);
  }
  let dominantShape: string | null = null;
  let dominantCount = -1;
  for (const [shape, count] of shapeGroups) {
    if (count > dominantCount) {
      dominantShape = shape;
      dominantCount = count;
    }
  }

  const unpromoted = allCandidates.filter((c) => c.status === 'candidate').slice(0, CANDIDATE_SCAN_LIMIT);

  const results: DiversityCandidateView[] = [];
  for (const candidate of unpromoted) {
    if (results.length >= MAX_RESULTS) break;
    const suggestion = await suggestSemanticType({ id: candidate.id, statement: candidate.statement });
    if (!suggestion.ok || !suggestion.suggestion) continue;
    // The whole point: only surface a candidate whose NATURAL shape is
    // genuinely different from what already saturates the crystal — never a
    // relabel of the dominant shape dressed up as "diversity."
    if (suggestion.suggestion.semanticType === dominantShape) continue;
    results.push({
      candidateId: candidate.id,
      statement: candidate.statement,
      evidenceSummary: candidate.rationale || '(no extraction rationale recorded)',
      proposedSemanticType: suggestion.suggestion.semanticType,
      confidence: suggestion.suggestion.confidence,
      reason: suggestion.suggestion.reason,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      dominantShape,
      distinctShapes: shapeGroups.size,
      candidates: results,
      scanned: unpromoted.length,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
