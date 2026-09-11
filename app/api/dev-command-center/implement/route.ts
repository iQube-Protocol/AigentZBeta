/**
 * POST /api/dev-command-center/implement — dispatch an Implementation Pack to
 * a bounded implementation actor (the DCC implementation-dispatch seam,
 * 2026-07-14; rebuilt as a provider-neutral dispatch, Phase F
 * bounded-execution repair, operator-directed 2026-08-16).
 *
 * Closes the copy-paste break the operator named: the Implement capsule could
 * generate a pack but only offer "Copy pack" — the operator had to paste it
 * into an implementation actor by hand. This route SELECTS an
 * `ExecutionRoute` (profile → provider/model/budget,
 * `services/constitutional/executionRouting.ts`) from the pack's own
 * risk/uncertainty signals and calls the matching
 * `ImplementationActorAdapter` (`services/constitutional/actors/
 * implementationActorAdapter.ts`) — today, always `anthropic-claude-code`,
 * which fires the SAME GitHub `repository_dispatch` this route used to build
 * inline. Every other provider is a stub that fails before any spend.
 *
 * `forbiddenFiles` is ALWAYS derived server-side from CLAUDE.md's protected
 * -file manifest (`services/constitutional/protectedFiles.ts`) — never
 * trusted from the client. `areasToTouch`/`preflight`/`knownBaselineFailures`
 * are accepted as ROUTING SIGNALS from the client-held pack (no server-side
 * pack store exists today — packs are generated once and held client-side);
 * a client that mis-states them can only cause a sub-optimal model/budget
 * choice, never bypass the protected-file boundary, which does not depend
 * on them.
 *
 * ── D1 (CFS-016): execution stays HUMAN ──
 * This route INITIATES implementation; it executes nothing. The working branch
 * is `aigentz/pack-*` — deliberately NOT `claude/**` (merge-claude-to-dev.yml
 * auto-merges claude/** into dev, the deploy branch, which would collapse the
 * human gate). The implementation actor opens a PR; the operator's merge is
 * the execution gate — untouched by any part of this repair.
 *
 * Admin-gated (spine). Best-effort `implementation_dispatched` receipt — the
 * initiation record in the development provenance chain (pack → dispatch →
 * PR → human merge). Receipt summary is T2-safe (goal excerpt + pack id +
 * branch — no persona identifier).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { githubConfigured, GITHUB_MISSING_ENV } from '@/app/api/dev-command-center/_lib/github';
import { mirrorLifecycleToLinear } from '@/services/linear/lifecycleMirror';
import { packSlug } from '@/app/api/dev-command-center/github/merge/route';
import { deriveForbiddenFiles } from '@/services/constitutional/protectedFiles';
import { routeExecution, type ExecutionProfile } from '@/services/constitutional/executionRouting';
import { getImplementationActorAdapter } from '@/services/constitutional/actors/implementationActorAdapter';
import type { PackPreflight } from '@/services/constitutional/implementationPack';

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

  let body: {
    packId?: unknown;
    goal?: unknown;
    packMarkdown?: unknown;
    areasToTouch?: unknown;
    preflight?: unknown;
    knownBaselineFailures?: unknown;
    priorAttemptFailed?: unknown;
  };
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

  // Routing SIGNALS only — client-held (no server-side pack store exists),
  // so a mis-stated value can at most cause a sub-optimal model/budget
  // choice. `forbiddenFiles` below is NEVER taken from these — it is always
  // server-derived from CLAUDE.md's own protected-file manifest.
  const areasToTouch = Array.isArray(body.areasToTouch)
    ? body.areasToTouch.filter((a): a is string => typeof a === 'string')
    : [];
  const rawPreflight =
    body.preflight && typeof body.preflight === 'object' ? (body.preflight as Record<string, unknown>) : null;
  const preflight: PackPreflight | null =
    rawPreflight &&
    (rawPreflight.disposition === 'proceed' || rawPreflight.disposition === 'escalate') &&
    typeof (rawPreflight.risk as Record<string, unknown> | undefined)?.score === 'number'
      ? (rawPreflight as unknown as PackPreflight)
      : null;
  const knownBaselineFailures = Array.isArray(body.knownBaselineFailures)
    ? body.knownBaselineFailures.filter((f): f is string => typeof f === 'string')
    : [];
  const priorAttemptFailed = body.priorAttemptFailed === true;

  const branch = dispatchBranchFor(packId);
  const forbiddenFiles = deriveForbiddenFiles();
  const route = routeExecution({ areasToTouch, forbiddenFiles, preflight }, priorAttemptFailed);

  const dispatchResult = await getImplementationActorAdapter(route.provider).dispatch({
    pack: { id: packId, goal, forbiddenFiles, knownBaselineFailures },
    packMarkdown,
    branch,
    route,
  });
  if (!dispatchResult.ok) {
    return NextResponse.json(
      { ok: false, error: dispatchResult.error, detail: dispatchResult.detail, route },
      { status: dispatchResult.error === 'not-configured' ? 503 : 502 },
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
        `pack ${packId}, branch ${branch}, model ${route.model} (${route.profile} profile). ` +
        `Execution stays human at the PR merge (CFS-016 D1).`,
      activeCartridge: 'agentiq',
      contextShared: ['dev-command-center'],
    });
    receiptId = receipt?.id ?? null;
  } catch {
    // Receipt is provenance, not a gate.
  }

  // Linear mirror (observe-mode, soft-fail): the pack's issue moves to In
  // Progress — CI is now producing the artifact. Same packSlug key the
  // pack-generation call used, so a remediation redispatch (a different goal
  // string, "Remediation: X") still lands on the SAME issue.
  const linear = await mirrorLifecycleToLinear({
    delegate: 'operator',
    profile: 'software',
    brief: packSlug(packId),
    phase: 'artifact_produced',
    note: `Dispatched to Claude Code in CI on \`${branch}\`. Watch the GitHub capsule for the PR.${
      receiptId ? ` Receipt \`${receiptId}\`.` : ''
    }`,
  });
  // Never silent (the operator's report, 2026-07-15): a failed/unmirrored
  // dispatch is visible to the client, not swallowed — the honest-degradation
  // convention every other CDE tool follows.
  if (!linear.mirrored) {
    console.warn(`[dev-command-center/implement] Linear mirror skipped: ${linear.reason}`);
  }

  return NextResponse.json({
    ok: true,
    dispatched: true,
    branch,
    workflow: 'Claude Implement (DCC dispatch)',
    provider: route.provider,
    model: route.model,
    executionProfile: route.profile,
    executionBudget: route.budget,
    routingReason: route.reason,
    receiptId,
    linear,
    watch:
      'GitHub → Actions → "Claude Implement (DCC dispatch)". The run implements the pack on ' +
      `${branch} and opens a PR to dev — review + merge to deploy (execution stays human).`,
  });
}
