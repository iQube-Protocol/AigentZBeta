/**
 * POST /api/wallet/base-qc/swap-in
 *
 * Generalised Mainnet QCT → DVN Q¢ swap. The user signs a QCT
 * `transfer(treasury, amount)` from their EVM wallet; this endpoint
 * verifies the receipt and credits the caller's DVN Q¢ balance.
 *
 * Body: { txHash: string, amountQc: number, chainId?: number }
 *
 * Generalised from /api/community-content/settle so any surface — not
 * just remix — can pre-fund DVN. The remix endpoint still keeps its
 * intent-bound path for atomic per-tx settlement; swap-in is the
 * standalone "fund my DVN balance" entry point referenced in the
 * 2026-05-22 DVN ⇄ Mainnet parity backlog.
 *
 * Identity: getActivePersona(req) is the spine — the credited DVN
 * balance is always the caller's. The on-chain sender is the user's
 * EVM wallet; we don't need to bind it because the only thing being
 * verified is that the configured treasury received QCT.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { creditQc } from '@/app/api/community-content/_lib/generate';
import { qcEnvVars } from '@/app/api/community-content/_lib/qcPaymentIntent';
import { getActivePersona } from '@/services/identity/getActivePersona';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function assetKeyForChain(chainId: number): string | null {
  switch (chainId) {
    case 84532: return 'BASE_QCENT';
    case 421614: return 'ARB_QCENT';
    case 11155111: return 'ETH_QCENT';
    case 11155420: return 'OP_QCENT';
    case 80002: return 'POLY_QCENT';
    default: return null;
  }
}

export async function POST(req: NextRequest) {
  const activePersona = await getActivePersona(req);
  if (!activePersona) {
    return NextResponse.json({ ok: false, error: 'sign-in required' }, { status: 401 });
  }

  let body: { txHash?: string; amountQc?: number; chainId?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const txHash = typeof body.txHash === 'string' ? body.txHash.trim() : '';
  const amountQc = typeof body.amountQc === 'number' && Number.isFinite(body.amountQc)
    ? Math.floor(body.amountQc)
    : 0;
  if (!txHash)         return NextResponse.json({ ok: false, error: 'txHash required' },   { status: 400 });
  if (amountQc <= 0)   return NextResponse.json({ ok: false, error: 'amountQc must be > 0' }, { status: 400 });

  const env = qcEnvVars();
  const chainId = typeof body.chainId === 'number' && Number.isFinite(body.chainId)
    ? body.chainId
    : env.chainId;
  const assetKey = assetKeyForChain(chainId);
  if (!assetKey) {
    return NextResponse.json(
      { ok: false, error: `unsupported chainId ${chainId} for Q¢ settlement` },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Supabase unavailable' }, { status: 500 });
  }

  // Idempotency: refuse to credit the same on-chain tx twice. The
  // qc_transactions tx_id column already carries on-chain hashes for
  // custodial settlements (`settleId::txHash`); we use a parallel
  // `swap-in::<txHash>` namespace so the unique check is durable.
  const swapTxId = `swap-in::${txHash}`;
  const { data: existing } = await supabase
    .from('qc_transactions')
    .select('id')
    .eq('tx_id', swapTxId)
    .limit(1);
  if (Array.isArray(existing) && existing.length > 0) {
    return NextResponse.json(
      { ok: false, error: 'txHash already credited' },
      { status: 409 },
    );
  }

  const amountBaseUnits = (BigInt(amountQc) * 10n ** 18n).toString();
  const verifyRes = await fetch(`${req.nextUrl.origin}/api/a2a/facilitator/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      assetKey,
      txHashOrId: txHash,
      chainId,
      tokenAddress: env.tokenAddress,
      payTo: env.treasury,
      amount: amountBaseUnits,
    }),
    cache: 'no-store',
  });
  const verifyJson = (await verifyRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!verifyRes.ok || !verifyJson.ok) {
    return NextResponse.json(
      { ok: false, error: `tx verification failed: ${verifyJson.error ?? `status ${verifyRes.status}`}` },
      { status: 402 },
    );
  }

  await creditQc(supabase, activePersona.personaId, amountQc, 'wallet_swap_in_mainnet_to_dvn', swapTxId);

  return NextResponse.json({
    ok: true,
    txHash,
    creditedQc: amountQc,
    chainId,
  });
}
