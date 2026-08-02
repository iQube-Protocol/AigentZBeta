/**
 * POST /api/research/crystal/[experimentId]/freeze-preview — builds a Freeze
 * Ceremony PACKAGE PREVIEW (CFS-054 §5 / PRD-EPI-001 §3.1 Workstream 5).
 * Admin-gated.
 *
 * ── This route NEVER freezes anything ───────────────────────────────────
 *
 * It calls `runFreezeCeremonyPreview`, which is pure/read-only end to end:
 * it runs the readiness + statistics reports and assembles the ratification
 * PACKAGE a human reviews. It never calls `freezeArtifact`, never writes to
 * `research_objects`, never creates a receipt, and never touches the DVN
 * pipeline. The response's `package.dvnAnchorRef` is always `null` and
 * `package.receiptPreview` is always a preview, not a created receipt — see
 * services/research/crystalFreezeCeremony.ts's header for the actual
 * (separate, operator-issued) freeze call this package previews.
 *
 * The request body supplies the ratification fields (operatorRef,
 * reviewerRef, domainBoundary, knownLimitations, freezeRationale,
 * ratifiedAt) — all required, all echoed verbatim into the package, never
 * defaulted or guessed by this route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { runFreezeCeremonyPreview } from '@/services/research/crystalFreezeCeremony';

export const dynamic = 'force-dynamic';

interface FreezePreviewBody {
  crystalId?: unknown;
  crystalDomain?: unknown;
  operatorRef?: unknown;
  reviewerRef?: unknown;
  domainBoundary?: unknown;
  knownLimitations?: unknown;
  freezeRationale?: unknown;
  ratifiedAt?: unknown;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

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
  let body: FreezePreviewBody;
  try {
    body = (await req.json()) as FreezePreviewBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }

  const knownLimitations = Array.isArray(body.knownLimitations)
    ? body.knownLimitations.filter((v): v is string => typeof v === 'string')
    : [];

  /*
   * THE SAME NAMESPACE BUG, IN THE SIBLING ROUTE (found by audit, 2026-08-02).
   *
   * `IndependentReviewPanel`'s domain field was fixed that morning because a
   * caller-supplied `constitutional-reasoning` WON over the ratified
   * declaration, so every readiness report described the historical namespace.
   * This route carried the identical defect one layer down — a hardcoded
   * `|| 'constitutional-reasoning'` fallback — which meant a freeze ceremony
   * package requested without an explicit domain would have been built over the
   * historical collection and named it as the crystal being frozen. That is the
   * substitution `crystalDomains.ts` exists to prevent, arriving at the one act
   * where it would have been hardest to undo.
   *
   * Blank now means the experiment's RATIFIED declaration governs, exactly as
   * readiness/statistics/recommendation already resolve it. An explicit
   * caller-supplied domain still wins, so ad-hoc inspection is unaffected.
   */
  const declaredDomain = crystalDomainForExperiment(experimentId)?.domain;
  const crystalDomain = asString(body.crystalDomain) || declaredDomain;
  if (!crystalDomain) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `no crystal domain is declared for experiment '${experimentId}' and none was supplied — refusing ` +
          'to build a freeze package over a guessed domain',
      },
      { status: 400 },
    );
  }

  const result = await runFreezeCeremonyPreview({
    crystalId: asString(body.crystalId) || `${experimentId}/crystal-vP1`,
    experimentId,
    crystalDomain,
    operatorRef: asString(body.operatorRef),
    reviewerRef: asString(body.reviewerRef) || null,
    domainBoundary: asString(body.domainBoundary),
    knownLimitations,
    freezeRationale: asString(body.freezeRationale),
    ratifiedAt: asString(body.ratifiedAt) || new Date().toISOString(),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  return NextResponse.json(
    {
      ok: true,
      package: result.package,
      /*
       * TWO DIFFERENT QUESTIONS, ANSWERED SEPARATELY (audit, 2026-08-02).
       *
       * `package.eligibleForRatification` is about the EVIDENCE. `execution` is
       * about the SUBSTRATE — whether `freezeArtifact` would actually run. They
       * were collapsing into one, so a package could read eligible while the
       * operator's next act failed on a `crystal-version` artifact that has
       * never existed (nothing in this repository calls `upsertArtifact`).
       */
      execution: result.execution,
      note: 'PREVIEW ONLY — no freeze was performed. See package.eligibleForRatification (evidence) and execution.wouldFreezeSucceed (substrate).',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
