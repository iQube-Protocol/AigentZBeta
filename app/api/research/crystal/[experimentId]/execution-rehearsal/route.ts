/**
 * POST /api/research/crystal/[experimentId]/execution-rehearsal — the
 * genuine per-arm execution rehearsal surface (2026-09-07).
 *
 * Distinct from `.../rehearsal` (the retrieval-only harness) — this route
 * calls a real pinned model per arm/task (`services/research/
 * expP1ExecutionRehearsal.ts`), so it is given its own longer `maxDuration`
 * rather than widening the retrieval-only route's envelope for unrelated
 * callers. Admin-gated, same posture as every other EXP-P1 governed-action
 * route. Never accepts a caller-supplied `runExecutionDesignation` or
 * `confirmatoryEligible` — both are fixed by the runner itself.
 *
 * The ONE body field this route reads: `taskSetVersion` (`'v4'` only today —
 * a fixed, checked-in allowlist, mirroring `.../rehearsal`'s own pattern).
 * Any other/missing value falls back to the unseen v4 set — never a
 * caller-controlled task-set CONTENT injection.
 *
 * Never triggered automatically by this codebase — a human clicks the button
 * this route backs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  runExpP1ExecutionRehearsal,
  UNSEEN_EXECUTION_REHEARSAL_TASK_SET,
} from '@/services/research/expP1ExecutionRehearsal';
import { summarizeRehearsalRun } from '@/services/research/expP1Rehearsal';
import type { ProvisionalTaskSet } from '@/services/research/expP1Rehearsal';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TASK_SET_ALLOWLIST: Record<string, ProvisionalTaskSet> = {
  v4: UNSEEN_EXECUTION_REHEARSAL_TASK_SET,
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ experimentId: string }> }) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ requestSucceeded: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ requestSucceeded: false, error: 'Steward access required' }, { status: 403 });
  }
  const { experimentId } = await params;

  const body = await req.json().catch(() => ({}));
  const requestedVersion = typeof body?.taskSetVersion === 'string' ? body.taskSetVersion : 'v4';
  const taskSet = TASK_SET_ALLOWLIST[requestedVersion] ?? TASK_SET_ALLOWLIST.v4;

  const result = await runExpP1ExecutionRehearsal({ personaId: persona.personaId, experimentId, taskSet });
  if (!result.ok) {
    return NextResponse.json({ requestSucceeded: false, error: result.error }, { status: 409 });
  }

  return NextResponse.json(
    {
      requestSucceeded: true,
      runId: result.runId,
      receiptId: result.receiptId ?? null,
      taskResults: result.taskResults,
      run: result.run,
      summary: result.run ? summarizeRehearsalRun(result.run) : null,
      note:
        'INTERNAL / NON-CONFIRMATORY / NOT VALID SCIENTIFIC EVIDENCE — real per-arm model execution against the ' +
        'frozen internal-pilot substrate only. The registered confirmatory EXP-P1 protocol (external ' +
        'countersignature, sealed held-out task set, externally-authored Arm D prose, a real judge/rubric) is ' +
        'unaffected and unbypassed.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
