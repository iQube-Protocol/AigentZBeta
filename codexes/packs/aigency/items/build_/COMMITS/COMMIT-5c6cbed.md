# Commit Brief: `5c6cbed` — Add Activate as a derived registry-activation stage between Passport and Delegate

| Field | Value |
|-------|-------|
| SHA | [`5c6cbed`](https://github.com/iQube-Protocol/AigentZBeta/commit/5c6cbed79772dcda914a40bdd6776cb13e57d6e2) |
| Author | Claude |
| Date | 2026-08-11T00:39:17Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add Activate as a derived registry-activation stage between Passport and Delegate

Constitutional State Model Correction (operator-ratified): registryActivated
is derived from iQubeRegistryPresent + sponsorBindingEstablished +
agentPassportIssued only, never from Delegate/Operate/capability_registered.
ensureAgentRegistryActivation() materializes agent_registry_activated exactly
once via the settled-fact mechanism, called from the Passport-completion
boundary in resolveAgentAdmissionState (never from a UI button, never
performed by the GET state route itself). Adds an explicit, operator-invoked
legacy-reconciliation route for agents whose predicates predate this
mechanism. No Standing is awarded on activation; contributionAccrued becomes
the canonical earnedStanding read. Journey spine is now Register -> Claim ->
Orient -> Passport -> Activate -> Delegate -> Operate, guided-ceremony order
only, not a constitutional dependency graph.
```

## Body

Constitutional State Model Correction (operator-ratified): registryActivated
is derived from iQubeRegistryPresent + sponsorBindingEstablished +
agentPassportIssued only, never from Delegate/Operate/capability_registered.
ensureAgentRegistryActivation() materializes agent_registry_activated exactly
once via the settled-fact mechanism, called from the Passport-completion
boundary in resolveAgentAdmissionState (never from a UI button, never
performed by the GET state route itself). Adds an explicit, operator-invoked
legacy-reconciliation route for agents whose predicates predate this
mechanism. No Standing is awarded on activation; contributionAccrued becomes
the canonical earnedStanding read. Journey spine is now Register -> Claim ->
Orient -> Passport -> Activate -> Delegate -> Operate, guided-ceremony order
only, not a constitutional dependency graph.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/assistant/receipts/route.ts` |
| Modified | `app/api/journey/moneypenny-horizen/state/route.ts` |
| Added | `app/api/ops/journey/reconcile-registry-activation/route.ts` |
| Modified | `services/dvn/activityReceiptDvnPipeline.ts` |
| Modified | `services/journey/agentAdmissionState.ts` |
| Added | `services/journey/agentRegistryActivation.ts` |
| Modified | `services/journey/agentStateAxes.ts` |
| Modified | `services/journey/horizenMoneyPennyJourney.ts` |
| Modified | `services/journey/settledFacts.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Modified | `tests/journey-admission-spine.test.ts` |
| Modified | `tests/journey-monotonic-admission.test.ts` |
| Modified | `tests/participation-standing-ingestion-tab.test.ts` |
| Added | `tests/registry-activation.test.ts` |

## Stats

 15 files changed, 849 insertions(+), 17 deletions(-)
