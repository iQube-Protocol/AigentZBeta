import { NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

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
      // Get all pending messages and process them
      const pendingMessages = await dvn.get_pending_messages().catch(() => []);
      
      if (!Array.isArray(pendingMessages) || pendingMessages.length === 0) {
        return NextResponse.json({
          ok: true,
          message: 'No pending messages to process',
          processed: 0,
          results: []
        });
      }

      const results = [];
      let processed = 0;

      for (const message of pendingMessages) {
        try {
          // Extract message details
          const messageId = message.id;
          const sourceChain = message.source_chain;
          
          // Decode payload to get transaction details
          let txHash = 'unknown';
          try {
            const payloadBytes = Array.isArray(message.payload) 
              ? message.payload 
              : Object.values(message.payload || {});
            const payloadStr = new TextDecoder().decode(Uint8Array.from(payloadBytes));
            const payloadJson = JSON.parse(payloadStr);
            txHash = payloadJson.txHash || 'unknown';
          } catch {}

          // Submit attestation for LayerZero processing
          // Using a mock validator signature for demonstration
          const validatorId = `validator_${Date.now()}`;
          const mockSignature = new TextEncoder().encode(`sig_${messageId}_${Date.now()}`);
          
          const attestResult = await dvn.submit_attestation(
            messageId,
            validatorId,
            Array.from(mockSignature)
          );

          results.push({
            messageId,
            sourceChain,
            txHash,
            status: 'processed',
            attestResult: attestResult.Ok || attestResult,
            validator: validatorId
          });
          
          processed++;
        } catch (error: any) {
          results.push({
            messageId: message.id,
            sourceChain: message.source_chain,
            status: 'failed',
            error: error.message
          });
        }
      }

      return NextResponse.json({
        ok: true,
        message: `Processed ${processed}/${pendingMessages.length} messages`,
        processed,
        total: pendingMessages.length,
        results,
        at: new Date().toISOString()
      });
    }

    if (action === 'verify_message' && messageIds.length > 0) {
      // Verify specific messages with LayerZero
      const results = [];
      
      for (const messageId of messageIds) {
        try {
          // Mock LayerZero endpoint for verification
          const dvnEndpoint = 'https://api.layerzero.network/dvn';
          const verifyResult = await dvn.verify_layerzero_message(
            80002, // Source chain (Polygon Amoy)
            messageId,
            dvnEndpoint
          );

          results.push({
            messageId,
            verified: verifyResult.Ok || false,
            status: 'verified'
          });
        } catch (error: any) {
          results.push({
            messageId,
            verified: false,
            status: 'failed',
            error: error.message
          });
        }
      }

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
