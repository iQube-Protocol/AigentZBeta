export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

/**
 * Payment Requests API
 * 
 * GET /api/wallet/payment-requests?agentId=xxx - Get pending requests for an agent
 * POST /api/wallet/payment-requests - Create a new payment request
 * PATCH /api/wallet/payment-requests - Accept, reject, or mark as paid
 */

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// GET - Fetch pending payment requests for an agent
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    const type = searchParams.get('type') || 'incoming'; // 'incoming' or 'outgoing'

    if (!agentId) {
      return NextResponse.json({ ok: false, error: 'agentId required' }, { status: 400 });
    }

    const supabase = getSupabase();

    if (type === 'incoming') {
      // Try RPC first
      let data: any[] | null = null;
      let error: any = null;

      try {
        const rpcResult = await supabase
          .rpc('get_pending_payment_requests', { p_payer_id: agentId });
        data = rpcResult.data;
        error = rpcResult.error;
      } catch (e) {
        console.log('[PaymentRequests] RPC not available, using direct query');
      }

      // Fallback to direct query if RPC fails or returns empty
      if (error || !data || data.length === 0) {
        const directResult = await supabase
          .from('payment_requests')
          .select('*')
          .or(`payer_id.eq.${agentId},payer_fio.ilike.${agentId}`)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });

        if (directResult.error) {
          return NextResponse.json({ ok: false, error: directResult.error.message }, { status: 500 });
        }
        data = directResult.data;
      }

      return NextResponse.json({ ok: true, requests: data || [] });
    } else {
      // Get requests this agent has sent (outgoing)
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .or(`requester_id.eq.${agentId},requester_fio.ilike.${agentId}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, requests: data || [] });
    }

  } catch (error) {
    console.error('[PaymentRequests] GET Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// POST - Create a new payment request
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      requesterId,      // Who is requesting payment (agent_id or fio_handle)
      requesterFio,     // FIO handle for display
      requesterAddress, // Address to receive payment
      payerId,          // Who should pay (agent_id or fio_handle)
      payerFio,         // FIO handle for display
      amount,
      asset = 'QCT',
      chainId = 421614,
      memo,
      expiresInDays = 7,
    } = body;

    if (!requesterId || !requesterAddress || !payerId || !amount) {
      return NextResponse.json({
        ok: false,
        error: 'requesterId, requesterAddress, payerId, and amount are required',
      }, { status: 400 });
    }

    const supabase = getSupabase();

    // Resolve payer's address if not provided
    let resolvedPayerAddress = body.payerAddress;
    if (!resolvedPayerAddress) {
      const { data: payerKeys } = await supabase
        .rpc('get_agent_addresses_flexible', { p_identifier: payerId });
      
      if (payerKeys && payerKeys.length > 0) {
        resolvedPayerAddress = payerKeys[0].evm_address;
      }
    }

    // Create the payment request using RPC function
    const { data: requestId, error } = await supabase
      .rpc('create_payment_request', {
        p_requester_id: requesterId,
        p_requester_fio: requesterFio || requesterId,
        p_requester_address: requesterAddress,
        p_payer_id: payerId,
        p_payer_fio: payerFio || payerId,
        p_amount: amount,
        p_asset: asset,
        p_chain_id: chainId,
        p_memo: memo,
        p_expires_in_days: expiresInDays,
      });

    if (error) {
      console.error('[PaymentRequests] Create error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      requestId,
      message: `Payment request sent to ${payerFio || payerId}`,
    });

  } catch (error) {
    console.error('[PaymentRequests] POST Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// PATCH - Accept, reject, or mark as paid
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestId, action, agentId, reason, txHash } = body;

    if (!requestId || !action || !agentId) {
      return NextResponse.json({
        ok: false,
        error: 'requestId, action, and agentId are required',
      }, { status: 400 });
    }

    const supabase = getSupabase();

    if (action === 'accept') {
      // Accept the request (will trigger payment via separate call)
      const { data: success, error } = await supabase
        .rpc('accept_payment_request', {
          p_request_id: requestId,
          p_payer_id: agentId,
        });

      if (error || !success) {
        return NextResponse.json({
          ok: false,
          error: error?.message || 'Failed to accept request',
        }, { status: 500 });
      }

      // Get request details for payment
      const { data: request } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      return NextResponse.json({
        ok: true,
        message: 'Request accepted',
        request,
        nextStep: 'Execute payment via /api/a2a/signer/transfer',
      });

    } else if (action === 'reject') {
      const { data: success, error } = await supabase
        .rpc('reject_payment_request', {
          p_request_id: requestId,
          p_payer_id: agentId,
          p_reason: reason || null,
        });

      if (error || !success) {
        return NextResponse.json({
          ok: false,
          error: error?.message || 'Failed to reject request',
        }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: 'Request rejected, requester has been notified',
      });

    } else if (action === 'paid') {
      if (!txHash) {
        return NextResponse.json({
          ok: false,
          error: 'txHash required for paid action',
        }, { status: 400 });
      }

      const { data: success, error } = await supabase
        .rpc('mark_payment_request_paid', {
          p_request_id: requestId,
          p_tx_hash: txHash,
        });

      if (error || !success) {
        return NextResponse.json({
          ok: false,
          error: error?.message || 'Failed to mark as paid',
        }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: 'Payment recorded, requester has been notified',
        txHash,
      });

    } else {
      return NextResponse.json({
        ok: false,
        error: 'Invalid action. Use: accept, reject, or paid',
      }, { status: 400 });
    }

  } catch (error) {
    console.error('[PaymentRequests] PATCH Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
