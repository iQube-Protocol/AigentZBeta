/**
 * EVM KNYT Balance API
 * GET /api/wallet/knyt/evm-balance?address=0x...&chainId=8453
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEvmKnytBalance, getAllEvmKnytBalances } from '@/services/wallet/knyt/evmKnytService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const chainId = searchParams.get('chainId');
    
    if (!address) {
      return NextResponse.json({ error: 'address is required' }, { status: 400 });
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid EVM address format' }, { status: 400 });
    }
    
    if (chainId) {
      const balance = await getEvmKnytBalance(address);
      return NextResponse.json({ address, balance });
    }
    
    // Return all chain balances
    const balances = await getAllEvmKnytBalances(address);
    return NextResponse.json({ address, balances });
  } catch (error) {
    console.error('[EVM KNYT API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
