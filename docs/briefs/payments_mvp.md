# Project Brief: Aigent-to-Aigent Payments MVP

- **Objective**: Demonstrate cross-chain Aigent-to-Aigent payments using $QCT as settlement with x402 payment protocol.
- **Agents**: Nakamoto, MoneyPenny, Kn0w1
- **Flow**: BTC Q¢ → Sepolia QCT → Arbitrum QCT → BTC Q¢
- **Constraints**: Use real deployed contracts/canisters/APIs from `.env.local`. No mocks unless explicitly noted for smoke tests.

## Components
- **/facilitator**: x402 facilitator APIs: `/pay-intent`, `/verify` (verifies real EVM & BTC testnet txs, issues proof blob)
- **/signer**: Programmatic send service for ERC-20 (QCT/USDC) and BTC Q¢
- **/faucet**: USDC airdrop + buy QCT from Treasury via real contracts
- **Wallet Drawer Hooks**: `useFacilitator`, `useBalances`, `useDVNEvents`, `x402PaidFetch`
- **Demo Script**: `scripts/demoLoop.ts` 4-hop scenario with x402 retry

## Environment Variables (real)
- `NEXT_PUBLIC_RPC_SEPOLIA`, `NEXT_PUBLIC_RPC_ARB_SEPOLIA`
- `NEXT_PUBLIC_QCT_SEPOLIA`, `NEXT_PUBLIC_QCT_ARB_SEPOLIA`, `NEXT_PUBLIC_KNYT_SEPOLIA`
- `NEXT_PUBLIC_BTC_BALANCE_API`
- `TREASURY_SEPOLIA`, `USDC_SEPOLIA`
- Optional: `NEXT_PUBLIC_FACILITATOR_URL`, `NEXT_PUBLIC_DVN_SSE_URL`

## Acceptance Criteria
- **Airdrop + Swap**: Faucet funds USDC and buys QCT; balances visible
- **Cross-Chain Payments**: Three hops executed and verified
- **x402 Flow**: 402 response with accepts; retry with facilitator proof → 200OK
- **DVN Proof-of-State**: PaymentConfirmed events visible in Wallet Drawer stream
- **Agent UX**: Conversational commands initiate payments; drawer updates live

## Deliverables
- Real infra only (no mocks): facilitator, signer, faucet services
- Hooks + Drawer UI integrated in `AigentZBeta/`
- `scripts/demoLoop.ts` demonstrating full loop
- Documentation and runbook in this file
