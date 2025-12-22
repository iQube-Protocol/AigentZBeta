/**
 * x402 Payment Request API
 * 
 * Creates payment requests that can be shared via:
 * - Shareable payment links
 * - QR codes
 * 
 * Supports deferred minting and cross-chain claims.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

interface PaymentRequestInput {
  amount: number;
  asset: string;
  chainId: number | string;
  requesterDid: string;
  requesterFio?: string;
  memo?: string;
  expiresIn?: number; // seconds
}

interface PaymentRequest {
  id: string;
  amount: number;
  asset: string;
  chainId: number | string;
  requesterDid: string;
  requesterFio?: string;
  memo?: string;
  expiresAt: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  paymentLink: string;
  qrData: string;
  createdAt: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `pr_${timestamp}${random}`;
}

function generatePaymentLink(requestId: string, baseUrl: string): string {
  return `${baseUrl}/pay/${requestId}`;
}

function generateQRData(request: PaymentRequest): string {
  // Generate a compact QR-friendly data string
  // Format: x402://<requestId>?a=<amount>&c=<chainId>&to=<requesterDid>
  const params = new URLSearchParams({
    a: request.amount.toString(),
    c: request.chainId.toString(),
    to: request.requesterDid,
  });
  
  if (request.memo) {
    params.set('m', request.memo);
  }
  
  return `x402://${request.id}?${params.toString()}`;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    return null;
  }
  
  return createClient(url, key);
}

// =============================================================================
// API HANDLERS
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    const body: PaymentRequestInput = await req.json();
    
    // Validate required fields
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid amount' },
        { status: 400 }
      );
    }
    
    if (!body.requesterDid) {
      return NextResponse.json(
        { ok: false, error: 'Missing requesterDid' },
        { status: 400 }
      );
    }

    // Generate request ID
    const requestId = generateRequestId();
    
    // Calculate expiry
    const expiresIn = body.expiresIn || 86400; // Default 24 hours
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    
    // Get base URL for payment link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    process.env.NEXTAUTH_URL || 
                    'https://beta.aigentz.me';
    
    // Create payment request object
    const paymentRequest: PaymentRequest = {
      id: requestId,
      amount: body.amount,
      asset: body.asset || 'QCT',
      chainId: body.chainId || 421614,
      requesterDid: body.requesterDid,
      requesterFio: body.requesterFio,
      memo: body.memo,
      expiresAt,
      status: 'pending',
      paymentLink: generatePaymentLink(requestId, baseUrl),
      qrData: '', // Will be set after full object is created
      createdAt: new Date().toISOString(),
    };
    
    // Generate QR data
    paymentRequest.qrData = generateQRData(paymentRequest);
    
    // Persist to database
    const supabase = getSupabase();
    if (supabase) {
      const { error: insertError } = await supabase
        .from('x402_payment_requests')
        .insert({
          id: requestId,
          amount: body.amount,
          asset: body.asset || 'QCT',
          chain_id: body.chainId || 421614,
          requester_did: body.requesterDid,
          requester_fio: body.requesterFio,
          memo: body.memo,
          expires_at: expiresAt,
          status: 'pending',
          payment_link: paymentRequest.paymentLink,
          qr_data: paymentRequest.qrData,
        });
      
      if (insertError) {
        // Log but don't fail - request can still work without persistence
        console.warn('Failed to persist payment request:', insertError.message);
        
        // If table doesn't exist, that's okay - we'll return the request anyway
        if (!insertError.message.includes('does not exist')) {
          console.error('Payment request insert error:', insertError);
        }
      }
    }
    
    return NextResponse.json({
      ok: true,
      ...paymentRequest,
    });
    
  } catch (error: any) {
    console.error('Payment request error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create payment request' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('id');
  
  if (!requestId) {
    return NextResponse.json(
      { ok: false, error: 'Missing request ID' },
      { status: 400 }
    );
  }
  
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'Database not configured' },
      { status: 500 }
    );
  }
  
  const { data, error } = await supabase
    .from('x402_payment_requests')
    .select('*')
    .eq('id', requestId)
    .single();
  
  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: 'Payment request not found' },
      { status: 404 }
    );
  }
  
  // Check if expired
  if (new Date(data.expires_at) < new Date() && data.status === 'pending') {
    // Update status to expired
    await supabase
      .from('x402_payment_requests')
      .update({ status: 'expired' })
      .eq('id', requestId);
    
    data.status = 'expired';
  }
  
  return NextResponse.json({
    ok: true,
    id: data.id,
    amount: data.amount,
    asset: data.asset,
    chainId: data.chain_id,
    requesterDid: data.requester_did,
    requesterFio: data.requester_fio,
    memo: data.memo,
    expiresAt: data.expires_at,
    status: data.status,
    paymentLink: data.payment_link,
    qrData: data.qr_data,
    createdAt: data.created_at,
  });
}

// Mark a payment request as paid
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestId, txHash, paidBy } = body;
    
    if (!requestId) {
      return NextResponse.json(
        { ok: false, error: 'Missing requestId' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: 'Database not configured' },
        { status: 500 }
      );
    }
    
    const { data, error } = await supabase
      .from('x402_payment_requests')
      .update({
        status: 'paid',
        paid_tx_hash: txHash,
        paid_by: paidBy,
        paid_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      ok: true,
      request: data,
    });
    
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to update payment request' },
      { status: 500 }
    );
  }
}
