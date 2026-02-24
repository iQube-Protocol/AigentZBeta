/**
 * KNYT Credit API
 * POST /api/wallet/knyt/credit
 * Body: { personaId, amount, source, metadata? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { creditKnyt } from '@/services/wallet/knyt/knytLedgerService';
import { KnytTxSource } from '@/services/wallet/knyt/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personaId, amount, source, metadata } = body;
    
    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }
    if (!source) {
      return NextResponse.json({ error: 'source is required' }, { status: 400 });
    }
    
    const result = await creditKnyt(personaId, amount, source as KnytTxSource, metadata);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      transaction: result.transaction,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error('[KNYT Credit API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
