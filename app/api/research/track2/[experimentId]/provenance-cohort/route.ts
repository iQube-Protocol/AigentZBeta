/**
 * /api/research/track2/[experimentId]/provenance-cohort — Track 2 Stage 5's
 * "Classify Provenance" bulk-preparation + cohort ratification act
 * (2026-09-03). Admin-gated, mirroring `validate-all` and Stage 2's
 * `bulk-review` route exactly.
 *
 * GET  — derives the current unclassified successor cohort, triages it into
 *        `ready` (a proposed evidence-provenance class, from
 *        `services/research/provenanceCohortPreparation.ts`) and `exception`
 *        (isolated, never guessed — see that module's own header for the
 *        four deterministic exception causes). Writes nothing.
 *
 * POST — the Steward's ONE ratification act. Recomputes the cohort FRESH
 *        (never trusts a client-supplied id list as proof nothing changed)
 *        and refuses (`recommendation-set-changed`, 409) when
 *        `expectedCohortHash` no longer matches — the exact stale-cohort
 *        protection `bulk-review`'s own `expectedCohortHash` check uses
 *        (`tests/track2-admission-cohort-ratification.test.ts`). On a real
 *        write (`dryRun: false`), every `ready` member is classified through
 *        `applyProvenanceReclassification` with `classDisposition:
 *        'recommendation-accepted'` and the EXACT accepted recommendation —
 *        never a second write path. Already-classified members (a resumed
 *        call after a partial prior run) are skipped, not re-classified —
 *        idempotent resume by construction, since a fresh triage never
 *        re-offers an already-classified invariant. One lifecycle receipt
 *        covers the whole batch. On success, immediately runs the ONE
 *        genuinely machine-safe downstream act — Validate — over the newly-
 *        eligible cohort members, the same batch `validateInvariant` loop
 *        `validate-all/route.ts` uses (its own doc comment: "a MACHINE-RUN
 *        gate with no per-record human content"). Add Relationships and
 *        Assign to Crystal remain separate Steward acts — both are
 *        per-record scientific/governed judgments even where mechanically
 *        evaluable, and this route does not self-approve them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { resolveSuccessorConstructionCohort } from '@/services/research/crystalCohortMembership';
import { reconcilePromotedCohort } from '@/services/research/populationReconciliation';
import {
  prepareProvenanceCohort,
  eligibleProvenanceCohortIds,
  PROVENANCE_EXCEPTION_LABEL,
  type ProvenanceCandidateRecommendation,
} from '@/services/research/provenanceCohortPreparation';
import { computeCohortHash } from '@/services/research/cohortAuthorization';
import { getInvariantById, getInvariantsByIds, updateInvariant } from '@/services/invariants/store';
import { applyProvenanceReclassification, readEvidenceProvenance } from '@/services/research/experimentalPopulations';
import { validateInvariant } from '@/services/invariants';
import { writeLifecycleReceipt } from '@/services/research/lifecycle';
import { personaPublicRef } from '@/services/identity/personaReferences';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_ACQUISITION_DOMAIN = 'financial-services';

async function loadFreshRecommendations(
  admin: NonNullable<ReturnType<typeof getSupabaseServer>>,
  experimentId: string,
  acquisitionDomain: string,
): Promise<{ ok: true; recommendations: ProvenanceCandidateRecommendation[] } | { ok: false; error: string }> {
  const resolution = await resolveSuccessorConstructionCohort(admin, experimentId, acquisitionDomain);
  if (!resolution.promotedForConstruction) {
    return { ok: false, error: 'the promoted cohort could not be read' };
  }
  const cohort = await reconcilePromotedCohort(resolution.promotedForConstruction);
  if (cohort.unclassifiedRecords.length === 0) {
    return { ok: true, recommendations: [] };
  }
  const records = await getInvariantsByIds(cohort.unclassifiedRecords.map((r) => r.id));
  const inputs = records.map((r) => ({ id: r.id, statement: r.statement, provenance: r.provenance }));
  const prepared = await prepareProvenanceCohort(admin, inputs);
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
  const eligibleIds = eligibleProvenanceCohortIds(result.recommendations);
  const cohortHash = computeCohortHash(eligibleIds);
  const distinctSignatures = new Set(ready.map((r) => r.signature)).size;
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
      distinctSourceSignatures: distinctSignatures,
      cohortHash,
      cohortInvariantIds: eligibleIds,
      recommendations: result.recommendations,
      exceptionsByCause,
      exceptionCauseLabels: PROVENANCE_EXCEPTION_LABEL,
      summary:
        result.recommendations.length === 0
          ? 'nothing to classify — every successor-scoped invariant already carries a recorded evidence provenance'
          : `${ready.length} of ${result.recommendations.length} unclassified invariant(s) derive unambiguously from ` +
            `${distinctSignatures} distinct source-document signature(s) and can be ratified in one act. ` +
            `${exceptions.length} exception(s) require individual review and are never proposed a class.`,
      note:
        'This is a derived, read-only view. Nothing has been written. Ratifying (POST, dryRun:false) classifies ' +
        'exactly the cohort whose hash is shown above, through the same evaluation this view used, and refuses ' +
        'if the cohort has changed since this was shown.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

interface ClassifyOutcome {
  invariantId: string;
  disposition: 'written' | 'already-classified' | 'failed' | 'skipped-not-eligible';
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
    /** Narrow the ratification to a subset of the fresh eligible cohort.
     *  Omit to ratify the WHOLE eligible cohort — the brief's "ONE Steward
     *  ratification for N invariants", not a per-item picker. */
    invariantIds?: unknown;
    /** Echo of the `cohortHash` a prior GET showed. Required alongside a
     *  real write to enforce stale-cohort protection; omitted only by a
     *  caller that has explicitly decided not to verify (never omitted by
     *  the ratification surface itself). */
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
      { ok: false, error: 'a rationale is required to ratify a provenance cohort — it is recorded on every invariant classified' },
      { status: 400 },
    );
  }

  const fresh = await loadFreshRecommendations(admin, experimentId, acquisitionDomain);
  if (!fresh.ok) return NextResponse.json({ ok: false, error: fresh.error }, { status: 502 });

  const freshEligibleIds = eligibleProvenanceCohortIds(fresh.recommendations);
  const freshHash = computeCohortHash(freshEligibleIds);

  // STALE-COHORT PROTECTION — checked only on a real write, mirroring
  // bulk-review's own posture: a stale dry-run preview is merely
  // uninformative, a stale WRITE would classify a cohort the Steward never
  // actually confirmed.
  if (!dryRun && body.expectedCohortHash && body.expectedCohortHash !== freshHash) {
    return NextResponse.json(
      {
        ok: false,
        error: 'recommendation-set-changed',
        detail:
          'The prepared eligible cohort no longer matches what was shown — an invariant may have been classified, ' +
          'promoted, or its resolved evidence changed since preparation. Refresh (GET) and reconfirm before ratifying.',
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
      alreadyClassified: 0,
      failed: 0,
      outcomes: [],
      exceptions,
      cohortHash: freshHash,
      summary: 'nothing eligible to ratify right now',
    });
  }

  if (dryRun) {
    const preview: ClassifyOutcome[] = targetIds.map((id) => {
      const rec = byId.get(id);
      if (!rec || rec.disposition !== 'ready') {
        return { invariantId: id, disposition: 'skipped-not-eligible', to: null, detail: 'not in the current eligible cohort' };
      }
      return { invariantId: id, disposition: 'written', to: rec.proposedClass, detail: `would classify '${rec.proposedClass}' (confidence ${rec.confidence})` };
    });
    return NextResponse.json({
      ok: true,
      dryRun: true,
      requested: targetIds.length,
      preview,
      exceptions,
      cohortHash: freshHash,
      distinctSourceSignatures: new Set(fresh.recommendations.filter((r) => r.disposition === 'ready').map((r) => r.signature)).size,
    });
  }

  // ── THE REAL WRITE — each record independently, through the ONE
  //    canonical applyProvenanceReclassification. ────────────────────────────
  const outcomes: ClassifyOutcome[] = [];
  const writtenIds: string[] = [];
  for (const id of targetIds) {
    const rec = byId.get(id);
    if (!rec || rec.disposition !== 'ready' || !rec.proposedClass) {
      outcomes.push({ invariantId: id, disposition: 'skipped-not-eligible', to: null, detail: 'not in the current eligible cohort' });
      continue;
    }
    // Re-read the CURRENT record — resumability: a partial prior run may
    // already have classified this invariant, which must be a benign skip,
    // never a re-classification or an error.
    const invariant = await getInvariantById(id).catch(() => null);
    if (!invariant) {
      outcomes.push({ invariantId: id, disposition: 'failed', to: null, detail: 'invariant not found' });
      continue;
    }
    if (readEvidenceProvenance(invariant.provenance) !== null) {
      outcomes.push({ invariantId: id, disposition: 'already-classified', to: readEvidenceProvenance(invariant.provenance), detail: 'already classified — skipped, not re-classified' });
      continue;
    }
    const result = applyProvenanceReclassification(invariant.provenance, {
      to: rec.proposedClass,
      evidenceRefs: rec.evidenceRefs,
      rationale:
        `${rationale} — cohort-derived from source document signature (${rec.evidenceRefs.join(', ')}); ` +
        `${rec.reason ?? ''}`.trim(),
      classDisposition: 'recommendation-accepted',
      acceptedRecommendation: {
        suggestedClass: rec.proposedClass,
        confidence: rec.confidence ?? 0,
        primarySource: rec.primarySource,
        supportingSources: rec.supportingSources,
        reason: rec.reason ?? '',
      },
      actor: personaPublicRef(persona.personaId),
      at: new Date().toISOString(),
    });
    if (!result.ok) {
      outcomes.push({ invariantId: id, disposition: 'failed', to: null, detail: result.error });
      continue;
    }
    await updateInvariant(id, { provenance: result.provenance });
    writtenIds.push(id);
    outcomes.push({ invariantId: id, disposition: 'written', to: result.to, detail: `classified '${result.to}'` });
  }

  const written = outcomes.filter((o) => o.disposition === 'written');
  const alreadyClassified = outcomes.filter((o) => o.disposition === 'already-classified');
  const failed = outcomes.filter((o) => o.disposition === 'failed');

  let receiptWritten = false;
  let receiptWarning: string | null = null;
  if (written.length > 0) {
    const distinctSignatures = new Set(written.map((o) => byId.get(o.invariantId)?.signature).filter(Boolean)).size;
    const summary =
      `Track 2 Stage 5 provenance cohort ratified — ${written.length} invariant(s) classified from ` +
      `${distinctSignatures} distinct source-document signature(s) by ${personaPublicRef(persona.personaId)}. ` +
      `Members: ${written.map((o) => `${o.invariantId} → ${o.to}`).join(', ')}. ` +
      (exceptions.length > 0
        ? `${exceptions.length} exception(s) isolated, never classified — disclosed separately. `
        : '') +
      `Rationale: ${rationale}`;
    const receipt = await writeLifecycleReceipt({ personaId: persona.personaId, summary, invariantSeedIds: [] }).catch(() => ({ ok: false, receiptId: null }));
    receiptWritten = receipt.ok;
    if (!receipt.ok) {
      console.error('[PROVENANCE COHORT] receipt not written for', written.map((o) => o.invariantId).join(', '));
      receiptWarning = 'The classifications were recorded but the batch receipt was not written. The classifications stand; the attributable record of this act does not.';
    }
  }

  // ── IMMEDIATELY RUN THE NEXT MACHINE-SAFE ACT: VALIDATE. Same batch
  //    validateInvariant loop validate-all/route.ts uses — no per-record
  //    human content, so no new judgment is required beyond this ratification. ──
  let validateRan = 0;
  let validatePassed = 0;
  const validateFailures: { invariantId: string; detail: string }[] = [];
  if (written.length > 0) {
    const resolutionAfter = await resolveSuccessorConstructionCohort(admin, experimentId, acquisitionDomain).catch(() => null);
    if (resolutionAfter?.promotedForConstruction) {
      const cohortAfter = await reconcilePromotedCohort(resolutionAfter.promotedForConstruction).catch(() => null);
      const toValidate = cohortAfter?.unvalidatedRecords ?? [];
      for (const t of toValidate) {
        validateRan += 1;
        try {
          const { verdict } = await validateInvariant(t.id, { personaId: persona.personaId });
          if (verdict.ok) validatePassed += 1;
          else validateFailures.push({ invariantId: t.id, detail: verdict.checks.filter((c) => !c.passed).map((c) => c.name).join(', ') });
        } catch (e) {
          validateFailures.push({ invariantId: t.id, detail: e instanceof Error ? e.message : 'validate_failed' });
        }
      }
    }
  }

  return NextResponse.json(
    {
      ok: failed.length === 0,
      dryRun: false,
      requested: targetIds.length,
      written: written.length,
      alreadyClassified: alreadyClassified.length,
      failed: failed.length,
      outcomes,
      exceptions,
      cohortHash: freshHash,
      steward: personaPublicRef(persona.personaId),
      rationale,
      receiptWritten,
      receiptWarning,
      downstream: {
        validate: { ran: validateRan, passed: validatePassed, failures: validateFailures },
      },
      note:
        'Ratification classifies exactly the eligible cohort. It is not a validation gate, not a crystal ' +
        'assignment, and not a freeze — Validate was run immediately over the newly-eligible members because it ' +
        'is machine-run with no per-record human content; Add Relationships and Assign to Crystal remain ' +
        'separate Steward acts.',
    },
    { status: failed.length === 0 ? 200 : 207, headers: { 'Cache-Control': 'no-store' } },
  );
}
