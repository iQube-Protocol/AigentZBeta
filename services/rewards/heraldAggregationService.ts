/**
 * heraldAggregationService — periodic rollup of Herald-of-the-Order
 * share attribution into reward grants.
 *
 * Herald has three reward variants (see seed in
 * supabase/migrations/20260504000000_seed_general_task_templates.sql):
 *
 *   HeraldCuriosityClicks      +0.25 KNYT  — 10 unique clicks / 7 days
 *   HeraldAudienceSignups      +1.00 KNYT  — 3 signups / 30 days
 *   HeraldConversionPayingUser +2.00 KNYT  — 1 paying user / 30 days
 *
 * Why a cron and not a per-event trigger:
 *   - "10 unique clicks / 7 days" is a rolling-window threshold; checking
 *     on every click would burn a query per call. Better to scan once
 *     per hour (or per day) for any persona that crosses the threshold.
 *   - Same for signups + conversions — the per-period aggregate fits a
 *     batched scan cleanly.
 *
 * Idempotency:
 *   Each grant uses a deterministic `sourceEventId` keyed on
 *   (rewardTaskType, personaId, periodAnchor). For weekly clicks the
 *   anchor is the ISO week label (e.g. `2026-W19`); for monthly signups
 *   + conversions it's the year-month (e.g. `2026-05`). The bridge to
 *   crm_rewards is also idempotent on `rewardGrantId` (UNIQUE-via-
 *   metadata in the bridge helper) so re-running the cron in the same
 *   period is safe.
 *
 * Data sources:
 *   - referral_clicks: per-click log with `source` field. We filter
 *     `source LIKE 'herald%'` (covers `herald` + platform suffixes like
 *     `herald:Twitter`). Uniqueness is approximated by
 *     COUNT(DISTINCT user_agent) — IP isn't recorded on the table.
 *   - referral_attributions: per-signup log with the same source field
 *     (written by /api/referral/process when refCode is supplied).
 *   - personas.first_paid_purchase_at: conversion timestamp. Joined to
 *     referral_attributions to find Herald-attributed conversions.
 *
 * Privacy:
 *   Reads T0 personaIds server-side; writes go through rewardService
 *   which routes through the existing bridgeGrantToCrmRewards path
 *   (T2 alias commitments on receipts; persona_id in crm_rewards stays
 *   server-side; T1-only on /api/wallet/tasks output).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRewardService, RewardTaskType } from '@/services/rewards/rewardService';

function sb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// ─── Period anchors ────────────────────────────────────────────────────────

function isoWeek(d: Date): string {
  // ISO 8601 week (4-digit year + "-W" + 2-digit week). Used as the
  // periodAnchor for the curiosity-clicks idempotency key.
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function yearMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ─── Thresholds (mirror the seed config) ───────────────────────────────────

const HERALD_CLICKS_THRESHOLD = 10;
const HERALD_CLICKS_WINDOW_DAYS = 7;
const HERALD_SIGNUPS_THRESHOLD = 3;
const HERALD_SIGNUPS_WINDOW_DAYS = 30;
const HERALD_CONVERSION_THRESHOLD = 1;
const HERALD_CONVERSION_WINDOW_DAYS = 30;

// ─── Aggregation entry points ──────────────────────────────────────────────

export interface AggregationResult {
  granted: number;
  skipped: number;
  errors: string[];
  details: Array<{
    personaId: string;
    rewardTaskType: string;
    periodAnchor: string;
    status: 'granted' | 'idempotent-hit' | 'below-threshold' | 'error';
    detail?: string;
  }>;
}

/**
 * Aggregate Herald curiosity clicks. For every persona that has ≥10
 * unique-user_agent clicks via a Herald-sourced ref_code in the last
 * 7 days, grant HeraldCuriosityClicks (+0.25 KNYT) once per ISO week.
 */
