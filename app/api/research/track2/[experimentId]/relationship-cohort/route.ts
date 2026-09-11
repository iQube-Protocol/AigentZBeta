/**
 * /api/research/track2/[experimentId]/relationship-cohort — Track 2 Stage 7's
 * "Add Relationships" bulk-preparation + cohort ratification act
 * (2026-09-05). Admin-gated, mirroring `provenance-cohort`'s route exactly.
 *
 * GET  — derives the current orphan successor cohort, triages it into
 *        `ready` (a proposed relationship, from
 *        `services/research/relationshipCohortPreparation.ts`) and
 *        `exception` (isolated, never guessed — see that module's own
 *        header for the three deterministic exception causes). Writes
 *        nothing.
 *
 * POST — the Steward's ONE ratification act. Recomputes the cohort FRESH
 *        (never trusts a client-supplied id list as proof nothing changed)
 *        and refuses (`recommendation-set-changed`, 409) when
 *        `expectedCohortHash` no longer matches — the exact stale-cohort
 *        protection `provenance-cohort`'s own `expectedCohortHash` check
 *        uses. On a real write (`dryRun: false`), every `ready` member's
 *        chosen suggestion is written through `addEdge` — the SAME writer
 *        every other relationship in this codebase uses, with its cycle
 *        guard and canonical-quarantine rule fully intact. Already-related
 *        members (a resumed call after a partial prior run) are skipped, not
 *        re-written — idempotent resume by construction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { resolveSuccessorConstructionCohort, resolveFrozenPredecessorContext } from '@/services/research/crystalCohortMembership';
import { reconcilePromotedCohort } from '@/services/research/populationReconciliation';
import {
  prepareRelationshipCohort,
  eligibleRelationshipCohortIds,
  RELATIONSHIP_EXCEPTION_LABEL,
  type RelationshipCandidateRecommendation,
} from '@/services/research/relationshipCohortPreparation';
import { computeCohortHash } from '@/services/research/cohortAuthorization';
import { addEdge, getInvariantById, listEdgesForInvariants } from '@/services/invariants';
import { writeLifecycleReceipt } from '@/services/research/lifecycle';
import { personaPublicRef } from '@/services/identity/personaReferences';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_ACQUISITION_DOMAIN = 'financial-services';

async function loadFreshRecommendations(
  admin: NonNullable<ReturnType<typeof getSupabaseServer>>,
  experimentId: string,
  acquisitionDomain: string,
): Promise<{ ok: true; recommendations: RelationshipCandidateRecommendation[] } | { ok: false; error: string }> {
  const resolution = await resolveSuccessorConstructionCohort(admin, experimentId, acquisitionDomain);
  if (!resolution.promotedForConstruction) {
    return { ok: false, error: 'the promoted cohort could not be read' };
  }
  const frozenContext = await resolveFrozenPredecessorContext(experimentId);
  const cohort = await reconcilePromotedCohort(resolution.promotedForConstruction, {
    admin,
    experimentId,
    inheritedMemberIds: frozenContext.frozenGenerationMemberIds ?? undefined,
  });
  if (cohort.orphanRecords.length === 0) {
    return { ok: true, recommendations: [] };
  }
  const prepared = await prepareRelationshipCohort(cohort.orphanRecords, cohort.members);
  return { ok: true, recommendations: prepared.recommendations };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });

  const { experimentId } = await params;
  const declaration = crystalDomainForExperiment(experimentId);
  if (!declaration) {
    return NextResponse.json({ ok: false, error: `no crystal domain is declared for experiment '${experimentId}'` }, { status: 404 });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const acquisitionDomain = req.nextUrl.searchParams.get('acquisitionDomain')?.trim() || DEFAULT_ACQUISITION_DOMAIN;
  const result = await loadFreshRecommendations(admin, experimentId, acquisitionDomain);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });

  const ready = result.recommendations.filter((r) => r.disposition === 'ready');
  const exceptions = result.recommendations.filter((r) => r.disposition === 'exception');
  const eligibleIds = eligibleRelationshipCohortIds(result.recommendations);
  const cohortHash = computeCohortHash(eligibleIds);
  const exceptionsByCause = exceptions.reduce<Record<string, number>>((acc, r) => {
    const key = r.exceptionCause ?? 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json(
    {
      ok: true,
      experimentId,
      acquisitionDomain,
      total: result.recommendations.length,
      readyCount: ready.length,
      exceptionCount: exceptions.length,
      cohortHash,
      cohortInvariantIds: eligibleIds,
      recommendations: result.recommendations,
      exceptionsByCause,
      exceptionCauseLabels: RELATIONSHIP_EXCEPTION_LABEL,
      summary:
        result.recommendations.length === 0
          ? 'nothing to relate — every successor-scoped invariant already has at least one relationship'
          : `${ready.length} of ${result.recommendations.length} orphan invariant(s) have a writable relationship ` +
            `candidate and can be ratified in one act. ${exceptions.length} exception(s) require individual review.`,
      note:
        'This is a derived, read-only view. Nothing has been written. Ratifying (POST, dryRun:false) writes ' +
        'exactly the cohort whose hash is shown above, through the same evaluation this view used, and refuses ' +
        'if the cohort has changed since this was shown.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

interface RelateOutcome {
  invariantId: string;
  disposition: 'written' | 'already-related' | 'failed' | 'skipped-not-eligible';
  to: string | null;
  detail: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });

  const { experimentId } = await params;
  const declaration = crystalDomainForExperiment(experimentId);
  if (!declaration) {
    return NextResponse.json({ ok: false, error: `no crystal domain is declared for experiment '${experimentId}'` }, { status: 404 });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    dryRun?: boolean;
    rationale?: string;
    acquisitionDomain?: string;
    invariantIds?: unknown;
    expectedCohortHash?: string;
  };

  const dryRun = body.dryRun !== false;
  const rationale = typeof body.rationale === 'string' ? body.rationale.trim() : '';
  const acquisitionDomain = typeof body.acquisitionDomain === 'string' && body.acquisitionDomain.trim()
    ? body.acquisitionDomain.trim()
    : DEFAULT_ACQUISITION_DOMAIN;
  const requestedIds = Array.isArray(body.invariantIds)
    ? [...new Set((body.invariantIds as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim().length > 0))]
    : null;

  if (!dryRun && !rationale) {
    return NextResponse.json(
      { ok: false, error: 'a rationale is required to ratify a relationship cohort — it is recorded on every edge written' },
      { status: 400 },
    );
  }

  const fresh = await loadFreshRecommendations(admin, experimentId, acquisitionDomain);
  if (!fresh.ok) return NextResponse.json({ ok: false, error: fresh.error }, { status: 502 });

  const freshEligibleIds = eligibleRelationshipCohortIds(fresh.recommendations);
  const freshHash = computeCohortHash(freshEligibleIds);

  if (!dryRun && body.expectedCohortHash && body.expectedCohortHash !== freshHash) {
    return NextResponse.json(
      {
        ok: false,
        error: 'recommendation-set-changed',
        detail:
          'The prepared eligible cohort no longer matches what was shown — an invariant may have gained a ' +
          'relationship, been promoted, or the crystal membership changed since preparation. Refresh (GET) and ' +
          'reconfirm before ratifying.',
        currentCohortHash: freshHash,
      },
      { status: 409 },
    );
  }

  const byId = new Map(fresh.recommendations.map((r) => [r.invariantId, r]));
  const targetIds = requestedIds ?? freshEligibleIds;
  const exceptions = fresh.recommendations.filter((r) => r.disposition === 'exception');

  if (targetIds.length === 0) {
    return NextResponse.json({
      ok: true,
      dryRun,
      written: 0,
      alreadyRelated: 0,
      failed: 0,
      outcomes: [],
      exceptions,
      cohortHash: freshHash,
      summary: 'nothing eligible to ratify right now',
    });
  }

  if (dryRun) {
    const preview: RelateOutcome[] = targetIds.map((id) => {
      const rec = byId.get(id);
      if (!rec || rec.disposition !== 'ready') {
        return { invariantId: id, disposition: 'skipped-not-eligible', to: null, detail: 'not in the current eligible cohort' };
      }
      return {
        invariantId: id,
        disposition: 'written',
        to: rec.relatedInvariantId,
        detail: `would relate '${rec.relationType}' to ${rec.relatedInvariantId} (confidence ${rec.confidence})`,
      };
    });
    return NextResponse.json({ ok: true, dryRun: true, requested: targetIds.length, preview, exceptions, cohortHash: freshHash });
  }

  // ── THE REAL WRITE — each record independently, through the ONE
  //    canonical addEdge. ────────────────────────────────────────────────────
  const outcomes: RelateOutcome[] = [];
  const written: RelateOutcome[] = [];
  for (const id of targetIds) {
    const rec = byId.get(id);
    if (!rec || rec.disposition !== 'ready' || !rec.relatedInvariantId || !rec.relationType) {
      outcomes.push({ invariantId: id, disposition: 'skipped-not-eligible', to: null, detail: 'not in the current eligible cohort' });
      continue;
    }
    // Resumability: a partial prior run (or a manual edge added since
    // preparation) may already have given this invariant an edge — a benign
    // skip, never a duplicate or an error.
    const invariant = await getInvariantById(id).catch(() => null);
    if (!invariant) {
      outcomes.push({ invariantId: id, disposition: 'failed', to: null, detail: 'invariant not found' });
      continue;
    }
    const existingEdges = await listEdgesForInvariants([id], 'both').catch(() => []);
    if (existingEdges.length > 0) {
      outcomes.push({ invariantId: id, disposition: 'already-related', to: null, detail: 'already has a relationship — skipped, not duplicated' });
      continue;
    }
    try {
      const edge = await addEdge({
        fromInvariantId: id,
        toInvariantId: rec.relatedInvariantId,
        edgeType: rec.relationType,
        rationale: `${rationale} — ${rec.rationale ?? ''}`.trim(),
        provenance: {
          recordedBy: personaPublicRef(persona.personaId),
          recordedAt: new Date().toISOString(),
          cohortDerived: true,
          confidence: rec.confidence ?? 0,
        },
      });
      written.push({ invariantId: id, disposition: 'written', to: edge.toInvariantId, detail: `related '${rec.relationType}' to ${rec.relatedInvariantId}` });
      outcomes.push(written[written.length - 1]);
    } catch (e) {
      outcomes.push({ invariantId: id, disposition: 'failed', to: null, detail: e instanceof Error ? e.message : 'edge_create_failed' });
    }
  }

  const alreadyRelated = outcomes.filter((o) => o.disposition === 'already-related');
  const failed = outcomes.filter((o) => o.disposition === 'failed');

  let receiptWritten = false;
  let receiptWarning: string | null = null;
  if (written.length > 0) {
    const summary =
      `Track 2 Stage 7 relationship cohort ratified — ${written.length} edge(s) written by ` +
      `${personaPublicRef(persona.personaId)}. Members: ${written.map((o) => `${o.invariantId} → ${o.to}`).join(', ')}. ` +
      (exceptions.length > 0 ? `${exceptions.length} exception(s) isolated, never written — disclosed separately. ` : '') +
      `Rationale: ${rationale}`;
    const receipt = await writeLifecycleReceipt({ personaId: persona.personaId, summary, invariantSeedIds: [] }).catch(() => ({ ok: false, receiptId: null }));
    receiptWritten = receipt.ok;
    if (!receipt.ok) {
      console.error('[RELATIONSHIP COHORT] receipt not written for', written.map((o) => o.invariantId).join(', '));
      receiptWarning = 'The relationships were recorded but the batch receipt was not written. The relationships stand; the attributable record of this act does not.';
    }
  }

  return NextResponse.json(
    {
      ok: failed.length === 0,
      dryRun: false,
      requested: targetIds.length,
      written: written.length,
      alreadyRelated: alreadyRelated.length,
      failed: failed.length,
      outcomes,
      exceptions,
      cohortHash: freshHash,
      steward: personaPublicRef(persona.personaId),
      rationale,
      receiptWritten,
      receiptWarning,
      note: 'Ratification writes exactly the eligible cohort. It is not a validation gate, not a crystal assignment, and not a freeze.',
    },
    { status: failed.length === 0 ? 200 : 207, headers: { 'Cache-Control': 'no-store' } },
  );
}
