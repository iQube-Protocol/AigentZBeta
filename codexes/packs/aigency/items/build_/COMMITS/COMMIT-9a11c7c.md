# Commit Brief: `9a11c7c` — Give Factor real Bankr capability actions (Phase 5 of Factor+Aegis Bankr PRD)

| Field | Value |
|-------|-------|
| SHA | [`9a11c7c`](https://github.com/iQube-Protocol/AigentZBeta/commit/9a11c7c2c4d5552804fd671373f3097c43913f12) |
| Author | Claude |
| Date | 2026-09-05T20:15:58Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Give Factor real Bankr capability actions (Phase 5 of Factor+Aegis Bankr PRD)

Model bankr_tokenization as 10 distinct actions (explain, assess issuer
readiness, inspect/provision provider-wallet binding, prepare launch
proposal, deterministic preflight, request Aegis assessment, request
MoneyPenny approval, submit approved launch, inspect deployment status,
inspect fee claims) instead of flipping the whole capability live at
once. services/factor/bankrCapabilityHandlers.ts wraps the existing
Phase 2-4 services (Bankr adapter, provider-wallet binding, token-launch
state machine, Aegis assessment) with no new mechanism; every handler is
registered individually in factorActionHandlerRegistry.ts so submission
stays gated behind requiresApproval while explain/assess/prepare become
real and reachable. Capability status moves planned -> partial
(PREPARABLE), submit stays execute+requiresApproval+external.

Also fixes a real Phase 2 defect surfaced by testing the submit-then-
inspect flow: createBankrProviderAdapter() built a brand-new
BankrFakeTransport per call, so a job created by submitApprovedLaunch was
invisible to a later inspectDeploymentStatus call in the same process —
the fake transport is now memoized for the process lifetime (unconfigured
deployments only; live transport is unaffected), matching how a real
Bankr deployment's job state actually persists server-side.

18 new/updated tests (73 in the 3 manifest/registry files, 15 new in
bankr-capability-handlers.test.ts); full suite run shows the pre-existing
64-failure/18-file baseline unchanged (all in unrelated subsystems —
journey, pulse, resolution-records, register-ceremony, repo-weight);
tsc --noEmit holds at the pre-existing 679-error baseline with zero new
errors in any Phase 5 file.

No token launch is authorized by this commit — submission still requires
human/MoneyPenny approval and this deployment has no live Bankr
credentials (fake transport throughout).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BNNSnY6Ar3mEQjQuyz1c5J
```

## Body

Model bankr_tokenization as 10 distinct actions (explain, assess issuer
readiness, inspect/provision provider-wallet binding, prepare launch
proposal, deterministic preflight, request Aegis assessment, request
MoneyPenny approval, submit approved launch, inspect deployment status,
inspect fee claims) instead of flipping the whole capability live at
once. services/factor/bankrCapabilityHandlers.ts wraps the existing
Phase 2-4 services (Bankr adapter, provider-wallet binding, token-launch
state machine, Aegis assessment) with no new mechanism; every handler is
registered individually in factorActionHandlerRegistry.ts so submission
stays gated behind requiresApproval while explain/assess/prepare become
real and reachable. Capability status moves planned -> partial
(PREPARABLE), submit stays execute+requiresApproval+external.

Also fixes a real Phase 2 defect surfaced by testing the submit-then-
inspect flow: createBankrProviderAdapter() built a brand-new
BankrFakeTransport per call, so a job created by submitApprovedLaunch was
invisible to a later inspectDeploymentStatus call in the same process —
the fake transport is now memoized for the process lifetime (unconfigured
deployments only; live transport is unaffected), matching how a real
Bankr deployment's job state actually persists server-side.

18 new/updated tests (73 in the 3 manifest/registry files, 15 new in
bankr-capability-handlers.test.ts); full suite run shows the pre-existing
64-failure/18-file baseline unchanged (all in unrelated subsystems —
journey, pulse, resolution-records, register-ceremony, repo-weight);
tsc --noEmit holds at the pre-existing 679-error baseline with zero new
errors in any Phase 5 file.

No token launch is authorized by this commit — submission still requires
human/MoneyPenny approval and this deployment has no live Bankr
credentials (fake transport throughout).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BNNSnY6Ar3mEQjQuyz1c5J

## Files Changed

| Change | File |
|--------|------|
| Added | `services/factor/bankrCapabilityHandlers.ts` |
| Modified | `services/factor/factorActionHandlerRegistry.ts` |
| Modified | `services/factor/factorCapabilityManifest.ts` |
| Modified | `services/financialServices/providers/bankr/bankrProviderAdapter.ts` |
| Added | `tests/bankr-capability-handlers.test.ts` |
| Modified | `tests/factor-action-handler-registry.test.ts` |
| Modified | `tests/factor-capability-manifest.test.ts` |
| Modified | `tests/factor-capability-runtime-contract.test.ts` |

## Stats

 8 files changed, 698 insertions(+), 27 deletions(-)
