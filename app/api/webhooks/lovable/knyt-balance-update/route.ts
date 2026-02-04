/**
 * KNYT Balance Update Webhook for Lovable Integration
 * 
 * Handles balance change events and notifies Lovable thin client
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnytBalance } from '@/services/wallet/knyt/knytLedgerService';

export async function POST(request: NextRequest) {
  try {
    const { event, personaId, data } = await request.json();

    if (event === 'balance_update_request' || event === 'purchase_completed') {
      // Get current balance
      const balanceResult = await getKnytBalance(personaId);

      if (balanceResult.success && balanceResult.balance) {
        return NextResponse.json({
          success: true,
          event: 'balance_updated',
          data: {
            personaId,
            balance: balanceResult.balance,
            timestamp: new Date().toISOString(),
            trigger: event,
          }
        });
      } else {
        return NextResponse.json({ 
          error: 'Failed to fetch balance',
          details: balanceResult.error 
        }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Unknown event' }, { status: 400 });

  } catch (error) {
    console.error('KNYT Balance Update Webhook Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
