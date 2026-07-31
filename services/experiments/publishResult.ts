/**
 * Shared canonical-publication logic for Foundational Validation Series
 * results — used by POST /api/experiments/results (live runs published from
 * the Experiment Lab) and POST /api/experiments/results/backfill (historical
 * run records bundled in the repo).
 *
 * Trust model (unchanged from the route this was extracted from): the results
 * object is serialized ONCE, that exact string is stored, sha256 over it is
 * the T2-safe content commitment, and an `experiment_result_published`
 * receipt (DVN-anchorable) carries the same hash.
 */

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import exp003Config from '@/services/experiments/exp003-tasks.json';
import {
  canUseForConfirmatoryComparison,
  PRE_FIX_CALIBRATION,
} from '@/services/invariants/projectionBridge';

/** The NAMED experiment ids — used by callers that deliberately restrict scope
 *  (e.g. the public external-submission route). It is NOT a limit on what the
 *  service can publish: experiment publishing is global-by-shape (operator
 *  direction 2026-07-20), validated by format at the caller + the DB CHECK, so
 *  every current AND future experiment saves without a code change here. */
export type PublishableExperiment =
  | 'EXP-001' | 'EXP-002' | 'EXP-003' | 'EXP-004'
  | 'EXP-P1' | 'EXP-P2' | 'EXP-P3'
  | 'IRV-001' | 'IPV-001'
  | 'ISR-001';

export interface PublishResultInput {
  /** Any valid experiment id (shape-validated by the caller + DB CHECK). */
  experiment: string;
  provider: string;
  model: string;
  aggregates: Record<string, unknown>;
  results: unknown;
  /** Backfill mode: skip silently if this exact content is already published. */
  skipIfExists?: boolean;
  /** Publication state (participant publishing flow). Defaults to 'published'
   *  to preserve the historical admin-canon behaviour; reviewer submits pass
   *  'private' or 'pending'. */
  visibility?: 'private' | 'pending' | 'published';
  /**
   * The coordinate calibration this result was computed under (IRE-6). REQUIRED
   * whenever `aggregates` carries a coordinate-derived metric — see
   * `canUseForConfirmatoryComparison`. Omit for results the coordinate path
   * never touched; the gate allows those regardless.
   */
  calibration?: string | null;
}

export interface PublishResultOutcome {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  contentHash?: string;
  receiptId?: string | null;
  receiptStatus?: string | null;
  error?: string;
}

export async function publishExperimentResult(
  client: SupabaseClient,
  personaId: string,
  input: PublishResultInput,
): Promise<PublishResultOutcome> {
  // Calibration declaration gate (operator ruling 2026-07-27 — IRE-6).
  //
  // A result carrying a coordinate-derived metric must declare which coordinate
  // calibration produced it. Fail-closed: an undeclared record is refused,
  // because no stamp existed before the units fix, so "undeclared" IS the
  // pre-fix case. Without this the label is prose in a markdown file and the
  // number goes on being aggregated — a mechanism that cannot fire (CB-1).
  //
  // This is a DECLARATION requirement, not a ban: a pre-fix diagnostic may
  // still be published, by naming its calibration and carrying the label (see
  // the historical Stage-0 records in the backfill route). What it may not do
  // is enter the canonical results system claiming to be comparable.
  const calibrationCheck = canUseForConfirmatoryComparison({
    calibration: input.calibration ?? null,
    aggregates: input.aggregates,
  });
  if (!calibrationCheck.allowed && input.calibration !== PRE_FIX_CALIBRATION) {
    return { ok: false, error: `calibration gate: ${calibrationCheck.reason}` };
  }

  // Serialize ONCE — this exact string is what gets stored and hashed.
  // Verification must always recompute over the stored text verbatim. The gate
  // above never mutates `input.results`: the stored bytes are the caller's
  // bytes, and the content commitment stays the caller's commitment.
  const resultsJson = JSON.stringify(input.results);
  const contentHash = createHash('sha256').update(resultsJson).digest('hex');

  if (input.skipIfExists) {
    const { data: existing } = await client
      .from('experiment_results')
      .select('id')
      .eq('content_hash', contentHash)
      .limit(1);
    if (existing && existing.length > 0) {
      return { ok: true, skipped: true, contentHash };
    }
  }

  const { data: row, error: insertError } = await client
    .from('experiment_results')
    .insert({
      experiment: input.experiment,
      provider: input.provider,
      model: input.model,
      aggregates: input.aggregates,
      results_json: resultsJson,
      content_hash: contentHash,
      visibility: input.visibility ?? 'published',
      submitted_by_persona_id: personaId,
    })
    .select('id')
    .single();
  if (insertError || !row) {
    const message = insertError && /does not exist/i.test(insertError.message)
      ? 'experiment_results table missing — apply supabase/migrations/20260704120000_experiment_results.sql'
      : insertError?.message ?? 'insert failed';
    return { ok: false, error: message };
  }

  // The grounding collection for the text experiments (both use the same 18
  // seeds) — recorded on the receipt for reuse-count instrumentation.
  let invariantsUsed: string[] = [];
  if (input.experiment !== 'EXP-002') {
    const { data: invRows } = await client
      .from('invariants')
      .select('id')
      .in('seed_id', exp003Config.seedIds);
    invariantsUsed = (invRows ?? []).map((r) => String(r.id));
  }

  // T2-safe summary: experiment + provider/model + the content commitment.
  // No identifiers; the hash is the auditable anchor.
  const receipt = await createActivityReceipt({
    personaId,
    actionType: 'experiment_result_published',
    summary: `${input.experiment} result published — provider=${input.provider} model=${input.model} sha256=${contentHash}`,
    activeCartridge: 'agentiq',
    invariantsUsed,
  }).catch((err) => {
    console.error('[experiments/publishResult] receipt creation failed', err);
    return null;
  });

  if (receipt) {
    await client
      .from('experiment_results')
      .update({ receipt_id: receipt.id })
      .eq('id', row.id);
  }

  return {
    ok: true,
    id: String(row.id),
    contentHash,
    receiptId: receipt?.id ?? null,
    receiptStatus: receipt?.receiptStatus ?? null,
  };
}
