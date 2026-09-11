# Commit Brief: `a0e8fe4` — Project wallet-conversion capability READINESS at fs-cross, never exercise [merge spec/moneypenny-mpy2-3]

| Field | Value |
|-------|-------|
| SHA | [`a0e8fe4`](https://github.com/iQube-Protocol/AigentZBeta/commit/a0e8fe4527a1c37f959349ec5f42a67646cf7475) |
| Author | Claude |
| Date | 2026-09-01T20:05:30Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Project wallet-conversion capability READINESS at fs-cross, never exercise [merge spec/moneypenny-mpy2-3]

Wires AEE's prescription for fs-cross, the ExperienceHandoff created at
Cross, and the FS Bridge front door's handoff-consuming effect to a single
shared capability id (WALLET_CONVERSION_CAPABILITY_ID, kept in lockstep
with the real registered CTP primitive walletAssetConvert.ts's PRIMITIVE_ID
via a parity test rather than a client-unsafe import). Uses the EXISTING
ExperienceHandoff.capabilityFocus field per the governing directive - no
new handoff field, no wrapper, no new persistence.

Establishes only that the capability is discoverable/projectable by AEE,
carried through the existing FS prescription/handoff architecture, and
correctly named after the live SmartWalletDrawer -> POST /api/wallet/qct/
convert/usdc-to-qc -> constitutionalRuntime.execute('ctp.wallet.asset.
convert', ...) chain. Crossing performs no conversion, writes no
ctp_transition_evidence, and never touches Standing - capability
availability and successful execution stay explicitly distinct, pinned by
13 new acceptance tests including a negative check that the wiring path
never references ctp_transition_evidence at all.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Wires AEE's prescription for fs-cross, the ExperienceHandoff created at
Cross, and the FS Bridge front door's handoff-consuming effect to a single
shared capability id (WALLET_CONVERSION_CAPABILITY_ID, kept in lockstep
with the real registered CTP primitive walletAssetConvert.ts's PRIMITIVE_ID
via a parity test rather than a client-unsafe import). Uses the EXISTING
ExperienceHandoff.capabilityFocus field per the governing directive - no
new handoff field, no wrapper, no new persistence.

Establishes only that the capability is discoverable/projectable by AEE,
carried through the existing FS prescription/handoff architecture, and
correctly named after the live SmartWalletDrawer -> POST /api/wallet/qct/
convert/usdc-to-qc -> constitutionalRuntime.execute('ctp.wallet.asset.
convert', ...) chain. Crossing performs no conversion, writes no
ctp_transition_evidence, and never touches Standing - capability
availability and successful execution stay explicitly distinct, pinned by
13 new acceptance tests including a negative check that the wiring path
never references ctp_transition_evidence at all.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `components/journey/FinancialServicesBridgeFrontDoor.tsx` |
| Modified | `components/journey/FinancialSovereigntyPrepareCrossStage.tsx` |
| Modified | `services/adaptive/experiencePrescriptionAssembly.ts` |
| Modified | `services/ctp/primitives/walletAssetConvert.ts` |
| Added | `services/financialServices/walletConversionCapability.ts` |
| Added | `tests/fs-cross-wallet-conversion-capability.test.ts` |

## Stats

 7 files changed, 190 insertions(+), 2 deletions(-)
