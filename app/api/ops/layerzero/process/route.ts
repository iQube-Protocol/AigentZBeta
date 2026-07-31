import { NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { getQCTEventListener } from '@/services/qct/EventListener';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 10;

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
            attestResult: attestResult?.Ok ?? attestResult,
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

      const processed = results.filter((r) => r.status === 'processed').length;

      return NextResponse.json({
        ok: true,
        message: `Processed ${processed}/${batch.length} messages`,
        processed,
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
