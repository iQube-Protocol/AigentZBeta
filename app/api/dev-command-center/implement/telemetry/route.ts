/**
 * POST /api/dev-command-center/implement/telemetry — the CI callback that
 * closes the Phase F bounded-execution loop (operator-directed 2026-08-16).
 *
 * Called from `.github/workflows/claude-implement.yml`'s post-execution step
 * (`if: always()`, runs whether Claude Code's own step succeeded or failed)
 * with the raw terminal result JSON the Claude Code CLI already writes to
 * `/home/runner/work/_temp/claude-execution-output.json` — the SAME file
 * `show_full_output: true` was added to surface (2026-07-14). This route:
 *
 *   1. Extracts telemetry from that JSON (`executionTelemetry.ts`) — never a
 *      second measurement mechanism.
 *   2. Evaluates it against the pack's OWN declared `executionBudget`
 *      (`evaluateBudget` — the governor; this route is not one, it only
 *      calls the existing pure comparison).
 *   3. Records a best-effort `implementation_execution_observed` receipt —
 *      the durable observation ledger.
 *   4. If the budget was exceeded AND an open PR exists for the branch,
 *      comments on it flagging `awaiting-escalation` — never blocks or
 *      alters the PR's mergeability, never touches the human merge gate.
 *
 * Auth: CRON_TRIGGER_TOKEN, the SAME infra-driven convention already used by
 * `/api/ops/dvn/attestation-processor-cron` and its siblings — this route is
 * called from GitHub Actions CI, never from a browser, so it is never
 * persona-session-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GITHUB_REPO, githubConfigured } from '@/app/api/dev-command-center/_lib/github';
import { ghOpenPulls } from '@/app/api/dev-command-center/_lib/github';
import {
  extractClaudeCodeTelemetry,
  recordExecutionTelemetry,
  toObservedExecutionCounters,
} from '@/services/constitutional/executionTelemetry';
import { evaluateBudget, type ExecutionBudget } from '@/services/constitutional/executionBudget';

export const dynamic = 'force-dynamic';

/** The persona of record for CI-originated receipts — mirrors the existing
 *  convention of scoping infra-driven receipts to a fixed system persona
 *  rather than inventing a caller-supplied one (no browser caller exists
 *  here to have a persona in the first place). */
const CI_SYSTEM_PERSONA_ID = 'system:devon-implementation-actor';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { packId?: unknown; branch?: unknown; resultJson?: unknown; budget?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const packId = typeof body.packId === 'string' ? body.packId : '';
  const branch = typeof body.branch === 'string' ? body.branch : '';
  if (!packId || !branch) {
    return NextResponse.json({ error: 'packId and branch are required' }, { status: 400 });
  }
  const budget = (body.budget && typeof body.budget === 'object' ? body.budget : null) as ExecutionBudget | null;

  const telemetry = extractClaudeCodeTelemetry(body.resultJson);
  const counters = toObservedExecutionCounters(telemetry);
  const evaluation = budget
    ? evaluateBudget(budget, counters)
    : { state: 'proceeding' as const, exceeded: [] };

  const receiptId = await recordExecutionTelemetry({
    actingPersonaId: CI_SYSTEM_PERSONA_ID,
    packId,
    branch,
    executionState: evaluation.state,
    telemetry,
  });

  let prComment: { attempted: boolean; posted: boolean; prNumber: number | null; note: string } = {
    attempted: false,
    posted: false,
    prNumber: null,
    note: 'no escalation — budget within envelope',
  };

  if (evaluation.state === 'awaiting-escalation' && githubConfigured()) {
    prComment.attempted = true;
    const openPulls = await ghOpenPulls(50);
    const matching = openPulls.ok ? (openPulls.data ?? []).find((p) => p.headRef === branch) : null;
    if (matching) {
      const commentBody =
        `**awaiting-escalation** — this implementation run exceeded its execution budget ` +
        `(${evaluation.exceeded.join(', ')}). The PR is unaffected and human review/merge proceeds normally; ` +
        `this is a signal that a larger envelope or human attention may be needed for follow-up work on this pack.\n\n` +
        `Observed: provider ${telemetry.provider}, model ${telemetry.model ?? 'unknown'}, ` +
        `${telemetry.turns ?? '?'} turns, ${telemetry.wallClockMs !== null ? Math.round(telemetry.wallClockMs / 1000) : '?'}s, ` +
        `cost ${telemetry.observedCostUsd !== null ? `$${telemetry.observedCostUsd.toFixed(2)}` : 'unknown'}.`;
      try {
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/issues/${matching.number}/comments`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({ body: commentBody }),
            cache: 'no-store',
          },
        );
        prComment = {
          attempted: true,
          posted: res.ok,
          prNumber: matching.number,
          note: res.ok ? 'awaiting-escalation comment posted' : `comment post failed (${res.status})`,
        };
      } catch (err) {
        prComment = {
          attempted: true,
          posted: false,
          prNumber: matching.number,
          note: `comment post failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    } else {
      prComment.note = 'awaiting-escalation, but no open PR found for this branch yet';
    }
  }

  return NextResponse.json({
    ok: true,
    packId,
    branch,
    executionState: evaluation.state,
    exceeded: evaluation.exceeded,
    telemetry,
    receiptId,
    prComment,
  });
}
