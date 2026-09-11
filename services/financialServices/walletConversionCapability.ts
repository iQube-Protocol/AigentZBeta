/**
 * walletConversionCapability — the ONE capability id the FS journey's
 * `fs-cross` stage projects and carries (AEE-Next, 2026-09-01).
 *
 * Governing rule (operator directive, 2026-09-01): "the governing
 * requirement is capability READINESS, not capability EXERCISE." Crossing
 * makes the real wallet-conversion capability discoverable/projectable —
 * it never performs a conversion, and it never implies one happened.
 *
 * MUST equal `services/ctp/primitives/walletAssetConvert.ts`'s exported
 * `PRIMITIVE_ID` verbatim — duplicated here rather than imported, because
 * that module pulls in `crypto` and other server-only dependencies that are
 * unsafe to reach from this constant's 'use client' callers
 * (FinancialSovereigntyPrepareCrossStage.tsx,
 * FinancialServicesBridgeFrontDoor.tsx) — the exact defect class
 * `experienceHandoffService.ts`'s own header documents (Buffer.from in a
 * client bundle). Parity between the two literals is enforced by
 * `tests/fs-cross-wallet-conversion-capability.test.ts`, never by import.
 */
export const WALLET_CONVERSION_CAPABILITY_ID = 'ctp.wallet.asset.convert';
