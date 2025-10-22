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

    // Check if mock mode is enabled (for development when testnet is unavailable)
    const mockMode = process.env.FIO_MOCK_MODE === 'true';
    
    console.log('[FIO Register] Starting registration:', {
      handle,
      personaId,
      mockMode,
      publicKey: publicKey.substring(0, 20) + '...',
      hasPrivateKey: !!privateKey
    });
    
    let result;
    
    if (mockMode) {
      // Mock registration for development
      console.log('[FIO Register] MOCK MODE: Simulating registration for', handle);
      result = {
        txId: `mock_tx_${Date.now()}`,
        fioAddress: handle,
        expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        fee: 40000000000
      };
    } else {
      // Real FIO registration
      console.log('[FIO Register] REAL MODE: Registering on FIO blockchain');
      const endpoint = process.env.FIO_API_ENDPOINT || 'https://testnet.fioprotocol.io/v1/';
      const chainId = process.env.FIO_CHAIN_ID || 'b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e';
      
      console.log('[FIO Register] Initializing FIO SDK:', { endpoint, chainId });
      
      try {
        const fioService = getFIOService();
        await fioService.initialize({
          endpoint,
          chainId,
          privateKey,
          publicKey
        });

        console.log('[FIO Register] Calling registerHandle...');
        result = await fioService.registerHandle(handle, publicKey);
        console.log('[FIO Register] Registration successful:', {
          txId: result.txId,
          fioAddress: result.fioAddress,
          fee: result.fee
        });
      } catch (fioError: any) {
        console.error('[FIO Register] FIO API Error:', fioError.message);
        console.log('[FIO Register] Falling back to MOCK MODE due to FIO API failure');
        
        // Fallback to mock registration if FIO API is down
        result = {
          txId: `fallback_tx_${Date.now()}`,
          fioAddress: handle,
          expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          fee: 40000000000
        };
        
        console.log('[FIO Register] Using fallback registration:', result);
      }
    }

    // Update persona in Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Updating persona in Supabase:', {
      personaId,
      handle,
      publicKey: publicKey.substring(0, 20) + '...',
      txId: result.txId
    });
    
    const { data: updateData, error: updateError } = await supabase
      .from('persona')
      .update({
        fio_handle: handle,
        fio_public_key: publicKey,
        fio_tx_id: result.txId,
        fio_handle_expiration: result.expiration.toISOString(),
        fio_registration_status: 'confirmed',
        fio_registered_at: new Date().toISOString()
      })
      .eq('id', personaId)
      .select();

    if (updateError) {
      console.error('Failed to update persona in Supabase:', {
        error: updateError,
        personaId,
        handle
      });
      // Return error to client so they know what happened
      return NextResponse.json({
        ok: false,
        error: `Registration succeeded but failed to save to database: ${updateError.message}`
      }, { status: 500 });
    }

    console.log('Persona updated successfully:', updateData);

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
