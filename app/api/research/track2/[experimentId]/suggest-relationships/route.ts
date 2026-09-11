/**
 * POST /api/research/track2/[experimentId]/suggest-relationships — Stage 7's
 * review-card engine (operator direction, 2026-08-04: "Ask the system: 'Show
 * me the three strongest relationships.' The steward's role becomes
 * constitutional approval, not manual graph construction.").
 *
 * Resolves the current SUCCESSOR cohort server-side through the ONE shared
 * resolver (`resolveSuccessorConstructionCohort`, 2026-08-31 — never a
 * client-supplied member list, so a caller cannot inject a candidate pool
 * from outside this crystal) and offers a candidate pool spanning the
 * target-Crystal membership universe: other successor cohort members AND
 * the inherited predecessor's own members. Per the operator's ruling
 * ("successor cohort vs successor Crystal are not the same thing"), a new
 * member relating BACKWARD into inherited Crystal structure is scientifically
 * valid and must be offerable — but this route must never again offer an
 * arbitrary OTHER promoted invariant elsewhere in the acquisition domain,
 * which the unscoped `reconcilePromotedCohort(candidates.filter(...))` call
 * this replaces used to admit (the live root cause of the 2026-08-31 Record
 * 3 incident: a `supports` edge was correctly accepted to a genuine inherited
 * member, but the route offering it had no way to distinguish that from an
 * out-of-Crystal invariant).
 *
 * Delegates ranking/relation-type/rationale generation to
 * `services/invariants/relationshipSuggestion.ts`. This route writes
 * nothing — it is read-only advice; the steward's Accept still goes through
 * the EXISTING `POST /api/invariants/[id]/edges`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { reconcilePromotedCohort } from '@/services/research/populationReconciliation';
import { resolveSuccessorConstructionCohort } from '@/services/research/crystalCohortMembership';
import { getInvariantById } from '@/services/invariants';
import { suggestRelationships } from '@/services/invariants/relationshipSuggestion';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_ACQUISITION_DOMAIN = 'financial-services';

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

  let body: { invariantId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }
  const invariantId = typeof body.invariantId === 'string' ? body.invariantId.trim() : '';
  if (!invariantId) {
    return NextResponse.json({ ok: false, error: 'invariantId is required' }, { status: 400 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });
  }

  const acquisitionDomain =
    req.nextUrl.searchParams.get('acquisitionDomain')?.trim() || DEFAULT_ACQUISITION_DOMAIN;
  const [resolution, candidateInvariant] = await Promise.all([
    resolveSuccessorConstructionCohort(admin, experimentId, acquisitionDomain),
    getInvariantById(invariantId).catch(() => null),
  ]);
  if (!resolution.promotedForConstruction) {
    return NextResponse.json({ ok: false, error: 'the promoted cohort could not be read' }, { status: 502 });
  }
  if (!candidateInvariant) {
    return NextResponse.json({ ok: false, error: `invariant '${invariantId}' not found` }, { status: 404 });
  }
  const cohort = await reconcilePromotedCohort(resolution.promotedForConstruction);
  if (!cohort.invariantIds.includes(invariantId)) {
    return NextResponse.json(
      { ok: false, error: `'${invariantId}' is not a member of the current successor construction cohort` },
      { status: 409 },
    );
  }

  // The target-Crystal membership universe (operator ruling, 2026-08-31):
  // other successor cohort members AND inherited predecessor members — see
  // this route's own header for why an arbitrary out-of-Crystal invariant
  // must never appear here.
  const candidatePool = [...cohort.members, ...(resolution.context.frozenGenerationMembers ?? [])];

  const result = await suggestRelationships(
    { id: invariantId, statement: candidateInvariant.statement },
    candidatePool,
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, suggestions: result.suggestions }, { headers: { 'Cache-Control': 'no-store' } });
}
