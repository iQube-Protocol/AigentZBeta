/**
 * POST /api/ops/sync/cron-tick — server-side scheduled anchor cycle.
 *
 * Replaces the client-driven auto-process loop in hooks/ops/useSyncStatus.ts
 * which only ran when a browser had /ops open. This endpoint is called
 * by a scheduled trigger (Amplify EventBridge, GitHub Actions cron, or
 * any external uptime-monitor pingback) every cron_cadence_seconds.
 *
 * Policy: size-OR-time (K/T) — anchor when EITHER
 *   - pending_count >= batch_size_k (default 50)
 *   - OR pending_count >= 1 AND (now - lastAnchorTime) >= max_age_minutes_t (default 15min)
 *
 * Otherwise no-op (defer). Caller can pause cycles entirely via the
 * is_paused flag on ops_anchor_config.
 *
 * Audit trail: every tick — anchored, deferred, skipped, or failed —
 * lands a row in anchor_history so the operator can see why each tick
 * acted (or didn't). drift_before/drift_after capture the dvn↔pos
 * deficit at tick entry + exit.
 *
 * Auth: requires CRON_TRIGGER_TOKEN header. The token is independent
 * of the persona spine because this route is fired by infra schedulers
 * with no user session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AnchorConfig {
  batch_size_k: number;
  max_age_minutes_t: number;
  cron_cadence_seconds: number;
  is_paused: boolean;
}

interface TickResult {
  ok: boolean;
  cycle_action: 'anchored' | 'deferred' | 'skipped' | 'failed';
  decision_reason: 'size_k' | 'time_t' | 'manual' | 'idle' | 'paused' | 'error';
  drift_before: number;
  drift_after: number;
  duration_ms: number;
  batch_id?: string;
  anchor_txid?: string;
  receipt_count?: number;
  error?: string;
  config: AnchorConfig;
  at: string;
}

const DEFAULT_CONFIG: AnchorConfig = {
  batch_size_k: 50,
  max_age_minutes_t: 15,
  cron_cadence_seconds: 60,
  is_paused: false,
};

async function loadConfig(): Promise<AnchorConfig> {
  const sb = getSupabaseServer();
  if (!sb) return DEFAULT_CONFIG;
  try {
    const { data } = await sb.from('ops_anchor_config').select('*').eq('id', 1).maybeSingle();
    if (!data) return DEFAULT_CONFIG;
    return {
      batch_size_k: Number((data as any).batch_size_k ?? DEFAULT_CONFIG.batch_size_k),
      max_age_minutes_t: Number((data as any).max_age_minutes_t ?? DEFAULT_CONFIG.max_age_minutes_t),
      cron_cadence_seconds: Number((data as any).cron_cadence_seconds ?? DEFAULT_CONFIG.cron_cadence_seconds),
      is_paused: Boolean((data as any).is_paused ?? false),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function loadLastAnchorAt(): Promise<Date | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from('anchor_history')
      .select('created_at')
      .eq('cycle_action', 'anchored')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return new Date((data as any).created_at);
  } catch {
    return null;
  }
}

async function recordHistory(row: Omit<TickResult, 'ok' | 'config' | 'at'>): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;
  try {
    await sb.from('anchor_history').insert({
      cycle_action: row.cycle_action,
      decision_reason: row.decision_reason,
      drift_before: row.drift_before,
      drift_after: row.drift_after,
      duration_ms: row.duration_ms,
      batch_id: row.batch_id ?? null,
      anchor_txid: row.anchor_txid ?? null,
      receipt_count: row.receipt_count ?? 0,
      error: row.error ?? null,
    });
  } catch {
    // History is best-effort. Don't fail the tick on logging failure.
  }
}

export async function POST(request: NextRequest) {
  // Auth — cron-token only. This route is infra-driven; the persona
  // spine doesn't apply.
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided = request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const tickStart = Date.now();
  const config = await loadConfig();

  // Read canister state up-front so we always log a meaningful tick row.
  const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string;
  const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;

  if (!POS_ID || !DVN_ID) {
    return NextResponse.json({ error: 'canister_ids_not_configured' }, { status: 503 });
  }

  let posCount = 0;
  let dvnCount = 0;
  try {
    const [pos, dvn] = await Promise.all([
      getActor<any>(POS_ID, posIdl),
      getActor<any>(DVN_ID, dvnIdl),
    ]);
    const [posPending, dvnPending] = await Promise.all([
      pos.get_pending_count().catch(() => BigInt(0)),
      dvn.get_pending_messages().catch(() => []),
    ]);
    posCount = Number(posPending);
    dvnCount = Array.isArray(dvnPending) ? dvnPending.length : 0;
  } catch (err) {
    const result: TickResult = {
      ok: false,
      cycle_action: 'failed',
      decision_reason: 'error',
      drift_before: 0,
      drift_after: 0,
      duration_ms: Date.now() - tickStart,
      error: `canister_actor_failed: ${(err as Error).message}`,
      config,
      at: new Date().toISOString(),
    };
    await recordHistory(result);
    return NextResponse.json(result, { status: 500 });
  }

  const driftBefore = Math.abs(posCount - dvnCount);

  // Kill switch
  if (config.is_paused) {
    const result: TickResult = {
      ok: true,
      cycle_action: 'skipped',
      decision_reason: 'paused',
      drift_before: driftBefore,
      drift_after: driftBefore,
      duration_ms: Date.now() - tickStart,
      receipt_count: posCount,
      config,
      at: new Date().toISOString(),
    };
    await recordHistory(result);
    return NextResponse.json(result);
  }

  // Idle — nothing to anchor
  if (posCount === 0) {
    const result: TickResult = {
      ok: true,
      cycle_action: 'skipped',
      decision_reason: 'idle',
      drift_before: driftBefore,
      drift_after: driftBefore,
      duration_ms: Date.now() - tickStart,
      receipt_count: 0,
      config,
      at: new Date().toISOString(),
    };
    await recordHistory(result);
    return NextResponse.json(result);
  }

  // K/T decision
  const sizeTrigger = posCount >= config.batch_size_k;
  let timeTrigger = false;
  let lastAnchorAt: Date | null = null;
  if (!sizeTrigger) {
    lastAnchorAt = await loadLastAnchorAt();
    const ageMs = lastAnchorAt ? Date.now() - lastAnchorAt.getTime() : Infinity;
    timeTrigger = ageMs >= config.max_age_minutes_t * 60_000;
  }

  if (!sizeTrigger && !timeTrigger) {
    const result: TickResult = {
      ok: true,
      cycle_action: 'deferred',
      decision_reason: posCount === 0 ? 'idle' : 'size_k',
      drift_before: driftBefore,
      drift_after: driftBefore,
      duration_ms: Date.now() - tickStart,
      receipt_count: posCount,
      config,
      at: new Date().toISOString(),
    };
    await recordHistory(result);
    return NextResponse.json(result);
  }

  // Execute anchor cycle
  const decisionReason: 'size_k' | 'time_t' = sizeTrigger ? 'size_k' : 'time_t';
  try {
    const [pos, dvn] = await Promise.all([
      getActor<any>(POS_ID, posIdl),
      getActor<any>(DVN_ID, dvnIdl),
    ]);
    const batchResult = await pos.batch_now();
    const anchorResult = await pos.anchor();

    // Read drift after
    const [posAfter, dvnAfter] = await Promise.all([
      pos.get_pending_count().catch(() => BigInt(0)),
      dvn.get_pending_messages().catch(() => []),
    ]);
    const driftAfter = Math.abs(Number(posAfter) - (Array.isArray(dvnAfter) ? dvnAfter.length : 0));

    const result: TickResult = {
      ok: true,
      cycle_action: 'anchored',
      decision_reason: decisionReason,
      drift_before: driftBefore,
      drift_after: driftAfter,
      duration_ms: Date.now() - tickStart,
      batch_id: typeof batchResult === 'string' ? batchResult : String(batchResult),
      anchor_txid: typeof anchorResult === 'string' ? anchorResult : String(anchorResult),
      receipt_count: posCount,
      config,
      at: new Date().toISOString(),
    };
    await recordHistory(result);
    return NextResponse.json(result);
  } catch (err) {
    const result: TickResult = {
      ok: false,
      cycle_action: 'failed',
      decision_reason: 'error',
      drift_before: driftBefore,
      drift_after: driftBefore,
      duration_ms: Date.now() - tickStart,
      receipt_count: posCount,
      error: (err as Error).message,
      config,
      at: new Date().toISOString(),
    };
    await recordHistory(result);
    return NextResponse.json(result, { status: 500 });
  }
}
