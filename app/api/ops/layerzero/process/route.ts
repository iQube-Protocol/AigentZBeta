import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { processPendingDvnAttestations } from '@/services/ops/dvnAttestationProcessor';
import { requireOpsAuth } from '@/services/ops/opsAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ── AUTH (Horizen Pilot Closure, Part B2, 2026-08-09) ───────────────────────
 *
 * This route previously had NO auth gate at all — any caller could drive
 * DVN attestation submission. It now requires EITHER CRON_TRIGGER_TOKEN
 * (for the new scheduler route to reuse if it ever calls this route instead
 * of the shared service directly) OR an authenticated admin persona — see
 * services/ops/opsAuth.ts for why this route gets the dual-path check
 * instead of the cron-token-only convention most /api/ops/** routes use:
 * this is one of the two routes the operator /ops console calls directly.
 *
 * `process_pending`'s submit_attestation logic now lives in
 * services/ops/dvnAttestationProcessor.ts — this route calls it rather
 * than reimplementing it, so the new cron-driven scheduler route
 * (app/api/ops/dvn/attestation-processor-cron/route.ts) can never drift
 * from what the operator's manual "Process via LayerZero" button does.
 * Nothing about validatorId generation, signature generation, batch size,
 * or attestation semantics changed in the extraction.
 */
export async function POST(request: NextRequest) {
  const auth = await requireOpsAuth(request);
  if (!auth.ok) return auth.response!;

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
      const result = await processPendingDvnAttestations(dvn);
      return NextResponse.json(result);
    }

    if (action === 'verify_message' && messageIds.length > 0) {
      const BATCH_SIZE = 10;
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
