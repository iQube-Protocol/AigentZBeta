/**
 * Sync Persona Wallet Addresses to FIO Network
 * POST /api/identity/persona/[id]/sync-fio
 * 
 * Syncs the persona's wallet addresses (EVM, BTC, SOL) to the FIO network
 * so they can be resolved via the FIO handle.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPersonaFioService } from '@/services/wallet/personaFioService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Persona ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch canonical persona from database
    const { data: persona } = await supabase
      .from('personas')
      .select('id, fio_handle, evm_address, btc_address, sol_address')
      .eq('id', id)
      .single();

    if (!persona) {
      return NextResponse.json(
        { ok: false, error: 'Persona not found' },
        { status: 404 }
      );
    }

    if (!persona.fio_handle) {
      return NextResponse.json(
        { ok: false, error: 'Persona does not have a FIO handle' },
        { status: 400 }
      );
    }

    const fioService = getPersonaFioService();
    const results: { chain: string; success: boolean; error?: string }[] = [];

    // Sync EVM address
    if (persona.evm_address) {
      const result = await fioService.mapWalletAddress(
        persona.fio_handle,
        'ETH', // FIO chain code for EVM
        persona.evm_address
      );
      results.push({ chain: 'ETH', ...result });
    }

    // Sync BTC address
    if (persona.btc_address) {
      const result = await fioService.mapWalletAddress(
        persona.fio_handle,
        'BTC',
        persona.btc_address
      );
      results.push({ chain: 'BTC', ...result });
    }

    // Sync SOL address
    if (persona.sol_address) {
      const result = await fioService.mapWalletAddress(
        persona.fio_handle,
        'SOL',
        persona.sol_address
      );
      results.push({ chain: 'SOL', ...result });
    }

    const allSuccess = results.every(r => r.success);
    const syncedCount = results.filter(r => r.success).length;

    return NextResponse.json({
      ok: allSuccess,
      message: `Synced ${syncedCount}/${results.length} addresses to FIO`,
      results,
      fioHandle: persona.fio_handle,
    });

  } catch (e: any) {
    console.error('[POST /api/identity/persona/[id]/sync-fio] Error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to sync to FIO' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/identity/persona/[id]/sync-fio
 * Get the current FIO chain mappings for a persona
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Persona ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch persona to get FIO handle
    const { data: p2 } = await supabase
      .from('personas')
      .select('fio_handle')
      .eq('id', id)
      .single();
    const fioHandle: string | null = p2?.fio_handle ?? null;

    if (!fioHandle) {
      return NextResponse.json(
        { ok: false, error: 'Persona not found or has no FIO handle' },
        { status: 404 }
      );
    }

    // Resolve FIO handle to get chain addresses
    const fioService = getPersonaFioService();
    const addresses = await fioService.resolveHandle(fioHandle);

    return NextResponse.json({
      ok: true,
      fioHandle,
      addresses: addresses || {},
    });

  } catch (e: any) {
    console.error('[GET /api/identity/persona/[id]/sync-fio] Error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to get FIO mappings' },
      { status: 500 }
    );
  }
}
