/**
 * KNYT Balance API
 * GET /api/wallet/knyt/balance?personaId=xxx
 * 
 * Returns both DVN ledger balance and on-chain EVM KNYT balance.
 * 
 * EVM Address Lookup Priority:
 * 1. FIO network (source of truth) - via fio_handle resolution
 * 2. persona table (singular) - Supabase cache
 * 3. personas table (plural) - legacy Supabase cache
 * 4. agent_keys table - for AI agent personas
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getKnytBalance } from '@/services/wallet/knyt/knytLedgerService';
import { getEvmKnytBalance } from '@/services/wallet/knyt/evmKnytService';
import { getPersonaFioService } from '@/services/wallet/personaFioService';

export const runtime = 'nodejs';

// CORS headers for cross-origin requests from thin client
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');
    
    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400, headers: corsHeaders });
    }
    
    // Get DVN ledger balance
    const result = await getKnytBalance(personaId);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500, headers: corsHeaders });
    }
    
    // Try to get on-chain EVM KNYT balance
    let evmKnyt: number | undefined;
    let evmAddress: string | undefined;
    
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
        
        // First, get the FIO handle for this persona
        let fioHandle: string | null = null;
        
        // Detect if personaId is UUID or string slug
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(personaId);
        const isFioHandle = personaId.includes('@');
        
        let personaData: any = null;
        let personaError: any = null;
        
        // Query persona table based on identifier type
        if (isUuid) {
          const result = await supabase.from('persona').select('fio_handle, evm_address').eq('id', personaId).single();
          personaData = result.data;
          personaError = result.error;
        } else if (isFioHandle) {
          const result = await supabase.from('persona').select('fio_handle, evm_address').eq('fio_handle', personaId).single();
          personaData = result.data;
          personaError = result.error;
        }
        // For non-UUID/non-FIO slugs, skip persona table (will check agent_keys later)
        
        console.log(`[KNYT Balance] Persona lookup for ${personaId}:`, { 
          found: !!personaData, 
          error: personaError?.message,
          fio_handle: personaData?.fio_handle,
          evm_address: personaData?.evm_address 
        });
        
        if (personaData) {
          fioHandle = personaData.fio_handle;
          // Use Supabase evm_address directly (source of truth for linked wallets)
          if (personaData.evm_address) {
            evmAddress = personaData.evm_address;
            console.log(`[KNYT Balance] Using EVM address from persona table: ${evmAddress}`);
          }
        }
        
        // PRIORITY 1: Try FIO network (source of truth) if we have a handle
        if (fioHandle && !evmAddress) {
          try {
            const fioService = getPersonaFioService();
            const fioAddresses = await fioService.resolveHandle(fioHandle);
            if (fioAddresses?.ETH) {
              evmAddress = fioAddresses.ETH;
              console.log(`[KNYT Balance] Got EVM address from FIO for ${fioHandle}: ${evmAddress}`);
            }
          } catch (fioError) {
            console.warn('[KNYT Balance] FIO lookup failed, using Supabase cache:', fioError);
          }
        }
        
        // PRIORITY 2: Check personas table (plural) for evm_address
        if (!evmAddress && (isUuid || isFioHandle)) {
          const query = supabase.from('personas').select('fio_handle, evm_address');
          const { data: personaPlural } = isUuid 
            ? await query.eq('id', personaId).single()
            : await query.eq('fio_handle', personaId).single();
          
          if (personaPlural?.evm_address) {
            evmAddress = personaPlural.evm_address;
            if (!fioHandle) fioHandle = personaPlural.fio_handle;
            console.log(`[KNYT Balance] Got EVM from personas table: ${evmAddress}`);
          }
        }
        
        // PRIORITY 3: Fallback to agent_keys for AI agent personas
        // agent_keys table uses 'agent_id' column, not 'persona_id'
        if (!evmAddress) {
          const { data: agentKeys } = await supabase
            .from('agent_keys')
            .select('evm_address')
            .eq('agent_id', personaId)
            .single();
          
          if (agentKeys?.evm_address) {
            evmAddress = agentKeys.evm_address;
            console.log(`[KNYT Balance] Got EVM address from agent_keys for ${personaId}: ${evmAddress}`);
          }
        }
        
        // Fetch on-chain KNYT balance if we have an EVM address
        if (evmAddress) {
          const evmBalance = await getEvmKnytBalance(evmAddress);
          if (evmBalance) {
            evmKnyt = parseFloat(evmBalance.balanceFormatted);
          }
        }
      }
    } catch (evmError) {
      console.warn('[KNYT Balance API] EVM balance fetch failed:', evmError);
      // Continue without EVM balance - DVN balance is still valid
    }
    
    const dvnBalance = result.balance?.dvnKnyt || 0;
    const evmBalance = evmKnyt || 0;
    const totalKnyt = dvnBalance + evmBalance;
    
    return NextResponse.json({
      personaId,
      dvnKnyt: dvnBalance,           // Off-chain DVN ledger balance (spendable in Tier 0)
      evmKnyt: evmBalance,           // On-chain EVM balance (requires bridging for Tier 0)
      totalKnyt,                     // Total balance across all sources
      spendableKnyt: dvnBalance,     // What can be spent in Tier 0 (gas-free)
      evmAddress,
      updatedAt: result.balance?.updatedAt,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[KNYT Balance API] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}
