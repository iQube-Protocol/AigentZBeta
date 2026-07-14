/**
 * POST /api/dev-command-center/github/merge — merge a PR into dev from within
 * the platform (the human execution gate, in-app; 2026-07-14).
 *
 * Completes the DCC development loop: pack → dispatch (Claude implements in
 * CI) → PR → **operator merges HERE** → Amplify deploys dev. The operator's
 * deliberate click IS the CFS-016 D1 human gate — the surface moved into the
 * platform, the authority did not move off the human. GitHub's own branch
 * protection / required checks are still enforced server-side by the merge
 * API (a 405 from GitHub surfaces honestly).
 *
 * Scope guard: only PRs whose BASE is `dev` can be merged here — this is the
 * deploy lane the DCC flow owns. Anything else (main, feature bases) stays a
 * github.com act. The merge-commit message names the PR + head branch (the
 * CLAUDE.md descriptive-merge rule; never a bare default).
 *
 * Receipted as `deployment_authorized` (CFS-020 Deployment class): merging to
 * dev IS authorizing a deploy — Amplify builds dev on merge. T2-safe summary
 * (PR number/title/head/sha — no persona identifier).
 *
 * Admin-gated (spine). GITHUB_TOKEN server-side only. Body:
 *   { pullNumber: number, expectedHeadSha?: string }
 * expectedHeadSha (when supplied) is passed to GitHub's merge API — the merge
 * fails 409 if the head moved since the operator reviewed it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { GITHUB_REPO, githubConfigured, GITHUB_MISSING_ENV } from '@/app/api/dev-command-center/_lib/github';

export const dynamic = 'force-dynamic';

const GH_HEADERS = () => ({
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  if (!githubConfigured()) {
    return NextResponse.json({ ok: false, configured: false, missingEnv: GITHUB_MISSING_ENV }, { status: 503 });
  }

  let body: { pullNumber?: unknown; expectedHeadSha?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const pullNumber = typeof body.pullNumber === 'number' && Number.isInteger(body.pullNumber) ? body.pullNumber : null;
  if (!pullNumber || pullNumber <= 0) {
    return NextResponse.json({ ok: false, error: 'pullNumber (positive integer) is required' }, { status: 400 });
  }
  const expectedHeadSha = typeof body.expectedHeadSha === 'string' && body.expectedHeadSha.trim()
    ? body.expectedHeadSha.trim()
    : undefined;

  // 1) Read the PR — verify it is open and targets dev BEFORE any write.
  const prRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/pulls/${pullNumber}`, {
    headers: GH_HEADERS(),
    cache: 'no-store',
  });
  if (!prRes.ok) {
    return NextResponse.json(
      { ok: false, error: `PR #${pullNumber} could not be read (GitHub ${prRes.status})` },
      { status: 502 },
    );
  }
  const pr = (await prRes.json()) as {
    state?: string;
    title?: string;
    head?: { ref?: string; sha?: string };
    base?: { ref?: string };
    mergeable?: boolean | null;
    mergeable_state?: string;
  };
  if (pr.state !== 'open') {
    return NextResponse.json({ ok: false, error: `PR #${pullNumber} is not open (state: ${pr.state})` }, { status: 409 });
  }
  if (pr.base?.ref !== 'dev') {
    // The deploy lane this surface owns — anything else stays a github.com act.
    return NextResponse.json(
      { ok: false, error: `PR #${pullNumber} targets '${pr.base?.ref}' — only PRs into dev can be merged from the platform` },
      { status: 403 },
    );
  }
  const title = (pr.title ?? '').slice(0, 140);
  const headRef = pr.head?.ref ?? 'unknown';

  // 2) Merge — GitHub enforces branch protection + required checks here; a
  //    405 (not mergeable) or 409 (head moved) surfaces honestly to the card.
  const mergeRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/pulls/${pullNumber}/merge`, {
    method: 'PUT',
    headers: GH_HEADERS(),
    body: JSON.stringify({
      merge_method: 'merge',
      // Descriptive merge message (CLAUDE.md rule) — names the content merged.
      commit_title: `Merge PR #${pullNumber}: ${title} (${headRef})`,
      ...(expectedHeadSha ? { sha: expectedHeadSha } : {}),
    }),
    cache: 'no-store',
  });
  const mergeData = (await mergeRes.json().catch(() => ({}))) as { merged?: boolean; sha?: string; message?: string };
  if (!mergeRes.ok || mergeData.merged !== true) {
    const hint =
      mergeRes.status === 405
        ? ' (not mergeable — checks failing/pending, conflicts, or branch protection)'
        : mergeRes.status === 409
        ? ' (the head moved since review — refresh and re-review)'
        : '';
    return NextResponse.json(
      { ok: false, error: `merge refused by GitHub (${mergeRes.status})${hint}: ${mergeData.message ?? 'no detail'}` },
      { status: 502 },
    );
  }

  // 3) The authorization record — merging to dev IS authorizing the deploy
  //    (Amplify builds dev on merge). Best-effort, but a failed receipt is
  //    reported honestly alongside the successful merge.
  let receiptId: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: persona.personaId,
      actionType: 'deployment_authorized',
      summary:
        `PR #${pullNumber} merged to dev from the platform (human execution gate): ` +
        `"${title}" — head ${headRef}, merge ${String(mergeData.sha ?? '').slice(0, 10)}. ` +
        'Amplify deploys dev on merge (CFS-016 D1 — the operator authorized in-app).',
      activeCartridge: 'agentiq',
      contextShared: ['dev-command-center'],
    });
    receiptId = receipt?.id ?? null;
  } catch {
    // Receipt is provenance, not a gate — the merge already happened.
  }

  return NextResponse.json({
    ok: true,
    merged: true,
    pullNumber,
    sha: mergeData.sha ?? null,
    receiptId,
    note: 'Merged to dev — Amplify is building the deploy now. The merge is the D1 human gate, exercised in-app.',
  });
}
