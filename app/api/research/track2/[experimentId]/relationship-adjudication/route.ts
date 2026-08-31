/**
 * POST /api/research/track2/[experimentId]/relationship-adjudication —
 * Track 2 Stage 7's explicit steward act for "a crystal member may
 * legitimately have zero relationships" (operator report, 2026-08-31).
 *
 * Records ONLY the fact that this member's relationship candidates were
 * reviewed and none warranted admission (services/research/
 * crystalRelationshipAdjudication.ts::recordNoDefensibleEdgeAdjudication) —
 * never a fabricated edge, never a cached "stage complete" flag. The cohort
 * membership and its fingerprint are resolved SERVER-SIDE from the SAME
 * `reconcilePromotedCohort` every other Track 2 route reads, so a caller
 * cannot spoof which cohort this adjudication was reached under.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { listCandidates } from '@/services/invariants/discoveryEngine';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { reconcilePromotedCohort } from '@/services/research/populationReconciliation';
import { recordNoDefensibleEdgeAdjudication } from '@/services/research/crystalRelationshipAdjudication';

export const dynamic = 'force-dynamic';

const DEFAULT_ACQUISITION_DOMAIN = 'financial-services';

export async function POST(
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

  let body: { invariantId?: unknown; reviewedCandidateIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }
  const invariantId = typeof body.invariantId === 'string' ? body.invariantId.trim() : '';
  if (!invariantId) {
    return NextResponse.json({ ok: false, error: 'invariantId is required' }, { status: 400 });
  }
  const reviewedCandidateIds = Array.isArray(body.reviewedCandidateIds)
    ? body.reviewedCandidateIds.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : [];

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503 });

  const acquisitionDomain =
    req.nextUrl.searchParams.get('acquisitionDomain')?.trim() || DEFAULT_ACQUISITION_DOMAIN;
  const candidates = await listCandidates(admin, acquisitionDomain).catch(() => null);
  if (!candidates) {
    return NextResponse.json({ ok: false, error: 'the promoted cohort could not be read' }, { status: 502 });
  }
  const cohort = await reconcilePromotedCohort(candidates.filter((c) => c.status === 'promoted'));
  if (!cohort.invariantIds.includes(invariantId)) {
    return NextResponse.json(
      { ok: false, error: `'${invariantId}' is not a member of the current crystal's promoted cohort` },
      { status: 409 },
    );
  }

  const result = await recordNoDefensibleEdgeAdjudication(admin, {
    experimentId,
    crystalDomain: declaration.domain,
    invariantId,
    cohortMemberIds: cohort.invariantIds,
    adjudicatedByPersonaId: persona.personaId,
    reviewedCandidateIds,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, adjudication: result.adjudication },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
