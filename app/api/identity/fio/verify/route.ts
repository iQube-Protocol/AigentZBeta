import { NextRequest, NextResponse } from 'next/server';
import { getFIOService } from '@/services/identity/fioService';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Verify FIO handle ownership
 * POST /api/identity/fio/verify
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { handle, publicKey, personaId } = body;

    if (!handle || !publicKey) {
      return NextResponse.json(
        { ok: false, error: 'Handle and publicKey are required' },
        { status: 400 }
      );
    }

    // Initialize FIO service
    const fioService = getFIOService();
    await fioService.initialize({
      endpoint: process.env.FIO_API_ENDPOINT || 'https://fio.greymass.com',
      chainId: process.env.FIO_CHAIN_ID || '21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c'
    });

    // Verify ownership
    const verified = await fioService.verifyOwnership(handle, publicKey);

    // Get handle info for expiration
    let expiration = null;
    let owner = null;
    try {
      const info = await fioService.getHandleInfo(handle);
      expiration = info.expiration.toISOString();
      owner = info.owner;
    } catch (e) {
      console.error('Failed to get handle info:', e);
    }

    // Update persona in Supabase if personaId provided
    if (personaId && verified) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error: updateError } = await supabase
        .from('persona')
        .update({
          fio_handle: handle,
          fio_public_key: publicKey,
          fio_handle_verified: true,
          fio_handle_expiration: expiration,
          fio_registration_status: 'confirmed',
          fio_last_verified_at: new Date().toISOString()
        })
        .eq('id', personaId);

      if (updateError) {
        console.error('Failed to update persona:', updateError);
      }
    }

    return NextResponse.json({
      ok: true,
      verified,
      owner,
      expiration
    });
  } catch (e: any) {
    console.error('FIO verification error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to verify FIO handle' },
      { status: 500 }
    );
  }
}
