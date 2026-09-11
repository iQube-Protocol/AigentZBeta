# Commit Brief: `4846fa6` — Wire real P&L verification into production, distinct from authorization

| Field | Value |
|-------|-------|
| SHA | [`4846fa6`](https://github.com/iQube-Protocol/AigentZBeta/commit/4846fa62ea04664d55f46e7aa68586ac337e8d69) |
| Author | Claude |
| Date | 2026-08-09T00:52:25Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Wire real P&L verification into production, distinct from authorization

discoverAndReceiptPnlServiceEvidence (services/horizen/pnlServiceVerification.ts)
was fully built, read-only, idempotent, and tested, but had zero production
callers — only a manual CLI script. horizen_pnl_transparency_enabled
(disclosure authorization) was the only P&L signal any route ever produced or
displayed; pnl_service_verified (independent service verification) existed
only as a receipt type and a test.

Added services/horizen/pnlVerificationBoundary.ts as the one production
caller, wired into the journey state route at the boundary where a subject
to correlate first becomes known (a confirmed registration's own
tokenId/registryAgentId) — never coupled to Pulse admission or the Ratify
gate, per the operator's own already-ratified rule
(RES-2026-08-08-PNL-INDEPENDENT-EVIDENCE-001). Exposes pnlServiceVerified as
a field distinct from pnlDisclosureAuthorized/pnlTransparencyEnabled in both
the verify evidence record and the ancillary block, with a detail string
naming why when verification is pending — so the pilot can no longer render
"enabled" and "verified" as the same fact.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

discoverAndReceiptPnlServiceEvidence (services/horizen/pnlServiceVerification.ts)
was fully built, read-only, idempotent, and tested, but had zero production
callers — only a manual CLI script. horizen_pnl_transparency_enabled
(disclosure authorization) was the only P&L signal any route ever produced or
displayed; pnl_service_verified (independent service verification) existed
only as a receipt type and a test.

Added services/horizen/pnlVerificationBoundary.ts as the one production
caller, wired into the journey state route at the boundary where a subject
to correlate first becomes known (a confirmed registration's own
tokenId/registryAgentId) — never coupled to Pulse admission or the Ratify
gate, per the operator's own already-ratified rule
(RES-2026-08-08-PNL-INDEPENDENT-EVIDENCE-001). Exposes pnlServiceVerified as
a field distinct from pnlDisclosureAuthorized/pnlTransparencyEnabled in both
the verify evidence record and the ancillary block, with a detail string
naming why when verification is pending — so the pilot can no longer render
"enabled" and "verified" as the same fact.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/journey/moneypenny-horizen/state/route.ts` |
| Added | `services/horizen/pnlVerificationBoundary.ts` |
| Modified | `services/journey/passportEligibility.ts` |
| Added | `tests/pnl-verification-boundary.test.ts` |

## Stats

 4 files changed, 221 insertions(+)
