import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPersonaFioService } from '@/services/wallet/personaFioService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/identity/persona/[id]
 * Fetch a single persona by ID or FIO handle
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Persona ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if id looks like a UUID or a FIO handle
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isFioHandle = id.includes('@');

    // PRIORITY 1: Try persona table (singular) - has wallet addresses
    let personaQuery = supabase.from('persona').select('*');
    if (isUuid) {
      personaQuery = personaQuery.eq('id', id);
    } else if (isFioHandle) {
      personaQuery = personaQuery.eq('fio_handle', id);
    } else {
      personaQuery = personaQuery.eq('id', id);
    }

    const { data: personaSingular, error: singularError } = await personaQuery.single();

    if (!singularError && personaSingular) {
      // Also try to get display_name from personas table if needed
      let displayData: any = {};
      if (isUuid) {
        const { data: pd } = await supabase
          .from('personas')
          .select('display_name, avatar_uri')
          .eq('id', id)
          .single();
        if (pd) displayData = pd;
      }
      
      return NextResponse.json({ 
        ok: true, 
        data: { 
          ...personaSingular, 
          display_name: displayData.display_name,
          avatar_uri: displayData.avatar_uri,
        } 
      });
    }

    // PRIORITY 2: Try persona_with_reputation view (includes reputation data)
    let query = supabase.from('persona_with_reputation').select('*');
    if (isUuid) {
      query = query.eq('id', id);
    } else if (isFioHandle) {
      query = query.eq('fio_handle', id);
    } else {
      query = query.or(`id.eq.${id},fio_handle.ilike.%${id}%`);
    }

    const { data: personaWithRep, error: repError } = await query.single();

    if (!repError && personaWithRep) {
      return NextResponse.json({ ok: true, data: personaWithRep });
    }

    // PRIORITY 3: Fallback to basic personas table
    let fallbackQuery = supabase.from('personas').select('*');
    if (isUuid) {
      fallbackQuery = fallbackQuery.eq('id', id);
    } else if (isFioHandle) {
      fallbackQuery = fallbackQuery.eq('fio_handle', id);
    } else {
      fallbackQuery = fallbackQuery.or(`id.eq.${id},fio_handle.ilike.%${id}%`);
    }

    const { data: persona, error } = await fallbackQuery.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { ok: false, error: 'Persona not found' },
          { status: 404 }
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, data: persona });
  } catch (e: any) {
    console.error('[GET /api/identity/persona/[id]] Error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to fetch persona' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/identity/persona/[id]
 * Update a persona by ID or FIO handle
 * 
 * Supports updating wallet addresses (evm_address, btc_address, sol_address)
 * which are stored in Supabase and should also be synced to FIO network.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Persona ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if id looks like a UUID or a FIO handle
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isFioHandle = id.includes('@');

    // persona table (singular) has different columns than personas table (plural)
    // persona: id, fio_handle, evm_address, btc_address, sol_address, bio, etc.
    // personas: id, display_name, avatar_uri, evm_address, btc_address, sol_address, bio, etc.
    
    // Filter body to only include columns that exist in persona table
    const personaTableUpdates: Record<string, any> = {};
    if (body.evm_address !== undefined) personaTableUpdates.evm_address = body.evm_address;
    if (body.btc_address !== undefined) personaTableUpdates.btc_address = body.btc_address;
    if (body.sol_address !== undefined) personaTableUpdates.sol_address = body.sol_address;
    if (body.bio !== undefined) personaTableUpdates.bio = body.bio;
    if (body.fio_handle !== undefined) personaTableUpdates.fio_handle = body.fio_handle;

    // Try persona table first (singular - where most data lives)
    let data: any = null;
    let error: any = null;
    
    if (Object.keys(personaTableUpdates).length > 0) {
      let query = supabase.from('persona').update(personaTableUpdates);
      if (isUuid) {
        query = query.eq('id', id);
      } else if (isFioHandle) {
        query = query.eq('fio_handle', id);
      } else {
        query = query.eq('id', id);
      }

      const result = await query.select().single();
      data = result.data;
      error = result.error;
    }

    // If not found in persona table or no valid updates, try personas table (plural)
    if (error?.code === 'PGRST116' || !data) {
      // personas table supports all fields including display_name, avatar_uri
      let fallbackQuery = supabase.from('personas').update(body);
      if (isUuid) {
        fallbackQuery = fallbackQuery.eq('id', id);
      } else if (isFioHandle) {
        fallbackQuery = fallbackQuery.eq('fio_handle', id);
      } else {
        fallbackQuery = fallbackQuery.eq('id', id);
      }
      const fallbackResult = await fallbackQuery.select().single();
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { ok: false, error: 'Persona not found' },
          { status: 404 }
        );
      }
      throw new Error(error.message);
    }

    // Sync wallet addresses to FIO network if evm_address, btc_address, or sol_address changed
    // This calls FIO addpubaddress action to register chain mappings on-chain
    const fioHandle = data?.fio_handle;
    if (fioHandle && (body.evm_address || body.btc_address || body.sol_address)) {
      console.log('[PATCH persona] Syncing wallet addresses to FIO network:', {
        fioHandle,
        evm_address: body.evm_address,
        btc_address: body.btc_address,
        sol_address: body.sol_address,
      });
      
      const fioSyncResults: { chain: string; success: boolean; error?: string }[] = [];
      
      try {
        const fioService = getPersonaFioService();
        
        // Sync EVM address (ETH chain code covers all EVM chains in FIO)
        if (body.evm_address) {
          const result = await fioService.mapWalletAddress(fioHandle, 'ETH', body.evm_address);
          fioSyncResults.push({ chain: 'ETH', ...result });
        }
        
        // Sync BTC address
        if (body.btc_address) {
          const result = await fioService.mapWalletAddress(fioHandle, 'BTC', body.btc_address);
          fioSyncResults.push({ chain: 'BTC', ...result });
        }
        
        // Sync SOL address
        if (body.sol_address) {
          const result = await fioService.mapWalletAddress(fioHandle, 'SOL', body.sol_address);
          fioSyncResults.push({ chain: 'SOL', ...result });
        }
        
        console.log('[PATCH persona] FIO sync results:', fioSyncResults);
      } catch (fioError) {
        console.error('[PATCH persona] FIO sync error:', fioError);
        // Don't fail the request if FIO sync fails - Supabase update succeeded
        fioSyncResults.push({ chain: 'ALL', success: false, error: (fioError as Error).message });
      }
      
      // Include FIO sync status in response
      return NextResponse.json({ 
        ok: true, 
        data,
        fioSync: {
          attempted: true,
          results: fioSyncResults,
        }
      });
    }

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('[PATCH /api/identity/persona/[id]] Error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to update persona' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/identity/persona/[id]
 * Delete a persona
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Persona ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from('personas')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, message: 'Persona deleted successfully' });
  } catch (e: any) {
    console.error('[DELETE /api/identity/persona/[id]] Error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to delete persona' },
      { status: 500 }
    );
  }
}
