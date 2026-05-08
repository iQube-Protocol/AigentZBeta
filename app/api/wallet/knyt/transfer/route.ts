/**
 * KNYT P2P Transfer API
 * POST /api/wallet/knyt/transfer
 * Body: { fromPersonaId, toPersonaId, amount, memo? }
 *
 * Off-chain DVN ledger settlement — no gas, no chain. Internally a
 * paired debit/credit on wallet_balances tagged with transfer_out / transfer_in.
 */

import { NextRequest, NextResponse } from 'next/server';
import { transferDvnKnyt } from '@/services/wallet/knyt/knytLedgerService';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromPersonaId, toPersonaId, amount, memo } = body;

    if (!fromPersonaId) {
      return NextResponse.json({ error: 'fromPersonaId is required' }, { status: 400 });
    }
    if (!toPersonaId) {
      return NextResponse.json({ error: 'toPersonaId is required' }, { status: 400 });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const metadata = memo ? { memo } : undefined;
    const result = await transferDvnKnyt(fromPersonaId, toPersonaId, amount, metadata);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      fromTxId: result.fromTxId,
      toTxId: result.toTxId,
      newSenderBalance: result.newSenderBalance,
      newRecipientBalance: result.newRecipientBalance,
    });
  } catch (error) {
    console.error('[KNYT Transfer API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
