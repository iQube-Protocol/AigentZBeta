# Standing → Reputation Correlation — Open Backlog Item

**Date:** 2026-06-24  
**Status:** Backlog — definition required before implementation  
**Thread:** spec  

---

## The Open Question

Reputation is currently derived exclusively from task completion signals (tasks created, completed,
rated). Standing is a separate two-lane score (Consequence + Capability) that measures sovereign
contribution depth and venture/identity signal quality.

**The question:** How should standing contribute to reputation, and at what weight?

This has not been defined. Do not implement any correlation until the definition below is filled in
and approved by the operator.

---

## Current State (as of 2026-06-24)

| Signal | Source | Goes into |
|---|---|---|
| Tasks completed | `task_completions` | Reputation (score + DVN receipt) |
| Tasks rated | `task_ratings` | Reputation (score + DVN receipt) |
| Standing accrued | `crm_persona_reputation` standing columns | Standing display in wallet; RQH canister; DVN `standing_accrued` receipt |
| Standing score | `services/standing/standingScore.ts` | Wallet "Reputation & Standing" tab |

Standing and reputation are currently **parallel, non-intersecting** systems. Each generates its own
DVN receipts. The RQH canister holds both (tasks as `task` skill_category, standing as `standing`
skill_category) but there is no composite computation across them.

---

## Why This Needs Design First

Standing has a sovereign security property:
> *Financial accruals and voting rights accrue to the citizen, not the agent. Delegation to an
> agent is explicit and bounded. Autonomous rights transfer requires admin approval with clearly
> defined agent roles.*

Any standing→reputation correlation must respect this boundary. Specifically:
- Reputation scores that gate financial rewards or voting weight must not automatically inherit
  standing accrued via agent activity unless the citizen has explicitly delegated that credit.
- Consequence Standing (personal lane) is the most directly citizen-attributable; Capability
  Standing (VentureQube signals) reflects platform engagement and is more safely agent-delegable.

---

## Questions to Answer Before Implementation

1. **Weight:** What fraction of reputation should standing contribute? (e.g. reputation = 0.80 ×
   task_score + 0.20 × standing_score)

2. **Lane specificity:** Should all four standing lanes contribute equally, or should Consequence
   (personal, delegated, stewardship) contribute differently from Capability?

3. **Direction of travel:** Does standing *augment* reputation (additive), or does it *set a floor*
   (reputation cannot exceed standing × factor)?

4. **Gating:** Should a minimum standing threshold be required before standing contributes to
   reputation at all (prevents gaming via micro-accruals)?

5. **Refresh cadence:** When standing changes, should reputation recompute immediately, on the next
   brief engagement, or on a scheduled job?

6. **Citizen delegation model:** When standing credit comes from agent actions (Capability lane,
   delegated lane), must the citizen explicitly opt in to that credit flowing into their reputation
   score?

7. **DVN treatment:** Should the composite score produce a single `reputation_updated` receipt, or
   separate receipts per contributing lane?

---

## Proposed Correlation Shape (Sketch — Not Approved)

```
reputation_score = task_component + standing_component

task_component    = 0.80 × normalised_task_score          # existing
standing_component = 0.20 × (
    personal_lane  × 0.50   # highest citizen-attribution
  + delegated_lane × 0.25   # agent-delegated; citizen must opt in
  + stewardship    × 0.15   # community standing
  + capability     × 0.10   # platform engagement
) / 100
```

This is a sketch only. The weights must be reviewed against:
- The existing `computeReputationScore` logic in `services/reputation/`
- The RQH canister's evidence model
- The sovereign delegation constraint above

---

## Implementation Touchpoints (when ready)

- `services/reputation/` — wherever reputation score is computed
- `services/standing/standingScore.ts` — expose lane breakdown for consumption
- `app/api/wallet/tasks/route.ts` — already returns both; composite can be added here
- `services/crm/taskCanisterService.ts` — RQH evidence model may need a composite skill_category
- DVN pipeline — determine receipt taxonomy for composite score

---

## Acceptance Criteria (to be defined by operator)

- [ ] Operator defines and approves the correlation formula
- [ ] Sovereign delegation model for agent-sourced standing credit is specified
- [ ] Implementation reviewed against PSC-001 Capability Preservation Standard
- [ ] DVN receipt taxonomy for composite score is agreed
- [ ] No financial accrual or voting weight path uses the composite before approval
