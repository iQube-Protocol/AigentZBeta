import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { constitutionalRuntime } from '@/services/ctp/constitutionalRuntime';
import '@/services/ctp/primitives/walletAssetConvert';
import type { WalletAssetConvertResult } from '@/services/ctp/primitives/walletAssetConvert';

export const runtime = 'nodejs';

/**
 * CTP Slice C (2026-09-01, delivery amendment §3.3) — this route is now a
 * THIN WEB-CHANNEL ADAPTER over the Constitutional Runtime. It performs no
 * wallet mutation of its own: the ONE canonical implementation
 * (`convertWalletAsset`, bound to the atomic `convert_wallet_asset`
 * Postgres function) is reached ONLY through
 * `constitutionalRuntime.execute('ctp.wallet.asset.convert', ...)`.
 *
 * Authorization repair (2026-09-01, preserved from the earlier urgent fix):
 * the wallet subject resolves EXCLUSIVELY from `getActivePersona` — a
 * body-supplied `personaId` is never read.
 *
 * Scope: USDC -> BASE_QC only (BCENT excluded — see the primitive's own
 * header for why).
 */
export async function POST(request: NextRequest) {
  try {
    const persona = await getActivePersona(request);
    if (!persona?.personaId) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required — no active persona resolved for this caller.' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const usdcAmount = Number((body as { usdcAmount?: unknown })?.usdcAmount);
    if (!Number.isFinite(usdcAmount) || usdcAmount <= 0) {
      return NextResponse.json({ ok: false, error: 'usdcAmount must be a positive number' }, { status: 400 });
    }

    // Slice C scope (2026-09-01, operator instruction): BASE_QC only. BCENT
    // remains simulated/off-chain (services/wallet/qctLedgerService.ts) and
    // is explicitly NOT included in the first constitutional primitive —
    // refuse rather than silently substituting BASE_QC for a caller who
    // asked for BCENT.
    const requestedDestination = (body as { destination?: unknown })?.destination;
    if (requestedDestination && requestedDestination !== 'BASE_QC') {
      return NextResponse.json(
        { ok: false, error: `Conversion to '${requestedDestination}' is not yet available through the constitutional runtime — only BASE_QC is supported in this slice.` },
        { status: 400 },
      );
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Platform database is unavailable.' }, { status: 500 });
    }

    const outcome = await constitutionalRuntime.execute(
      admin,
      'ctp.wallet.asset.convert',
      {
        channel: 'web',
        channelSessionRef: null,
        callerPersonaId: persona.personaId,
        callerAuthProfileId: persona.authProfileId ?? null,
      },
      { usdcAmount },
    );

    if (!outcome.ok) {
      return NextResponse.json(
        { ok: false, error: outcome.refusal.reason, refusalCode: outcome.refusal.reasonCode },
        { status: 400 },
      );
    }

    const result = outcome.result as WalletAssetConvertResult;
    return NextResponse.json({
      ok: true,
      conversionId: result.conversionId,
      destination: 'BASE_QC',
      debited: {
        asset: 'USDC',
        amount: result.debitedUsdc,
        txId: result.debitTxId,
        newBalance: result.resultingUsdcBalance,
      },
      credited: {
        asset: 'BASE_QC',
        amount: result.creditedBaseQc,
        txId: result.creditTxId,
        newBalance: result.resultingBaseQcBalance,
      },
      quote: {
        rate: result.rate,
        feePercent: result.feePercent,
        destination: 'BASE_QC',
        qctGross: result.debitedUsdc * result.rate,
        feeQct: result.feeQct,
        qctNet: result.creditedBaseQc,
      },
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[USDC→QCT] conversion error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
