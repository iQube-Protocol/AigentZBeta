/**
 * POST /api/skills/crm/matrix-prep
 *
 * AgentiQ Platform Native Skill — CRM Matrix Prep
 *
 * Prepares the nakamoto_knyt_personas dataset for use in the KNYT experience matrix:
 *
 *   1. Derive investment_amount_band from Total-Invested (where not already set)
 *   2. Assign campaign_cohort from band (where not already assigned)
 *   3. Normalise OM-Tier-Status raw values → canonical KNYT tier labels
 *   4. Compute matrix_x_stage label (Prospect/Keta/Keji/First/Zero/Sat KNYT)
 *      — written to metadata only, not a dedicated column (read from OM-Tier-Status)
 *   5. Compute matrix_y_stage from engagement signals → write back to matrix_y_stage
 *      Y-stage ladder: observer → collector → curator → correspondent →
 *                      remixer → creator → steward → franchisee
 *
 * Investment band → cohort mapping:
 *   >= 5000       → top_shelf
 *   2000–4999     → top_shelf
 *   1000–1999     → zero_knyt
 *   500–999       → reactivation
 *   100–499       → reactivation
 *   < 100 / null  → general
 *
 * Y-stage derivation (priority order — highest wins):
 *   is_franchisee                                    → 'franchisee'
 *   is_steward                                       → 'steward'
 *   is_content_creator OR content_contribution_count > 2 → 'creator'
 *   is_remixer OR remix_count > 0                    → 'remixer'
 *   content_contribution_count > 0                   → 'curator'
 *   platform_engagement_score >= 50                  → 'correspondent'
 *   resolved tier OR Total-Invested >= 100           → 'collector'
 *   else                                             → 'observer'
 *
 * Request body:
 *   dry_run              boolean  Default: true. Set false to write changes.
 *   assign_bands         boolean  Default: true. Derive investment_amount_band.
 *   assign_cohorts       boolean  Default: true. Set campaign_cohort from band.
 *   compute_y_stage      boolean  Default: true. Compute and write matrix_y_stage.
 *   overwrite_cohort     boolean  Default: false. Re-assign cohorts even if already set.
 *   overwrite_y_stage    boolean  Default: false. Re-compute y_stage even if already set.
 *
 * Response:
 *   {
 *     dry_run: boolean,
 *     total_rows: number,
 *     bands_set: number,
 *     cohorts_set: number,
 *     y_stages_set: number,
 *     x_stage_distribution: Record<string, number>,
 *     y_stage_distribution: Record<string, number>,
 *     band_distribution: Record<string, number>,
 *     cohort_distribution: Record<string, number>,
 *     errors: string[],
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

const PAGE = 1000;

// Canonical tier labels (display form for X-axis)
const CANONICAL_TIER: Record<string, string> = {
  SAT:   'Sat KNYT',
  ZERO:  'Zero KNYT',
  FIRST: 'First KNYT',
  KEJI:  'Keji KNYT',
  KETA:  'Keta KNYT',
};

// X-axis matrix stage label
const TIER_TO_X_STAGE: Record<string, string> = {
  SAT:   'Sat KNYT',
  ZERO:  'Zero',
  FIRST: 'First',
  KEJI:  'Keji',
  KETA:  'Keta',
};

function normalizeTierKey(raw: string): string {
  const c = (raw || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (c.includes('SAT'))   return 'SAT';
  if (c.includes('ZERO'))  return 'ZERO';
  if (c.includes('FIRST')) return 'FIRST';
  if (c.includes('KEJI'))  return 'KEJI';
  if (c.includes('KETA'))  return 'KETA';
  return '';
}

function parseAmount(raw: unknown): number {
  if (!raw) return 0;
  return parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0;
}

// Derive X-axis tier key from investment amount — mirrors dashboard matrix view
function tierKeyFromAmount(amount: number): string {
  if (amount >= 25000) return 'SAT';
  if (amount >= 1000)  return 'ZERO';
  if (amount >= 500)   return 'FIRST';
  if (amount >= 250)   return 'KEJI';
  if (amount >= 100)   return 'KETA';
  return '';
}

function deriveBand(invested: number): string {
  if (invested >= 2000) return 'top_shelf';
  if (invested >= 1000) return 'zero_knyt';
  if (invested >= 100)  return 'reactivation';
  return 'general';
}

function deriveYStage(row: Record<string, unknown>): string {
  const isF  = row['is_franchisee']    === true;
  const isS  = row['is_steward']       === true;
  const isCC = row['is_content_creator'] === true;
  const isR  = row['is_remixer']       === true;
  const cCount = (row['content_contribution_count'] as number) || 0;
  const rCount = (row['remix_count'] as number) || 0;
  const engScore = (row['platform_engagement_score'] as number) || 0;

  // Check if this row represents an investor (has resolved tier or investment >= 100)
  const tierKey = normalizeTierKey(String(row['OM-Tier-Status'] || ''));
  const invested = parseAmount(row['Total-Invested']);
  const hasInvestment = !!tierKey || invested >= 100;

  if (isF)                              return 'franchisee';
  if (isS)                              return 'steward';
  if (isCC || cCount > 2)               return 'creator';
  if (isR || rCount > 0)                return 'remixer';
  if (cCount > 0)                       return 'curator';
  if (engScore >= 50)                   return 'correspondent';
  if (hasInvestment)                    return 'collector';
  return 'observer';
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun           = body.dry_run           !== false;  // default: true
    const assignBands      = body.assign_bands      !== false;  // default: true
    const assignCohorts    = body.assign_cohorts    !== false;  // default: true
    const computeYStage    = body.compute_y_stage   !== false;  // default: true
    const overwriteCohort  = body.overwrite_cohort  === true;   // default: false
    const overwriteYStage  = body.overwrite_y_stage === true;   // default: false

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

    // ── 2. Compute updates ────────────────────────────────────────────────────
    type RowUpdate = {
      id: string;
      investment_amount_band?: string;
      campaign_cohort?: string;
      matrix_y_stage?: string;
    };

    const xDist: Record<string, number>    = {};
    const yDist: Record<string, number>    = {};
    const bandDist: Record<string, number> = {};
    const cohortDist: Record<string, number> = {};

    const rowUpdates: RowUpdate[] = [];

    for (const row of allRows) {
      const id = str(row['id']);
      const invested = parseAmount(row['Total-Invested']);
      const tierKey  = normalizeTierKey(str(row['OM-Tier-Status'])) || tierKeyFromAmount(invested);
      const xStage   = tierKey ? (TIER_TO_X_STAGE[tierKey] ?? 'Prospect') : 'Prospect';

      xDist[xStage] = (xDist[xStage] ?? 0) + 1;

      const update: RowUpdate = { id };

      // Band
      if (assignBands) {
        const existingBand = str(row['investment_amount_band']);
        if (!existingBand || overwriteCohort) {
          const band = (tierKey || invested > 0) ? deriveBand(
            // Use tier-implied minimum when no direct investment amount
            tierKey === 'SAT'   ? Math.max(invested, 25000) :
            tierKey === 'ZERO'  ? Math.max(invested, 1000)  :
            tierKey === 'FIRST' ? Math.max(invested, 500)   :
            tierKey === 'KEJI'  ? Math.max(invested, 250)   :
            tierKey === 'KETA'  ? Math.max(invested, 100)   : invested
          ) : 'general';
          update.investment_amount_band = band;
          bandDist[band] = (bandDist[band] ?? 0) + 1;
        } else {
          bandDist[existingBand] = (bandDist[existingBand] ?? 0) + 1;
        }
      }

      // Cohort (depends on band — use the just-computed one or existing)
      if (assignCohorts) {
        const existingCohort = str(row['campaign_cohort']);
        if (!existingCohort || overwriteCohort) {
          const band = update.investment_amount_band ?? str(row['investment_amount_band']);
          const cohort = band === 'top_shelf'    ? 'top_shelf'   :
                         band === 'zero_knyt'    ? 'zero_knyt'   :
                         band === 'reactivation' ? 'reactivation' : 'general';
          update.campaign_cohort = cohort;
          cohortDist[cohort] = (cohortDist[cohort] ?? 0) + 1;
        } else {
          cohortDist[existingCohort] = (cohortDist[existingCohort] ?? 0) + 1;
        }
      }

      // Y-stage
      if (computeYStage) {
        const existingY = str(row['matrix_y_stage']);
        if (!existingY || overwriteYStage) {
          const yStage = deriveYStage(row);
          update.matrix_y_stage = yStage;
          yDist[yStage] = (yDist[yStage] ?? 0) + 1;
        } else {
          yDist[existingY] = (yDist[existingY] ?? 0) + 1;
        }
      }

      // Only queue the update if there's something to change beyond just id
      const hasChanges = update.investment_amount_band !== undefined ||
                         update.campaign_cohort !== undefined ||
                         update.matrix_y_stage !== undefined;
      if (hasChanges) rowUpdates.push(update);
    }

    // ── 3. Write updates (if not dry run) ─────────────────────────────────────
    let bandsSet   = 0;
    let cohortsSet = 0;
    let yStagesSet = 0;

    if (!dryRun && rowUpdates.length > 0) {
      // Group by update signature to minimize DB round-trips
      const CHUNK = 200;

      // Write in chunks of individual row updates
      for (let i = 0; i < rowUpdates.length; i += CHUNK) {
        const chunk = rowUpdates.slice(i, i + CHUNK);

        // Build individual update objects keyed by id
        for (const upd of chunk) {
          const payload: Record<string, string> = {};
          if (upd.investment_amount_band) payload['investment_amount_band'] = upd.investment_amount_band;
          if (upd.campaign_cohort)        payload['campaign_cohort']        = upd.campaign_cohort;
          if (upd.matrix_y_stage)         payload['matrix_y_stage']         = upd.matrix_y_stage;

          const { error } = await client
            .from('nakamoto_knyt_personas')
            .update(payload)
            .eq('id', upd.id);

          if (error) {
            errors.push(`Update failed for ${upd.id}: ${error.message}`);
          } else {
            if (upd.investment_amount_band) bandsSet++;
            if (upd.campaign_cohort)        cohortsSet++;
            if (upd.matrix_y_stage)         yStagesSet++;
          }
        }
      }
    }

    // When dry_run, report what would change
    const wouldSetBands   = rowUpdates.filter((u) => u.investment_amount_band).length;
    const wouldSetCohorts = rowUpdates.filter((u) => u.campaign_cohort).length;
    const wouldSetY       = rowUpdates.filter((u) => u.matrix_y_stage).length;

    return NextResponse.json({
      dry_run: dryRun,
      total_rows: totalRows,
      bands_set:                dryRun ? 0 : bandsSet,
      bands_would_set:          dryRun ? wouldSetBands : undefined,
      cohorts_set:              dryRun ? 0 : cohortsSet,
      cohorts_would_set:        dryRun ? wouldSetCohorts : undefined,
      y_stages_set:             dryRun ? 0 : yStagesSet,
      y_stages_would_set:       dryRun ? wouldSetY : undefined,
      x_stage_distribution:     xDist,
      y_stage_distribution:     yDist,
      band_distribution:        bandDist,
      cohort_distribution:      cohortDist,
      errors,
      hint: dryRun
        ? 'This was a dry run. Set dry_run:false to write changes. Use overwrite_cohort:true or overwrite_y_stage:true to re-compute already-set values.'
        : undefined,
    });

  } catch (err: any) {
    console.error('[skills/crm/matrix-prep] error:', err);
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
  }
}
