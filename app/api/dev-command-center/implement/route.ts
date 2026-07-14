/**
 * POST /api/dev-command-center/implement — dispatch an Implementation Pack to
 * Claude Code running in CI (the DCC implementation-dispatch seam, 2026-07-14).
 *
 * Closes the copy-paste break the operator named: the Implement capsule could
 * generate a pack but only offer "Copy pack" — the operator had to paste it
 * into Claude Code by hand. This route fires a GitHub `repository_dispatch`
 * (event_type `claude-implement`) whose workflow runs Claude Code against the
 * pack on a fresh `aigentz/pack-*` branch and opens a PR to dev.
 *
 * ── D1 (CFS-016): execution stays HUMAN ──
 * This route INITIATES implementation; it executes nothing. The working branch
 * is `aigentz/pack-*` — deliberately NOT `claude/**` (merge-claude-to-dev.yml
 * auto-merges claude/** into dev, the deploy branch, which would collapse the
 * human gate). Claude opens a PR; the operator's merge is the execution gate.
 *
 * Admin-gated (spine). GITHUB_TOKEN server-side only (mirrors _lib/github /
 * write-doc config). Best-effort `implementation_dispatched` receipt — the
 * initiation record in the development provenance chain (pack → dispatch →
 * PR → human merge). Receipt summary is T2-safe (goal excerpt + pack id +
 * branch — no persona identifier).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { GITHUB_REPO, githubConfigured, GITHUB_MISSING_ENV } from '@/app/api/dev-command-center/_lib/github';

export const dynamic = 'force-dynamic';

/** repository_dispatch client_payload ceiling (GitHub caps the payload; stay
 *  well under it so the dispatch never 422s on a large pack). */
const MAX_PACK_CHARS = 55_000;

/** Mint the CI working branch from the pack id — deterministic, sanitized,
 *  and ALWAYS under aigentz/pack-* (the workflow refuses anything else). */
export function dispatchBranchFor(packId: string): string {
  const slug = packId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const h = createHash('sha256').update(`dcc:dispatch:${packId}`).digest('hex').slice(0, 8);
  return `aigentz/pack-${slug || 'unnamed'}-${h}`;
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!githubConfigured()) {
    return NextResponse.json({ ok: false, configured: false, missingEnv: GITHUB_MISSING_ENV }, { status: 503 });
  }

  let body: { packId?: unknown; goal?: unknown; packMarkdown?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const packId = typeof body.packId === 'string' ? body.packId.trim() : '';
  const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
  const packMarkdown = typeof body.packMarkdown === 'string' ? body.packMarkdown : '';
  if (!packId || !goal || !packMarkdown.trim()) {
    return NextResponse.json(
      { error: 'packId, goal, and packMarkdown (non-empty strings) are required' },
      { status: 400 },
    );
  }
  if (packMarkdown.length > MAX_PACK_CHARS) {
    // Honest refusal, never a silent truncation — a truncated pack would have
    // Claude implement half a plan.
    return NextResponse.json(
      {
        error:
          `packMarkdown is ${packMarkdown.length} chars — exceeds the ${MAX_PACK_CHARS} dispatch ` +
          'payload ceiling. Trim the pack (e.g. drop the JSON fence) and retry.',
      },
      { status: 413 },
    );
  }

  const branch = dispatchBranchFor(packId);

  // Fire the repository_dispatch. GitHub answers 204 No Content on success.
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      event_type: 'claude-implement',
      client_payload: { packId, goal: goal.slice(0, 300), branch, packMarkdown },
    }),
    cache: 'no-store',
  });
  if (res.status !== 204) {
    const detail = await res.text().catch(() => '');
    return NextResponse.json(
      {
        ok: false,
        error:
          `GitHub dispatch failed (${res.status}). ` +
          (res.status === 404
            ? 'Common causes: the claude-implement.yml workflow is not on the default branch yet, or GITHUB_TOKEN lacks repo scope.'
            : detail.slice(0, 300)),
      },
      { status: 502 },
    );
  }

  // Best-effort initiation receipt — never blocks the dispatch result.
  let receiptId: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: persona.personaId,
      actionType: 'implementation_dispatched',
      summary:
        `Implementation dispatched to Claude Code (CI): "${goal.slice(0, 140)}" — ` +
        `pack ${packId}, branch ${branch}. Execution stays human at the PR merge (CFS-016 D1).`,
      activeCartridge: 'agentiq',
      contextShared: ['dev-command-center'],
    });
    receiptId = receipt?.id ?? null;
  } catch {
    // Receipt is provenance, not a gate.
  }

  return NextResponse.json({
    ok: true,
    dispatched: true,
    branch,
    workflow: 'Claude Implement (DCC dispatch)',
    receiptId,
    watch:
      'GitHub → Actions → "Claude Implement (DCC dispatch)". The run implements the pack on ' +
      `${branch} and opens a PR to dev — review + merge to deploy (execution stays human).`,
  });
}
