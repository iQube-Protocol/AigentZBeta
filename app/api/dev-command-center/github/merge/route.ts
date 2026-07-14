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
 * ── Validation gate (2026-07-14, operator-ratified) ──
 * A PR whose head is an `aigentz/pack-*` branch is a DISPATCHED IMPLEMENTATION
 * of a specific pack — it merges only when a PASSING consequence-validation
 * record exists for that pack (`constitutional_validation_recorded` receipt
 * with `verdict=pass pack=<packId>`, written when the operator approves the
 * validation report in the DCC Validate stage). We deploy validated code.
 *
 * Admin override — never silent: `{ overrideValidation: true, overrideReason }`
 * (reason ≥ 10 chars) merges anyway, and the act is receipted as
 * `validation_override_granted` (DVN-anchorable) so the system can run
 * end-to-end past minor or mistaken infringements WITH a tamper-evident
 * record of who chose to and why. Non-pack PRs are ungated (their validation
 * story predates the DCC loop).
 *
 * Admin-gated (spine). GITHUB_TOKEN server-side only. Body:
 *   { pullNumber: number, expectedHeadSha?: string,
 *     overrideValidation?: boolean, overrideReason?: string }
 * expectedHeadSha (when supplied) is passed to GitHub's merge API — the merge
 * fails 409 if the head moved since the operator reviewed it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createActivityReceipt, listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';
import { GITHUB_REPO, githubConfigured, GITHUB_MISSING_ENV } from '@/app/api/dev-command-center/_lib/github';

export const dynamic = 'force-dynamic';

const GH_HEADERS = () => ({
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

/** The same slug transform dispatchBranchFor applies to a packId — used to
 *  compare a `pack=<id>` receipt tag against the PR's branch slug. Pure. */
export function packSlug(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/** Extract the pack slug from an `aigentz/pack-<slug>-<sha8>` branch, or null
 *  for any other branch (non-pack PRs are not validation-gated). Pure. */
export function packSlugFromBranch(headRef: string): string | null {
  const m = /^aigentz\/pack-(.+)-[0-9a-f]{8}$/.exec(headRef);
  return m ? m[1] : null;
}

/** Does a passing consequence-validation record exist for this pack? Scans the
 *  merging admin's own `constitutional_validation_recorded` receipts for
 *  `verdict=pass` + a `pack=<id>` tag whose slug matches the branch's. */
export function hasPassingValidation(
  receipts: Array<{ summary?: string | null }>,
  slug: string,
): boolean {
  return receipts.some((r) => {
    const s = r.summary ?? '';
    if (!s.includes('verdict=pass')) return false;
    const m = /\bpack=([^\s"]+)/.exec(s);
    return m ? packSlug(m[1]) === slug : false;
  });
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  if (!githubConfigured()) {
    return NextResponse.json({ ok: false, configured: false, missingEnv: GITHUB_MISSING_ENV }, { status: 503 });
  }

  let body: { pullNumber?: unknown; expectedHeadSha?: unknown; overrideValidation?: unknown; overrideReason?: unknown };
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

  // 1b) Validation gate — pack PRs merge only against a passing validation
  //     record, or an explicit receipted override (see header).
  const slug = packSlugFromBranch(headRef);
  const override = body.overrideValidation === true;
  const overrideReason = typeof body.overrideReason === 'string' ? body.overrideReason.trim() : '';
  let validationState: 'passed' | 'overridden' | 'ungated' = 'ungated';
  if (slug) {
    if (override) {
      if (overrideReason.length < 10) {
        return NextResponse.json(
          { ok: false, error: 'overrideReason (at least 10 characters) is required to override the validation gate' },
          { status: 400 },
        );
      }
      validationState = 'overridden';
    } else {
      const receipts = await listActivityReceiptsForPersona(persona.personaId, {
        actionTypes: ['constitutional_validation_recorded'],
        limit: 100,
      }).catch(() => []);
      if (!hasPassingValidation(receipts, slug)) {
        return NextResponse.json(
          {
            ok: false,
            validationGate: 'blocked',
            error:
              `No passing consequence-validation record found for pack '${slug}'. ` +
              'Run the Validate stage in the Dev Command Center (approve the validation report — verdict must be pass), ' +
              'then merge. An admin override with a stated reason is available and will be receipted.',
          },
          { status: 409 },
        );
      }
      validationState = 'passed';
    }
  }

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
        `Validation gate: ${validationState}. ` +
        'Amplify deploys dev on merge (CFS-016 D1 — the operator authorized in-app).',
      activeCartridge: 'agentiq',
      contextShared: ['dev-command-center'],
    });
    receiptId = receipt?.id ?? null;
  } catch {
    // Receipt is provenance, not a gate — the merge already happened.
  }

  // 3b) The override is NEVER silent — its own DVN-anchorable receipt records
  //     who deployed past the validation gate and why.
  let overrideReceiptId: string | null = null;
  if (validationState === 'overridden') {
    try {
      const receipt = await createActivityReceipt({
        personaId: persona.personaId,
        actionType: 'validation_override_granted',
        summary:
          `VALIDATION GATE OVERRIDDEN — PR #${pullNumber} ("${title}", head ${headRef}) merged to dev ` +
          `WITHOUT a passing consequence-validation record. Reason: "${overrideReason.slice(0, 300)}". ` +
          `Merge ${String(mergeData.sha ?? '').slice(0, 10)}.`,
        activeCartridge: 'agentiq',
        contextShared: ['dev-command-center'],
      });
      overrideReceiptId = receipt?.id ?? null;
    } catch {
      console.error('[github/merge] validation-override receipt failed — override is under-recorded');
    }
  }

  return NextResponse.json({
    ok: true,
    merged: true,
    pullNumber,
    sha: mergeData.sha ?? null,
    receiptId,
    validationGate: validationState,
    ...(overrideReceiptId ? { overrideReceiptId } : {}),
    note:
      validationState === 'overridden'
        ? '⚠ Merged WITH a validation override — the deploy is running on unvalidated code and the override is receipted. Validate post-hoc in the DCC.'
        : 'Merged to dev — Amplify is building the deploy now. The merge is the D1 human gate, exercised in-app.',
  });
}
