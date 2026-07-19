/**
 * experimentQuota — the monthly experiment-run allowance gate (IRL OS payment
 * model, 2026-07-19). Light (Research Copilot) = 3 runs/month; Steward = a high
 * cap (STEWARD_EXPERIMENT_CAP); admins are uncapped.
 *
 * A "run" is one experiment execution (the front-end runner completes one
 * protocol per run). Counted per (persona, calendar month) in
 * experiment_run_counters. The gate is called at the experiment-run
 * chokepoint: it checks entitlement + remaining allowance BEFORE the run
 * proceeds, and records the run on success.
 *
 * Fail-open on infra errors (missing table pre-migration) is deliberate for
 * ADMIN callers only — a non-admin with no plan is denied. This never opens a
 * credit-spending path to an unentitled persona.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getPersonaPlan } from '@/services/billing/personaPlan';

/** 'YYYY-MM' for a given date. Callers pass the run time (no argless Date). */
export function periodKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface QuotaState {
  allowed: boolean;
  cap: number;
  used: number;
  remaining: number;
  reason?: string;
}

/**
 * Read-only quota check — does this persona have experiment access, and runs
 * left this month? Admins are always allowed (cap reported as Infinity).
 */
export async function checkExperimentQuota(
  admin: SupabaseClient,
  personaId: string,
  now: Date,
  isAdmin: boolean,
): Promise<QuotaState> {
  if (isAdmin) return { allowed: true, cap: Infinity, used: 0, remaining: Infinity };

  const plan = await getPersonaPlan(admin, personaId);
  const cap = plan.experimentMonthlyCap;
  if (cap <= 0) {
    return { allowed: false, cap: 0, used: 0, remaining: 0, reason: 'Research access required to run experiments' };
  }

  const period = periodKey(now);
  const { data } = await admin
    .from('experiment_run_counters')
    .select('runs')
    .eq('persona_id', personaId)
    .eq('period', period)
    .maybeSingle();
  const used = Number(data?.runs ?? 0);
  const remaining = Math.max(0, cap - used);
  return {
    allowed: remaining > 0,
    cap,
    used,
    remaining,
    reason: remaining > 0 ? undefined : `Monthly experiment limit reached (${cap}/month)`,
  };
}

/**
 * Record one completed run (increment the monthly counter). Best-effort upsert;
 * admins are not counted. Call AFTER a run is admitted so the count reflects
 * actual usage.
 */
export async function recordExperimentRun(
  admin: SupabaseClient,
  personaId: string,
  now: Date,
  isAdmin: boolean,
): Promise<void> {
  if (isAdmin) return;
  const period = periodKey(now);
  const { data } = await admin
    .from('experiment_run_counters')
    .select('runs')
    .eq('persona_id', personaId)
    .eq('period', period)
    .maybeSingle();
  const runs = Number(data?.runs ?? 0) + 1;
  await admin
    .from('experiment_run_counters')
    .upsert({ persona_id: personaId, period, runs, updated_at: now.toISOString() }, { onConflict: 'persona_id,period' });
}
