/**
 * POST /api/wallet/base-qc/credit-from-usdc
 *
 * USDC purchase → DVN Q¢ credit (Phase A of the 2026-05-22 DVN ⇄ Mainnet
 * parity backlog). The user transfers USDC to the configured treasury;
 * this endpoint verifies the receipt and credits the caller's DVN Q¢
 * balance at the canonical $1 = 100 Q¢ rate.
 *
 * Body: { txHash: string, amountUsdcMicroUnits: string, chainId?: number }
 *
 * Why micro-units (not float USD): the USDC contract uses 6 decimals.
 * Strings + bigint avoid floating-point drift on small amounts.
 *
 * Q¢ rate: 1 USDC = 100 Q¢. `qcAmount = floor(microUnits / 10_000)`
 * because 1 USDC = 1_000_000 microUnits, and 1_000_000 / 10_000 = 100.
 *
 * Required env per chain (USDC token + treasury are env-driven so dev
 * / mainnet / staging don't accidentally cross over):
 *   NEXT_PUBLIC_USDC_ADDRESS_BASE_SEPOLIA    0x036CbD53842c5426634e7929541eC2318f3dCF7e
 *   NEXT_PUBLIC_USDC_ADDRESS_BASE            0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 *   TREASURY_ADDRESS                         (shared with the QCT settle path)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { creditQc } from '@/app/api/community-content/_lib/generate';
import { getActivePersona } from '@/services/identity/getActivePersona';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const USDC_RATE_QC_PER_USDC = 100;            // $1 USDC → 100 Q¢
const USDC_DECIMALS = 6n;
const USDC_MICRO_PER_USD = 10n ** USDC_DECIMALS;

interface UsdcAssetConfig {
  assetKey: string;
  tokenAddress: string | null;
}

function usdcAssetForChain(chainId: number): UsdcAssetConfig | null {
  switch (chainId) {
    case 84532: // Base Sepolia
      return { assetKey: 'BASE_USDC',  tokenAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS_BASE_SEPOLIA || null };
    case 8453:  // Base mainnet
      return { assetKey: 'BASE_USDC',  tokenAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS_BASE         || null };
    case 11155111: // Ethereum Sepolia
      return { assetKey: 'ETH_USDC',   tokenAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS_ETH_SEPOLIA  || null };
    case 421614: // Arbitrum Sepolia
      return { assetKey: 'ARB_USDC',   tokenAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS_ARB_SEPOLIA  || null };
    case 11155420: // Optimism Sepolia
      return { assetKey: 'OP_USDC',    tokenAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS_OP_SEPOLIA   || null };
    case 80002: // Polygon Amoy
      return { assetKey: 'POLY_USDC',  tokenAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS_POLYGON_AMOY || null };
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  const activePersona = await getActivePersona(req);
  if (!activePersona) {
    return NextResponse.json({ ok: false, error: 'sign-in required' }, { status: 401 });
  }

  let body: { txHash?: string; amountUsdcMicroUnits?: string; chainId?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const txHash = typeof body.txHash === 'string' ? body.txHash.trim() : '';
  const microUnitsStr = typeof body.amountUsdcMicroUnits === 'string'
    ? body.amountUsdcMicroUnits.trim()
    : '';
  if (!txHash)          return NextResponse.json({ ok: false, error: 'txHash required' }, { status: 400 });
  if (!microUnitsStr)   return NextResponse.json({ ok: false, error: 'amountUsdcMicroUnits required' }, { status: 400 });

  let microUnits: bigint;
  try {
    microUnits = BigInt(microUnitsStr);
  } catch {
    return NextResponse.json({ ok: false, error: 'amountUsdcMicroUnits must be a base-10 integer string' }, { status: 400 });
  }
  if (microUnits <= 0n) {
    return NextResponse.json({ ok: false, error: 'amountUsdcMicroUnits must be > 0' }, { status: 400 });
  }

  const chainId = typeof body.chainId === 'number' && Number.isFinite(body.chainId)
    ? body.chainId
    : Number(process.env.NEXT_PUBLIC_QC_CHAIN_ID || 84532);

  const usdcConfig = usdcAssetForChain(chainId);
  if (!usdcConfig) {
    return NextResponse.json(
      { ok: false, error: `unsupported chainId ${chainId} for USDC settlement` },
      { status: 400 },
    );
  }
  if (!usdcConfig.tokenAddress) {
    return NextResponse.json(
      { ok: false, error: `USDC token address not configured for chainId ${chainId}` },
      { status: 500 },
    );
  }

  const treasury = process.env.TREASURY_ADDRESS;
  if (!treasury) {
    return NextResponse.json({ ok: false, error: 'TREASURY_ADDRESS not configured' }, { status: 500 });
  }

  // Compute Q¢ to credit. Floor-divide micro-units by 10_000 = 100 Q¢
  // per USDC (canonical $1 = 100 Q¢). Sub-cent USDC fractions are
  // discarded — the treasury keeps the dust as float.
  const qcAmount = Number((microUnits * BigInt(USDC_RATE_QC_PER_USDC)) / USDC_MICRO_PER_USD);
  if (qcAmount <= 0) {
    return NextResponse.json({ ok: false, error: 'amount too small (< 0.01 USDC)' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Supabase unavailable' }, { status: 500 });
  }

  // Idempotency — same on-chain tx can't credit twice.
  const swapTxId = `usdc-credit::${txHash}`;
  const { data: existing } = await supabase
    .from('qc_transactions')
    .select('id')
    .eq('tx_id', swapTxId)
    .limit(1);
  if (Array.isArray(existing) && existing.length > 0) {
    return NextResponse.json({ ok: false, error: 'txHash already credited' }, { status: 409 });
  }

  // Verify USDC transfer to treasury via the generic ERC20 path in
  // /api/a2a/facilitator/verify. The verifier matches the Transfer
  // log by tokenAddress + payTo + amount so the client can't
  // misrepresent the credit size.
  const verifyRes = await fetch(`${req.nextUrl.origin}/api/a2a/facilitator/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      assetKey: usdcConfig.assetKey,
      txHashOrId: txHash,
      chainId,
      tokenAddress: usdcConfig.tokenAddress,
      payTo: treasury,
      amount: microUnits.toString(),
    }),
    cache: 'no-store',
  });
  const verifyJson = (await verifyRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!verifyRes.ok || !verifyJson.ok) {
    return NextResponse.json(
      { ok: false, error: `USDC tx verification failed: ${verifyJson.error ?? `status ${verifyRes.status}`}` },
      { status: 402 },
    );
  }

  await creditQc(
    supabase,
    activePersona.personaId,
    qcAmount,
    'usdc_purchase_to_dvn',
    swapTxId,
  );

  return NextResponse.json({
    ok: true,
    txHash,
    creditedQc: qcAmount,
    chainId,
    rate: { qcPerUsdc: USDC_RATE_QC_PER_USDC },
  });
}
