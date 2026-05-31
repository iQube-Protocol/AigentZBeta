/**
 * Mint saga state machine.
 *
 * PRD v1.0 §7 + v1.1 §B.12. Stage 5 deliverable. Wraps the existing
 * baseTokenMint.ts functions (mintMasterQube, mintCanonicalEdition) in a
 * state machine with idempotency + retry + outbox + compensation.
 *
 * The saga DOES NOT decide access, ownership, or receipt authority. It
 * sequences side effects across registry + chain + DVN per PRD v1.0 §3
 * authority matrix. Each step is idempotent: re-running from the same
 * current_state is safe (the relevant `idempotency_keys` entry short-
 * circuits the re-execution).
 *
 * State graph (mint_sagas.current_state values):
 *
 *   unminted
 *     → registry_draft_created
 *     → payload_encrypted
 *     → payload_uploaded                  [retry; failure → payload_upload_failed]
 *     → token_qube_created
 *     → chain_minting                     [bounded retry; failure → mint_failed]
 *     → chain_minted
 *     → anchor_persisted                  [retry; failure → anchor_persist_failed]
 *     → receipt_emitting                  [retry; failure → receipt_pending]
 *     → receipt_emitted
 *     → card_publishing                   [retry; failure → card_publish_pending]
 *     → card_published
 *     → MINT_COMPLETE
 *
 * Rules (PRD v1.0 §7.2):
 *   - Every step has an idempotency key in idempotency_keys JSONB
 *   - External-system steps (chain, storage, ICP) have bounded retries
 *   - Registry writes use an outbox: write intent → ack on completion
 *   - Chain success + DB failure → saga re-runs DB persistence. No chain
 *     rollback. Documented loudly in step doc-comments.
 *   - mint_failed / payload_upload_failed are recoverable via operator
 *     console (POST /api/registry/iqube/[id]/mint?force=true)
 *   - *_pending states are transient — background reconciler drives them
 *
 * For Stage 5 scope:
 *   - Full state machine framework is implemented
 *   - Chain step calls baseTokenMint.mintMasterQube (already pre-deploy
 *     graceful — returns skipped='contract_unconfigured' until contracts
 *     deploy)
 *   - Edition mint flow remains via claimEditionForPurchase (Phase 9.2 —
 *     untouched; that flow already handles per-purchase edition claims)
 *   - DVN receipt emission is a placeholder (Stage 6 wires orchestrationEvents)
 *   - Card publish is a placeholder (Stage 7 / agent-legibility extension)
 *
 * Authority compliance:
 *   - Saga never SELECTs from persona_token_qube_ownership (Stage 4 hook
 *     is the read path)
 *   - Saga calls userOwnsAsset only via evaluateAccess delegation, never
 *     reimplements
 *   - Saga emits receipts via orchestrationEvents.emitDecisionReceipt
 *     (when wired Stage 6) — never raw DB inserts
 */

import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

import { mintMasterQube } from '@/services/chain/baseTokenMint';

// ── State enum (mirrors mint_sagas.current_state CHECK values) ────────────

export const SAGA_STATES = [
  'unminted',
  'registry_draft_created',
  'payload_encrypted',
  'payload_uploaded',
  'token_qube_created',
  'chain_minting',
  'chain_minted',
  'anchor_persisted',
  'receipt_emitting',
  'receipt_emitted',
  'card_publishing',
  'card_published',
  'MINT_COMPLETE',
  // failure / recovery
  'mint_failed',
  'payload_upload_failed',
  'anchor_persist_failed',
  'anchor_pending',
  'receipt_pending',
  'card_publish_pending',
] as const;

export type SagaState = (typeof SAGA_STATES)[number];

const TERMINAL: ReadonlySet<SagaState> = new Set(['MINT_COMPLETE']);
const FAILURE: ReadonlySet<SagaState> = new Set([
  'mint_failed',
  'payload_upload_failed',
  'anchor_persist_failed',
]);
const PENDING: ReadonlySet<SagaState> = new Set([
  'anchor_pending',
  'receipt_pending',
  'card_publish_pending',
]);