export async function aggregateHeraldClicks(now: Date = new Date()): Promise<AggregationResult> {
  const db = sb();
  const result: AggregationResult = { granted: 0, skipped: 0, errors: [], details: [] };
  const periodAnchor = isoWeek(now);
  const windowStart = new Date(now.getTime() - HERALD_CLICKS_WINDOW_DAYS * 86400_000).toISOString();

  // Fetch click rows in window. We do the distinct-by-user_agent
  // aggregation in TypeScript because Supabase's REST API doesn't
  // expose COUNT(DISTINCT) directly. Volume is small in alpha.
  const { data: clicks, error } = await db
    .from('referral_clicks')
    .select('referrer_persona_id, user_agent')
    .like('source', 'herald%')
    .not('referrer_persona_id', 'is', null)
    .gte('created_at', windowStart);
  if (error) {
    result.errors.push(`clicks fetch: ${error.message}`);
    return result;
  }

  // Bucket by persona → set of user_agents.
  const buckets = new Map<string, Set<string>>();
  for (const row of clicks ?? []) {
    const pid = row.referrer_persona_id as string;
    const ua = (row.user_agent as string | null) || 'unknown-ua';
    if (!buckets.has(pid)) buckets.set(pid, new Set());
    buckets.get(pid)!.add(ua);
  }

  const rewardService = getRewardService();
  for (const [personaId, uaSet] of buckets) {
    const uniqueClicks = uaSet.size;
    if (uniqueClicks < HERALD_CLICKS_THRESHOLD) {
      result.skipped += 1;
      result.details.push({ personaId, rewardTaskType: 'HeraldCuriosityClicks', periodAnchor, status: 'below-threshold' });
      continue;
    }

    // Idempotency key: same persona + same ISO week → same sourceEventId.
    // grantRewardForTask + bridge are both idempotent on this.
    const sourceEventId = `herald:clicks:${personaId}:${periodAnchor}`;
    const grantResult = await rewardService.grantRewardForTask({
      personaId,
      taskType: RewardTaskType.HeraldCuriosityClicks,
      sourceEventId,
      metadata: {
        herald: { variant: 'clicks', uniqueClicks, periodAnchor },
      },
    });
    if (grantResult.success) {
      result.granted += 1;
      result.details.push({ personaId, rewardTaskType: 'HeraldCuriosityClicks', periodAnchor, status: 'granted' });
    } else if (grantResult.error?.toLowerCase().includes('cap')) {
      result.skipped += 1;
      result.details.push({ personaId, rewardTaskType: 'HeraldCuriosityClicks', periodAnchor, status: 'idempotent-hit', detail: grantResult.error });
    } else {
      result.errors.push(`clicks grant ${personaId}: ${grantResult.error}`);
      result.details.push({ personaId, rewardTaskType: 'HeraldCuriosityClicks', periodAnchor, status: 'error', detail: grantResult.error });
    }
  }

  return result;
}

/**
 * Aggregate Herald audience signups. Same shape as clicks but reads
 * from referral_attributions filtered on `source LIKE 'herald%'` and
 * counts distinct new_persona_id signups in the last 30 days. Grants
 * once per calendar month per persona.
 */
export async function aggregateHeraldSignups(now: Date = new Date()): Promise<AggregationResult> {
  const db = sb();
  const result: AggregationResult = { granted: 0, skipped: 0, errors: [], details: [] };
  const periodAnchor = yearMonth(now);
  const windowStart = new Date(now.getTime() - HERALD_SIGNUPS_WINDOW_DAYS * 86400_000).toISOString();

  const { data: rows, error } = await db
    .from('referral_attributions')
    .select('referrer_persona_id, new_persona_id')
    .like('source', 'herald%')
    .gte('created_at', windowStart);
  if (error) {
    result.errors.push(`signups fetch: ${error.message}`);
    return result;
  }

  const buckets = new Map<string, Set<string>>();
  for (const row of rows ?? []) {
    const pid = row.referrer_persona_id as string;
    const np = row.new_persona_id as string;
    if (!buckets.has(pid)) buckets.set(pid, new Set());
    buckets.get(pid)!.add(np);
  }

  const rewardService = getRewardService();
  for (const [personaId, signupSet] of buckets) {
    const signupCount = signupSet.size;
    if (signupCount < HERALD_SIGNUPS_THRESHOLD) {
      result.skipped += 1;
      result.details.push({ personaId, rewardTaskType: 'HeraldAudienceSignups', periodAnchor, status: 'below-threshold' });
      continue;
    }
    const sourceEventId = `herald:signups:${personaId}:${periodAnchor}`;
    const grantResult = await rewardService.grantRewardForTask({
      personaId,
      taskType: RewardTaskType.HeraldAudienceSignups,
      sourceEventId,
      metadata: { herald: { variant: 'signups', signupCount, periodAnchor } },
    });
    if (grantResult.success) {
      result.granted += 1;
      result.details.push({ personaId, rewardTaskType: 'HeraldAudienceSignups', periodAnchor, status: 'granted' });
    } else if (grantResult.error?.toLowerCase().includes('cap')) {
      result.skipped += 1;
      result.details.push({ personaId, rewardTaskType: 'HeraldAudienceSignups', periodAnchor, status: 'idempotent-hit', detail: grantResult.error });
    } else {
      result.errors.push(`signups grant ${personaId}: ${grantResult.error}`);
      result.details.push({ personaId, rewardTaskType: 'HeraldAudienceSignups', periodAnchor, status: 'error', detail: grantResult.error });
    }
  }
  return result;
}

/**
 * Aggregate Herald conversions. Counts Herald-attributed new_persona
 * rows whose `first_paid_purchase_at` is within the last 30 days. Also
 * caches that timestamp into referral_attributions.first_conversion_at
 * so re-scans skip already-attributed conversions.
 */
