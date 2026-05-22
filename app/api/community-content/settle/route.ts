/**
 * POST /api/community-content/settle
 *
 * Body: { intentId: string, txHash: string }
 *
 * Verifies a Mainnet QCT transfer (Base Sepolia by default) against a
 * pending payment intent that was issued by /generate's 402 response,
 * then credits the user's DVN Q¢ balance by the intent amount so a
 * follow-up /generate call can debit DVN normally.
 *
 * Ledger model: DVN Q¢ (ICP-anchored) and Mainnet Q¢ (EVM ERC20) are
 * two on-chain ledgers that should remain in 1:1 parity. This endpoint
 * is one half of the bridge: Mainnet → DVN (verify Mainnet receipt,
 * credit DVN). The DVN → Mainnet half is deferred minting handled by
 * a separate batch reconciliation job (see agentiq/updates backlog).
 *
 * Reuses the existing `/api/a2a/facilitator/verify` pipe for receipt
 * verification — no new RPC plumbing. The facilitator decodes the
 * ERC20 Transfer log and confirms { tokenAddress, payTo, amount }
 * match the intent's expected values, so the client cannot tamper
 * with the settlement amount.
 *
 * Identity: getActivePersona(req) must resolve to the same personaId
 * that opened the intent — prevents one persona from settling another
 * persona's pending intent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCommunityContentSupabase } from '../_lib/personaContext';
import { creditQc } from '../_lib/generate';
import {
  loadQcPaymentIntent,
  markQcPaymentIntentSettled,
  qcEnvVars,
} from '../_lib/qcPaymentIntent';
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
  // Identity check via the canonical spine.
  const activePersona = await getActivePersona(req);
  if (!activePersona) {
    return NextResponse.json({ ok: false, error: 'sign-in required' }, { status: 401 });
  }

  let body: { intentId?: string; txHash?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const intentId = typeof body.intentId === 'string' ? body.intentId.trim() : '';
  const txHash = typeof body.txHash === 'string' ? body.txHash.trim() : '';
  if (!intentId) return NextResponse.json({ ok: false, error: 'intentId required' }, { status: 400 });
  if (!txHash)   return NextResponse.json({ ok: false, error: 'txHash required' },   { status: 400 });

  const supabase = getCommunityContentSupabase();

  // Load the pending intent — refuses if already settled, never issued,
  // or owned by a different persona than the caller.
  const intent = await loadQcPaymentIntent(supabase, intentId);
  if (!intent) {
    return NextResponse.json(
      { ok: false, error: 'unknown or already-settled intent' },
      { status: 404 },
    );
  }
  if (intent.personaId !== activePersona.personaId) {
    return NextResponse.json({ ok: false, error: 'intent owner mismatch' }, { status: 403 });
  }

  const { chainId, tokenAddress, treasury } = qcEnvVars();
  const assetKey = assetKeyForChain(chainId);
  if (!assetKey) {
    return NextResponse.json(
      { ok: false, error: `unsupported chainId ${chainId} for Q¢ settlement` },
      { status: 500 },
    );
  }

  // Verify the on-chain transfer through the existing facilitator
  // pipe. The verify endpoint decodes the ERC20 Transfer log on the
  // configured RPC (NEXT_PUBLIC_RPC_BASE_SEPOLIA or fallback to
  // https://sepolia.base.org) and confirms { tokenAddress, payTo,
  // amount } match what we pass below.
  const amountBaseUnits = (BigInt(intent.amountQc) * 10n ** 18n).toString();
  const verifyOrigin = req.nextUrl.origin;
  const verifyRes = await fetch(`${verifyOrigin}/api/a2a/facilitator/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      assetKey,
      txHashOrId: txHash,
      chainId,
      tokenAddress,
      payTo: treasury,
      amount: amountBaseUnits,
    }),
    cache: 'no-store',
  });
  const verifyJson = (await verifyRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!verifyRes.ok || !verifyJson.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `tx verification failed: ${verifyJson.error ?? `status ${verifyRes.status}`}`,
      },
      { status: 402 },
    );
  }

  // Credit DVN with the verified amount, then mark the intent settled
  // so it can't be replayed. The user can now retry /generate and the
  // standard debitQc path will succeed.
  await creditQc(supabase, activePersona.personaId, intent.amountQc, intent.reason, intent.referenceId);
  await markQcPaymentIntentSettled(supabase, intentId, txHash);

  return NextResponse.json({
    ok: true,
    intentId,
    txHash,
    creditedQc: intent.amountQc,
  });
}
