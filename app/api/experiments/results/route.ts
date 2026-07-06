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
import { publishExperimentResult } from '@/services/experiments/publishResult';

export const dynamic = 'force-dynamic';

const EXPERIMENTS = ['EXP-001', 'EXP-002', 'EXP-003', 'EXP-004'] as const;

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const client = getSupabaseServer();
  if (!client) return NextResponse.json({ error: 'storage unavailable' }, { status: 500 });

  const { data, error } = await client
    .from('experiment_results')
    .select('id, experiment, provider, model, aggregates, results_json, content_hash, receipt_id, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    const message = /does not exist/i.test(error.message)
      ? 'experiment_results table missing — apply supabase/migrations/20260704120000_experiment_results.sql'
      : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Attach DVN status from the anchoring receipts in one query.
  const receiptIds = (data ?? []).map((r) => r.receipt_id).filter(Boolean) as string[];
  const statusByReceipt = new Map<string, { receiptStatus: string; dvnReceiptId: string | null }>();
  if (receiptIds.length > 0) {
    const { data: receipts } = await client
      .from('activity_receipts')
      .select('id, receipt_status, dvn_receipt_id')
      .in('id', receiptIds);
    for (const r of receipts ?? []) {
      statusByReceipt.set(String(r.id), {
        receiptStatus: String(r.receipt_status ?? 'local'),
        dvnReceiptId: (r.dvn_receipt_id as string) ?? null,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    results: (data ?? []).map((r) => ({
      id: r.id,
      experiment: r.experiment,
      provider: r.provider,
      model: r.model,
      aggregates: r.aggregates,
      resultsJson: r.results_json,
      contentHash: r.content_hash,
      receiptId: r.receipt_id,
      receiptStatus: r.receipt_id
        ? statusByReceipt.get(String(r.receipt_id))?.receiptStatus ?? 'local'
        : null,
      dvnReceiptId: r.receipt_id
        ? statusByReceipt.get(String(r.receipt_id))?.dvnReceiptId ?? null
        : null,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: {
    experiment?: string;
    provider?: string;
    model?: string;
    aggregates?: Record<string, unknown>;
    results?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!EXPERIMENTS.includes(body.experiment as (typeof EXPERIMENTS)[number])) {
    return NextResponse.json({ error: `experiment must be one of: ${EXPERIMENTS.join(', ')}` }, { status: 400 });
  }
  if (typeof body.provider !== 'string' || typeof body.model !== 'string' || body.results === undefined) {
    return NextResponse.json({ error: 'provider, model, and results are required' }, { status: 400 });
  }

  const client = getSupabaseServer();
  if (!client) return NextResponse.json({ error: 'storage unavailable' }, { status: 500 });

  const outcome = await publishExperimentResult(client, persona.personaId, {
    experiment: body.experiment as 'EXP-001' | 'EXP-002' | 'EXP-003' | 'EXP-004',
    provider: body.provider,
    model: body.model,
    aggregates: body.aggregates ?? {},
    results: body.results,
  });
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error ?? 'publish failed' }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    id: outcome.id,
    contentHash: outcome.contentHash,
    receiptId: outcome.receiptId ?? null,
    receiptStatus: outcome.receiptStatus ?? null,
  });
}
