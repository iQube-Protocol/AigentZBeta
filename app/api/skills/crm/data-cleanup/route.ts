/**
 * POST /api/skills/crm/data-cleanup
 *
 * AgentiQ Platform Native Skill — CRM Data Cleanup
 *
 * Audits and normalises the nakamoto_knyt_personas CRM dataset:
 *   1. Report duplicate records (same email, case-insensitive)
 *   2. Report / fix records with non-canonical OM-Tier-Status values
 *      ("Sat KNYT", "SAT KNYT", "SAT" all normalise to "Sat KNYT")
 *   3. Report records missing both name and email (phantom rows)
 *   4. Optionally merge duplicates: keep the row with the richer data,
 *      delete duplicates (dry_run:true by default — inspect before applying)
 *
 * Tier normalisation canonical output values (written back to OM-Tier-Status):
 *   SAT   → "Sat KNYT"
 *   ZERO  → "Zero KNYT"
 *   FIRST → "First KNYT"
 *   KEJI  → "Keji KNYT"
 *   KETA  → "Keta KNYT"
 *
 * Request body:
 *   dry_run         boolean  Default: true. Set false to apply changes.
 *   fix_tiers       boolean  Default: true. Normalise OM-Tier-Status to canonical form.
 *   merge_dupes     boolean  Default: false. Delete duplicate rows keeping richest.
 *   phantom_report  boolean  Default: true. Report rows with no name and no email.
 *
 * Response:
 *   {
 *     dry_run: boolean,
 *     total_rows: number,
 *     tier_report: { raw_value: string, count: number, canonical: string }[],
 *     tiers_fixed: number,
 *     dupe_groups: { email: string, count: number, ids: string[] }[],
 *     dupes_deleted: number,
 *     phantom_rows: { id: string }[],
 *     errors: string[],
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

const PAGE = 1000;

// Canonical tier labels written back to the DB
const CANONICAL_TIER: Record<string, string> = {
  SAT:   'Sat KNYT',
  ZERO:  'Zero KNYT',
  FIRST: 'First KNYT',
  KEJI:  'Keji KNYT',
  KETA:  'Keta KNYT',
};

// Normalise raw tier value to canonical short code
function normalizeTierKey(raw: string): string {
  const c = (raw || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (c.includes('SAT'))   return 'SAT';
  if (c.includes('ZERO'))  return 'ZERO';
  if (c.includes('FIRST')) return 'FIRST';
  if (c.includes('KEJI'))  return 'KEJI';
  if (c.includes('KETA'))  return 'KETA';
  return '';
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

// Score a row by richness (higher = keep)
function richnessScore(row: Record<string, unknown>): number {
  let score = 0;
  if (str(row['First-Name']))          score += 2;
  if (str(row['Last-Name']))           score += 2;
  if (str(row['Email']))               score += 3;
  if (str(row['OM-Tier-Status']))      score += 4;
  if (str(row['Total-Invested']))      score += 3;
  if (str(row['KNYT-ID']))             score += 3;
  if (str(row['Metaiye-Shares-Owned'])) score += 2;
  if (str(row['KNYT-COYN-Owned']))     score += 2;
  if (row['platform_activated_at'])    score += 5;
  if (str(row['csv_investment_status'])) score += 2;
  return score;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun       = body.dry_run       !== false;   // default: true
    const fixTiers     = body.fix_tiers     !== false;   // default: true
    const mergeDupes   = body.merge_dupes   === true;    // default: false
    const phantomRpt   = body.phantom_report !== false;  // default: true

    const client = getCrmClient();

    // ── 1. Fetch ALL rows ─────────────────────────────────────────────────────
    const allRows: Record<string, unknown>[] = [];
    let page = 0;
    while (true) {
      const { data, error } = await client
        .from('nakamoto_knyt_personas')
        .select('*')
        .range(page * PAGE, (page + 1) * PAGE - 1);
      if (error) {
        return NextResponse.json({ error: `Fetch failed: ${error.message}` }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      allRows.push(...(data as Record<string, unknown>[]));
      if (data.length < PAGE) break;
      page++;
    }

    const totalRows = allRows.length;
    const errors: string[] = [];

    // ── 2. Tier audit ─────────────────────────────────────────────────────────
    const tierBuckets: Record<string, { count: number; ids: string[] }> = {};
    for (const row of allRows) {
      const raw = str(row['OM-Tier-Status']);
      if (!raw) continue;
      const key = normalizeTierKey(raw);
      const canonical = key ? CANONICAL_TIER[key] : null;
      const bucketKey = raw;  // group by exact raw value
      if (!tierBuckets[bucketKey]) tierBuckets[bucketKey] = { count: 0, ids: [] };
      tierBuckets[bucketKey].count++;
      if (canonical && raw !== canonical) {
        tierBuckets[bucketKey].ids.push(str(row['id']));
      }
    }

    // Build tier_report — entries where raw != canonical (those need fixing)
    const tierReport = Object.entries(tierBuckets)
      .map(([rawValue, { count, ids }]) => {
        const key = normalizeTierKey(rawValue);
        const canonical = key ? CANONICAL_TIER[key] : null;
        return { raw_value: rawValue, count, canonical, needs_fix: !!canonical && rawValue !== canonical, ids };
      })
      .filter((r) => r.needs_fix)
      .sort((a, b) => b.count - a.count);

    let tiersFixed = 0;

    if (fixTiers && !dryRun) {
      // Group ids by canonical target for bulk updates
      const byCanonical: Record<string, string[]> = {};
      for (const entry of tierReport) {
        if (!entry.canonical) continue;
        byCanonical[entry.canonical] = [...(byCanonical[entry.canonical] ?? []), ...entry.ids];
      }
      const CHUNK = 200;
      for (const [canonical, ids] of Object.entries(byCanonical)) {
        for (let i = 0; i < ids.length; i += CHUNK) {
          const { error } = await client
            .from('nakamoto_knyt_personas')
            .update({ 'OM-Tier-Status': canonical })
            .in('id', ids.slice(i, i + CHUNK));
          if (error) {
            errors.push(`Tier fix failed for "${canonical}": ${error.message}`);
          } else {
            tiersFixed += Math.min(CHUNK, ids.length - i);
          }
        }
      }
    }

    // ── 3. Duplicate detection (by email, case-insensitive) ───────────────────
    const emailIndex: Record<string, Record<string, unknown>[]> = {};
    for (const row of allRows) {
      const email = str(row['Email']).toLowerCase();
      if (!email) continue;
      if (!emailIndex[email]) emailIndex[email] = [];
      emailIndex[email].push(row);
    }

    const dupeGroups = Object.entries(emailIndex)
      .filter(([, rows]) => rows.length > 1)
      .map(([email, rows]) => ({
        email,
        count: rows.length,
        ids: rows.map((r) => str(r['id'])),
        keep_id: rows.sort((a, b) => richnessScore(b) - richnessScore(a))[0]['id'] as string,
      }))
      .sort((a, b) => b.count - a.count);

    let dupesDeleted = 0;

    if (mergeDupes && !dryRun && dupeGroups.length > 0) {
      const deleteIds: string[] = [];
      for (const grp of dupeGroups) {
        const toDelete = grp.ids.filter((id) => id !== grp.keep_id);
        deleteIds.push(...toDelete);
      }
      const CHUNK = 200;
      for (let i = 0; i < deleteIds.length; i += CHUNK) {
        const { error } = await client
          .from('nakamoto_knyt_personas')
          .delete()
          .in('id', deleteIds.slice(i, i + CHUNK));
        if (error) {
          errors.push(`Dupe delete failed: ${error.message}`);
        } else {
          dupesDeleted += Math.min(CHUNK, deleteIds.length - i);
        }
      }
    }

    // ── 4. Phantom rows (no name, no email) ───────────────────────────────────
    const phantomRows = phantomRpt
      ? allRows
          .filter((row) => {
            const hasName  = str(row['First-Name']) || str(row['Last-Name']);
            const hasEmail = str(row['Email']);
            const hasInvestment =
              str(row['Total-Invested']) || str(row['OM-Tier-Status']) ||
              str(row['KNYT-ID']) || str(row['KNYT-COYN-Owned']) ||
              str(row['csv_investment_status']);
            return !hasName && !hasEmail && !hasInvestment;
          })
          .map((row) => ({ id: str(row['id']) }))
      : [];

    return NextResponse.json({
      dry_run: dryRun,
      total_rows: totalRows,
      tier_report: tierReport.map(({ ids: _ids, ...rest }) => rest),  // omit id lists from response
      tiers_fixed: dryRun ? 0 : tiersFixed,
      tiers_would_fix: tierReport.reduce((sum, r) => sum + r.ids.length, 0),
      dupe_groups: dupeGroups.map(({ ids: _ids, ...rest }) => rest),  // omit id lists
      dupes_deleted: dryRun ? 0 : dupesDeleted,
      dupes_would_delete: dupeGroups.reduce((sum, g) => sum + (g.ids.length - 1), 0),
      phantom_rows: phantomRows,
      errors,
      hint: dryRun
        ? 'This was a dry run. Set dry_run:false to apply changes. Set merge_dupes:true to also delete duplicate rows.'
        : undefined,
    });

  } catch (err: any) {
    console.error('[skills/crm/data-cleanup] error:', err);
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
  }
}
