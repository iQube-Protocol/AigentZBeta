/**
 * GET/POST /api/research/crystal/[experimentId]/rehearsal — the two-mode
 * execution model's internal-rehearsal surface (operator ruling, 2026-09-07:
 * "Update the experiment execution model so we can rehearse internally
 * without weakening the registered confirmatory protocol.").
 *
 * GET  — read-only. Resolves the frozen substrate (never a hardcoded
 *        generation — `latestFrozenCrystalArtifact`), rehearsal eligibility,
 *        the confirmatory execution's outstanding blockers (derived from the
 *        REGISTERED protocol's own `PROTOCOL_FREEZE_ARTIFACT_KINDS` ladder,
 *        never invented), and a SUMMARY of past rehearsal runs (no
 *        taskResults — those can be large across many runs). Admin-gated,
 *        same posture as the freeze route's own GET.
 *
 *        `?runId=<the run's full id>` — returns the FULL detail (including
 *        every task's per-arm scores/groundingInvariantIds) for ONE past
 *        run instead of the status summary, so the operator can review what
 *        a completed rehearsal actually did.
 *
 * POST — launches ONE internal rehearsal run. Refuses outright unless the
 *        current substrate is frozen with `executionDesignation:
 *        'internal-pilot'` — see `rehearsalEligibility`
 *        (services/research/expP1Rehearsal.ts). Never accepts a caller-
 *        supplied `runExecutionDesignation` or `confirmatoryEligible` — both
 *        are fixed by the runner itself, unconditionally, so this route can
 *        never be used to launch (or mislabel) a confirmatory execution.
 *
 *        The ONE body field this route reads: `taskSetVersion` (`'v1'` |
 *        `'v2'` | `'v3'`, default `'v1'`) — a lookup key into a fixed, checked-in
 *        allowlist of PROVISIONAL task-set fixtures
 *        (`services/research/expP1Rehearsal.ts`'s own exports), never an
 *        arbitrary caller-supplied task set. Any other/missing value falls
 *        back to `'v1'` — never a caller-controlled task-set CONTENT
 *        injection, only a selection between two names this codebase
 *        already ships.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { deriveProtocolRatified, getExecutionRun } from '@/services/research/artifacts';
import { listExecutionRuns } from '@/services/research/artifacts';
import {
  LARGER_REHEARSAL_TASK_SET,
  PROVISIONAL_REHEARSAL_TASK_SET,
  UNSEEN_REHEARSAL_TASK_SET,
  rehearsalEligibility,
  runExpP1Rehearsal,
  summarizeRehearsalRun,
  type ProvisionalTaskSet,
} from '@/services/research/expP1Rehearsal';
import type { FrozenArtifactKind } from '@/types/research';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Fixed, checked-in allowlist — the ONLY task sets this route can ever
 *  launch. Adding a version means adding a fixture export + a line here,
 *  never accepting caller-supplied task content. */
const TASK_SET_ALLOWLIST: Record<string, ProvisionalTaskSet> = {
  v1: PROVISIONAL_REHEARSAL_TASK_SET,
  v2: LARGER_REHEARSAL_TASK_SET,
  // v3 — the unseen set for evaluating the corrected (task-scoped) Arm B
  // selector (2026-09-07 Arm B selection-fidelity fix). Never reuse v2 as
  // the primary evaluation set for that fix — see UNSEEN_REHEARSAL_TASK_SET's
  // own header.
  v3: UNSEEN_REHEARSAL_TASK_SET,
};

const CRYSTAL_VERSION_ID_PATTERN = /\/crystal-vP(\d+)$/;

/** Human-readable labels for the registered protocol's own freeze ladder —
 *  never a second, invented ontology. `crystal-version`'s confirmatory
 *  freeze is reported separately (it's already surfaced by
 *  FreezeVP2InternalPilotAction) so this list is scoped to the remaining six. */
