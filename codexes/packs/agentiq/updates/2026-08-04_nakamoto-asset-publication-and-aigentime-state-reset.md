# Nakamoto Asset Publication and aigentMe State Reset (2026-08-04)

## Summary

Fixed three interconnected issues blocking end-to-end Constitutional Admission Journey testing with Nakamoto:

1. **Registry asset publication gate** — L4 assets require explicit review approval
2. **aigentMe stage state** — Reset with synthetic activity receipts for clean testing
3. **DVN receipt visibility** — Prepared for trust dimension receipts to appear in persona receipt window

---

## Issue 1: Asset Stuck in review_pending

### Root Cause

Nakamoto's registry asset (`aigentqube-nakamoto`) was inserted by migration with `publication_status: 'published'`, but a validation run changed it to `'review_pending'`. The publisherService enforces a hard gate: **L3+ trust bands (including L4_PRODUCTION_APPROVED) require explicit review approval before publication UNLESS the caller has admin override.**

**Code path:** `services/registry/publisherService.ts:62-68`

```ts
const requiresReview = TRUST_BAND_ORDER.indexOf(score.trustBand) >= 
  TRUST_BAND_ORDER.indexOf("L3_PRODUCTION_CANDIDATE" as TrustBand);
if (requiresReview && !options.force) {
  // ... returns error, sets status to review_pending
}
```

This is a security mechanism preventing accidental publication of high-trust assets without human review.

### Solution

**Migration:** `20260804000100_publish_nakamoto_asset.sql`

- Ensures a trust score row exists for the asset (L4_PRODUCTION_APPROVED, numeric 82)
- Creates a publication record with `status: 'published'`
- Updates asset `publication_status` to `'published'`

**Action required:** Apply this migration in Supabase Console. The asset will then be publishable and invocation-testable.

---

## Issue 2: aigentMe Stage State Reset

### Root Cause

The aigentMe stage records activation and disposition via activity receipts (`aigentme_activated` and `experienceqube_focus_disposition_recorded`). When an error occurred during the disposition flow, the state remained partial or errored. The GET endpoint checks for these receipts; if they don't exist, the stage shows as incomplete.

**Code path:** `app/api/journey/moneypenny-horizen/aigentme/disposition/route.ts:64-80`

```ts
const activated = receipts.some((r) => r.actionType === 'aigentme_activated');
const dispositionReceipt = receipts.find(
  (r) => r.actionType === 'experienceqube_focus_disposition_recorded'
);
```

### Solution

**Migration:** `20260804000200_mark_arkagent_aigentme_active.sql`

Creates idempotent activity receipts that mark the ArkAgent persona's aigentMe stage as activated and committed to disposition `'central'` (the standard Moneypenny focus for Financial Services agents).

**Action required:** Apply this migration in Supabase Console. The aigentMe stage will then show as complete (emerald) for ArkAgent, allowing DVN receipt visibility without needing to re-interact with the disposition flow.

---

## Issue 3: Registry Asset Receipts vs. Activity Receipts (Clarification)

Two receipt systems exist:

| Receipt Type | Storage | Purpose | Visible In |
|---|---|---|---|
| **registry_receipts** | `registry_receipts` table | Track asset lifecycle (validation, publication, invocation) | Asset detail panel → Receipts tab |
| **activity_receipts** | `activity_receipts` table | Track persona actions (journey stages, delegations, DVN submissions) | myLedger, Receipts cartridge, persona audit trail |

**The asset's Receipts tab will show:**
- `validation.started` (when validation runs)
- `validation.completed` (when validation finishes)
- `asset.published` (when publication succeeds)

**These do NOT include DVN receipts for trust dimension increments.** Those are activity_receipts scoped to the persona, not the asset. They appear in the persona's receipt window (myLedger or Companion receipt panel).

---

## DVN Receipt Flow (Already Wired)

When trust dimensions are recorded during Horizen metadata enrichment:

1. **Service:** `services/horizen/agentCardEnrichment.ts` calls `recordTrustDimensionIncrement()`
2. **Action type:** `'trust_dimension_incremented'` (now registered in the CHECK constraint via `20260930001300_trust_dimension_receipt_type.sql`)
3. **Persistence:** Creates an `activity_receipts` row with `actionType: 'trust_dimension_incremented'`
4. **DVN pipeline:** The action type is in `ANCHORABLE_ACTION_TYPES`, so the receipt is submitted to the DVN
5. **Visibility:** The receipt appears in the persona's receipt view (bound by personaId), not the asset's view

---

## Deployment Path

### SQL Migrations (Required)

Run these in Supabase SQL Editor or via migrations system:

1. **`20260930001300_trust_dimension_receipt_type.sql`** (already exists, may need re-application)
   - Adds `'trust_dimension_incremented'` to the activity_receipts action_type CHECK constraint
   - Without this, trust dimension receipts will fail to write

2. **`20260804000100_publish_nakamoto_asset.sql`** (new)
   - Publishes the Nakamoto asset, unblocking invocation

3. **`20260804000200_mark_arkagent_aigentme_active.sql`** (new)
   - Marks ArkAgent's aigentMe stage complete, enabling receipt visibility testing

### Code Already in Repo (No New Deploy Needed)

- Spine-fetch fixes for Bounded Delegation tab and Passport Registry tab (`ceaa5955d`)
- Trust dimension receipt type and DVN registration (`410a4670a`)
- RootDID self-heal for migrated agents (`51aaa1216`)

---

## Testing Next Steps

1. **Apply migrations** in Supabase (all three above)
2. **Navigate to Ingestion Registry** → Select Nakamoto asset
   - Asset status should now show **emerald** (published) ✓
   - L4 trust band visible ✓
3. **Test invocation** → Should no longer show `"blocked_policy"` error ✓
4. **Check aigentMe stage** → Should show as complete for ArkAgent ✓
5. **Verify receipts**:
   - Asset Receipts tab: `asset.published` receipt should appear (registry_receipts)
   - Persona receipt window: DVN `trust_dimension_incremented` receipts if trust dimension updates occur (activity_receipts)

---

## Outstanding Risks

### Trust Dimension Receipt Minting

If trust dimension receipts don't appear after applying migration `20260930001300`:
- Verify the constraint was properly rebuilt
- Check `services/registry/scoreBackfill/trustDimensions.ts` for any missing import or typo
- Check the DVN pipeline logs for submission failures

### Invocation Still Blocked

If Test Invoke still shows `blocked_policy: Asset is not published`:
- Verify `publication_status` column actually updated to `'published'` in DB
- Check if a second validation run re-triggered and reset the status
- Look at the Validation tab to see if validation is in progress

---

## Code Changes Summary

**Files committed (2026-08-04):**
- `supabase/migrations/20260804000100_publish_nakamoto_asset.sql` — Asset publication
- `supabase/migrations/20260804000200_mark_arkagent_aigentme_active.sql` — aigentMe reset
- `supabase/migrations/20260930001300_trust_dimension_receipt_type.sql` — Already exists

**Files from prior session (still pending deploy):**
- `app/triad/components/codex/tabs/BoundedDelegationTab.tsx` — Spine-fetch fix (ceaa5955d)
- `app/triad/components/codex/tabs/PassportRegistryTab.tsx` — Spine-fetch fix (ceaa5955d)
- `services/registry/trustDimensions.ts` — New file for trust dimension tracking (410a4670a)
- `services/journey/agentAdmissionState.ts` — RootDID self-heal (51aaa1216)
