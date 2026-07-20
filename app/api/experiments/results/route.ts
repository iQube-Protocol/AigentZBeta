/**
 * /api/experiments/results — canonical publication of Foundational Validation
 * Series results (Experiment Lab · Results tab).
 *
 * Trust model:
 *   - POST serializes the submitted results object ONCE, stores that exact
 *     string (`results_json`), computes sha256 over it (`content_hash` — a
 *     T2-safe content commitment, no identifiers), and emits an
 *     `experiment_result_published` activity receipt whose summary carries
 *     the same hash. That action type is DVN-anchorable, so the commitment
 *     lands in tamper-evident constitutional memory.
 *   - GET returns the stored rows + their receipts' DVN status. Verification
 *     is mechanical and trustless: recompute sha256 over `resultsJson`
 *     verbatim (the Results tab does this in-browser via SubtleCrypto) and
 *     compare with the anchored hash.
 *
 * GET  — list published results (spine-gated: any authenticated persona)
 * POST — publish (admin-gated): { experiment, provider, model, aggregates, results }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { checkExperimentQuota, recordExperimentRun } from '@/services/billing/experimentQuota';
import { publishExperimentResult } from '@/services/experiments/publishResult';
import { listPublishedExperimentResults } from '@/services/research/publicReads';

export const dynamic = 'force-dynamic';

// Experiment publishing is GLOBAL BY SHAPE, not an enumerated allowlist
// (operator direction 2026-07-20): every current AND future experiment saves
// without a code change here. We validate the id's FORMAT and let policy handle
// the rest — `visibility` below gives admins straight-to-canon publication and
// users a private save (or steward-approved 'pending' when they opt in). The
// experiment_results DB CHECK enforces the SAME shape (migration
// 20260722000000), so app + DB agree; a completed run is never lost again.
const EXPERIMENT_ID_RE = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$/;

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  // Read logic lives in the shared, persona-free module (the public IRL OS
  // route /api/public/irl/experiments-results calls the SAME reader).
  const outcome = await listPublishedExperimentResults();
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json({ ok: true, results: outcome.results });
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  // Publishing a result IS completing an experiment — this is the single
  // count point for the monthly cap. Admins are never blocked or metered;
  // otherwise the caller needs research access AND remaining quota.
  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
  const quotaClient = getSupabaseServer();
  if (!quotaClient) return NextResponse.json({ error: 'storage unavailable' }, { status: 500 });
  const quota = await checkExperimentQuota(quotaClient, persona.personaId, new Date(), isAdmin);
  if (!quota.allowed) {
    return NextResponse.json({ error: 'quota_exceeded', message: quota.reason ?? 'Research access required' }, { status: 403 });
  }

  let body: {
    experiment?: string;
    provider?: string;
    model?: string;
    aggregates?: Record<string, unknown>;
    results?: unknown;
    /** Reviewer opt-in: request PUBLIC publication (→ pending steward approval)
     *  rather than saving privately. Ignored for admins (who publish to canon). */
    requestPublish?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const experimentId = typeof body.experiment === 'string' ? body.experiment.trim().toUpperCase() : '';
  if (!EXPERIMENT_ID_RE.test(experimentId)) {
    return NextResponse.json(
      { error: 'experiment must be a valid id (letters/digits with a hyphen), e.g. EXP-006, EXP-P1, IRV-001' },
      { status: 400 },
    );
  }
  if (typeof body.provider !== 'string' || typeof body.model !== 'string' || body.results === undefined) {
    return NextResponse.json({ error: 'provider, model, and results are required' }, { status: 400 });
  }

  const client = getSupabaseServer();
  if (!client) return NextResponse.json({ error: 'storage unavailable' }, { status: 500 });

  // Visibility: admins publish straight to the canon; a participant/reviewer
  // saves PRIVATE by default, or 'pending' when they request public publication
  // (which a steward must approve before it joins the published canon).
  const visibility = isAdmin ? 'published' : body.requestPublish ? 'pending' : 'private';
  const outcome = await publishExperimentResult(client, persona.personaId, {
    experiment: experimentId,
    provider: body.provider,
    model: body.model,
    aggregates: body.aggregates ?? {},
    results: body.results,
    visibility,
  });
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error ?? 'publish failed' }, { status: 500 });
  }
  // One completed experiment = one counted run against the monthly cap.
  // Admins are not counted (recordExperimentRun no-ops for admins).
  await recordExperimentRun(quotaClient, persona.personaId, new Date(), isAdmin);
  return NextResponse.json({
    ok: true,
    id: outcome.id,
    contentHash: outcome.contentHash,
    receiptId: outcome.receiptId ?? null,
    receiptStatus: outcome.receiptStatus ?? null,
    visibility,
  });
}
