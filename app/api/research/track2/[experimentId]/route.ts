/**
 * GET /api/research/track2/[experimentId] — the guided Track 2 programme
 * (operator ruling, 2026-08-02). Read-only, steward-gated.
 *
 * Composes signals the platform already computes into the eleven-stage view.
 * It runs no stage's work and stores no progress: every status is derived at
 * request time, so acting through any underlying surface directly is reflected
 * here immediately and this view can never disagree with the reports it reads.
 *
 * Upstream signals (Corpus Scout candidates, discovery candidates, the
 * classification queue) are read BEST-EFFORT and fail SOFT to `null`, which the
 * programme renders as `unknown`. They are convenience context, not the
 * authority — and an unreadable convenience signal must never be able to make a
 * governed stage look complete or blocked.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listCandidateSources } from '@/services/corpusScout/provenance';
import { listCandidates } from '@/services/invariants/discoveryEngine';
import { listInvariants } from '@/services/invariants/store';
import { getArtifact } from '@/services/research/artifacts';
import {
  crystalDeclarationHash,
  crystalDomainForExperiment,
  crystalLifecycleStage,
  crystalReviewStageStatus,
} from '@/services/research/crystalDomains';
import { runCrystalReadinessReport } from '@/services/research/crystalReadiness';
import { readEvidenceProvenance } from '@/services/research/experimentalPopulations';
import { buildTrack2Programme } from '@/services/research/track2Programme';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** The acquisition domain upstream of the crystal. Defaults to the Discovery
 *  Domain Registry's financial-services lane; overridable per request, never
 *  guessed from the crystal domain (they are different namespaces). */
const DEFAULT_ACQUISITION_DOMAIN = 'financial-services';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ requestSucceeded: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ requestSucceeded: false, error: 'Steward access required' }, { status: 403 });
  }

  const { experimentId } = await params;
  const declaration = crystalDomainForExperiment(experimentId);
  if (!declaration) {
    return NextResponse.json(
      {
        requestSucceeded: false,
        error: `no crystal domain is declared for experiment '${experimentId}'`,
      },
      { status: 404 },
    );
  }
  const acquisitionDomain =
    req.nextUrl.searchParams.get('acquisitionDomain')?.trim() || DEFAULT_ACQUISITION_DOMAIN;

  const admin = getSupabaseServer();
  const readiness = await runCrystalReadinessReport({ experimentId, crystalDomain: declaration.domain });

  // Best-effort, fail-soft. `null` becomes `unknown`, never `complete`.
  const [sources, candidates, promoted, artifact] = await Promise.all([
    admin ? listCandidateSources(admin, { campaignDomain: acquisitionDomain }).catch(() => null) : null,
    admin ? listCandidates(admin, acquisitionDomain).catch(() => null) : null,
    listInvariants({ domain: acquisitionDomain, limit: 500 }).catch(() => null),
    getArtifact(experimentId, 'crystal-version').catch(() => null),
  ]);

  const candidateSources = sources
    ? {
        total: sources.length,
        pendingReview: sources.filter((s) => s.reviewWorkflowStatus === 'pending_review').length,
        admitted: sources.filter((s) => Boolean(s.evidenceRowId)).length,
      }
    : null;

  const discoveryCandidates = candidates
    ? {
        total: candidates.length,
        awaitingReview: candidates.filter((c) => c.status === 'candidate').length,
        promoted: candidates.filter((c) => c.status === 'promoted').length,
      }
    : null;

  const unclassifiedPromoted = promoted
    ? promoted.filter((inv) => readEvidenceProvenance(inv.provenance) === null).length
    : null;

  const lifecycle = crystalLifecycleStage({
    domainRatified: declaration.ratification === 'ratified',
    invariantCount: readiness.invariantCount,
    readinessOk: readiness.ok,
    // Read off the persisted artifact — never inferred from readiness.
    frozen: artifact?.lifecycle === 'frozen',
  });

  const reviewStage = crystalReviewStageStatus({
    invariantCount: readiness.invariantCount,
    readinessOk: readiness.ok,
  });

  const programme = buildTrack2Programme({
    experimentId,
    crystalDomain: declaration.domain,
    signals: {
      candidateSources,
      discoveryCandidates,
      unclassifiedPromoted,
      readiness,
      lifecycle,
      artifact: artifact ? { id: artifact.id, lifecycle: artifact.lifecycle } : null,
      independentReviewRequestOpen: reviewStage.independentReviewRequestOpen,
    },
  });

  return NextResponse.json(
    {
      requestSucceeded: true,
      programme,
      acquisitionDomain,
      lifecycle,
      reviewStage,
      readiness,
      crystalDomainDeclaration: declaration,
      declarationHash: crystalDeclarationHash(declaration),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
