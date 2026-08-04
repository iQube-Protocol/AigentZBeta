/**
 * POST /api/research/track2/[experimentId]/suggest-relationships — Stage 7's
 * review-card engine (operator direction, 2026-08-04: "Ask the system: 'Show
 * me the three strongest relationships.' The steward's role becomes
 * constitutional approval, not manual graph construction.").
 *
 * Resolves the current cohort server-side (the SAME `reconcilePromotedCohort`
 * every other Track 2 route reads — never a client-supplied member list, so
 * a caller cannot inject a candidate pool from outside this crystal) and
 * delegates ranking/relation-type/rationale generation to
 * `services/invariants/relationshipSuggestion.ts`. This route writes
 * nothing — it is read-only advice; the steward's Accept still goes through
 * the EXISTING `POST /api/invariants/[id]/edges`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { listCandidates } from '@/services/invariants/discoveryEngine';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { reconcilePromotedCohort } from '@/services/research/populationReconciliation';
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
  const [candidates, candidateInvariant] = await Promise.all([
    listCandidates(admin, acquisitionDomain).catch(() => null),
    getInvariantById(invariantId).catch(() => null),
  ]);
  if (!candidates) {
    return NextResponse.json({ ok: false, error: 'the promoted cohort could not be read' }, { status: 502 });
  }
  if (!candidateInvariant) {
    return NextResponse.json({ ok: false, error: `invariant '${invariantId}' not found` }, { status: 404 });
  }
  const cohort = await reconcilePromotedCohort(candidates.filter((c) => c.status === 'promoted'));
  if (!cohort.invariantIds.includes(invariantId)) {
    return NextResponse.json(
      { ok: false, error: `'${invariantId}' is not a member of the current crystal's promoted cohort` },
      { status: 409 },
    );
  }

  const result = await suggestRelationships(
    { id: invariantId, statement: candidateInvariant.statement },
    cohort.members,
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, suggestions: result.suggestions }, { headers: { 'Cache-Control': 'no-store' } });
}
