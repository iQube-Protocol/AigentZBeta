/**
 * Corpus Scout Track 2 Stage 2 — the SHARED preparation computation
 * (2026-08-31, "Review & Admit machine-preparation" repair).
 *
 * Extracted VERBATIM from `GET /api/corpus-scout/candidates/prepare-
 * recommendations`'s own body (2026-08-03) so the route and
 * `researchProgrammeOrchestrator.ts`'s Stage 2 pending-decision enrichment
 * call the SAME computation rather than two independently-drifting copies
 * (inv.engineering.036/037). The route still owns its own response envelope
 * (summary/population/criticalPath); this module owns only the part both
 * callers need: recommendations + duplicate groups/resolutions.
 *
 * ── The one behavioural addition over the original inline version ──────────
 *
 * Per-source EXCEPTION ISOLATION. The original inline `pending.map(...)` had
 * no try/catch — a single source whose lineage lookup threw (a malformed
 * `canonicalUrl`, an unexpected shape from `buildDomainLineageIndex`) failed
 * the ENTIRE preparation pass with a 500, withholding a recommendation for
 * every other pending source too. That is exactly the "one bad row blocks
 * seventeen good ones" defect the exception-isolation ruling forbids. A
 * failure computing ONE source's recommendation now yields a `manual review
 * required` entry naming the failure, and the remaining sources are
 * unaffected — never a thrown exception, never a narrowed batch.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { listCandidateSources } from './provenance';
import { findDuplicateCandidates, type DuplicateGroup } from './intelligence';
import {
  composeDuplicateResolution,
  dryRunDuplicateResolution,
  type DuplicateResolutionPlan,
  type DuplicateResolutionDryRun,
} from './duplicateResolution';
import { findRegistryEntry } from './institutionalRegistry';
import {
  composeAdmissionRecommendation,
  type AdmissionRecommendation,
  type SourceQualitySignals,
} from './admissionRecommendation';
import { buildDomainLineageIndex, deriveSourceLineage } from '@/services/invariants/discoveryEngine';

export interface AdmissionPreparation {
  recommendations: AdmissionRecommendation[];
  duplicateGroups: DuplicateGroup[];
  duplicateResolutions: DuplicateResolutionPlan[];
  duplicateDryRun: DuplicateResolutionDryRun;
}

/**
 * Compute the machine preparation pass for every `pending_review` source in
 * `campaignDomain` — read-only, writes nothing (same contract as
 * `composeAdmissionRecommendation`/`composeDuplicateResolution` themselves).
 */
export async function prepareAdmissionRecommendations(
  admin: SupabaseClient,
  campaignDomain: string,
): Promise<AdmissionPreparation> {
  const pending = await listCandidateSources(admin, { campaignDomain, reviewWorkflowStatus: 'pending_review' });

  if (pending.length === 0) {
    return { recommendations: [], duplicateGroups: [], duplicateResolutions: [], duplicateDryRun: dryRunDuplicateResolution([]) };
  }

  // Duplicate groups over the SAME batch being prepared — the existing
  // detector, not re-derived (inv.engineering.037).
  const duplicateGroups = findDuplicateCandidates(
    pending.map((r) => ({
      sourceId: r.sourceId,
      artifactHash: r.artifactHash,
      normalizedTextHash: r.normalizedTextHash,
      canonicalUrl: r.canonicalUrl,
    })),
  );
  const duplicateSourceIds = new Set(duplicateGroups.flatMap((g) => g.sourceIds));

  const duplicateResolutions = duplicateGroups.map((group) => composeDuplicateResolution({ group, rows: pending }));

  const lineageIndex = await buildDomainLineageIndex(admin, campaignDomain);

  const recommendations = pending.map((row) => {
    try {
      const lineage = deriveSourceLineage(row.canonicalUrl, lineageIndex);
      const institutionalTier =
        row.issuer && row.campaignSubDomain
          ? (findRegistryEntry(row.campaignDomain, row.campaignSubDomain, row.issuer)?.tier ?? null)
          : null;
      const signals: SourceQualitySignals = {
        sourceId: row.sourceId,
        campaignDomain: row.campaignDomain,
        campaignSubDomain: row.campaignSubDomain,
        issuer: row.issuer,
        title: row.title,
        canonicalUrl: row.canonicalUrl,
        publicationDate: row.publicationDate,
        authors: row.authors,
        extractionStatus: row.extractionStatus,
        artifactHash: row.artifactHash,
        extractionWarnings: row.extractionWarnings,
        structuralTags: row.structuralTags,
        licenseStatus: row.licenseStatus,
        isDuplicate: duplicateSourceIds.has(row.sourceId),
        institutionalTier,
      };
      return composeAdmissionRecommendation({ source: signals, lineage });
    } catch (e) {
      // ISOLATED, not propagated. One source's recommendation failing must
      // never withhold a recommendation for every other pending source.
      const message = e instanceof Error ? e.message : String(e);
      return {
        sourceId: row.sourceId,
        admissionClass: 'manual review required',
        reviewDecision: null,
        primaryDomain: row.campaignDomain,
        primarySubDomain: row.campaignSubDomain,
        secondarySubDomains: [],
        confidence: 0,
        domainConfidence: 0,
        reviewTier: 'exception',
        disposition: 'exception',
        evidenceUsed: [],
        rationale: `The recommendation pass failed for this source: ${message}. It requires individual inspection.`,
        provisional: false,
        warnings: [`Preparation failed for this source: ${message}.`],
        exception: {
          scope: 'source',
          recordId: row.sourceId,
          recordLabel: row.title?.trim() || row.canonicalUrl,
          cause: message,
          causeGroup: 'low-confidence-classification',
          disposition: 'exception',
          stage: 'review-and-admit',
          blocksCurrentStage: false,
          blocksCrystalAssignment: false,
          blocksReadiness: false,
          blocksFreeze: false,
          consequence: 'This source alone is held for individual inspection; every other pending source is unaffected.',
          recommendedAction: 'Open this source and decide it individually — the automated recommendation pass could not classify it.',
          deferrableUntil: null,
        },
      } satisfies AdmissionRecommendation;
    }
  });

  return { recommendations, duplicateGroups, duplicateResolutions, duplicateDryRun: dryRunDuplicateResolution(duplicateResolutions) };
}
