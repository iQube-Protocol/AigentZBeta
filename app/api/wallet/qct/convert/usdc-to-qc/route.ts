import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { creditWalletAsset, debitWalletAsset, type WalletAssetCode } from '@/services/wallet/qctLedgerService';
import type { QriptoDenomination } from '@/services/qriptocent/settlement/types';

/**
 * Authorization repair (2026-09-01, urgent — CLAUDE.md "Identity & Access
 * Spine"): this route previously took the wallet subject as a body-supplied
 * `personaId` with NO authentication check at all — any caller could debit/
 * credit ANY persona's wallet by passing that persona's id. The wallet
 * subject now resolves EXCLUSIVELY from the authenticated caller's session
 * via the existing canonical identity spine (`getActivePersona` — the SAME
 * resolver every other spine-gated route uses; no new resolver invented).
 * A body-supplied `personaId` is no longer read for ANY purpose — see the
 * removed destructuring below. `getActivePersona`'s own existing source
 * chain (session token / `x-persona-id` header / `?personaId=` URL param /
 * default) already validates that any explicitly-selected persona is
 * OWNED by the caller before returning it, so the existing multi-persona
 * selection mechanism is preserved exactly, just no longer bypassable via
 * the request body.
 */

export const runtime = 'nodejs';

function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

// Maps the caller-facing QriptoDenomination choice to this ledger's asset
// code. 'QCT' is this ledger's pre-existing name for Base Q¢ ('BASE_QC') —
// see the WalletAssetCode comment in qctLedgerService.ts.
const DESTINATION_ASSET: Record<QriptoDenomination, WalletAssetCode> = {
  BASE_QC: 'QCT',
  BCENT: 'BCENT',
};

export async function POST(request: NextRequest) {
  try {
    // Authoritative wallet subject — resolved server-side ONLY. A body-
    // supplied `personaId` is never read (see file header).
    const persona = await getActivePersona(request);
    if (!persona?.personaId) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required — no active persona resolved for this caller.' },
        { status: 401 },
      );
    }
    const personaId = persona.personaId;

    const body = await request.json().catch(() => ({}));
    const { usdcAmount, destination } = body || {};

    const usdc = Number(usdcAmount);
    if (!Number.isFinite(usdc) || usdc <= 0) {
      return NextResponse.json({ ok: false, error: 'usdcAmount must be a positive number' }, { status: 400 });
    }

    // Defaults to Base Q¢ so existing callers that don't send `destination`
    // keep today's behaviour exactly.
    const destinationDenomination: QriptoDenomination =
      destination === 'BCENT' ? 'BCENT' : 'BASE_QC';
    const destinationAsset = DESTINATION_ASSET[destinationDenomination];

    const rate = 100; // 1 USDC = 100 Q¢ (CLAUDE.md Q¢ pricing: $1 = 100 Q¢)
    const feePercent = 0.01;

    const qctGross = usdc * rate;
    const feeQct = qctGross * feePercent;
    const qctNet = qctGross - feeQct;

    const conversionId = `usdc_to_qct_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const metadata = {
      conversionId,
      rate,
      feePercent,
      destination: destinationDenomination,
      usdcAmount: round8(usdc),
      qctGross: round8(qctGross),
      feeQct: round8(feeQct),
      qctNet: round8(qctNet),
      // BCENT is settled off-chain until the BitCent Rune is etched (R-10) —
      // see codexes/packs/agentiq/updates/2026-07-29_qriptocent-supply-constitution.md
      onChainSettled: destinationDenomination === 'BASE_QC',
    };

    // Debit USDC first
    const debit = await debitWalletAsset(personaId, 'USDC', usdc, 'usdc_to_qct_conversion', metadata);
    if (!debit.success) {
      return NextResponse.json({ ok: false, error: debit.error }, { status: 400 });
    }

    // Credit the chosen destination denomination
    const credit = await creditWalletAsset(personaId, destinationAsset, qctNet, 'usdc_to_qct_conversion', metadata);
    if (!credit.success) {
      // Attempt rollback
      await creditWalletAsset(personaId, 'USDC', usdc, 'usdc_to_qct_refund', {
        ...metadata,
        rollbackReason: credit.error || 'credit_failed',
      });

      return NextResponse.json({ ok: false, error: credit.error || `Failed to credit ${destinationDenomination}` }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      conversionId,
      destination: destinationDenomination,
      debited: {
        asset: 'USDC',
        amount: round8(usdc),
        txId: debit.txId,
        newBalance: debit.newBalance,
      },
      credited: {
        asset: destinationDenomination,
        amount: round8(qctNet),
        txId: credit.txId,
        newBalance: credit.newBalance,
      },
      quote: {
        rate,
        feePercent,
        destination: destinationDenomination,
        qctGross: round8(qctGross),
        feeQct: round8(feeQct),
        qctNet: round8(qctNet),
      },
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[USDC→QCT] conversion error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
