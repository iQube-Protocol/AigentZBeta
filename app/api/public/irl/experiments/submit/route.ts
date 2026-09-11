/**
 * POST /api/public/irl/experiments/submit — CFS-042 Phase 2: passport-delegated
 * EXTERNAL result submission into constitutional memory.
 *
 * The second door beside the admin route (/api/experiments/results, unchanged).
 * The external party's AGENT submits its independently-run result set under the
 * authorized x409 Constitutional Agreement the operator countersigned.
 *
 * Gate chain (every submission, in order):
 *   1. Agreement exists (the unguessable agreementId is the capability ref).
 *   2. Agreement is AUTHORIZED (the operator's human sign-off opened the gate;
 *      acceptance alone never opens it — Principal–Delegate Separation).
 *   3. capabilityRef must be the submission capability
 *      ('irl:experiment-result:submit') — an agreement for any other
 *      capability cannot publish results.
 *   4. TTL — now must be within delegatedAuthority.ttlHours of the agreement's
 *      formation (bounded, expiring authority; conservative basis = createdAt).
 *   5. maxActions — prior submissions under this agreement are counted; the
 *      budget is spent, not standing.
 *   6. Experiment id must be in the EXTERNAL allow-list (Validation Programme +
 *      Stage-0 series only — the Foundational series stays internal).
 *
 * On pass: publishExperimentResult — the SAME receipted, content-hashed,
 * DVN-anchorable publication path as internal results, with
 * origin='external' + the agreement id + agent ref folded into aggregates
 * (T2-safe: refs and slugs, never a persona identifier). Verification stays
 * trustless: recompute sha256 over resultsJson verbatim and compare with the
 * anchored hash (GET /api/public/irl/experiments-results serves the rows).
 *
 * Receipt persona = the Institute's steward of record
 * (RESULTS_STEWARD_PERSONA_ID env) — external agents have no persona; the
 * receipt records the Institute admitting the external result. Fail-soft as in
 * the service layer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgreement } from '@/services/constitutional/constitutionalAgreement';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { publishExperimentResult, type PublishableExperiment } from '@/services/experiments/publishResult';

export const dynamic = 'force-dynamic';

/** The capability this door serves — must match the agreement's capabilityRef. */
const SUBMISSION_CAPABILITY = 'irl:experiment-result:submit';

/** External submissions: Validation Programme + Stage-0 series only. */
const EXTERNAL_EXPERIMENTS: PublishableExperiment[] = ['EXP-P1', 'EXP-P2', 'EXP-P3', 'IRV-001', 'IPV-001', 'ISR-001'];

export async function POST(request: NextRequest) {
  let body: {
    agreementId?: string;
    experiment?: string;
    provider?: string;
    model?: string;
    aggregates?: Record<string, unknown>;
    results?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const agreementId = String(body.agreementId ?? '').trim();
  if (!agreementId) return NextResponse.json({ ok: false, error: 'agreementId required' }, { status: 400 });
  if (!EXTERNAL_EXPERIMENTS.includes(body.experiment as PublishableExperiment)) {
    return NextResponse.json({ ok: false, error: `experiment must be one of: ${EXTERNAL_EXPERIMENTS.join(', ')}` }, { status: 400 });
  }
  if (typeof body.provider !== 'string' || typeof body.model !== 'string' || body.results === undefined) {
    return NextResponse.json({ ok: false, error: 'provider, model, and results are required' }, { status: 400 });
  }

  // 1–2: agreement exists and is authorized (the x409 gate).
  const row = await getAgreement(agreementId);
  if (!row) return NextResponse.json({ ok: false, error: 'agreement not found' }, { status: 404 });
  const GATE_OPEN = new Set(['authorized', 'executed', 'settled', 'reconstitutable']);
  if (!GATE_OPEN.has(row.status)) {
    return NextResponse.json(
      { ok: false, error: `agreement status is '${row.status}' — submission requires an AUTHORIZED agreement (the operator must countersign first)`, remediation: 'Complete acceptance (POST /api/public/irl/agreement) and wait for the Institute operator to authorize.' },
      { status: 409 },
    );
  }

  // 3: correct capability.
  if (row.capabilityRef !== SUBMISSION_CAPABILITY) {
    return NextResponse.json({ ok: false, error: `agreement capability '${row.capabilityRef}' does not grant result submission ('${SUBMISSION_CAPABILITY}')` }, { status: 403 });
  }

  const authority = row.object?.payload?.delegatedAuthority;
  if (!authority) return NextResponse.json({ ok: false, error: 'agreement carries no delegated authority' }, { status: 409 });

  // 4: TTL (bounded, expiring — conservative basis: agreement formation time).
  const formedAt = Date.parse(row.createdAt);
  const ttlMs = (authority.ttlHours ?? 0) * 3600_000;
  if (!Number.isFinite(formedAt) || ttlMs <= 0 || Date.now() > formedAt + ttlMs) {
    return NextResponse.json({ ok: false, error: 'delegated authority TTL has lapsed — the delegation must be re-formed and re-authorized' }, { status: 409 });
  }

  const client = getSupabaseServer();
  if (!client) return NextResponse.json({ ok: false, error: 'storage unavailable' }, { status: 500 });

  // 5: maxActions budget (spent, not standing).
  const { count } = await client
    .from('experiment_results')
    .select('id', { count: 'exact', head: true })
    .eq('aggregates->>agreementId', agreementId);
  const used = count ?? 0;
  if (used >= (authority.maxActions ?? 0)) {
    return NextResponse.json({ ok: false, error: `delegated action budget exhausted (${used}/${authority.maxActions} submissions used)` }, { status: 409 });
  }

  // 6 + publish: the same receipted, content-hashed path as internal results.
  const outcome = await publishExperimentResult(client, process.env.RESULTS_STEWARD_PERSONA_ID || '', {
    experiment: body.experiment as PublishableExperiment,
    provider: body.provider,
    model: body.model,
    aggregates: {
      ...(body.aggregates ?? {}),
      origin: 'external',
      submissionLabel: 'independently submitted',
      agreementId,
      agentRef: row.selectedAgentRef,
    },
    results: body.results,
  });
  if (!outcome.ok) {
    return NextResponse.json({ ok: false, error: outcome.error ?? 'publish failed' }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    origin: 'external',
    id: outcome.id,
    contentHash: outcome.contentHash,
    receiptId: outcome.receiptId ?? null,
    receiptStatus: outcome.receiptStatus ?? null,
    budget: { used: used + 1, max: authority.maxActions },
    verify: 'GET /api/public/irl/experiments-results — recompute sha256 over resultsJson verbatim and compare with contentHash.',
  });
}
