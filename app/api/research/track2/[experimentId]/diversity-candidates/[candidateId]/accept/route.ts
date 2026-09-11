/**
 * POST /api/research/track2/[experimentId]/diversity-candidates/[candidateId]/accept
 * — Stage 9's "Extract and validate" act (operator direction, 2026-08-05).
 *
 * Promotes the named candidate with the STEWARD-CONFIRMED `semanticType` (the
 * exact value the diversity-candidates GET response showed them — never
 * re-derived here, so what the steward approved is what gets written), then
 * advances it to `validated`. This is the ONLY path that can ever set a
 * semantic type other than `constraint` (see promoteCandidate's own doc
 * comment) — closing the gap that kept every crystal's structural-diversity
 * check permanently stuck at one shape.
 *
 * ── What this deliberately does NOT do ─────────────────────────────────────
 *
 * It does not classify evidence provenance and does not assign the new
 * invariant to the crystal domain — those are Stage 5 and Stage 8's own
 * governed acts, each with its own rationale requirement, and bypassing them
 * here would be exactly the "invented shortcut around readiness" the
 * operator ruled out. The newly-validated invariant is picked up by the
 * EXISTING Classification Queue and Assignment Control the moment the
 * steward reloads the programme — no second, parallel path is created.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { promoteCandidate } from '@/services/invariants/discoveryEngine';
import { validateInvariant } from '@/services/invariants';
import { INVARIANT_SEMANTIC_TYPES, type InvariantSemanticType } from '@/types/invariants';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isValidSemanticType(v: unknown): v is InvariantSemanticType {
  return typeof v === 'string' && (INVARIANT_SEMANTIC_TYPES as readonly string[]).includes(v);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string; candidateId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  }

  const { experimentId, candidateId } = await params;
  const declaration = crystalDomainForExperiment(experimentId);
  if (!declaration) {
    return NextResponse.json(
      { ok: false, error: `no crystal domain is declared for experiment '${experimentId}'` },
      { status: 404 },
    );
  }

  let body: { semanticType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }
  if (!isValidSemanticType(body.semanticType)) {
    return NextResponse.json(
      { ok: false, error: `semanticType must be one of: ${INVARIANT_SEMANTIC_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });
  }

  const promotion = await promoteCandidate(
    admin,
    candidateId,
    { personaId: persona.personaId },
    [],
    body.semanticType,
  );
  if (!promotion.ok) {
    return NextResponse.json({ ok: false, error: promotion.error }, { status: 409 });
  }

  let validated = false;
  let validationDetail = '';
  try {
    const { verdict } = await validateInvariant(promotion.invariantId, { personaId: persona.personaId });
    validated = verdict.ok;
    validationDetail = verdict.ok ? '' : verdict.checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.detail ?? 'failed'}`).join('; ');
  } catch (e) {
    validationDetail = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(
    {
      ok: true,
      invariantId: promotion.invariantId,
      semanticType: body.semanticType,
      validated,
      validationDetail: validated ? null : validationDetail,
      note: validated
        ? `Promoted as '${body.semanticType}' and validated. It still needs evidence-provenance classification ` +
          '(Stage 5) and crystal assignment (Stage 8) before readiness counts it — both queues now include it.'
        : `Promoted as '${body.semanticType}' but validation did not pass (${validationDetail}). Advance it ` +
          'manually once the blocking check is resolved.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
