/**
 * POST /api/research/track2/[experimentId]/validate-all — Stage 6's "Validate
 * All" batch act (al, 2026-08-04, steward-workflow ruling).
 *
 *   > "Every incomplete stage must expose an affordance capable of completing
 *   >  that stage... Replace explanation with action."
 *
 * Unlike Stage 5's classification (a per-record human judgment: which
 * evidence-provenance class, cited from which sources) and Stage 7's
 * relationships (a per-record human claim: which other invariant, related
 * how), validation is a MACHINE-RUN gate with no per-record human content —
 * `validateInvariant` runs the same consistency/groundedness/canonical-form
 * checks on every invariant it is given. That is what makes a genuine batch
 * "Validate All" honest here where it would not be for Stage 5 or 7 (see
 * services/research/populationReconciliation.ts and this route's siblings —
 * those two stay per-record queues for exactly that reason).
 *
 * This route is a NEW CALLER of the EXISTING canonical `validateInvariant`
 * (services/invariants/lifecycle.ts) — the same function
 * `POST /api/invariants/[id]/advance` already calls one id at a time. It
 * writes nothing itself: `validateInvariant` performs the check, the
 * transition, and its own DVN-anchored receipt.
 *
 * The batch is resolved SERVER-SIDE from the current SUCCESSOR cohort —
 * through the ONE shared resolver, `resolveSuccessorConstructionCohort`
 * (2026-08-31 fix) — never taken from the client as an id list, and never
 * the raw unscoped `reconcilePromotedCohort(candidates.filter(...))` this
 * replaces: validation in THIS pass applies to the new construction cohort,
 * not to every historic promoted candidate in the acquisition domain
 * (which would silently re-run the gate over the frozen predecessor's own,
 * already-validated members).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { reconcilePromotedCohort } from '@/services/research/populationReconciliation';
import { resolveSuccessorConstructionCohort } from '@/services/research/crystalCohortMembership';
import { validateInvariant } from '@/services/invariants';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_ACQUISITION_DOMAIN = 'financial-services';

interface ValidateOutcome {
  invariantId: string;
  ok: boolean;
  detail: string;
  /** validateInvariant's own per-check verdict, verbatim — so the steward reviews what was checked, not only whether it passed (operator direction, 2026-08-05). */
  checks: { name: string; passed: boolean; detail?: string }[];
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
  const declaration = crystalDomainForExperiment(experimentId);
  if (!declaration) {
    return NextResponse.json(
      { ok: false, error: `no crystal domain is declared for experiment '${experimentId}'` },
      { status: 404 },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });
  }

  const acquisitionDomain =
    req.nextUrl.searchParams.get('acquisitionDomain')?.trim() || DEFAULT_ACQUISITION_DOMAIN;
  const resolution = await resolveSuccessorConstructionCohort(admin, experimentId, acquisitionDomain);
  if (!resolution.promotedForConstruction) {
    return NextResponse.json({ ok: false, error: 'the promoted cohort could not be read' }, { status: 502 });
  }
  const cohort = await reconcilePromotedCohort(resolution.promotedForConstruction);
  const targets = cohort.unvalidatedRecords;
  if (targets.length === 0) {
    return NextResponse.json({ ok: true, outcomes: [], summary: 'nothing to validate — every cohort member already carries a validation' });
  }

  // EACH RECORD, INDEPENDENTLY (mirrors reconcile/route.ts) — a failure on one
  // invariant never withholds the outcome already produced for another.
  const outcomes: ValidateOutcome[] = [];
  for (const t of targets) {
    try {
      const { verdict } = await validateInvariant(t.id, { personaId: persona.personaId });
      const failing = verdict.checks.filter((c) => !c.passed).map((c) => `${c.name}${c.detail ? `: ${c.detail}` : ''}`);
      outcomes.push({
        invariantId: t.id,
        ok: verdict.ok,
        detail: verdict.ok ? 'validated' : failing.join('; ') || 'validation gate failed',
        checks: verdict.checks,
      });
    } catch (e) {
      outcomes.push({ invariantId: t.id, ok: false, detail: e instanceof Error ? e.message : 'validate_failed', checks: [] });
    }
  }

  const succeeded = outcomes.filter((o) => o.ok).length;
  const failed = outcomes.length - succeeded;
  return NextResponse.json(
    {
      ok: failed === 0,
      outcomes,
      summary: `${succeeded} of ${outcomes.length} invariant(s) validated` + (failed > 0 ? `; ${failed} failed — see each outcome's detail` : ''),
    },
    { status: failed === 0 ? 200 : 207 },
  );
}
