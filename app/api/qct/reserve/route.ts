/**
 * GET /api/qct/reserve
 *
 * Returns live Base mainnet QCT reserve stats and the contract params the
 * frontend needs to let a user purchase Q¢ with USDC directly on-chain.
 */

import { NextResponse } from 'next/server';
import { getQctReserveInfo, getQctPurchaseContractParams } from '@/services/wallet/qctCanonicalService';

export async function GET() {
  const [reserveInfo, contractParams] = await Promise.all([
    getQctReserveInfo(),
    Promise.resolve(getQctPurchaseContractParams()),
  ]);

  if (!contractParams) {
    return NextResponse.json(
      { ok: false, error: 'QCT reserve not deployed on Base mainnet yet. Set NEXT_PUBLIC_QCT_BASE_MAINNET and NEXT_PUBLIC_QCT_RESERVE_BASE_MAINNET.' },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    // Live stats (null if canister/rpc error — UI should gracefully degrade)
    stats: reserveInfo,
    // Static params for frontend wagmi/viem contract calls
    purchase: {
      chainId: contractParams.chainId,
      reserveAddress: contractParams.reserveAddress,
      qctAddress: contractParams.qctAddress,
      usdcAddress: contractParams.usdcAddress,
      mintRatio: contractParams.mintRatio,
      mintFeeBps: contractParams.mintFeeBps,
    },
  });
}
