/**
 * GET /api/corpus-scout/candidates/prepare-recommendations?campaignDomain=
 *
 * Track 2 Stage 2 — the "Prepare recommendations" act (2026-08-03). Computes,
 * for every source `pending_review` in the given acquisition domain, a
 * machine RECOMMENDATION of admission class + primary/secondary sub-domain,
 * derived from the platform's EXISTING invariant lineage
 * (`services/invariants/discoveryEngine.ts`'s `buildDomainLineageIndex` /
 * `deriveSourceLineage`) and existing source-quality signals
 * (`findDuplicateCandidates`, `findRegistryEntry`) — never a fresh guess.
 *
 * WRITES NOTHING. This is a read-only preparation pass; the governed act is
 * the steward's separate `POST /api/corpus-scout/candidates/bulk-review`
 * (through `applyCandidateReviewDecision`) once they have reviewed and,
 * where they choose to, overridden these recommendations.
 *
 * Only `pending_review` sources are considered — a source with any other
 * `reviewWorkflowStatus` (including the three sources manually admitted
 * before this feature existed) is NEVER computed here, so it can never be
 * shown as overridable; the client renders it as already-decided.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listCandidateSources } from '@/services/corpusScout/provenance';
import { prepareAdmissionRecommendations } from '@/services/corpusScout/admissionPreparation';
import {
  CONFIDENCE_AUTO_INCLUDE_THRESHOLD,
  CONFIDENCE_MANUAL_REVIEW_THRESHOLD,
} from '@/services/corpusScout/admissionRecommendation';
import {
  buildCriticalPath,
  renderPopulationDisclosure,
  summarizeIsolation,
  type PopulationDisclosure,
} from '@/services/research/exceptionIsolation';
import { eligibleAdmissionCohortIds, resolvableDuplicateAliasIds } from '@/services/corpusScout/admissionPreparation';
import { computeCohortHash } from '@/services/research/cohortAuthorization';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const campaignDomain = new URL(req.url).searchParams.get('campaignDomain')?.trim();
  if (!campaignDomain) return NextResponse.json({ ok: false, error: 'campaignDomain is required' }, { status: 400 });

  let prepared: Awaited<ReturnType<typeof prepareAdmissionRecommendations>>;
  try {
    // pending_review ONLY — an already-decided source (including the three
    // manually admitted before this feature existed) is never recommended.
    // Shared with `researchProgrammeOrchestrator.ts`'s Stage 2 pending-decision
    // enrichment — one computation, never two (inv.engineering.036/037).
    prepared = await prepareAdmissionRecommendations(admin, campaignDomain);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'recommendations could not be prepared' }, { status: 500 });
  }

  if (prepared.recommendations.length === 0) {
    return NextResponse.json({ ok: true, campaignDomain, generatedAt: new Date().toISOString(), recommendations: [] });
  }

  const { recommendations, duplicateGroups, duplicateResolutions, duplicateDryRun } = prepared;

  // ── The executable batch, computed SERVER-SIDE from the shared model ──────
  //
  // The operator must not have to find and deselect problem records by hand
  // (ruling §2). The summary preselects every ready and ready-with-warning
  // record and auto-excludes every exception and refusal — and its
  // `primaryActionEnabled` is deliberately independent of how many exceptions
  // there are.
  const summary = summarizeIsolation(
    recommendations.map((r) => ({
      recordId: r.sourceId,
      disposition: r.disposition,
      exception: r.exception,
      warnings: r.warnings,
    })),
    // No global stop is observable from a read-only preparation pass: the four
    // batch-integrity conditions that could hold here are all properties of a
    // WRITE (wrong corpus target, unresolved steward, a changed recommendation
    // set). They are evaluated at the bulk-review write, not here.
    null,
    'source',
  );

  // ── The full population, ALWAYS (ruling §5) ───────────────────────────────
  //
  // The guardrail against quietly reducing the corpus until readiness passes.
  // `discovered` counts every source in the domain at every review status —
  // not just the pending queue — so the disclosure can never shrink simply
  // because sources left the queue.
  let allInDomain: Awaited<ReturnType<typeof listCandidateSources>> = [];
  try {
    allInDomain = await listCandidateSources(admin, { campaignDomain });
  } catch {
    // A failed population read must never silently narrow the disclosure —
    // fall back to what is provably known (the pending queue) and say so.
    allInDomain = [];
  }
  const population: PopulationDisclosure = {
    discovered: allInDomain.length || recommendations.length,
    admitted: allInDomain.filter((s) => Boolean(s.evidenceRowId)).length,
    excludedWithWarnings: summary.counts.readyWithWarning,
    exceptions: summary.counts.exceptions,
    refused: summary.counts.refused,
    // Downstream of this stage and NOT readable from here. Reported as 0
    // rather than guessed — the freeze package, which sees the whole
    // pipeline, is where all eight counts are real. `scope` says so
    // explicitly (2026-09-01) so no renderer calls this "Full population".
    candidatesExtracted: 0,
    validated: 0,
    assignedToCrystal: 0,
    scope: 'current-acquisition-round',
  };

  return NextResponse.json(
    {
      ok: true,
      campaignDomain,
      generatedAt: new Date().toISOString(),
      confidencePolicy: {
        autoIncludeThreshold: CONFIDENCE_AUTO_INCLUDE_THRESHOLD,
        manualReviewThreshold: CONFIDENCE_MANUAL_REVIEW_THRESHOLD,
      },
      duplicateGroups,
      duplicateResolutions,
      duplicateDryRun,
      recommendations,
      summary,
      // STALE-COHORT PROTECTION (2026-09-01) — the SAME hashes
      // `researchProgrammeOrchestrator.ts`'s pendingDecision enrichment
      // computes over this identical `prepareAdmissionRecommendations`
      // output. A manual "Prepare recommendations" caller gets the same
      // commitment a Copilot-driven one does — one definition, one hash.
      admissionCohortHash: computeCohortHash(eligibleAdmissionCohortIds(recommendations)),
      duplicateCohortHash: computeCohortHash(resolvableDuplicateAliasIds(duplicateResolutions)),
      population,
      populationDisclosure: renderPopulationDisclosure(population),
      criticalPath: buildCriticalPath({
        stageLabel: 'admission',
        actVerb: 'Admit',
        noun: 'eligible source',
        counts: summary.counts,
        // No source-scope exception can block a freeze — only the readiness
        // engine, over the ACTUAL assigned crystal, can raise one (ruling §3).
        freezeBlockers: 0,
      }),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
