# Commit Brief: `7538ba5` — ops page: anchor calibration repositioned + Base mainnet card added

| Field | Value |
|-------|-------|
| SHA | [`7538ba5`](https://github.com/iQube-Protocol/AigentZBeta/commit/7538ba53f3cd63ecb70246eccb1267e92b4fdd31) |
| Author | Claude |
| Date | 2026-06-01T12:41:57Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
ops page: anchor calibration repositioned + Base mainnet card added

Per operator feedback on the new card layout:

1. Anchor Calibration card moved from between Canister Sync Status
   and ICP DVN to its preferred slot — after A2A DVN Integration and
   before the network-state cards. Groups it with the ICP-side
   integration concerns rather than chain monitoring.

2. New Base Mainnet card added next to the existing Base Sepolia
   testnet card. Required now that iQube + Q¢ contracts are live on
   Base mainnet — surfaces production block height, latest tx, and
   live contract addresses (QCT + QCT Reserve) read from env. The
   Sepolia card is retained for ongoing testnet rail testing.

New surface:
- GET /api/ops/base/mainnet — chain status + contract addrs (env-read,
  no chain interaction for the contracts; addresses surface only if
  NEXT_PUBLIC_QCT_BASE_MAINNET / NEXT_PUBLIC_QCT_RESERVE_BASE_MAINNET
  are configured)
- hooks/ops/useBaseMainnet — mirrors useBaseSepolia ergonomics
- Mainnet badge styling (emerald — production) vs Sepolia (cyan —
  testnet) to make the rail unambiguous at a glance
```

## Body

Per operator feedback on the new card layout:

1. Anchor Calibration card moved from between Canister Sync Status
   and ICP DVN to its preferred slot — after A2A DVN Integration and
   before the network-state cards. Groups it with the ICP-side
   integration concerns rather than chain monitoring.

2. New Base Mainnet card added next to the existing Base Sepolia
   testnet card. Required now that iQube + Q¢ contracts are live on
   Base mainnet — surfaces production block height, latest tx, and
   live contract addresses (QCT + QCT Reserve) read from env. The
   Sepolia card is retained for ongoing testnet rail testing.

New surface:
- GET /api/ops/base/mainnet — chain status + contract addrs (env-read,
  no chain interaction for the contracts; addresses surface only if
  NEXT_PUBLIC_QCT_BASE_MAINNET / NEXT_PUBLIC_QCT_RESERVE_BASE_MAINNET
  are configured)
- hooks/ops/useBaseMainnet — mirrors useBaseSepolia ergonomics
- Mainnet badge styling (emerald — production) vs Sepolia (cyan —
  testnet) to make the rail unambiguous at a glance

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/ops/page.tsx` |
| Added | `app/api/ops/base/mainnet/route.ts` |
| Added | `hooks/ops/useBaseMainnet.ts` |

## Stats

 3 files changed, 251 insertions(+), 2 deletions(-)
