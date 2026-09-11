# Commit Brief: `dafb68b` — Sell Research Copilot as its own dedicated tier/SKU, unbundled from aigentZ

| Field | Value |
|-------|-------|
| SHA | [`dafb68b`](https://github.com/iQube-Protocol/AigentZBeta/commit/dafb68b8bebd35262cf53debd5157f721a55a796) |
| Author | Claude |
| Date | 2026-07-16T04:38:27Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Sell Research Copilot as its own dedicated tier/SKU, unbundled from aigentZ

Operator correction: the Research Copilot is a SEPARATE unlock with a unique
SKU — not bundled into Sovereignty the way aigentZ's aigentzLiteAccess is.
Built as the dedicated research_copilot tier at $29/mo (same stage as
Sovereignty), sold on its own.

- migration: persona_plans.research_tier column ('none'/'active')
- personaPlan: own researchCopilotAccess flag from research_tier, NOT derived
  from sovereignAccess/aigentzLiteAccess
- planCheckout: research_copilot TIER_CONFIG entry + $29 price; tier-key-driven
  checkout sells it via Q¢/PayPal/USDC with no route change
- activationPlanGate: researcher gate -> researchCopilotAccess / requiredTier
  research_copilot (decoupled from aigentZ)
- billing/plan route: admin override grants researchCopilotAccess
- PlanUpgradeModal: single-tier research render branch, reusing all rail/
  checkout machinery; CitizenLadderModal row now reads "Add-on"
- activation-catalog: description names the dedicated $29 tier
- doc: corrected model + single-row-plan renewal limitation noted

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator correction: the Research Copilot is a SEPARATE unlock with a unique
SKU — not bundled into Sovereignty the way aigentZ's aigentzLiteAccess is.
Built as the dedicated research_copilot tier at $29/mo (same stage as
Sovereignty), sold on its own.

- migration: persona_plans.research_tier column ('none'/'active')
- personaPlan: own researchCopilotAccess flag from research_tier, NOT derived
  from sovereignAccess/aigentzLiteAccess
- planCheckout: research_copilot TIER_CONFIG entry + $29 price; tier-key-driven
  checkout sells it via Q¢/PayPal/USDC with no route change
- activationPlanGate: researcher gate -> researchCopilotAccess / requiredTier
  research_copilot (decoupled from aigentZ)
- billing/plan route: admin override grants researchCopilotAccess
- PlanUpgradeModal: single-tier research render branch, reusing all rail/
  checkout machinery; CitizenLadderModal row now reads "Add-on"
- activation-catalog: description names the dedicated $29 tier
- doc: corrected model + single-row-plan renewal limitation noted

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/billing/plan/route.ts` |
| Modified | `codexes/packs/agentiq/updates/2026-07-16_researcher-pathway-fo-subscription-integration.md` |
| Modified | `components/metame/billing/CitizenLadderModal.tsx` |
| Modified | `components/metame/billing/PlanUpgradeModal.tsx` |
| Modified | `data/activation-catalog.ts` |
| Modified | `services/activations/activationPlanGate.ts` |
| Modified | `services/billing/personaPlan.ts` |
| Modified | `services/billing/planCheckout.ts` |
| Added | `supabase/migrations/20260716010000_persona_plans_research_tier.sql` |

## Stats

 9 files changed, 213 insertions(+), 82 deletions(-)
