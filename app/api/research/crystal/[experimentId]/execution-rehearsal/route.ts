/**
 * POST /api/research/crystal/[experimentId]/execution-rehearsal — the
 * genuine per-arm execution rehearsal surface (2026-09-07, split into
 * start/step 2026-09-08 — see the durability-incident resolution record for
 * why: a one-shot 64-way-concurrent POST exceeded the hosting gateway's
 * ~30s SSR ceiling and returned a 504 to the browser while the Lambda kept
 * running server-side).
 *
 * Distinct from `.../rehearsal` (the retrieval-only harness) — this route
 * calls a real pinned model per arm/task (`services/research/
 * expP1ExecutionRehearsal.ts`).  Admin-gated, same posture as every other
 * EXP-P1 governed-action route. Never accepts a caller-supplied
 * `runExecutionDesignation` or `confirmatoryEligible` — both are fixed by
 * the runner itself.
 *
 * Body shape: `{ action: 'start' | 'step', taskSetVersion?: 'v4', runId?: string }`.
 * - `action: 'start'` — creates the durable run identity (no model calls),
 *   returns `{ runId, totalTasks }` almost immediately.
 * - `action: 'step'` — requires `runId`; executes up to one bounded batch of
 *   PENDING tasks and checkpoints. Safe to call repeatedly (polling) until
 *   the response reports `status: 'executed'`. Never re-executes a task
 *   already present in the run's persisted results.
 *
 * The ONE task-set field this route reads: `taskSetVersion` (`'v4'` only
 * today — a fixed, checked-in allowlist, mirroring `.../rehearsal`'s own
 * pattern). Any other/missing value falls back to the unseen v4 set — never
 * a caller-controlled task-set CONTENT injection.
 *
 * Never triggered automatically by this codebase — a human clicks the button
 * this route backs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  startExpP1ExecutionRehearsal,
  stepExpP1ExecutionRehearsal,
  UNSEEN_EXECUTION_REHEARSAL_TASK_SET,
} from '@/services/research/expP1ExecutionRehearsal';
import { summarizeRehearsalRun } from '@/services/research/expP1Rehearsal';
import type { ProvisionalTaskSet } from '@/services/research/expP1Rehearsal';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  const action = body?.action === 'step' ? 'step' : 'start';
  const requestedVersion = typeof body?.taskSetVersion === 'string' ? body.taskSetVersion : 'v4';
  const taskSet = TASK_SET_ALLOWLIST[requestedVersion] ?? TASK_SET_ALLOWLIST.v4;

  if (action === 'start') {
    const result = await startExpP1ExecutionRehearsal({ personaId: persona.personaId, experimentId, taskSet });
    if (!result.ok) {
      return NextResponse.json({ requestSucceeded: false, error: result.error }, { status: 409 });
    }
    return NextResponse.json(
      {
        requestSucceeded: true,
        action: 'start',
        runId: result.runId,
        taskSetId: result.taskSetId,
        totalTasks: result.totalTasks,
        doneCount: result.doneCount ?? 0,
        resumed: result.resumed ?? false,
        status: 'executing',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // action === 'step'
  const runId = typeof body?.runId === 'string' ? body.runId : null;
  if (!runId) {
    return NextResponse.json({ requestSucceeded: false, error: "'step' requires a runId" }, { status: 400 });
  }

  const result = await stepExpP1ExecutionRehearsal({ personaId: persona.personaId, runId, taskSet });
  if (!result.ok) {
    return NextResponse.json({ requestSucceeded: false, error: result.error }, { status: 409 });
  }

  return NextResponse.json(
    {
      requestSucceeded: true,
      action: 'step',
      runId,
      status: result.status,
      doneCount: result.doneCount,
      totalCount: result.totalCount,
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
