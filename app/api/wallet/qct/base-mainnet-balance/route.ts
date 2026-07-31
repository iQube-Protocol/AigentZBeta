/**
 * Base Q¢ MAINNET Balance API
 * GET /api/wallet/qct/base-mainnet-balance?address=0x...
 *
 * Reads the LIVE on-chain QriptoCENT (QCT) balance from the deployed Base
 * mainnet ERC-20 contract (chain 8453, `0x46CD79B8f795169FC59D5f1DE1a444c3C39fE7CE` —
 * see deployments/qct-base-mainnet.json) via the existing canonical service.
 * This is distinct from `/api/wallet/base-qc/balance`, which reads the
 * off-chain deferred/DVN Q¢ custody ledger (`qc_balances` table), and from
 * `useBalances`' `qctBase`, which reads the Base SEPOLIA (testnet) contract.
 *
 * Not a spine endpoint — takes a plain EVM address, no persona resolution —
 * so a raw client fetch (not personaFetch) is the correct call pattern here,
 * matching the sibling `base-qc/balance` route.
 *
 * Returns `configured: false` (not an error) when NEXT_PUBLIC_QCT_BASE_MAINNET
 * is unset, so the UI can render a clear "pending" state instead of a silent
 * zero balance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQctMainnetBalance } from '@/services/wallet/qctCanonicalService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'a valid EVM address is required' }, { status: 400 });
    }

    const result = await getQctMainnetBalance(address);
    if (!result) {
      // Contract not configured (NEXT_PUBLIC_QCT_BASE_MAINNET unset) or RPC
      // read failed — not a hard error, the UI should show a pending state.
      return NextResponse.json({ ok: true, configured: false });
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      address: result.address,
      balance: result.balance,
      balanceFormatted: result.balanceFormatted,
      contractAddress: result.contractAddress,
    });
  } catch (error: any) {
    console.error('[Base Q¢ Mainnet] Error:', error);
    return NextResponse.json({ error: error?.message || 'internal error' }, { status: 500 });
  }
}
