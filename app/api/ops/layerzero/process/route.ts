import { NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { getQCTEventListener } from '@/services/qct/EventListener';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 10;

/**
 * ── A REJECTED ATTESTATION IS NOT A PROCESSED ONE (operator ruling, 2026-08-08) ──
 *
 * `submit_attestation` is declared in services/ops/idl/cross_chain_service.ts
 * as returning a Candid Variant — `{ Ok: Text }` or `{ Err: Text }`. An `Err`
 * is a SUCCESSFUL CALL RETURNING A REJECTION: it does not throw, so
 * `Promise.allSettled` records it as `fulfilled`, and this route's mapper
 * previously returned `status: 'processed'` unconditionally. The route could
 * therefore answer "Processed 10/10 messages" when the canister had rejected
 * all ten, and `processed` — the number the Ops console alerts on — counted
 * every rejection as a success.
 *
 * That made this path useless for diagnosing the very backlog it exists to
 * drain: no telemetry from it could distinguish "drained" from "silently
 * refused". Nothing about validatorId, signature generation, batching, receipt
 * rows or canister behaviour is changed here — only whether the result is told
 * truthfully (operator: "Do not change validatorId, signature generation,
 * batching strategy, receipt rows, or canister behavior until that response
 * tells us what is actually being rejected").
 */
type AttestationOutcome =
  | { ok: true; value: string }
  | { ok: false; canisterError: string };

function readAttestationResult(raw: unknown): AttestationOutcome {
  // Plain-string return (older/looser canister builds) — treat as Ok, matching
  // submitActivityReceiptToDvn's own handling of the same dual shape.
  if (typeof raw === 'string') return { ok: true, value: raw };
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if ('Err' in r) {
      // The EXACT canister error, preserved verbatim — this is the thing we
      // are trying to learn and must never be summarised away.
      return { ok: false, canisterError: typeof r.Err === 'string' ? r.Err : JSON.stringify(r.Err) };
    }
    if ('Ok' in r) return { ok: true, value: typeof r.Ok === 'string' ? r.Ok : JSON.stringify(r.Ok) };
  }
  // Neither variant arm present — unrecognised, and therefore NOT a success.
  return { ok: false, canisterError: `submit_attestation returned unexpected shape: ${JSON.stringify(raw)}` };
}

function decodePayload(message: any): { txHash: string; txDetails: any } {
  try {
    const payloadBytes = Array.isArray(message.payload)
      ? message.payload
      : Object.values(message.payload || {});
    const payloadStr = new TextDecoder().decode(Uint8Array.from(payloadBytes));
    const payloadJson = JSON.parse(payloadStr);
    return { txHash: payloadJson.txHash || 'unknown', txDetails: payloadJson };
  } catch {
    return { txHash: 'unknown', txDetails: {} };
  }
}

export async function POST(request: Request) {
  try {
    const { action = 'process_pending', messageIds = [] } = await request.json().catch(() => ({}));

    const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;

    if (!DVN_ID) {
      return NextResponse.json({
        ok: false,
        error: 'DVN canister ID not configured'
      }, { status: 400 });
    }

    const dvn = await getActor<any>(DVN_ID, dvnIdl);

    if (action === 'process_pending') {
      const pendingMessages = await dvn.get_pending_messages().catch(() => []);

      if (!Array.isArray(pendingMessages) || pendingMessages.length === 0) {
        return NextResponse.json({
          ok: true,
          message: 'No pending messages to process',
          processed: 0,
          total: 0,
          results: []
        });
      }

      const batch = pendingMessages.slice(0, BATCH_SIZE);
      const listener = getQCTEventListener();

      const settled = await Promise.allSettled(
        batch.map(async (message: any) => {
          const messageId = message.id;
          const sourceChain = message.source_chain;
          const { txHash, txDetails } = decodePayload(message);

          const validatorId = `validator_${Date.now()}_${messageId}`;
          const mockSignature = new TextEncoder().encode(`sig_${messageId}_${Date.now()}`);

          const attestResult = await dvn.submit_attestation(
            messageId,
            validatorId,
            Array.from(mockSignature)
          );
          const outcome = readAttestationResult(attestResult);

          // A rejected attestation is reported as REJECTED and nothing else
          // happens for this message — in particular no DVN transaction is
          // recorded, because none occurred.
          if (!outcome.ok) {
            return {
              messageId,
              sourceChain,
              txHash,
              status: 'rejected' as const,
              canisterError: outcome.canisterError,
              validator: validatorId
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
              metadata: txDetails.metadata || {}
            });
          } catch { /* event recording is best-effort */ }

          return {
            messageId,
            sourceChain,
            txHash,
            status: 'processed' as const,
            attestResult: outcome.value,
            validator: validatorId
          };
        })
      );

      const results = settled.map((s, i) => {
        if (s.status === 'fulfilled') return s.value;
        return {
          messageId: batch[i]?.id,
          sourceChain: batch[i]?.source_chain,
          status: 'failed' as const,
          error: s.reason?.message ?? String(s.reason)
        };
      });

      // Three outcomes, counted separately and never merged: `processed` is an
      // Ok variant, `rejected` is an Err variant (the canister answered and
      // refused), `failed` is a thrown call (the canister never answered).
      // Collapsing rejected into processed is the exact defect this route
      // carried — see readAttestationResult's own note.
      const processed = results.filter((r) => r.status === 'processed').length;
      const rejected = results.filter((r) => r.status === 'rejected').length;
      const failed = results.filter((r) => r.status === 'failed').length;
      // Every distinct canister error, verbatim and de-duplicated — the answer
      // to "what is actually being rejected", surfaced without having to open
      // the results array.
      const canisterErrors = Array.from(
        new Set(
          results
            .map((r) => (r as { canisterError?: string }).canisterError)
            .filter((e): e is string => typeof e === 'string' && e.length > 0),
        ),
      );

      return NextResponse.json({
        // `ok` describes the ROUTE's own execution, not the batch's outcome —
        // it answered, and the counts below say what happened. A caller
        // deciding whether work got done must read `processed`, never `ok`.
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
        hasMore: pendingMessages.length > BATCH_SIZE,
        results,
        at: new Date().toISOString()
      });
    }

    if (action === 'verify_message' && messageIds.length > 0) {
      const verifyBatch = (messageIds as string[]).slice(0, BATCH_SIZE);

      const settled = await Promise.allSettled(
        verifyBatch.map(async (messageId: string) => {
          const dvnEndpoint = 'https://api.layerzero.network/dvn';
          const verifyResult = await dvn.verify_layerzero_message(
            80002,
            messageId,
            dvnEndpoint
          );
          return {
            messageId,
            verified: verifyResult?.Ok ?? false,
            status: 'verified' as const
          };
        })
      );

      const results = settled.map((s, i) => {
        if (s.status === 'fulfilled') return s.value;
        return {
          messageId: verifyBatch[i],
          verified: false,
          status: 'failed' as const,
          error: s.reason?.message ?? String(s.reason)
        };
      });

      return NextResponse.json({
        ok: true,
        message: `Verified ${results.length} messages`,
        results,
        at: new Date().toISOString()
      });
    }

    return NextResponse.json({
      ok: false,
      error: 'Invalid action. Use "process_pending" or "verify_message"'
    }, { status: 400 });

  } catch (error: any) {
    console.error('LayerZero processing API error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
}
