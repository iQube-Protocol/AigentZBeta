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
import { findDuplicateCandidates } from '@/services/corpusScout/intelligence';
import { findRegistryEntry } from '@/services/corpusScout/institutionalRegistry';
import {
  composeAdmissionRecommendation,
  CONFIDENCE_AUTO_INCLUDE_THRESHOLD,
  CONFIDENCE_MANUAL_REVIEW_THRESHOLD,
  type SourceQualitySignals,
} from '@/services/corpusScout/admissionRecommendation';
import { buildDomainLineageIndex, deriveSourceLineage } from '@/services/invariants/discoveryEngine';

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

  let pending: Awaited<ReturnType<typeof listCandidateSources>>;
  try {
    // pending_review ONLY — an already-decided source (including the three
    // manually admitted before this feature existed) is never recommended.
    pending = await listCandidateSources(admin, { campaignDomain, reviewWorkflowStatus: 'pending_review' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'the pending queue could not be read' }, { status: 500 });
  }

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, campaignDomain, generatedAt: new Date().toISOString(), recommendations: [] });
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

  let lineageIndex: Awaited<ReturnType<typeof buildDomainLineageIndex>>;
  try {
    lineageIndex = await buildDomainLineageIndex(admin, campaignDomain);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'the corpus lineage could not be read' }, { status: 500 });
  }

  const recommendations = pending.map((row) => {
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
      extractionStatus: row.extractionStatus,
      artifactHash: row.artifactHash,
      extractionWarnings: row.extractionWarnings,
      structuralTags: row.structuralTags,
      licenseStatus: row.licenseStatus,
      isDuplicate: duplicateSourceIds.has(row.sourceId),
      institutionalTier,
    };
    return composeAdmissionRecommendation({ source: signals, lineage });
  });

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
      recommendations,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
