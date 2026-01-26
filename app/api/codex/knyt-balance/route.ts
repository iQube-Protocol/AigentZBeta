/**
 * KNYT Balance API
 * 
 * GET /api/codex/knyt-balance?personaId=<personaId>
 * 
 * Fetches KNYT balance for a persona
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnytBalance } from '@/services/wallet/knyt/knytLedgerService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');

    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId is required' },
        { status: 400 }
      );
    }

    const balance = await getKnytBalance(personaId);
    
    return NextResponse.json(balance);
  } catch (error) {
    console.error('Error fetching KNYT balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KNYT balance' },
      { status: 500 }
    );
  }
}
