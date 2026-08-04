# Delegation Security Architecture Requirements (2026-08-04)

## Fundamental Principle

**Trust describes the agent. Authority constrains the grantor. Delegation may not exceed either.**

Trust and authority are independent dimensions:
- **Agent trust** = what the agent has **earned** through validation (immutable, unless explicitly ratified higher)
- **Sponsor authority** = what the sponsor **may grant** (depends on sponsor's own trust + relationship policy)
- **Effective delegation** = the minimum of ALL constraints

---

## The Security Gate (Mandatory)

Effective delegation band MUST be computed as:

```typescript
const effectiveBand = min(
  agent.validatedTrustBand,           // What agent earned
  sponsor.grantAuthorityCeiling,      // What sponsor can give
  requestedDelegationBand,             // What was asked for
  policyClassCeiling                  // System policy bound
);
```

**This is non-negotiable.** Simplified formulas like `max(personaReputationCap, agentOwnTrustBand)` violate the constraint model because they:
- Conflate independent dimensions
- Allow sponsor reputation to elevate agent authority beyond the agent's validated trust
- Create inconsistent authorization across grant chains

---

## UI Requirement: Separate Labels

The Bounded Delegation Tab and all delegation UX MUST display three separate values:

### Current (WRONG - conflates concepts)
```
Agent trusted as: L4 Production Approved
Maximum delegation: L1 Experimental
```

### Required (CORRECT - separates concerns)
```
Agent validated trust:           L4 Production Approved
Your current grant-authority:    L1 Experimental
Maximum effective delegation:    L1 Experimental (constrained by your authority)
```

This makes explicit:
1. What the agent has earned (validated trust)
2. What the sponsor can give (their own ceiling)
3. What results when the two are combined (effective band, always the minimum)

---

## Implementation Checklist

### BoundedDelegationTab.tsx

- [ ] Replace the header line displaying "Agent trusted as" + "Maximum delegation"
- [ ] Expand to three lines:
  - `Agent validated trust: L4_PRODUCTION_APPROVED`
  - `Your current grant-authority: L1_EXPERIMENTAL`
  - `Maximum effective delegation: min(agent, sponsor, requested, policy)`
- [ ] Add tooltip on grant-authority explaining where it comes from (sponsor persona reputation, relationship policies, etc.)
- [ ] Ensure the delegation band selector is bounded by effective maximum, not by agent trust alone
- [ ] Never label sponsor ceiling as "Agent's Trust Band"

### Delegation Form Validation

When user attempts to delegate at band X:
```typescript
if (X > effectiveBand) {
  return 'You cannot grant that band. Your authority is limited to ' + effectiveBand;
}
```

### Code Pattern (Generic)

```typescript
// WRONG
const maxDelegable = Math.max(personaReputationCap, agentOwnTrustBand);

// CORRECT
const maxDelegable = Math.min(
  agent.validatedTrustBand,
  sponsor.grantAuthorityCeiling,
  requestedBand,
  POLICY_CEILING[requestScope]
);
```

---

## Data Source Requirements

All three constraint values must come from persisted, authoritative sources:

| Constraint | Source Table | Lookup | Notes |
|-----------|-------------|--------|-------|
| `agent.validatedTrustBand` | `registry_assets` or `aigent_qubes` | `WHERE slug = ? AND status = 'published'` | One-time, immutable per ratification |
| `sponsor.grantAuthorityCeiling` | `delegated_authority_grants` or `persona_capabilities` | `WHERE grantor_persona_id = ? AND recipient_slug = ?` | May be time-bound, refreshed per session |
| `requestedDelegationBand` | Input parameter | User selects from dropdown | Validated against effective maximum |
| `POLICY_CEILING` | Config | `POLICY_CEILING[policyClass]` | System-wide, e.g. L3 cap for human_approval_required |

**All MUST be read fresh on each delegation request.** Do NOT cache or infer.

---

## Asset State Contradiction — Investigation Required

Current issue: Nakamoto appears in two states depending on viewing surface.

**Before implementing ANY delegation changes, resolve:**

1. **Verify canonical asset record identity:**
   - Is the same `asset_id` used by all surfaces?
   - Run diagnostic query in `/tmp/diagnose-asset-state.sql` to compare:
     - `registry_assets.trust_band`
     - Latest `registry_trust_scores.trust_band`
     - Latest `registry_validations.trust_band_cap`
     - `publication_status` in each

2. **Ensure single source of truth:**
   - All surfaces MUST read from `registry_assets` for the canonical trust_band
   - Trust scoring surfaces read `registry_trust_scores` only for SCORING CONTEXT, not as the canonical band
   - Invocation gate reads `publication_status` ONLY from `registry_assets`

3. **No surface may display stale or inferred values:**
   - Modal header shows `asset.trustBand` (from `GET /api/registry/assets/[id]`)
   - Must match invocation gate's read of the same record
   - If they differ, it is a data integrity bug, not a UI choice

---

## Testing Scenario (Post-Fix)

**Setup:**
- Agent Nakamoto: registry_assets.trust_band = L4_PRODUCTION_APPROVED
- Sponsor ArkAgent: grantAuthorityCeiling = L1_EXPERIMENTAL
- Requested: L4

**Expected behavior:**
```
GET /api/journey/[...]/state → delegation panel
  Shows:
    Agent validated trust:           L4 PRODUCTION APPROVED
    Your current grant-authority:    L1 EXPERIMENTAL
    Maximum effective delegation:    L1 EXPERIMENTAL

  Dropdown offers: [L1, L2, L3, L4] but button disabled if user selects > L1
  Submit at L1: ✓ succeeds
  Submit at L4: ✗ error "Your authority limited to L1"
```

---

## Ratification

This architecture is **non-negotiable** and applies to:
- All delegation grant flows (bounded, unbounded, system)
- All surfaces that display or compute delegable bands
- All test scenarios involving multi-tier sponsorship
- Cross-cartridge delegation (if implemented)

The key principle is **constitutional**: Delegation authority must be the intersection of all constraints, never the union or one dimension elevated above another.

Do not implement simplified logic. Do not conflate agent trust with sponsor authority. Do not skip the UI separation.
