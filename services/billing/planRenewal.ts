/**
 * planRenewal — monthly wallet-debit renewal sweep for paid plans.
 *
 * Alpha has no Stripe / stored-card mandate, so the only rail we can auto-charge
 * on renewal is the house wallet (Q¢). The sweep:
 *
 *   1. Finds active paid plans whose current_period_end has passed.
 *   2. For each, debits the base Q¢ price (house rate — no premium on renewal).
 *      - success → extend current_period_end +30 days, write plan_renewed receipt.
 *      - insufficient Q¢ → flip status to 'past_due' (the user tops up + the next
 *        sweep retries, or they re-checkout via PayPal/USDC).
 *
 * Free citizen plans (no priced tier) are skipped. PayPal/USDC-sourced plans are
 * still renewed via Q¢ here — auto-charging an external rail needs a stored
 * mandate we don't have in alpha; past_due is the honest fallback.
 *
 * Idempotent: only rows with current_period_end <= now are touched, and the
 * period is pushed forward on success so a re-run in the same window is a no-op.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { debitQc } from '@/app/api/community-content/_lib/generate';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { tierKeyForPlanRow, tierLabel, getTierPrice } from '@/services/billing/planCheckout';
import { revokeActiveGrant } from '@/services/delegation/delegationGrantStore';

export interface PlanRenewalSummary {
  ok: boolean;
  due: number;
  renewed: number;
  pastDue: number;
  /** past_due plans that auto-recovered (Q¢ topped up) on a later sweep. */
  recovered: number;
  /** past_due plans past the grace window → cancelled + reconciled. */
  cancelled: number;
  skipped: number;
  errors: string[];
}