const CONFIRMATORY_BLOCKER_LABELS: Partial<Record<FrozenArtifactKind, string>> = {
  'task-set': 'awaiting sealed held-out task set',
  'arm-config': 'awaiting external Arm D prose',
  'answer-key': 'awaiting externally-authored answer key',
  'judge-config': 'awaiting external judge configuration + rubric',
  'analysis-config': 'awaiting analysis configuration freeze',
  'interpretation-table': 'awaiting interpretation table freeze',
};

/** Always present — this codebase has no mechanism to track Austin's
 *  countersignature (it is an out-of-band, external event); listing it
 *  honestly rather than inventing a boolean nothing here can ever set. */
const EXTERNAL_COUNTERSIGNATURE_BLOCKER = 'awaiting external countersignature';

export async function GET(req: NextRequest, { params }: { params: Promise<{ experimentId: string }> }) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ requestSucceeded: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ requestSucceeded: false, error: 'Steward access required' }, { status: 403 });
  }
  const { experimentId } = await params;

  const runId = req.nextUrl.searchParams.get('runId');
  if (runId) {
    const run = await getExecutionRun(runId);
    if (!run || run.experimentId !== experimentId || run.runExecutionDesignation !== 'internal-rehearsal') {
      return NextResponse.json({ requestSucceeded: false, error: `no internal-rehearsal run '${runId}' found for '${experimentId}'` }, { status: 404 });
    }
    return NextResponse.json(
      { requestSucceeded: true, run, summary: summarizeRehearsalRun(run) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const eligibility = await rehearsalEligibility(experimentId);
  const generationMatch = eligibility.frozenCrystalArtifactId?.match(CRYSTAL_VERSION_ID_PATTERN);
  const frozenSubstrateLabel = generationMatch
    ? `Crystal vP${generationMatch[1]} · internal/pilot`
    : null;

  const protocol = await deriveProtocolRatified(experimentId);
  const confirmatoryBlockers = [
    EXTERNAL_COUNTERSIGNATURE_BLOCKER,
    ...protocol.missing.map((k) => CONFIRMATORY_BLOCKER_LABELS[k] ?? `awaiting ${k} freeze`),
  ];

  const runs = await listExecutionRuns(experimentId);
  const pastRehearsalRuns = runs
    .filter((r) => r.runExecutionDesignation === 'internal-rehearsal')
    .map((r) => ({
      id: r.id,
      frozenAt: r.frozenAt,
      taskSetId: r.taskSetId,
      taskSetProvenance: r.taskSetProvenance,
      armIds: r.armIds,
      taskCount: r.taskResults.length,
      receiptId: r.receiptId,
    }));

  return NextResponse.json(
    {
      requestSucceeded: true,
      eligibility,
      frozenSubstrateLabel,
      confirmatoryBlockers,
      pastRehearsalRuns,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

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
  const requestedVersion = typeof body?.taskSetVersion === 'string' ? body.taskSetVersion : 'v1';
  const taskSet = TASK_SET_ALLOWLIST[requestedVersion] ?? TASK_SET_ALLOWLIST.v1;

  const result = await runExpP1Rehearsal({ personaId: persona.personaId, experimentId, taskSet });
  if (!result.ok) {
    return NextResponse.json({ requestSucceeded: false, error: result.error }, { status: 409 });
  }

  return NextResponse.json(
    {
      requestSucceeded: true,
      runId: result.runId,
      receiptId: result.receiptId ?? null,
      taskResults: result.taskResults,
      // The FULL persisted artifact — the SAME shape `?runId=` returns for a
      // past run, so the UI's "copy as JSON" affordance has one shape to
      // work with whether the run just completed or is looked up later.
      run: result.run,
      summary: result.run ? summarizeRehearsalRun(result.run) : null,
      note:
        'INTERNAL / NON-CONFIRMATORY / NOT VALID SCIENTIFIC EVIDENCE — this run may never be promoted into the ' +
        'confirmatory EXP-P1 result set. It exercised the pipeline against the frozen internal-pilot substrate ' +
        'only; the registered confirmatory protocol (external countersignature, sealed held-out task set, ' +
        'externally-authored Arm D prose) is unaffected and unbypassed.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
