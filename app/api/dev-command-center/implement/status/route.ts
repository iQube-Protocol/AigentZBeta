/**
 * GET /api/dev-command-center/implement/status — DevOn UI Refinement Phase D,
 * the execution-status seam.
 *
 * Read-only. Answers exactly one question: what does GitHub itself say about
 * the Claude Code dispatch for this pack? Nothing here writes, merges, or
 * enables auto-merge — the human PR merge remains the only execution
 * authorization (CFS-016 D1), unchanged by this route.
 *
 * WHY `since` IS REQUIRED FOR CORRELATION, NOT branch name: the dispatch
 * (`POST /implement`) fires a `repository_dispatch`, which GitHub answers
 * with 204 and no run id. The workflow's OWN job then creates and checks out
 * the `aigentz/pack-*` branch — but a repository_dispatch-triggered run's
 * `head_branch` reflects the ref context at TRIGGER time (the default
 * branch), not the branch the job creates. So `?branch=` filtering on
 * `/actions/.../runs` would silently match nothing. Correlating by "the
 * earliest claude-implement.yml run created at/after our own dispatch
 * timestamp" is what actually identifies THIS dispatch, and the timestamp is
 * something the client already has (it's the moment the `invoked` actor
 * event fired) — no new server-side state to persist.
 *
 * Truthful coarse state, per the operator's instruction: only three facts are
 * ever read from GitHub — queued/in_progress, completed+success,
 * completed+failure(/cancelled/timed_out) — and mapped onto exactly
 * 'working' | 'completed' | 'failed'. No log scraping, no invented
 * sub-status. A completed Claude Code run maps to 'completed' only once an
 * actual PR is found for the branch — never on the run's own success alone —
 * because "successful implementation requiring merge" is the fact this
 * endpoint reports; the separate DevOn 'awaiting-authorization' event is the
 * client's concern (ImplementationLayout), not this route's.
 *
 * `selectCorrelatedRun` and `mapRunToStatus` are extracted as pure functions
 * so the truth-mapping is directly unit-testable (tests/devon-ui-phase-d-
 * execution-status.test.ts) without mocking the request/auth/network chain.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { dispatchBranchFor } from '@/app/api/dev-command-center/implement/route';
import {
  githubConfigured,
  GITHUB_MISSING_ENV,
  ghWorkflowRuns,
  ghPullsForBranch,
  type GhWorkflowRun,
} from '@/app/api/dev-command-center/_lib/github';

export const dynamic = 'force-dynamic';

const CLAUDE_IMPLEMENT_WORKFLOW_FILE = 'claude-implement.yml';
const FAILURE_CONCLUSIONS = new Set(['failure', 'cancelled', 'timed_out']);

export type DccExecutionStatus = 'working' | 'completed' | 'failed';

/**
 * The earliest claude-implement.yml run created at/after `sinceIso` — see the
 * file header for why chronology, not branch name, is the correlation key.
 * `undefined`/unparsable `sinceIso` disables the filter (every run is a
 * candidate; only used when a caller genuinely has no dispatch timestamp).
 */
export function selectCorrelatedRun(runs: readonly GhWorkflowRun[], sinceIso: string | null): GhWorkflowRun | undefined {
  const sinceMs = sinceIso ? Date.parse(sinceIso) : NaN;
  return [...runs]
    .filter((run) => (Number.isNaN(sinceMs) ? true : Date.parse(run.createdAt) >= sinceMs - 5000))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
}

/**
 * The ENTIRE truth-mapping, in one place: only three GitHub facts ever come
 * in (not-completed, completed+one-of-FAILURE_CONCLUSIONS, completed+success)
 * and only three statuses ever go out. `prFound` is passed in rather than
 * fetched here so this stays a pure function — the route fetches it only
 * when `run.conclusion === 'success'` (never wastes a PR lookup otherwise).
 */
export function mapRunToStatus(run: Pick<GhWorkflowRun, 'status' | 'conclusion'> | undefined, prFound: boolean): DccExecutionStatus {
  if (!run || run.status !== 'completed') return 'working';
  if (run.conclusion && FAILURE_CONCLUSIONS.has(run.conclusion)) return 'failed';
  if (run.conclusion === 'success') return prFound ? 'completed' : 'working';
  // Any conclusion outside the three named facts (e.g. 'neutral', 'skipped',
  // 'action_required') is never invented as success or failure.
  return 'working';
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  if (!githubConfigured()) {
    return NextResponse.json({ ok: false, configured: false, missingEnv: GITHUB_MISSING_ENV }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const packId = searchParams.get('packId')?.trim() ?? '';
  const since = searchParams.get('since')?.trim() ?? '';
  if (!packId) {
    return NextResponse.json({ ok: false, error: 'packId is required' }, { status: 400 });
  }
  const branch = dispatchBranchFor(packId);

  const runsResult = await ghWorkflowRuns(CLAUDE_IMPLEMENT_WORKFLOW_FILE);
  if (!runsResult.ok) {
    // GitHub itself is unreachable/erroring — never fabricate a status from silence.
    return NextResponse.json({ ok: false, error: runsResult.error ?? 'GitHub Actions query failed' }, { status: 502 });
  }

  const run = selectCorrelatedRun(runsResult.data ?? [], since || null);

  // A PR lookup is only ever needed to confirm a successful run — never
  // spent otherwise (working/failed are fully decided by the run alone).
  let prFound = false;
  let prNumber: number | undefined;
  let prUrl: string | undefined;
  let merged: boolean | undefined;
  if (run?.status === 'completed' && run.conclusion === 'success') {
    const prsResult = await ghPullsForBranch(branch);
    const pr = prsResult.ok ? prsResult.data?.[0] : undefined;
    if (pr) {
      prFound = true;
      prNumber = pr.number;
      prUrl = pr.htmlUrl;
      merged = pr.merged;
    }
  }

  const status = mapRunToStatus(run, prFound);
  return NextResponse.json({
    ok: true,
    status,
    branch,
    runUrl: run?.htmlUrl,
    runConclusion: run?.conclusion ?? undefined,
    ...(status === 'completed' ? { prNumber, prUrl, merged } : {}),
  });
}