const RENEWAL_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
// Grace window after a missed renewal before the plan is cancelled and its
// live bounded-delegate session is revoked. past_due within grace keeps full
// tier access (per the operator's grace-then-downgrade-on-cancel policy).
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Reconcile a persona's runtime when their subscription is cancelled. Per the
 * grace-then-downgrade policy: revoke the live bounded-delegate session (a
 * running agent acting on the persona's behalf) so delegated authority stops
 * at the moment the plan lapses. Sponsored agent identities and personas are
 * NOT deleted — they are flagged by falling to the free caps, and new genesis
 * is blocked by the capacity gate. Re-subscribing lets the user re-grant.
 */
async function reconcilePlanCancellation(personaId: string): Promise<void> {
  try {
    await revokeActiveGrant(personaId, 'subscription_cancelled');
  } catch {
    /* best-effort — the capacity gate still blocks new delegation while free */
  }
}

export async function renewDuePlans(limit = 200): Promise<PlanRenewalSummary> {
  const summary: PlanRenewalSummary = { ok: false, due: 0, renewed: 0, pastDue: 0, recovered: 0, cancelled: 0, skipped: 0, errors: [] };
  const admin = getSupabaseServer();
  if (!admin) {
    summary.errors.push('Database unavailable');
    return summary;
  }

  const nowIso = new Date().toISOString();
  const { data: dueRows, error } = await admin
    .from('persona_plans')
    .select('persona_id, plan_tier, venture_tier, standing_tier, status, current_period_end')
    .eq('status', 'active')
    .not('current_period_end', 'is', null)
    .lte('current_period_end', nowIso)
    .limit(limit);

  if (error) {
    summary.errors.push(`Query failed: ${error.message}`);
    return summary;
  }

  summary.due = dueRows?.length ?? 0;

  for (const row of dueRows ?? []) {
    const personaId = row.persona_id as string;
    const tierKey = tierKeyForPlanRow(row);
    if (!tierKey) {
      summary.skipped += 1; // free plan — nothing to renew
      continue;
    }

    const price = await getTierPrice(tierKey);
    if (!price || !price.active || price.cents <= 0) {
      summary.skipped += 1;
      continue;
    }

    // Q¢ renewal — house rate, no premium. $1 = 100 Q¢ ⇒ cents == Q¢.
    const qcAmount = price.cents;
    const renewalRef = `plan-renewal-${tierKey}-${Date.parse(nowIso)}`;

    let debitOk = false;
    try {
      const debit = await debitQc(admin, personaId, qcAmount, 'plan_renewal', renewalRef, 'dvn');
      debitOk = !!debit.ok;
    } catch (e) {
      summary.errors.push(`debit failed for ${personaId.slice(0, 8)}…: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    if (debitOk) {
      const nextPeriodEnd = new Date(Date.now() + RENEWAL_PERIOD_MS).toISOString();
      const { error: updErr } = await admin
        .from('persona_plans')
        .update({ status: 'active', current_period_end: nextPeriodEnd, updated_at: new Date().toISOString() })
        .eq('persona_id', personaId);
      if (updErr) {
        summary.errors.push(`period extend failed for ${personaId.slice(0, 8)}…: ${updErr.message}`);
        continue;
      }
      summary.renewed += 1;
      try {
        await createActivityReceipt({
          personaId,
          activeCartridge: 'metame',
          actionType: 'plan_renewed',
          summary: `Plan renewed: ${tierLabel(tierKey)} via Q¢ (${qcAmount} Q¢, next period ${nextPeriodEnd.slice(0, 10)})`,
          toolsUsed: ['plan-renewal-cron'],
        });
      } catch {
        /* receipt is best-effort */
      }
    } else {
      // Insufficient balance / debit refused → past_due. The user tops up and
      // the next sweep retries, or re-checks-out via another rail.
      const { error: pdErr } = await admin
        .from('persona_plans')
        .update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('persona_id', personaId);
      if (pdErr) summary.errors.push(`past_due flip failed for ${personaId.slice(0, 8)}…: ${pdErr.message}`);
      summary.pastDue += 1;
    }
  }

  // Second pass — past_due plans. Retry the Q¢ debit (auto-recover if the user
  // topped up); if it still fails AND the grace window has elapsed, cancel the
  // plan and reconcile the runtime (revoke the live bounded-delegate session).
  const graceCutoffIso = new Date(Date.now() - GRACE_MS).toISOString();
  const { data: pastDueRows, error: pdQueryErr } = await admin
    .from('persona_plans')
    .select('persona_id, plan_tier, venture_tier, standing_tier, status, current_period_end')
    .eq('status', 'past_due')
    .not('current_period_end', 'is', null)
    .limit(limit);
  if (pdQueryErr) {
    summary.errors.push(`past_due query failed: ${pdQueryErr.message}`);
  }

  for (const row of pastDueRows ?? []) {
    const personaId = row.persona_id as string;
    const tierKey = tierKeyForPlanRow(row);
    if (!tierKey) {
      summary.skipped += 1;
      continue;
    }
    const price = await getTierPrice(tierKey);
    if (!price || !price.active || price.cents <= 0) {
      summary.skipped += 1;
      continue;
    }

    // Retry the debit — the user may have topped up their Q¢ during grace.
    let debitOk = false;
    try {
      const recoverRef = `plan-recover-${tierKey}-${Date.parse(nowIso)}`;
      const debit = await debitQc(admin, personaId, price.cents, 'plan_renewal', recoverRef, 'dvn');
      debitOk = !!debit.ok;
    } catch {
      debitOk = false;
    }

    if (debitOk) {
      const nextPeriodEnd = new Date(Date.now() + RENEWAL_PERIOD_MS).toISOString();
      const { error: recErr } = await admin
        .from('persona_plans')
        .update({ status: 'active', current_period_end: nextPeriodEnd, updated_at: new Date().toISOString() })
        .eq('persona_id', personaId);
      if (recErr) {
        summary.errors.push(`recover failed for ${personaId.slice(0, 8)}…: ${recErr.message}`);
        continue;
      }
      summary.recovered += 1;
      continue;
    }

    // Still unpaid. Within grace → leave past_due (keep tier access). Past
    // grace → cancel + reconcile.
    const periodEnd = row.current_period_end as string;
    if (periodEnd > graceCutoffIso) {
      continue; // still inside the grace window
    }
    const { error: cancelErr } = await admin
      .from('persona_plans')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('persona_id', personaId);
    if (cancelErr) {
      summary.errors.push(`cancel failed for ${personaId.slice(0, 8)}…: ${cancelErr.message}`);
      continue;
    }
    await reconcilePlanCancellation(personaId);
    summary.cancelled += 1;
    try {
      await createActivityReceipt({
        personaId,
        activeCartridge: 'metame',
        actionType: 'plan_cancelled',
        summary: `Plan cancelled after grace window: ${tierLabel(tierKey)} (renewal unpaid). Reverted to free tier; live delegation revoked.`,
        toolsUsed: ['plan-renewal-cron'],
      });
    } catch {
      /* receipt is best-effort */
    }
  }

  summary.ok = true;
  return summary;
}
