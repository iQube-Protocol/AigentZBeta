/**
 * POST /api/research/track2/[experimentId]/reconcile — the Population
 * Reconciliation Board's executable act (al, 2026-08-04, Track 2 Stage 5).
 * Steward-gated.
 *
 *   > "The operator must be able to complete the repair from the place
 *   >  where the exception is surfaced." — not a navigation instruction.
 *
 * Body:
 *   { treatments: [{ candidateId: string; treatment: 'repair' | 'exclude'; reason?: string }] }
 *
 * Each treatment is applied through the EXISTING canonical capability
 * (services/invariants/discoveryEngine.ts's `repairPromotedCandidateInvariant
 * Link` / `excludeCandidateFromCrystal`) — this route never writes
 * `discovery_candidates` itself. Every record is receipted individually
 * (`population_record_repaired` | `population_record_excluded`), and a
 * partial batch failure is disclosed per-record, never summarised as one
 * pass/fail (al: "the batch action must still create per-record receipts and
 * disclose partial failure").
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import {
  repairPromotedCandidateInvariantLink,
  excludeCandidateFromCrystal,
} from '@/services/invariants/discoveryEngine';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ReconcileTreatment {
  candidateId: string;
  treatment: 'repair' | 'exclude';
  /** Required for 'exclude' — "an exclusion without a reason is not an exclusion, it is a disappearance." */
  reason?: string;
}

interface ReconcileOutcome {
  candidateId: string;
  treatment: 'repair' | 'exclude';
  ok: boolean;
  detail: string;
  invariantId?: string;
  receiptId?: string | null;
}

const FROM_STAGE_ID = 'review-and-promote';
const TO_STAGE_ID = 'classify-provenance';

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

  let body: { treatments?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }
  const treatments = Array.isArray(body.treatments) ? (body.treatments as ReconcileTreatment[]) : [];
  if (treatments.length === 0) {
    return NextResponse.json({ ok: false, error: 'treatments must be a non-empty array' }, { status: 400 });
  }
  for (const t of treatments) {
    if (typeof t.candidateId !== 'string' || !t.candidateId.trim()) {
      return NextResponse.json({ ok: false, error: 'every treatment requires a candidateId' }, { status: 400 });
    }
    if (t.treatment !== 'repair' && t.treatment !== 'exclude') {
      return NextResponse.json({ ok: false, error: `treatment must be 'repair' or 'exclude', got '${t.treatment}'` }, { status: 400 });
    }
    if (t.treatment === 'exclude' && (typeof t.reason !== 'string' || !t.reason.trim())) {
      return NextResponse.json(
        { ok: false, error: `candidate "${t.candidateId}": an exclusion reason is required` },
        { status: 400 },
      );
    }
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });
  }

  // EACH RECORD, INDEPENDENTLY — one outcome, one receipt attempt per record,
  // so a failure on record 2 never withholds the outcome already produced
  // for record 1 (al: "disclose partial failure").
  const outcomes: ReconcileOutcome[] = [];
  for (const t of treatments) {
    if (t.treatment === 'repair') {
      const result = await repairPromotedCandidateInvariantLink(admin, t.candidateId);
      if (!result.ok) {
        outcomes.push({ candidateId: t.candidateId, treatment: 'repair', ok: false, detail: result.detail });
        continue;
      }
      const receipt = await createActivityReceipt({
        personaId: persona.personaId,
        activeCartridge: 'agentiq',
        actionType: 'population_record_repaired',
        summary: `Repaired and included promoted candidate ${t.candidateId} — attached invariant ${result.invariantId} (exact-statement match)`,
        actionInput: {
          candidateId: t.candidateId,
          invariantId: result.invariantId,
          crystalId: experimentId,
          fromStageId: FROM_STAGE_ID,
          toStageId: TO_STAGE_ID,
          treatment: 'repair',
        },
      }).catch(() => null);
      outcomes.push({
        candidateId: t.candidateId,
        treatment: 'repair',
        ok: true,
        detail: `attached invariant ${result.invariantId}`,
        invariantId: result.invariantId,
        receiptId: receipt?.id ?? null,
      });
      continue;
    }

    // treatment === 'exclude'
    const result = await excludeCandidateFromCrystal(admin, t.candidateId, {
      reason: (t.reason as string).trim(),
      excludedBy: persona.personaId,
      crystalId: experimentId,
      fromStageId: FROM_STAGE_ID,
      toStageId: TO_STAGE_ID,
    });
    if (!result.ok) {
      outcomes.push({ candidateId: t.candidateId, treatment: 'exclude', ok: false, detail: result.detail });
      continue;
    }
    const receipt = await createActivityReceipt({
      personaId: persona.personaId,
      activeCartridge: 'agentiq',
      actionType: 'population_record_excluded',
      summary: `Explicitly excluded promoted candidate ${t.candidateId} from the crystal — ${(t.reason as string).trim()}`,
      actionInput: {
        candidateId: t.candidateId,
        reason: (t.reason as string).trim(),
        crystalId: experimentId,
        fromStageId: FROM_STAGE_ID,
        toStageId: TO_STAGE_ID,
        treatment: 'exclude',
      },
    }).catch(() => null);
    outcomes.push({
      candidateId: t.candidateId,
      treatment: 'exclude',
      ok: true,
      detail: 'excluded',
      receiptId: receipt?.id ?? null,
    });
  }

  const succeeded = outcomes.filter((o) => o.ok).length;
  const failed = outcomes.length - succeeded;

  return NextResponse.json(
    {
      ok: failed === 0,
      outcomes,
      summary: `${succeeded} of ${outcomes.length} treatment(s) applied` + (failed > 0 ? `; ${failed} failed — see each outcome's detail` : ''),
    },
    { headers: { 'Cache-Control': 'no-store' }, status: failed === 0 ? 200 : 207 },
  );
}
