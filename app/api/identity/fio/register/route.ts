import { NextRequest, NextResponse } from 'next/server';
import { getFIOService } from '@/services/identity/fioService';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Register a new FIO handle
 * POST /api/identity/fio/register
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
    const { handle, publicKey, personaId, privateKey } = body;

    if (!handle || !publicKey || !personaId) {
      return NextResponse.json(
        { ok: false, error: 'Handle, publicKey, and personaId are required' },
        { status: 400 }
      );
    }

    if (!privateKey) {
      return NextResponse.json(
        { ok: false, error: 'Private key is required for registration' },
        { status: 400 }
      );
    }

    // Initialize FIO service with private key for registration
    const fioService = getFIOService();
    await fioService.initialize({
      endpoint: process.env.FIO_API_ENDPOINT || 'https://fio.greymass.com',
      chainId: process.env.FIO_CHAIN_ID || '21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c',
      privateKey,
      publicKey
    });

    // Register the handle
    const result = await fioService.registerHandle(handle, publicKey);

    // Update persona in Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error: updateError } = await supabase
      .from('persona')
      .update({
        fio_handle: handle,
        fio_public_key: publicKey,
        fio_tx_id: result.txId,
        fio_handle_expiration: result.expiration.toISOString(),
        fio_registration_status: 'pending',
        fio_registered_at: new Date().toISOString()
      })
      .eq('id', personaId);

    if (updateError) {
      console.error('Failed to update persona:', updateError);
      // Registration succeeded but DB update failed - log but don't fail
    }

    return NextResponse.json({
      ok: true,
      data: {
        txId: result.txId,
        fioAddress: result.fioAddress,
        expiration: result.expiration.toISOString(),
        fee: result.fee,
        status: 'pending'
      }
    });
  } catch (e: any) {
    console.error('FIO registration error:', e);
    
    // If registration failed, update persona status
    if (body?.personaId) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from('persona')
          .update({
            fio_registration_status: 'failed'
          })
          .eq('id', body.personaId);
      } catch (updateError) {
        console.error('Failed to update persona status:', updateError);
      }
    }

    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to register FIO handle' },
      { status: 500 }
    );
  }
}
