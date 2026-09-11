# Commit Brief: `3b9ae5a` — Give Factor's Bankr actions real HTTP routes; close Phase 8 drift/tenant gaps (Phase 6 backend)

| Field | Value |
|-------|-------|
| SHA | [`3b9ae5a`](https://github.com/iQube-Protocol/AigentZBeta/commit/3b9ae5a0703c956e066c9d83aeb8f828769ebd30) |
| Author | Claude |
| Date | 2026-09-05T20:54:52Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Give Factor's Bankr actions real HTTP routes; close Phase 8 drift/tenant gaps (Phase 6 backend)

Factor + Aegis Bankr PRD, Phase 6: app/api/moneypenny/factor/bankr/{readiness,
launches,launches/[launchId],launches/[launchId]/action,launches/[launchId]/
approve} give SpecialistResponseCard's availableActions something real to
click through to, mirroring the existing cases/authority-chains route
conventions. The approve route is deliberately separate from action
dispatch (mirrors decide-admission's separation of authority) — Factor's
own action dispatch has no "approve" action.

While wiring the caller, found and closed two real Phase 5 gaps rather than
leaving them for an unwritten future caller:
- preflightLaunch/submitApprovedLaunch/inspectDeploymentStatus/
  inspectFeeClaims read token_launches with no tenant_id check at all
  (every other function in tokenLaunchService.ts already goes through a
  tenant-checked read). Exported that check as getTokenLaunch and switched
  all four over.
- Phase 8's "changed Bankr economics force reapproval" acceptance
  criterion (checkBankrTermsDrift) was never called by anything. Wired it
  into submitApprovedLaunch itself: re-quote, compare against the frozen
  hash, and on drift transition to revision_required and refuse to submit,
  rather than delegating enforcement to a caller that didn't exist yet.
  Also wired an optional authority-chain gate (bankr-token-launch-submit)
  following factorCaseService.ts's existing optional-chain pattern.

Also closed three of Phase 7's four dormant receipt action types (added in
Phase 4 but never emitted): bankr_provider_bound (on a genuinely new/
reactivated provider-wallet binding, never a routine idempotent refresh),
bankr_launch_preflighted, and aegis_token_assessment_ratified (additive to
the generic aegis_assessment_ratified, fired whenever a token_launch-
subject assessment is ratified regardless of caller). token_fees_claimed
stays unemitted — no fee-claim capability exists yet (Phase 0's own honest
limitation).

29 new/updated tests (bankr-api-routes.test.ts is new); 212 targeted tests
pass; tsc --noEmit baseline holds at exactly 679 errors, none in a touched
file.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EGP1sZh5ka4XcFutt5UAsc
```

## Body

Factor + Aegis Bankr PRD, Phase 6: app/api/moneypenny/factor/bankr/{readiness,
launches,launches/[launchId],launches/[launchId]/action,launches/[launchId]/
approve} give SpecialistResponseCard's availableActions something real to
click through to, mirroring the existing cases/authority-chains route
conventions. The approve route is deliberately separate from action
dispatch (mirrors decide-admission's separation of authority) — Factor's
own action dispatch has no "approve" action.

While wiring the caller, found and closed two real Phase 5 gaps rather than
leaving them for an unwritten future caller:
- preflightLaunch/submitApprovedLaunch/inspectDeploymentStatus/
  inspectFeeClaims read token_launches with no tenant_id check at all
  (every other function in tokenLaunchService.ts already goes through a
  tenant-checked read). Exported that check as getTokenLaunch and switched
  all four over.
- Phase 8's "changed Bankr economics force reapproval" acceptance
  criterion (checkBankrTermsDrift) was never called by anything. Wired it
  into submitApprovedLaunch itself: re-quote, compare against the frozen
  hash, and on drift transition to revision_required and refuse to submit,
  rather than delegating enforcement to a caller that didn't exist yet.
  Also wired an optional authority-chain gate (bankr-token-launch-submit)
  following factorCaseService.ts's existing optional-chain pattern.

Also closed three of Phase 7's four dormant receipt action types (added in
Phase 4 but never emitted): bankr_provider_bound (on a genuinely new/
reactivated provider-wallet binding, never a routine idempotent refresh),
bankr_launch_preflighted, and aegis_token_assessment_ratified (additive to
the generic aegis_assessment_ratified, fired whenever a token_launch-
subject assessment is ratified regardless of caller). token_fees_claimed
stays unemitted — no fee-claim capability exists yet (Phase 0's own honest
limitation).

29 new/updated tests (bankr-api-routes.test.ts is new); 212 targeted tests
pass; tsc --noEmit baseline holds at exactly 679 errors, none in a touched
file.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EGP1sZh5ka4XcFutt5UAsc

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/moneypenny/factor/_lib/respondError.ts` |
| Added | `app/api/moneypenny/factor/bankr/launches/[launchId]/action/route.ts` |
| Added | `app/api/moneypenny/factor/bankr/launches/[launchId]/approve/route.ts` |
| Added | `app/api/moneypenny/factor/bankr/launches/[launchId]/route.ts` |
| Added | `app/api/moneypenny/factor/bankr/launches/route.ts` |
| Added | `app/api/moneypenny/factor/bankr/readiness/route.ts` |
| Modified | `services/aegis/aegisAssessmentService.ts` |
| Modified | `services/factor/bankrCapabilityHandlers.ts` |
| Modified | `services/factor/factorCapabilityManifest.ts` |
| Modified | `services/factor/tokenLaunchService.ts` |
| Modified | `services/financialServices/providers/providerWalletBinding.ts` |
| Added | `tests/bankr-api-routes.test.ts` |
| Modified | `tests/bankr-capability-handlers.test.ts` |
| Modified | `tests/provider-wallet-binding.test.ts` |

## Stats

 14 files changed, 856 insertions(+), 28 deletions(-)
