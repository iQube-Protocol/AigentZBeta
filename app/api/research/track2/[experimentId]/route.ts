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
import { listCandidates, type CandidateRow } from '@/services/invariants/discoveryEngine';
import { getInvariantsByIds, listEdgesForInvariants } from '@/services/invariants/store';
import { getArtifact } from '@/services/research/artifacts';
import {
  crystalDeclarationHash,
  crystalDomainForExperiment,
  crystalLifecycleStage,
  crystalReviewStageStatus,
} from '@/services/research/crystalDomains';
import { runCrystalReadinessReport } from '@/services/research/crystalReadiness';
import { readEvidenceProvenance } from '@/services/research/experimentalPopulations';
import { buildTrack2Programme, type PromotedCohort } from '@/services/research/track2Programme';

/**
 * STAGES 5–7's POPULATION, RESOLVED FROM STAGE 4's OUTPUT (operator ruling,
 * 2026-08-03).
 *
 *   > "Stage 5 appears to have reverted to querying the ratified domain
 *   >  registry instead of the crystal it inherited. Those are different
 *   >  populations."
 *
 * What this replaces, exactly:
 *
 *     listInvariants({ domain: acquisitionDomain, limit: 500 })
 *       .filter(inv => readEvidenceProvenance(inv.provenance) === null).length
 *
 * — every invariant ever tagged with the acquisition domain, across every run
 * and every sub-domain, capped at 500. It reported 68 while Stage 4 reported
 * 17, and the readiness remedy pulled onto the same stage spoke about a third
 * population again (the empty crystal domain). Three numbers, one stage.
 *
 * The cohort is now resolved through `promoted_invariant_id` — the link the
 * promotion itself recorded — so Stage 5 receives exactly what Stage 4 handed
 * on. A promoted candidate whose invariant cannot be resolved is an EXPLICIT
 * exclusion carrying its reason, never a silent shortfall: that is what makes
 * `received + excluded === declaredOut` checkable rather than aspirational.
 */
async function resolvePromotedCohort(candidates: CandidateRow[]): Promise<PromotedCohort> {
  const promoted = candidates.filter((c) => c.status === 'promoted');
  const excluded: { recordId: string; reason: string }[] = [];
  const ids: string[] = [];
  for (const c of promoted) {
    if (c.promotedInvariantId) ids.push(c.promotedInvariantId);
    else
      excluded.push({
        recordId: c.id,
        reason: 'promoted with no recorded promoted_invariant_id — the promotion did not produce a readable invariant',
      });
  }

  const records = ids.length > 0 ? await getInvariantsByIds(ids) : [];
  const found = new Set(records.map((r) => r.id));
  for (const id of ids) {
    if (!found.has(id)) {
      excluded.push({ recordId: id, reason: 'promoted invariant id does not resolve to an invariant row' });
    }
  }

  let graph: PromotedCohort['graph'] = null;
  if (records.length > 0) {
    try {
      const memberIds = new Set(records.map((r) => r.id));
      const edges = await listEdgesForInvariants([...memberIds], 'both');
      // INTRA-COHORT ONLY. An edge to an invariant outside the cohort is a
      // relationship to a different population and must not be counted as one
      // inside this one.
      const intra = edges.filter((e) => memberIds.has(e.fromInvariantId) && memberIds.has(e.toInvariantId));
      const degree = new Set<string>();
      for (const e of intra) {
        degree.add(e.fromInvariantId);
        degree.add(e.toInvariantId);
      }
      graph = { relationshipCount: intra.length, orphanCount: records.length - degree.size };
    } catch {
      graph = null; // unread ⇒ `unknown`, never "no relationships"
    }
  } else if (ids.length === 0) {
    graph = { relationshipCount: 0, orphanCount: 0 };
  }

  return {
    invariantIds: records.map((r) => r.id).sort(),
    unclassified: records.filter((r) => readEvidenceProvenance(r.provenance) === null).length,
    unvalidated: records.filter((r) => r.timesValidated === 0).length,
    graph,
    excluded,
  };
}

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
  const [sources, candidates, artifact] = await Promise.all([
    admin ? listCandidateSources(admin, { campaignDomain: acquisitionDomain }).catch(() => null) : null,
    admin ? listCandidates(admin, acquisitionDomain).catch(() => null) : null,
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

  // Stages 5–7 read STAGE 4's OWN OUTPUT. The cohort is resolved from the same
  // `candidates` array Stage 4 is counted from, so the two cannot be about
  // different sets — and when the resolution itself fails, the signal is
  // `null` (`unknown`) rather than a domain query standing in for it.
  const promotedCohort = candidates ? await resolvePromotedCohort(candidates).catch(() => null) : null;

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
      promotedCohort,
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