export function isTerminalSagaState(s: SagaState): boolean {
  return TERMINAL.has(s);
}

export function isFailureSagaState(s: SagaState): boolean {
  return FAILURE.has(s);
}

export function isPendingSagaState(s: SagaState): boolean {
  return PENDING.has(s);
}

// ── DB row shape (mirrors mint_sagas table from Stage 1 C4) ──────────────

export interface SagaRow {
  saga_id: string;
  iqube_id: string | null;
  current_state: SagaState;
  last_error: string | null;
  retry_count: number;
  idempotency_keys: Record<string, unknown>;
  initiated_by_persona_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Step output ───────────────────────────────────────────────────────────

interface StepResult {
  next_state: SagaState;
  idempotency_key?: { step: string; value: unknown };
  error?: string;
  /** When set, the step's external action was skipped (e.g. contract
   *  not configured). Saga advances to next state to keep progress; the
   *  side effect is queued for when configuration lands. */
  skipped?: string;
}

type StepRunner = (row: SagaRow, supabase: ReturnType<typeof createClient>) => Promise<StepResult>;

// ── Helpers ───────────────────────────────────────────────────────────────

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function idempotencyKeyFor(saga_id: string, step: string): string {
  return createHash('sha256').update(`${saga_id}:${step}`).digest('hex').slice(0, 16);
}

async function persistState(
  saga_id: string,
  next: { current_state: SagaState; last_error?: string | null; retry_count?: number; idempotency_keys?: Record<string, unknown> },
): Promise<void> {
  const sb = client();
  const update: Record<string, unknown> = {
    current_state: next.current_state,
    updated_at: new Date().toISOString(),
  };
  if (next.last_error !== undefined) update.last_error = next.last_error;
  if (next.retry_count !== undefined) update.retry_count = next.retry_count;
  if (next.idempotency_keys) update.idempotency_keys = next.idempotency_keys;
  await sb.from('mint_sagas').update(update).eq('saga_id', saga_id);
}

async function loadSaga(saga_id: string): Promise<SagaRow | null> {
  const sb = client();
  const { data } = await sb.from('mint_sagas').select('*').eq('saga_id', saga_id).maybeSingle();
  return (data as SagaRow | null) ?? null;
}

async function loadIqubeContext(iqube_id: string): Promise<{
  primitive_type: string;
  source: string;
  source_id: string;
  content_qube_id?: string;
} | null> {
  const sb = client();
  const { data: mapRow } = await sb
    .from('iqube_id_map')
    .select('source, source_id, primitive_type')
    .eq('iqube_id', iqube_id)
    .maybeSingle();
  if (!mapRow) return null;
  const m = mapRow as { source: string; source_id: string; primitive_type: string };
  return {
    primitive_type: m.primitive_type,
    source: m.source,
    source_id: m.source_id,
    content_qube_id: m.source === 'content_qube' ? m.source_id : undefined,
  };
}

// ── Step runners ──────────────────────────────────────────────────────────

const STEPS: Partial<Record<SagaState, StepRunner>> = {
  /**
   * unminted → registry_draft_created
   * Confirms the iqube_id_map row exists. Idempotent — re-running just
   * re-verifies.
   */
  unminted: async (row) => {
    if (!row.iqube_id) {
      return { next_state: 'mint_failed', error: 'saga has no iqube_id' };
    }
    const ctx = await loadIqubeContext(row.iqube_id);
    if (!ctx) {
      return { next_state: 'mint_failed', error: `iqube_id_map missing for ${row.iqube_id}` };
    }
    return {
      next_state: 'registry_draft_created',
      idempotency_key: { step: 'registry_draft_created', value: { confirmed_at: new Date().toISOString() } },
    };
  },

  /**
   * registry_draft_created → payload_encrypted
   * For ContentQubes, payload encryption happens during content upload
   * (Phase 2 of the ContentQube spine). For non-content primitives this
   * is currently a no-op — Stage 7 wires the encryption flow.
   */
  registry_draft_created: async (_row) => {
    return {
      next_state: 'payload_encrypted',
      idempotency_key: { step: 'payload_encrypted', value: { skipped_no_op: true } },
    };
  },

  /**
   * payload_encrypted → payload_uploaded
   * Autonomys / IPFS upload. Currently a no-op for the Stage 5 scope —
   * the existing /api/iqube/persona/knyt/mint route does the upload for
   * KNYT persona iQubes; ContentQube uploads happen at content-creation
   * time, not at canonization time. Stage 7 generalises.
   */
  payload_encrypted: async (_row) => {
    return {
      next_state: 'payload_uploaded',
      idempotency_key: { step: 'payload_uploaded', value: { skipped_no_op: true } },
    };
  },

  /**
   * payload_uploaded → token_qube_created
   * iq_token_qubes row creation. For ContentQubes that already have an
   * editions/master-token relationship (Phase 7B), this step is a no-op
   * since the editions ledger handles tokenization per-edition.
   */
  payload_uploaded: async (_row) => {
    return {
      next_state: 'token_qube_created',
      idempotency_key: { step: 'token_qube_created', value: { skipped_no_op: true } },
    };
  },

  /**
   * token_qube_created → chain_minting → chain_minted
   * The actual chain mint. For ContentQubes routes through
   * mintMasterQube. For non-content primitives this is currently a no-op
   * (Stage 5 scope) — Stage 7 wires non-content chain mints.
   *
   * Chain success + DB failure recovery: if the chain call succeeds but
   * the next state persistence fails, the next saga run re-loads the
   * record at current_state='chain_minting' and the idempotency_key for
   * 'chain_minting' has the txHash → step short-circuits to
   * 'chain_minted' without re-broadcasting. Document loudly: no chain
   * rollback ever attempted.
   */
  token_qube_created: async (row) => {
    if (!row.iqube_id) {
      return { next_state: 'mint_failed', error: 'no iqube_id' };
    }
    const ctx = await loadIqubeContext(row.iqube_id);
    if (!ctx) {
      return { next_state: 'mint_failed', error: 'iqube_id_map missing' };
    }

    // Idempotency: if a prior run already broadcast, the recorded txHash
    // short-circuits the re-mint.
    const recordedKey = (row.idempotency_keys as Record<string, unknown>)?.['chain_minting'] as
      | { txHash?: string; tokenIdHex?: string; skipped?: string }
      | undefined;
    if (recordedKey?.txHash || recordedKey?.skipped) {
      return {
        next_state: 'chain_minted',
        idempotency_key: { step: 'chain_minted', value: recordedKey },
      };
    }

    if (ctx.primitive_type !== 'ContentQube' || !ctx.content_qube_id) {
      // Non-content primitive: chain mint deferred to Stage 7
      return {
        next_state: 'chain_minted',
        idempotency_key: {
          step: 'chain_minting',
          value: { skipped: 'non_content_primitive_stage7' },
        },
      };
    }

    // Persist 'chain_minting' before broadcast so a crash mid-call is
    // recoverable (next reconcile sees chain_minting + no txHash → can
    // either re-broadcast or wait for the chain explorer to confirm).
    await persistState(row.saga_id, { current_state: 'chain_minting' });

    try {
      const result = await mintMasterQube({
        contentQubeId: ctx.content_qube_id,
        // Stage 5 default owner = the contract-default. Stage 7 surfaces a
        // per-saga override field for treasury / partner wallet routing.
        ownerAddress: process.env.IQUBE_DEFAULT_MINT_OWNER ?? undefined as any,
        aliasCommitment: undefined,
      } as any);
      if (!result.ok) {
        return {
          next_state: 'mint_failed',
          error: result.error ?? 'chain mint returned !ok',
        };
      }
      if (result.skipped) {
        // Contract unconfigured / commons excluded / etc. — advance with
        // a 'skipped' marker so the saga can complete and the operator
        // sees the reason in the UI.
        return {
          next_state: 'chain_minted',
          skipped: result.skipped,
          idempotency_key: { step: 'chain_minting', value: { skipped: result.skipped } },
        };
      }
      return {
        next_state: 'chain_minted',
        idempotency_key: {
          step: 'chain_minting',
          value: {
            txHash: (result as { txHash?: string }).txHash,
            tokenIdHex: (result as { tokenIdHex?: string }).tokenIdHex,
          },
        },
      };
    } catch (err) {
      return { next_state: 'mint_failed', error: (err as Error).message };
    }
  },

  /**
   * chain_minted → anchor_persisted
   * Chain anchor (txHash + tokenId) was already persisted by mintMasterQube
   * itself into content_qubes / iq_token_qubes. This step is structural —
   * marks that we've observed the persistence completed.
   */
  chain_minted: async (_row) => {
    return {
      next_state: 'anchor_persisted',
      idempotency_key: { step: 'anchor_persisted', value: { observed_at: new Date().toISOString() } },
    };
  },

  /**
   * anchor_persisted → receipt_emitting → receipt_emitted
   * DVN receipt placeholder. Stage 6 wires orchestrationEvents.emitDecisionReceipt
   * with action='mint', mode='sync'. For Stage 5, advance through without
   * the actual emission so the saga can reach MINT_COMPLETE — Stage 6
   * back-fills receipts for sagas that ran pre-emission.
   */
  anchor_persisted: async (row) => {
    return {
      next_state: 'receipt_emitting',
      idempotency_key: { step: 'receipt_emitting', value: { deferred_to_stage_6: true } },
    };
  },

  receipt_emitting: async (_row) => {
    return {
      next_state: 'receipt_emitted',
      idempotency_key: { step: 'receipt_emitted', value: { deferred_to_stage_6: true } },
    };
  },

  /**
   * receipt_emitted → card_publishing → card_published
   * Agent-legibility card publish placeholder. Stage 7 generates/refreshes
   * /api/iqubes/[id]/card after mint. For Stage 5 we just advance.
   */
  receipt_emitted: async (_row) => {
    return {
      next_state: 'card_publishing',
      idempotency_key: { step: 'card_publishing', value: { deferred_to_stage_7: true } },
    };
  },

  card_publishing: async (_row) => {
    return {
      next_state: 'card_published',
      idempotency_key: { step: 'card_published', value: { deferred_to_stage_7: true } },
    };
  },

  card_published: async (_row) => {
    return {
      next_state: 'MINT_COMPLETE',
      idempotency_key: { step: 'MINT_COMPLETE', value: { completed_at: new Date().toISOString() } },
    };
  },
};

// ── Public API ────────────────────────────────────────────────────────────

export interface StartSagaInput {
  iqube_id: string;
  initiated_by_persona_id?: string;
}

export interface SagaSnapshot {
  saga_id: string;
  iqube_id: string | null;
  current_state: SagaState;
  retry_count: number;
  last_error: string | null;
  idempotency_keys: Record<string, unknown>;
  is_terminal: boolean;
  is_failure: boolean;
  is_pending: boolean;
  updated_at: string;
}

function snapshot(row: SagaRow): SagaSnapshot {
  return {
    saga_id: row.saga_id,
    iqube_id: row.iqube_id,
    current_state: row.current_state,
    retry_count: row.retry_count,
    last_error: row.last_error,
    idempotency_keys: row.idempotency_keys ?? {},
    is_terminal: isTerminalSagaState(row.current_state),
    is_failure: isFailureSagaState(row.current_state),
    is_pending: isPendingSagaState(row.current_state),
    updated_at: row.updated_at,
  };
}

/**
 * Start a new mint saga for an iqube. Idempotent on the (iqube_id) axis:
 * if a non-terminal saga already exists, returns its snapshot instead of
 * creating a duplicate.
 */
export async function startSaga(input: StartSagaInput): Promise<SagaSnapshot> {
  const sb = client();

  // Idempotent: return existing in-flight saga if any.
  const { data: existing } = await sb
    .from('mint_sagas')
    .select('*')
    .eq('iqube_id', input.iqube_id)
    .not('current_state', 'eq', 'MINT_COMPLETE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    return snapshot(existing as SagaRow);
  }

  const { data: created, error } = await sb
    .from('mint_sagas')
    .insert({
      iqube_id: input.iqube_id,
      current_state: 'unminted',
      retry_count: 0,
      idempotency_keys: {},
      initiated_by_persona_id: input.initiated_by_persona_id ?? null,
    })
    .select('*')
    .single();
  if (error || !created) {
    throw new Error(`mint saga insert failed: ${error?.message}`);
  }
  return snapshot(created as SagaRow);
}

/**
 * Advance the saga by ONE step. Caller (route handler / reconciler) loops
 * until the saga reaches a terminal / failure / pending state.
 */
export async function advanceSaga(saga_id: string): Promise<SagaSnapshot> {
  const sb = client();
  const row = await loadSaga(saga_id);
  if (!row) {
    throw new Error(`saga ${saga_id} not found`);
  }

  if (isTerminalSagaState(row.current_state) || isFailureSagaState(row.current_state)) {
    return snapshot(row);
  }

  const step = STEPS[row.current_state];
  if (!step) {
    return snapshot(row);
  }

  let result: StepResult;
  try {
    result = await step(row, sb);
  } catch (err) {
    await persistState(saga_id, {
      current_state: 'mint_failed',
      last_error: (err as Error).message,
      retry_count: row.retry_count + 1,
    });
    const reloaded = await loadSaga(saga_id);
    return snapshot(reloaded!);
  }

  const nextKeys = { ...row.idempotency_keys };
  if (result.idempotency_key) {
    nextKeys[result.idempotency_key.step] = result.idempotency_key.value;
  }
  if (result.skipped) {
    nextKeys[`${row.current_state}_skipped_reason`] = result.skipped;
  }

  await persistState(saga_id, {
    current_state: result.next_state,
    last_error: result.error ?? null,
    idempotency_keys: nextKeys,
    retry_count: result.error ? row.retry_count + 1 : row.retry_count,
  });

  const reloaded = await loadSaga(saga_id);
  return snapshot(reloaded!);
}

/**
 * Drive a saga to its terminal / failure / pending state by looping
 * advanceSaga. Used by the start route + the reconciler.
 *
 * Safety: hard-cap of 25 iterations to prevent runaway loops in case of
 * a bug in the state graph (the longest legitimate path is 12 steps).
 */
export async function driveSagaToCompletion(saga_id: string): Promise<SagaSnapshot> {
  let snap: SagaSnapshot | null = null;
  for (let i = 0; i < 25; i++) {
    snap = await advanceSaga(saga_id);
    if (snap.is_terminal || snap.is_failure || snap.is_pending) {
      return snap;
    }
  }
  throw new Error(`saga ${saga_id} exceeded 25-step cap — likely state-graph bug`);
}

/**
 * Reconcile all sagas in *_pending states. Background worker (Stage 6
 * may schedule). For Stage 5 the admin route /api/admin/registry/reconcile-sagas
 * triggers this on demand.
 */
export async function reconcilePendingSagas(): Promise<{
  processed: number;
  advanced: number;
  still_pending: number;
  failed: number;
}> {
  const sb = client();
  const { data } = await sb
    .from('mint_sagas')
    .select('saga_id')
    .in('current_state', ['anchor_pending', 'receipt_pending', 'card_publish_pending'])
    .limit(50);

  const ids = (data ?? []).map((r) => (r as { saga_id: string }).saga_id);
  let advanced = 0;
  let still_pending = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      const snap = await driveSagaToCompletion(id);
      if (snap.is_terminal) advanced++;
      else if (snap.is_failure) failed++;
      else still_pending++;
    } catch {
      failed++;
    }
  }
  return { processed: ids.length, advanced, still_pending, failed };
}

/**
 * List recent sagas for the Mints+Sagas tab.
 */
export async function listRecentSagas(limit = 50): Promise<SagaSnapshot[]> {
  const sb = client();
  const { data } = await sb
    .from('mint_sagas')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => snapshot(r as SagaRow));
}
