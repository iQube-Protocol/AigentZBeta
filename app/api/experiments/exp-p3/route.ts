/**
 * /api/experiments/exp-p3 — EXP-P3 / D1 Capability Validation runner.
 *
 * GET  → dataset status: is a SEALED change-set present, and how many cases?
 *        (No auth needed beyond the spine — status only, no measurement.)
 * POST → run both arms (field projection vs baseline retrieval) over the sealed
 *        change-set and return per-case + aggregate precision/recall/F1.
 *        Admin-OR-entitled (scoped to EXP-P3). Refuses to run against an unsealed
 *        or empty set — the harness never measures against fabricated ground truth.
 *
 * The change-set is authored + sealed by the operator/researcher in
 * services/experiments/exp-p3-changeset.json (sealed:true, cases:[…]).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { checkExperimentQuota } from '@/services/billing/experimentQuota';
import { runExpP3, type ChangeSetFile } from '@/services/experiments/expP3';
import changeSet from '@/services/experiments/exp-p3-changeset.json';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const DATA = changeSet as ChangeSetFile;

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  return NextResponse.json({
    ok: true,
    experiment: 'EXP-P3',
    datasetSealed: Boolean(DATA.sealed),
    caseCount: Array.isArray(DATA.cases) ? DATA.cases.length : 0,
    minCases: 20,
    note: DATA.note ?? null,
  });
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
  const quotaClient = getSupabaseServer();
  if (!quotaClient) return NextResponse.json({ error: 'storage unavailable' }, { status: 500 });
  const quota = await checkExperimentQuota(quotaClient, persona.personaId, new Date(), isAdmin, 'EXP-P3');
  if (!quota.allowed) {
    return NextResponse.json({ error: 'forbidden', message: quota.reason ?? 'Research access required' }, { status: 403 });
  }

  // Honest gate: no sealed ground truth → no run. Never measure against nothing.
  if (!DATA.sealed || !Array.isArray(DATA.cases) || DATA.cases.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'dataset_unsealed',
        message:
          'EXP-P3 has no sealed change-set yet. Author >=20 changes with ground-truthed affected sets in services/experiments/exp-p3-changeset.json and set sealed=true, then run.',
        datasetSealed: Boolean(DATA.sealed),
        caseCount: Array.isArray(DATA.cases) ? DATA.cases.length : 0,
      },
      { status: 409 },
    );
  }

  try {
    const { results, aggregate } = await runExpP3(DATA.cases);
    return NextResponse.json({ ok: true, experiment: 'EXP-P3', at: new Date().toISOString(), aggregate, results });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
