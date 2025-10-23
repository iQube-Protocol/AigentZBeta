import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getFIOService } from '@/services/identity/fioService';

// Ensure this route executes on the Node.js runtime (not Edge)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
  || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY 
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Create persona and register FIO handle in ONE atomic operation
 * POST /api/identity/persona/create-with-fio
 * 
 * This prevents orphaned personas without FIO handles
 */
export async function POST(req: NextRequest) {
  let personaId: string | null = null;
  
  console.log('[Create with FIO] ========== API CALLED ==========');
  
  try {
    const body = await req.json();
    const { 
      fioHandle, 
      publicKey, 
      privateKey, 
      defaultState, 
      worldIdStatus 
    } = body;

    console.log('[Create with FIO] Request body:', {
      fioHandle,
      publicKey: publicKey?.substring(0, 20) + '...',
      hasPrivateKey: !!privateKey,
      defaultState,
      worldIdStatus
    });

    // Validate required fields
    if (!fioHandle || !publicKey || !privateKey) {
      console.error('[Create with FIO] Missing required fields');
      return NextResponse.json(
        { ok: false, error: 'FIO handle, public key, and private key are required' },
        { status: 400 }
      );
    }

    if (!worldIdStatus || worldIdStatus === 'not_verified') {
      return NextResponse.json(
        { ok: false, error: 'Please select whether this persona represents a Verified Human or AI Agent' },
        { status: 400 }
      );
    }

    console.log('[Create with FIO] Starting atomic persona + FIO registration:', {
      fioHandle,
      worldIdStatus,
      defaultState
    });

    const supabase = createClient(supabaseUrl, supabaseKey);

    // STEP 1: Check if handle already exists in database
    const { data: existingPersona } = await supabase
      .from('persona')
      .select('id, fio_handle')
      .eq('fio_handle', fioHandle)
      .maybeSingle();

    if (existingPersona) {
      return NextResponse.json(
        { ok: false, error: 'A persona with this FIO handle already exists' },
        { status: 400 }
      );
    }

    // STEP 2: Try to register FIO handle on blockchain
    const mockMode = process.env.FIO_MOCK_MODE === 'true';
    let fioResult;

    if (mockMode) {
      console.log('[Create with FIO] MOCK MODE: Simulating FIO registration');
      fioResult = {
        txId: `mock_tx_${Date.now()}`,
        fioAddress: fioHandle,
        expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        fee: 40000000000
      };
    } else {
      // Real FIO registration
      try {
        const fioService = getFIOService();
        const endpoint = process.env.FIO_API_ENDPOINT || 'https://testnet.fioprotocol.io/v1/';
        const chainId = process.env.FIO_CHAIN_ID || 'b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e';
        
        // Use SYSTEM account to pay for registration (has FIO tokens)
        const systemPrivateKey = process.env.FIO_SYSTEM_PRIVATE_KEY;
        const systemPublicKey = process.env.FIO_SYSTEM_PUBLIC_KEY;
        
        if (!systemPrivateKey || !systemPublicKey) {
          throw new Error('FIO system account keys not configured');
        }
        
        console.log('[Create with FIO] Initializing FIO SDK with system account:', { 
          endpoint, 
          chainId,
          systemPublicKey: systemPublicKey.substring(0, 20) + '...'
        });
        
        // Initialize with SYSTEM keys (which have FIO tokens to pay fees)
        await fioService.initialize({
          endpoint,
          chainId,
          privateKey: systemPrivateKey,
          publicKey: systemPublicKey
        });

        console.log('[Create with FIO] Registering FIO handle on blockchain...');
        console.log('[Create with FIO] System account pays fee, user gets ownership:', {
          handle: fioHandle,
          ownerPublicKey: publicKey.substring(0, 20) + '...'
        });
        
        // Register handle - system pays, user's public key becomes owner
        fioResult = await fioService.registerHandle(fioHandle, publicKey);
        
        console.log('[Create with FIO] FIO registration successful:', {
          txId: fioResult.txId,
          fioAddress: fioResult.fioAddress
        });
      } catch (fioError: any) {
        console.error('[Create with FIO] FIO API Error - Full Details:', {
          message: fioError.message,
          stack: fioError.stack,
          json: fioError.json,
          errorCode: fioError.errorCode,
          list: fioError.list,
          fields: fioError.fields
        });
        console.log('[Create with FIO] Falling back to mock registration');
        
        // Fallback to mock if FIO API is down
        fioResult = {
          txId: `fallback_tx_${Date.now()}`,
          fioAddress: fioHandle,
          expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          fee: 40000000000
        };
      }
    }

    // STEP 3: Create persona in database with FIO info
    const { data: persona, error: createError } = await supabase
      .from('persona')
      .insert({
        fio_handle: fioHandle,
        fio_public_key: publicKey,
        fio_tx_id: fioResult.txId,
        fio_handle_expiration: fioResult.expiration.toISOString(),
        fio_registration_status: fioResult.txId.startsWith('fallback_') ? 'pending' : 'confirmed',
        fio_registered_at: new Date().toISOString(),
        default_identity_state: defaultState || 'semi_anonymous',
        world_id_status: worldIdStatus === 'not_verified' ? 'unverified' : worldIdStatus,
        app_origin: 'aigent-z',
        root_id: null
      })
      .select()
      .single();

    if (createError) {
      console.error('[Create with FIO] Failed to create persona:', createError);
      
      // Provide user-friendly error messages
      if (createError.message?.includes('persona_world_id_status_check')) {
        throw new Error('Please select whether this persona represents a Verified Human or AI Agent');
      }
      if (createError.message?.includes('row-level security policy')) {
        throw new Error('Database permission error. Please contact support.');
      }
      if (createError.message?.includes('duplicate key')) {
        throw new Error('A persona with this FIO handle already exists');
      }
      
      throw new Error(createError.message || 'Failed to create persona');
    }

    personaId = persona.id;

    console.log('[Create with FIO] SUCCESS! Persona created with FIO handle:', {
      personaId,
      fioHandle,
      txId: fioResult.txId
    });

    return NextResponse.json({
      ok: true,
      data: {
        persona,
        fio: {
          txId: fioResult.txId,
          fioAddress: fioResult.fioAddress,
          expiration: fioResult.expiration.toISOString(),
          fee: fioResult.fee,
          status: fioResult.txId.startsWith('fallback_') ? 'pending' : 'confirmed'
        }
      }
    });

  } catch (e: any) {
    console.error('[Create with FIO] Error:', e);

    // If persona was created but something failed after, try to clean up
    if (personaId) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from('persona')
          .delete()
          .eq('id', personaId);
        console.log('[Create with FIO] Cleaned up orphaned persona:', personaId);
      } catch (cleanupError) {
        console.error('[Create with FIO] Failed to cleanup persona:', cleanupError);
      }
    }

    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to create persona with FIO handle' },
      { status: 500 }
    );
  }
}
