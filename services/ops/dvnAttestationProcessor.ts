import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { getQCTEventListener } from '@/services/qct/EventListener';

export const DVN_ATTESTATION_BATCH_SIZE = 10;

/**
 * ── A REJECTED ATTESTATION IS NOT A PROCESSED ONE (operator ruling, 2026-08-08) ──
 *
 * See the identical comment this was extracted from in
 * app/api/ops/layerzero/process/route.ts's git history — preserved here
 * verbatim because the classification rule travels with the logic, not the
 * route.
 */
type AttestationOutcome = { ok: true; value: string } | { ok: false; canisterError: string };

function readAttestationResult(raw: unknown): AttestationOutcome {
  if (typeof raw === 'string') return { ok: true, value: raw };
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if ('Err' in r) {
      return { ok: false, canisterError: typeof r.Err === 'string' ? r.Err : JSON.stringify(r.Err) };
    }
    if ('Ok' in r) return { ok: true, value: typeof r.Ok === 'string' ? r.Ok : JSON.stringify(r.Ok) };
  }
  return { ok: false, canisterError: `submit_attestation returned unexpected shape: ${JSON.stringify(raw)}` };
}

function decodePayload(message: any): { txHash: string; txDetails: any } {
  try {
    const payloadBytes = Array.isArray(message.payload) ? message.payload : Object.values(message.payload || {});
    const payloadStr = new TextDecoder().decode(Uint8Array.from(payloadBytes));
    const payloadJson = JSON.parse(payloadStr);
    return { txHash: payloadJson.txHash || 'unknown', txDetails: payloadJson };
  } catch {
    return { txHash: 'unknown', txDetails: {} };
  }
}

export type DvnAttestationBatchResult =
  | {
      ok: true;
      message: string;
      processed: number;
      rejected: number;
      failed: number;
      canisterErrors: string[];
      total: number;
      batchSize: number;
      hasMore: boolean;
      results: Array<Record<string, unknown>>;
      at: string;
    }
  | {
      ok: false;
      error: string;
      at: string;
    };

/**
 * ── UNREADABLE IS NOT EMPTY (operator ruling, 2026-09-06) ───────────────────
 *
 * `dvn.get_pending_messages()` failing (IC reject, timeout, response-size
 * cap, malformed payload) is a DIFFERENT fact from the queue genuinely
 * holding zero messages, and the two must never collapse into the same
 * `[]`. Collapsing them here previously made a genuine read failure report
 * as `idle: true` at the cron route — the exact defect class the 2026-08-08
 * `get_ready_messages()` IC0504 incident named (see
 * services/dvn/activityReceiptDvnPipeline.ts's own header comment and
 * scripts/diagnose-dvn-backlog.ts's `SetRead` type, which this mirrors).
 * Never `.catch(() => [])` this call again — a failure must propagate as
 * `{ readable: false, error }` so the caller can fail visibly.
 */
type DvnPendingRead = { readable: true; messages: any[] } | { readable: false; error: string };

