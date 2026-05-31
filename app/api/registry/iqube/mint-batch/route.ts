/**
 * POST /api/registry/iqube/mint-batch — batch mint orchestration.
 *
 * Phase B B7 of the legacy /registry → canonical SoT integration.
 *
 * The legacy /registry cart was a localStorage counter with no real
 * batch-mint backend. Per the integration plan §0 item 2 + §B7, the
 * cart now becomes a real batch orchestration that:
 *   1. Validates every iqube_id exists in iqube_id_map (HTTP 400 on
 *      any missing — atomic precheck before any saga starts)
 *   2. Calls startSaga() per id (idempotent — existing in-flight
 *      sagas are reused, so re-submitting the same cart doesn't
 *      double-mint)
 *   3. Drives all sagas in parallel via Promise.allSettled (one
 *      failure doesn't block the batch)
 *   4. Returns { batch_id, sagas, summary } with per-id status
 *   5. Emits a single orchestration_events row with event_type=
 *      'mint_batch_initiated' so the batch is auditable as a unit
 *      (per-iqube saga receipts still emit individually via the
 *      saga's own steps)
 *
 * Auth: spine-gated, admin only (mirrors the single mint route's gate).
 *
 * Body:
 *   {
 *     iqube_ids: string[],            // required, non-empty
 *     visibility?: 'public'|'private' // applied to every saga in the batch
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  startSaga,
  driveSagaToCompletion,
  type SagaSnapshot,
} from '@/services/registry/mintSaga';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';

interface MintBatchBody {
  iqube_ids?: string[];
  visibility?: 'public' | 'private';
}

interface BatchResultEntry {
  iqube_id: string;
  saga_id: string | null;
  current_state: string | null;
  is_terminal: boolean;
  is_failure: boolean;
  is_pending: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  // 1. Auth
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 2. Body
  let body: MintBatchBody;
  try {
    body = (await request.json()) as MintBatchBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const ids = Array.isArray(body.iqube_ids)
    ? body.iqube_ids.filter((v) => typeof v === 'string' && v.length >= 4)
    : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { error: 'iqube_ids required (non-empty string array)' },
      { status: 400 },
    );
  }
  if (ids.length > 100) {
    return NextResponse.json(
      { error: 'batch_too_large', detail: 'max 100 iqubes per batch' },
      { status: 400 },
    );
  }

  const visibility = body.visibility === 'public' || body.visibility === 'private'
    ? body.visibility
    : undefined;

  // 3. Pre-check — every id must exist in iqube_id_map
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }

  const { data: mapped, error: mapErr } = await supabase
    .from('iqube_id_map')
    .select('iqube_id')
    .in('iqube_id', ids);
  if (mapErr) {
    return NextResponse.json(
      { error: 'map_lookup_failed', detail: mapErr.message },
      { status: 500 },
    );
  }
  const knownIds = new Set((mapped ?? []).map((r) => (r as { iqube_id: string }).iqube_id));
  const missing = ids.filter((id) => !knownIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'unknown_iqubes', missing },
      { status: 400 },
    );
  }

  const batchId = randomUUID();

  // 4. Start + drive sagas in parallel
  const results: BatchResultEntry[] = await Promise.all(
    ids.map(async (iqubeId): Promise<BatchResultEntry> => {
      try {
        const initial: SagaSnapshot = await startSaga({
          iqube_id: iqubeId,
          initiated_by_persona_id: persona.personaId,
        });

        // Stash batch_id + visibility on the saga's idempotency_keys
        // for downstream visibility correlation. Best-effort.
        if (visibility || batchId) {
          try {
            const newKeys = {
              ...(initial.idempotency_keys ?? {}),
              batch_id: batchId,
              ...(visibility ? { visibility } : {}),
            };
            await supabase
              .from('mint_sagas')
              .update({ idempotency_keys: newKeys })
              .eq('saga_id', initial.saga_id);
          } catch {
            // non-fatal
          }
        }

        const final = await driveSagaToCompletion(initial.saga_id);
        return {
          iqube_id: iqubeId,
          saga_id: final.saga_id,
          current_state: final.current_state,
          is_terminal: final.is_terminal,
          is_failure: final.is_failure,
          is_pending: final.is_pending,
        };
      } catch (err) {
        return {
          iqube_id: iqubeId,
          saga_id: null,
          current_state: null,
          is_terminal: false,
          is_failure: true,
          is_pending: false,
          error: (err as Error).message,
        };
      }
    }),
  );

  // 5. Summary
  const summary = {
    total: results.length,
    completed: results.filter((r) => r.is_terminal && !r.is_failure).length,
    pending: results.filter((r) => r.is_pending).length,
    failed: results.filter((r) => r.is_failure).length,
  };

  // 6. Batch-level audit event (per-iqube saga events still emit
  //    individually from saga steps)
  void emitOrchestrationEvent({
    event_id: randomUUID(),
    event_type: 'mint_batch_initiated',
    from_role: 'aigent-z',
    to_role: 'aigent-z',
    reason: 'legacy_registry_cart_batch_mint',
    journey_stage: 'prospect',
    active_cartridge: null,
    active_codex: null,
    receipt_eligible: true,
    timestamp: new Date().toISOString(),
    metadata: {
      batch_id: batchId,
      iqube_ids: ids,
      visibility: visibility ?? null,
      summary,
      actor_cohort_id: persona.cohortMemberships?.[0] ?? null,
    },
  });

  return NextResponse.json({
    batch_id: batchId,
    sagas: results,
    summary,
    visibility_choice: visibility ?? null,
  });
}
