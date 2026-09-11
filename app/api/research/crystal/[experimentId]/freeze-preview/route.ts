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
import { crystalDeclarationHash, crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { runFreezeCeremonyPreview } from '@/services/research/crystalFreezeCeremony';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveTrack2Population } from '@/services/research/track2Population';

/** The acquisition domain upstream of the crystal. A DIFFERENT namespace from
 *  the crystal domain — never derived from it (the Track 2 route makes the same
 *  refusal). Overridable per request. */
const DEFAULT_ACQUISITION_DOMAIN = 'financial-services';

export const dynamic = 'force-dynamic';

interface FreezePreviewBody {
  crystalId?: unknown;
  crystalDomain?: unknown;
  /** The acquisition domain the population is read from. Optional; defaults to
   *  `DEFAULT_ACQUISITION_DOMAIN`, never derived from `crystalDomain`. */
  acquisitionDomain?: unknown;
  operatorRef?: unknown;
  reviewerRef?: unknown;
  /**
   * REMOVED as an input (operator ruling, 2026-08-02). Declared here only so a
   * caller that still sends it is REFUSED rather than silently ignored — see
   * the boundary block in the handler.
   */
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
  const declaration = crystalDomainForExperiment(experimentId);
  const declaredDomain = declaration?.domain;
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

  /*
   * THE BOUNDARY IS READ, NEVER RETYPED (operator ruling, 2026-08-02).
   *
   *   > "That is unnecessary and dangerous."
   *
   * `domainBoundary` was a free-text field the operator filled in at the least
   * reversible act on the platform. Whatever they typed became the boundary
   * statement inside the freeze ceremony package — the artefact that records
   * WHAT WAS FROZEN. A paraphrase, a truncation, or last week's wording would
   * have been committed as the constitutional boundary, and the package would
   * have looked entirely correct afterwards.
   *
   * This is the same defect class as the `constitutional-reasoning` default
   * this route already carried: a writable field standing where a ratified
   * value belongs.
   *
   * So the boundary is now taken verbatim from the ratified declaration, and a
   * caller-supplied one is REFUSED rather than ignored — silently discarding it
   * would let an operator believe they had amended the boundary. A different
   * boundary is reachable only by amending the domain declaration itself, which
   * is a separate constitutional act with its own record.
   */
  if (body.domainBoundary !== undefined) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'domainBoundary is not an input. The freeze package carries the RATIFIED boundary verbatim, read ' +
          'server-side from the domain declaration. Confirm it (boundaryAcknowledged) — do not reproduce it. ' +
          'A different boundary requires a formal amendment to the domain declaration, never a freeze-preview ' +
          'field.',
        ratifiedBoundary: declaration?.boundary ?? null,
      },
      { status: 400 },
    );
  }
  if (!declaration?.boundary) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `no ratified boundary exists for experiment '${experimentId}' — refusing to build a freeze package ` +
          'whose boundary statement would have to be invented',
      },
      { status: 400 },
    );
  }

  /*
   * THE POPULATION, RESOLVED FROM REAL DATA (operator ruling, 2026-08-03).
   *
   *   > "Without this, an independently verifiable crystal hash could still
   *   >  conceal how much of the original population disappeared before freeze."
   *
   * The schema accepted these fields and `packageHash` committed to them, but
   * nothing populated them — every count read `null`, and a null discloses
   * nothing. `resolveTrack2Population` reads all eight from rows that exist.
   *
   * When a count cannot be read it returns `null` WITH the reason, and the
   * package's `population` stays `null` rather than carrying a zero: *"a zero
   * that means 'unknown' is precisely the dishonesty this work exists to
   * remove."* The unreadable fields are surfaced on the response so the
   * operator sees WHY the disclosure is absent instead of reading a clean-looking
   * set of zeroes.
   */
  const acquisitionDomain = asString(body.acquisitionDomain) || DEFAULT_ACQUISITION_DOMAIN;
  const populationResult = await resolveTrack2Population(getSupabaseServer(), {
    acquisitionDomain,
    crystalDomain,
  });

  const result = await runFreezeCeremonyPreview({
    ...(populationResult.population ? { population: populationResult.population } : {}),
    ...(populationResult.assignedInvariantIds ? { assignedInvariantIds: populationResult.assignedInvariantIds } : {}),
    crystalId: asString(body.crystalId) || `${experimentId}/crystal-vP1`,
    experimentId,
    crystalDomain,
    operatorRef: asString(body.operatorRef),
    reviewerRef: asString(body.reviewerRef) || null,
    // Verbatim from the declaration. `buildFreezeCeremonyPackage` still requires
    // it non-empty — that refusal is unchanged; what changed is who supplies it.
    domainBoundary: declaration.boundary,
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
      acquisitionDomain,
      /* Named gaps, never silent zeroes. Empty ⇒ every count on the package is
       * a real read. */
      populationUnreadable: populationResult.unreadable,
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
      /*
       * Emitted for RENDERING AS IMMUTABLE TEXT. The operator reads this and
       * confirms "I ratify this exact boundary"; they never reproduce it. The
       * declaration hash lets a later reader prove which version of the boundary
       * the package was built under.
       */
      ratifiedBoundary: {
        domain: declaration.domain,
        label: declaration.label,
        boundary: declaration.boundary,
        exclusions: declaration.exclusions,
        ratificationText: declaration.ratificationText ?? null,
        ratifiedBy: declaration.ratifiedBy ?? null,
        ratifiedAt: declaration.ratifiedAt ?? null,
        declarationHash: crystalDeclarationHash(declaration),
        immutable: true,
        amendedBy:
          'A formal amendment to the domain declaration (services/research/crystalDomains.ts), ratified by the ' +
          'operator. Never a field on this form.',
      },
      note: 'PREVIEW ONLY — no freeze was performed. See package.eligibleForRatification (evidence) and execution.wouldFreezeSucceed (substrate).',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
