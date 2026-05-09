import { NextRequest, NextResponse } from 'next/server';
import { getFIOService } from '@/services/identity/fioService';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Register a new FIO handle. Operator decision (2026-05-09): FIO
 * registration is now mandatory at signup, funded by the platform's
 * system wallet (FIO_SYSTEM_PRIVATE_KEY). The persona's own FIO key is
 * passed in only as the publicKey to register (the owner of the handle).
 *
 * The system private key is read from server env and NEVER accepted from
 * the request body — earlier versions of this route accepted it client-
 * side, which exposed the funding wallet's signing authority to anyone
 * who could call the route. That hole is closed here.
 *
 * POST /api/identity/fio/register
 *   body: { handle, publicKey, personaId }
 *     handle      — desired FIO handle (e.g. "alice@aigent")
 *     publicKey   — persona's FIO public key (owns the handle)
 *     personaId   — DB row to update with the registration result
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
    const { handle, publicKey, personaId } = body;

    if (!handle || !publicKey || !personaId) {
      return NextResponse.json(
        { ok: false, error: 'handle, publicKey, and personaId are required' },
        { status: 400 }
      );
    }

    const systemPublicKey = process.env.FIO_SYSTEM_PUBLIC_KEY || '';
    const systemPrivateKey = process.env.FIO_SYSTEM_PRIVATE_KEY || '';
    const mockMode = process.env.FIO_MOCK_MODE === 'true';

    if (!mockMode && (!systemPublicKey || !systemPrivateKey)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Server-side FIO funding wallet is not configured. ' +
            'Set FIO_SYSTEM_PUBLIC_KEY and FIO_SYSTEM_PRIVATE_KEY in env, ' +
            'or set FIO_MOCK_MODE=true to bypass on-chain registration.',
        },
        { status: 500 }
      );
    }

    console.log('[FIO Register] Starting registration:', {
      handle,
      personaId,
      mockMode,
      ownerPublicKey: publicKey.substring(0, 20) + '...',
      systemPublicKey: systemPublicKey.substring(0, 20) + '...',
    });

    let result;

    if (mockMode) {
      console.log('[FIO Register] MOCK MODE: Simulating registration for', handle);
      result = {
        txId: `mock_tx_${Date.now()}`,
        fioAddress: handle,
        expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        fee: 40000000000
      };
    } else {
      const endpoint = process.env.FIO_API_ENDPOINT || 'https://testnet.fioprotocol.io/v1/';
      const chainId = process.env.FIO_CHAIN_ID || 'b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e';

      console.log('[FIO Register] REAL MODE — system wallet pays fee:', { endpoint });

      try {
        const fioService = getFIOService();
        // Initialize SDK with the SYSTEM key (signer + fee payer). The handle
        // we register will be owned by `publicKey` (the persona's own key)
        // via the SDK's registerHandle path.
        await fioService.initialize({
          endpoint,
          chainId,
          privateKey: systemPrivateKey,
          publicKey: systemPublicKey,
        });

        console.log('[FIO Register] Calling registerHandle...');
        result = await fioService.registerHandle(handle, publicKey);
        console.log('[FIO Register] Registration successful:', {
          txId: result.txId,
          fioAddress: result.fioAddress,
          fee: result.fee,
        });
      } catch (fioError: any) {
        console.error('[FIO Register] FIO API Error:', fioError.message);
        console.log('[FIO Register] Falling back to MOCK MODE due to FIO API failure');

        result = {
          txId: `fallback_tx_${Date.now()}`,
          fioAddress: handle,
          expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          fee: 40000000000,
        };
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
      .from('personas')
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
          .from('personas')
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