export async function aggregateHeraldConversions(now: Date = new Date()): Promise<AggregationResult> {
  const db = sb();
  const result: AggregationResult = { granted: 0, skipped: 0, errors: [], details: [] };
  const periodAnchor = yearMonth(now);
  const windowStart = new Date(now.getTime() - HERALD_CONVERSION_WINDOW_DAYS * 86400_000).toISOString();

  // Step 1: pull Herald attribution rows that haven't been marked
  // converted yet (first_conversion_at IS NULL).
  const { data: pending, error: pendingErr } = await db
    .from('referral_attributions')
    .select('id, referrer_persona_id, new_persona_id')
    .like('source', 'herald%')
    .is('first_conversion_at', null);
  if (pendingErr) {
    result.errors.push(`conversions fetch: ${pendingErr.message}`);
    return result;
  }

  // Step 2: for each pending row, check if the new_persona has a
  // first_paid_purchase_at in the window. We batch the IN query.
  const newPersonaIds = (pending ?? []).map((r) => r.new_persona_id as string);
  if (newPersonaIds.length === 0) return result;

  const { data: converted, error: convErr } = await db
    .from('personas')
    .select('id, first_paid_purchase_at')
    .in('id', newPersonaIds)
    .not('first_paid_purchase_at', 'is', null)
    .gte('first_paid_purchase_at', windowStart);
  if (convErr) {
    result.errors.push(`personas fetch: ${convErr.message}`);
    return result;
  }
  const convMap = new Map<string, string>();
  for (const row of converted ?? []) {
    convMap.set(row.id as string, row.first_paid_purchase_at as string);
  }

  // Step 3: for each newly-detected conversion, grant once + cache.
  const rewardService = getRewardService();
  const updates: Array<{ id: number; first_conversion_at: string }> = [];
  for (const attr of pending ?? []) {
    const newPersonaId = attr.new_persona_id as string;
    const convAt = convMap.get(newPersonaId);
    if (!convAt) continue; // not yet converted
    const referrerPersonaId = attr.referrer_persona_id as string;

    const sourceEventId = `herald:conversion:${referrerPersonaId}:${newPersonaId}`;
    const grantResult = await rewardService.grantRewardForTask({
      personaId: referrerPersonaId,
      taskType: RewardTaskType.HeraldConversionPayingUser,
      sourceEventId,
      metadata: {
        herald: { variant: 'conversion', refereePersonaId: newPersonaId, convertedAt: convAt, periodAnchor },
      },
    });

    if (grantResult.success) {
      result.granted += 1;
      result.details.push({ personaId: referrerPersonaId, rewardTaskType: 'HeraldConversionPayingUser', periodAnchor, status: 'granted' });
      updates.push({ id: attr.id as number, first_conversion_at: convAt });
    } else if (grantResult.error?.toLowerCase().includes('cap')) {
      result.skipped += 1;
      result.details.push({ personaId: referrerPersonaId, rewardTaskType: 'HeraldConversionPayingUser', periodAnchor, status: 'idempotent-hit', detail: grantResult.error });
      // Even on cap-block, mark as converted to skip on next scan.
      updates.push({ id: attr.id as number, first_conversion_at: convAt });
    } else {
      result.errors.push(`conversion grant ${referrerPersonaId}: ${grantResult.error}`);
      result.details.push({ personaId: referrerPersonaId, rewardTaskType: 'HeraldConversionPayingUser', periodAnchor, status: 'error', detail: grantResult.error });
    }
  }

  // Persist first_conversion_at on the attribution rows so the next
  // scan skips them. Best-effort — failures don't break the grant.
  for (const u of updates) {
    try {
      await db.from('referral_attributions').update({ first_conversion_at: u.first_conversion_at }).eq('id', u.id);
    } catch { /* non-fatal */ }
  }

  return result;
}

/**
 * Run all three Herald aggregations in sequence. Each returns its own
 * result; we merge them into a single summary for the cron endpoint.
 */
export async function runHeraldAggregation(now: Date = new Date()): Promise<{
  clicks: AggregationResult;
  signups: AggregationResult;
  conversions: AggregationResult;
  totalGranted: number;
  totalSkipped: number;
  totalErrors: number;
  ranAt: string;
}> {
  const startedAt = new Date().toISOString();
  const [clicks, signups, conversions] = await Promise.all([
    aggregateHeraldClicks(now),
    aggregateHeraldSignups(now),
    aggregateHeraldConversions(now),
  ]);
  return {
    clicks,
    signups,
    conversions,
    totalGranted: clicks.granted + signups.granted + conversions.granted,
    totalSkipped: clicks.skipped + signups.skipped + conversions.skipped,
    totalErrors: clicks.errors.length + signups.errors.length + conversions.errors.length,
    ranAt: startedAt,
  };
}
