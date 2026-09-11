/**
 * Intent chain cron advancement — polled by /api/ops/sync/cron-tick.
 *
 * Two concerns:
 *   1. Scheduled-step advancement — current_step_kind='scheduled' AND
 *      scheduled_advance_at <= now() → call advanceScheduledChain
 *   2. Wait-step timeout — current_step_kind='wait' AND
 *      wait_timeout_at <= now() → call timeoutWaitChain
 *
 * Bounded per tick to keep Lambda durations sane. Default cap: 50 chains
 * advanced per tick. Higher loads catch up over subsequent ticks since
 * the partial indexes on intent_chains support fast time-window queries.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { advanceScheduledChain, timeoutWaitChain } from '@/services/intentChains/advancer';
import type { IntentChainRow } from '@/types/intentChains';

export interface ChainTickSummary {
  scheduled_advanced: number;
  wait_timed_out: number;
  errors: number;
  cap_reached: boolean;
  duration_ms: number;
}

export async function tickChainAdvances(maxPerTick = 50): Promise<ChainTickSummary> {
  const started = Date.now();
  const summary: ChainTickSummary = {
    scheduled_advanced: 0,
    wait_timed_out: 0,
    errors: 0,
    cap_reached: false,
    duration_ms: 0,
  };

  const sb = getSupabaseServer();
  if (!sb) {
    summary.duration_ms = Date.now() - started;
    return summary;
  }
  const now = new Date().toISOString();
  let remaining = maxPerTick;

  // 1. Scheduled steps whose delay has elapsed
  try {
    const { data: scheduled } = await sb
      .from('intent_chains')
      .select('*')
      .in('status', ['active', 'waiting'])
      .eq('current_step_kind', 'scheduled')
      .lte('scheduled_advance_at', now)
      .order('scheduled_advance_at', { ascending: true })
      .limit(remaining);

    for (const row of (scheduled ?? []) as IntentChainRow[]) {
      if (remaining <= 0) {
        summary.cap_reached = true;
        break;
      }
      try {
        await advanceScheduledChain(row);
        summary.scheduled_advanced++;
      } catch (err) {
        console.error('[tickChainAdvances] scheduled error', row.chain_id, (err as Error).message);
        summary.errors++;
      }
      remaining--;
    }
  } catch (err) {
    console.error('[tickChainAdvances] scheduled query failed', (err as Error).message);
    summary.errors++;
  }

  // 2. Wait steps whose timeout has elapsed
  if (remaining > 0) {
    try {
      const { data: timedOut } = await sb
        .from('intent_chains')
        .select('*')
        .eq('status', 'waiting')
        .eq('current_step_kind', 'wait')
        .lte('wait_timeout_at', now)
        .order('wait_timeout_at', { ascending: true })
        .limit(remaining);

      for (const row of (timedOut ?? []) as IntentChainRow[]) {
        if (remaining <= 0) {
          summary.cap_reached = true;
          break;
        }
        try {
          await timeoutWaitChain(row);
          summary.wait_timed_out++;
        } catch (err) {
          console.error('[tickChainAdvances] timeout error', row.chain_id, (err as Error).message);
          summary.errors++;
        }
        remaining--;
      }
    } catch (err) {
      console.error('[tickChainAdvances] timeout query failed', (err as Error).message);
      summary.errors++;
    }
  }

  summary.duration_ms = Date.now() - started;
  return summary;
}
