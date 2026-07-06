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

export interface PublishResultInput {
  experiment: 'EXP-001' | 'EXP-002' | 'EXP-003' | 'EXP-004';
  provider: string;
  model: string;
  aggregates: Record<string, unknown>;
  results: unknown;
  /** Backfill mode: skip silently if this exact content is already published. */
  skipIfExists?: boolean;
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
  // Serialize ONCE — this exact string is what gets stored and hashed.
  // Verification must always recompute over the stored text verbatim.
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