async function readPendingDvnMessages(dvn: any): Promise<DvnPendingRead> {
  try {
    const messages = await dvn.get_pending_messages();
    if (!Array.isArray(messages)) {
      return {
        readable: false,
        error: `get_pending_messages() returned a non-array shape: ${JSON.stringify(messages)}`,
      };
    }
    return { readable: true, messages };
  } catch (err) {
    return { readable: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * The ONE place `dvn.submit_attestation` is called to drain the DVN pending
 * queue. Extracted verbatim (Horizen Pilot Closure — Final Standing + DVN
 * Closure, Part B2, 2026-08-09) from the `process_pending` action that used
 * to live inline in app/api/ops/layerzero/process/route.ts, so the
 * operator-UI route and the new cron-driven scheduler route
 * (app/api/ops/dvn/attestation-processor-cron/route.ts) call the SAME
 * implementation rather than two copies that will drift apart.
 *
 * Per the operator's explicit B3 sequencing instruction, this extraction
 * changes NOTHING about validatorId generation, signature generation,
 * batch size, or attestation semantics — same test-grade `validator_*`/
 * `sig_*` values as before. That substrate is dev/pilot-only and must be
 * labelled as such in any closure documentation; it is never disguised as
 * production independent-validator cryptography.
 */
export async function processPendingDvnAttestations(dvn: any): Promise<DvnAttestationBatchResult> {
  const read = await readPendingDvnMessages(dvn);
  if (!read.readable) {
    return {
      ok: false,
      error: `get_pending_messages() UNREADABLE: ${read.error}`,
      at: new Date().toISOString(),
    };
  }
  const pendingMessages = read.messages;

  if (pendingMessages.length === 0) {
    return {
      ok: true,
      message: 'No pending messages to process',
      processed: 0,
      rejected: 0,
      failed: 0,
      canisterErrors: [],
      total: 0,
      batchSize: 0,
      hasMore: false,
      results: [],
      at: new Date().toISOString(),
    };
  }

  const batch = pendingMessages.slice(0, DVN_ATTESTATION_BATCH_SIZE);
  const listener = getQCTEventListener();

  const settled = await Promise.allSettled(
    batch.map(async (message: any) => {
      const messageId = message.id;
      const sourceChain = message.source_chain;
      const { txHash, txDetails } = decodePayload(message);

      const validatorId = `validator_${Date.now()}_${messageId}`;
      const mockSignature = new TextEncoder().encode(`sig_${messageId}_${Date.now()}`);

      const attestResult = await dvn.submit_attestation(messageId, validatorId, Array.from(mockSignature));
      const outcome = readAttestationResult(attestResult);

      if (!outcome.ok) {
        return {
          messageId,
          sourceChain,
          txHash,
          status: 'rejected' as const,
          canisterError: outcome.canisterError,
          validator: validatorId,
        };
      }

      try {
        listener.recordDVNTransaction({
          messageId,
          sourceChain,
          txHash,
          timestamp: Number(message.timestamp) || Date.now(),
          from: txDetails.fromAddress || message.sender || 'unknown',
          to: txDetails.toAddress || 'unknown',
          amount: txDetails.amount || '0',
          operation: txDetails.operation || 'transfer',
          metadata: txDetails.metadata || {},
        });
      } catch {
        /* event recording is best-effort */
      }

      return {
        messageId,
        sourceChain,
        txHash,
        status: 'processed' as const,
        attestResult: outcome.value,
        validator: validatorId,
      };
    }),
  );

  const results = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    return {
      messageId: batch[i]?.id,
      sourceChain: batch[i]?.source_chain,
      status: 'failed' as const,
      error: s.reason?.message ?? String(s.reason),
    };
  });

  const processed = results.filter((r) => r.status === 'processed').length;
  const rejected = results.filter((r) => r.status === 'rejected').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const canisterErrors = Array.from(
    new Set(
      results
        .map((r) => (r as { canisterError?: string }).canisterError)
        .filter((e): e is string => typeof e === 'string' && e.length > 0),
    ),
  );

  return {
    ok: true,
    message:
      `Processed ${processed}/${batch.length}` +
      (rejected > 0 ? `, ${rejected} rejected by canister` : '') +
      (failed > 0 ? `, ${failed} call(s) failed` : ''),
    processed,
    rejected,
    failed,
    canisterErrors,
    total: pendingMessages.length,
    batchSize: batch.length,
    hasMore: pendingMessages.length > DVN_ATTESTATION_BATCH_SIZE,
    results,
    at: new Date().toISOString(),
  };
}

/** Resolves the DVN cross-chain-service actor from env — no canister ID guessing. */
export async function getDvnCanisterActor(): Promise<any> {
  const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID ||
    process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
  if (!DVN_ID) {
    throw new Error('DVN canister ID not configured');
  }
  return getActor<any>(DVN_ID, dvnIdl);
}

/**
 * DVN pending-message count for a given actor — the signal the scheduler
 * route decides liveness from (Part B2: "the scheduler must operate from
 * DVN pending state, NOT PoS pending count").
 *
 * Returns a `{ readable, ... }` discriminated result, never a bare number —
 * a read failure must be distinguishable from a genuine zero-length queue
 * so the caller can fail visibly instead of reporting `idle: true` (see
 * `readPendingDvnMessages`'s header comment above).
 */
export type DvnPendingCountResult = { readable: true; count: number } | { readable: false; error: string };

export async function countDvnPendingMessages(dvn: any): Promise<DvnPendingCountResult> {
  const read = await readPendingDvnMessages(dvn);
  if (!read.readable) return read;
  return { readable: true, count: read.messages.length };
}
