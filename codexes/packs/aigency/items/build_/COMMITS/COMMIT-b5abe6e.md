# Commit Brief: `b5abe6e` — Split Ratify P&L into three independent tiers, uniform journey spacing

| Field | Value |
|-------|-------|
| SHA | [`b5abe6e`](https://github.com/iQube-Protocol/AigentZBeta/commit/b5abe6ed98cbb356ec81a3828dbbe4fc11eed03d) |
| Author | Claude |
| Date | 2026-08-09T05:41:11Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Split Ratify P&L into three independent tiers, uniform journey spacing

PulseTransparencyToggle now renders P&L disclosure/service/evidence as
three always-visible rows instead of one row that switched text — the
prior copy could read as "P&L was approved by Horizen" when only
disclosure/permission scope had been granted. Disclosure (operator
grant), service (Horizen onboarding registration), and evidence
(independently verified pnl_service_verified) are sourced independently
and never inferred from one another. PilotJourneyTab threads the
observer's own verify-stage pnlServiceVerified evidence through rather
than re-deriving it client-side.

JourneyRunSurface: the Operate->fork junction connector was a fixed
16px segment while every other spine connector was flex-1 (stretching
to fill leftover strip width on wide viewports), so the two connector
kinds diverged visually. All inter-stage connectors now use the same
fixed 16px width.

Updated the two Pulse test suites' pinned source-scan assertions to
match the new three-tier copy and multi-line prop destructuring.
```

## Body

PulseTransparencyToggle now renders P&L disclosure/service/evidence as
three always-visible rows instead of one row that switched text — the
prior copy could read as "P&L was approved by Horizen" when only
disclosure/permission scope had been granted. Disclosure (operator
grant), service (Horizen onboarding registration), and evidence
(independently verified pnl_service_verified) are sourced independently
and never inferred from one another. PilotJourneyTab threads the
observer's own verify-stage pnlServiceVerified evidence through rather
than re-deriving it client-side.

JourneyRunSurface: the Operate->fork junction connector was a fixed
16px segment while every other spine connector was flex-1 (stretching
to fill leftover strip width on wide viewports), so the two connector
kinds diverged visually. All inter-stage connectors now use the same
fixed 16px width.

Updated the two Pulse test suites' pinned source-scan assertions to
match the new three-tier copy and multi-line prop destructuring.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/PilotJourneyTab.tsx` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `components/journey/PulseTransparencyToggle.tsx` |
| Modified | `tests/pulse-close-now-structured-projection.test.ts` |
| Modified | `tests/pulse-plnl-split-and-correlation-trace.test.ts` |

## Stats

 5 files changed, 122 insertions(+), 37 deletions(-)
