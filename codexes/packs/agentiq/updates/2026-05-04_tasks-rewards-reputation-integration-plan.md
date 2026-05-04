# Tasks · Rewards · Reputation Integration Plan

**Status:** backlog · plan locked, build pending
**Owner:** TBD
**Pack:** agentiq/updates
**Date:** 2026-05-04

This doc captures what's already built across the tasks/rewards/reputation surfaces, what's broken or disconnected, and the integration plan to ship a clean working loop in the Order tab right HUD + wallet tabs (Tasks / Rewards / Reputation).

It also captures the adjusted scope for the **Investor Dashboard** (admin-only My Documents stub + admin-only Investment Card with upload).

---

## 1. Audit — what's already built

### 1.1 Backend infrastructure (DB + services) — DONE

Tables (migration `20251130010000_task_contribution_engine.sql`):

| Table | Purpose |
|---|---|
| `crm_task_templates` | TaskQube definitions: title, category, verification mode, reward (QCT/QOYN/KNYT) and reputation weights |
| `crm_contributions` | User submissions/claims against task templates (status: claimed / submitted / under_review / accepted / rejected / cancelled) |
| `crm_persona_reputation` | Multi-dimensional reputation vector per persona (technical, creative, entrepreneurial, data_arch, community + overall, lifetime CVS) |
| `crm_reputation_events` | Audit log of every reputation delta with source_type (task_completion / usage_reward / manual / decay / etc.) |
| `crm_rewards` | Token reward grants linked to tasks + contributions + reputation bucket at time of grant |
| `crm_category_defaults` | Default reputation weights per category |
| `knyt_publication_states` | Living Canon item lifecycle (canon / community / correspondent branches) |
| `knyt_elections` | 21 Sats election open/close state |

Services:

| Service | Purpose |
|---|---|
| `services/crm/taskService.ts` | `listTaskTemplates`, `claimTask`, `completeTask`, `getPersonaReputation` |
| `services/rewards/rewardService.ts` | `RewardTaskType` enum (16 task types, all 6 task families covered), `BASE_REWARD_AMOUNTS`, `grantReward()` w/ DVN KNYT minting via `createKnytClaim` / `mintKnyt` |
| `services/rewards/referralService.ts` | Bring a Knight referral tracking |
| `services/rewards/engagementService.ts` | Knight of Attention episode/streak tracking |
| `services/crm/taskCanisterService.ts` | On-chain RQH bucket sync |

API routes:

| Route | Status |
|---|---|
| `/api/crm/tasks` (list/[id]/canister-sync/complete) | wired |
| `/api/codex/knyt/living-canon` (overview + branch viewer) | wired |
| `/api/codex/knyt/living-canon/contribute` | wired — writes to `crm_contributions` |
| `/api/codex/knyt/living-canon/review` | wired — emits reward + reputation events on accept |
| `/api/moneypenny/crm/tasks` | admin task admin (claim/complete) |

Seeded task templates (migration `20260329030000_knyt_task_templates_v1.sql`):
- `knyt:dispatch` (Field Dispatch, community branch, 0.5 KNYT, editor_review)
- `knyt:theory` (Theory Submission, community branch, 0.5 KNYT)
- `knyt:observation` (Observation, community branch, 0.25 KNYT)
- + correspondent variants (elevated tier, peer review)

### 1.2 Wallet UI — PARTIAL (decorative only)

`SmartWalletDrawer` Tasks tab renders 3 hero cards as **hardcoded JSX** (lines 3162–3199):
- "Bring a Knight" → only action is "Share Invite Link" (raw share, no completion tracking)
- "Knight of Attention" → static counters showing "0/2 episodes", "0 streak"
- "Herald of the Order" → static counters showing "0 clicks", "0 signups"

Plus a Living Canon section (lines 3204–3232) with 3 buttons:
- "Vote on open elections" (+21 KNYT) → `knyt:navigate-tab` event to 21 Sats tab
- "Submit community contribution" (PoKW) → same event
- "File Correspondent dispatch" (Featured) → same event

These 6 cards/buttons do NOT consume `crm_task_templates` data and are NOT connected to `crm_persona_reputation` or `crm_rewards`. They're aesthetic/navigation affordances only.

The lower "Active Tasks" section reads from `walletNode.tasks` — this prop is never populated anywhere; always renders "No active tasks".

The Reputation and Rewards tabs are similarly empty stubs.

### 1.3 Order tab right HUD — empty placeholder

`KnytTemplateRenderer.tsx` Order template renders `<QuestRail activeTask={undefined} rewards={undefined} />` (line 1291–1297). All three QuestRail sections (Active Quest / Rewards / Ascension Progress) are conditional renders that gate on truthy props — none are passed, so the column renders an empty card.

`ascensionRank` from KnytRewardView is used in the LEFT HUD only; the RIGHT HUD doesn't receive it.

### 1.4 CRM admin side menu — DONE

`/app/(shell)/crm/tasks` + `/personas` + `/rewards` + `/contributions` + `/segments` are operator-facing admin surfaces. They read/write the same tables and are integrated with the reputation system already. Operators can claim/complete/review tasks and see persona reputation vectors.

---

## 2. Gap analysis — what's broken or disconnected

| # | Gap | Impact |
|---|---|---|
| G1 | The 3 General task cards in the wallet are JSX-hardcoded, not bound to `crm_task_templates` rows or `RewardTaskType` IDs | No progress tracking, no completion, no reward emission |
| G2 | The 3 Living Canon task buttons are navigation links only; submission flow exists but the wallet doesn't reflect submission status, accepted/rejected outcome, or accumulated rewards | Users can't see whether their submitted dispatch was accepted; can't see rewards earned |
| G3 | `walletNode.tasks` is never populated — no API route assembles the user's task list | "Active Tasks" section is dead, copilot's `Show tasks` action returns empty |
| G4 | Order tab right HUD `<QuestRail>` receives no data | Empty card with no content; user requested it surface tasks/quests/rewards |
| G5 | Reputation tab in wallet — empty stub | `crm_persona_reputation` data exists server-side but isn't surfaced to users |
| G6 | Rewards tab in wallet — empty stub | `crm_rewards` granted by `rewardService.ts` aren't visible to the recipient |
| G7 | No unified "user-facing tasks" API — wallet, Order tab, and copilot all need one | Each surface would otherwise reinvent the assembly |
| G8 | `crm_task_templates` has no rows for the 3 General task families (only Living Canon templates seeded) | Even if we wire the wallet to templates, the General families have no DB row to bind to |

---

## 3. Integration plan

The architecture is already sound (templates → contributions → rewards + reputation events). The work is **wiring the existing backend into the user-facing surfaces** plus seeding the 3 General task templates.

### 3.1 Phase A — DB seed

Add `crm_task_templates` rows for the 3 General task families with category `community` and the appropriate `RewardTaskType` slugs:

| Template slug | Title | RewardTaskType (settlement) | Base KNYT | Category |
|---|---|---|---|---|
| `knyt:bring-a-knight` | Bring a Knight | `BringAKnightQualifiedReferral` | 2.0 | community |
| `knyt:knight-of-attention` | Knight of Attention | `KnightOfAttentionEpisodeComplete` (+ streak variants) | 0.5 | community |
| `knyt:herald-of-the-order` | Herald of the Order | `HeraldCuriosityClicks` (+ signup, conversion) | 0.25 | community |

These 3 plus the 3 Living Canon templates already seeded = 6 user-facing task families surfaced in the wallet.

### 3.2 Phase B — User-facing tasks API

Single new endpoint that assembles the user's complete task surface in one shot:

```
GET /api/wallet/tasks?personaId=<uuid>
→ {
    active:    [ { templateSlug, title, description, progress%, status, rewardPreview, nextStep, deepLink } ],
    available: [ { templateSlug, title, description, rewardPreview, deepLink } ],
    completed: [ { contributionId, templateSlug, title, completedAt, rewardAmount, rewardStatus } ],
    summary:   { activeCount, claimableRewardsKnyt, lifetimeRewardsKnyt }
  }
```

Source data:
- `crm_task_templates` (active, plus those the persona is eligible for)
- `crm_contributions WHERE persona_id = ?` (active claims, completed)
- `crm_rewards WHERE persona_id = ?` (claimable + history)
- `crm_persona_reputation WHERE persona_id = ?` (rank derivation)

Per-template progress rules:
- `bring-a-knight` → count of qualified referrals via `referralService`
- `knight-of-attention` → episode completions this week + streak
- `herald-of-the-order` → social click/signup/conversion counters
- Living Canon → contribution counts by branch + state

### 3.3 Phase C — Wallet wire-up

**Tasks tab** (`SmartWalletDrawer` lines 3158+):
- Replace the 6 hardcoded JSX cards with rendering driven by `/api/wallet/tasks` response.
- Each card binds to its template slug; click → opens template-specific UX (referral link / episode → reader / 21 Sats submission shell).
- Active Tasks section now populated from `active[]`.
- Add empty state when no active tasks but available tasks exist ("Start one of the X tasks above to earn KNYT").

**Reputation tab:**
- Surface `crm_persona_reputation` row: 5-dimension radar chart (technical / creative / entrepreneurial / data_arch / community), overall rank, lifetime CVS, total tasks completed.
- Show recent `crm_reputation_events` as a feed (date · category · delta).

**Rewards tab:**
- Surface `crm_rewards` rows: claimable (status='pending' or 'unclaimed'), recent grants, lifetime totals.
- "Claim" button on claimable rows → triggers KNYT mint via `claimDeferredKnyt`.
- Currency totals: KNYT / Q¢ / QOYN.

### 3.4 Phase D — Order tab right HUD

`KnytTemplateRenderer.tsx` `OrderOfMetaiyeTemplate` (line ~1212):
- Pass new props: `activeTask`, `rewards`, `ascensionRank` — all assembled from the same `/api/wallet/tasks` (or piggyback on an existing persona-level fetch).
- `<QuestRail>` already conditionally renders all three sections — once props arrive, the column populates automatically.
- Mobile: keep as-is (right HUD hidden on mobile per existing logic).

### 3.5 Phase E — Completion → reward → reputation loop verification

For each of the 6 task families, verify the full loop fires:

1. **User action completes the task** (referral converts / episode finishes / share gets a click / Living Canon submission accepted)
2. `rewardService.grantReward()` runs with the right `RewardTaskType`
3. `crm_rewards` row inserted with persona_id + amount + reputation snapshot
4. `crm_reputation_events` row inserted with weighted deltas
5. `update_persona_reputation()` fn applies deltas to `crm_persona_reputation`
6. Wallet UI re-fetches and surfaces the change (Tasks completion ✓, Rewards new claimable, Reputation delta visible)

For the Living Canon flow, this is already wired through `/api/codex/knyt/living-canon/review` → just needs the wallet UI to show the result. For the 3 General task families, services already exist (`referralService`, `engagementService`); the wiring point is the eventing layer (e.g., `cart/purchase/complete` already calls these on referral conversions).

### 3.6 Phase F — Copilot integration

`CodexCopilotLayer` already routes "show tasks" / "open tasks" prompts to the wallet tasks tab. After Phase C the copilot can answer "what tasks do I have?" with real data and propose claiming pending rewards.

---

## 4. Investor Dashboard — adjusted scope

Per direction, **Phase 1 ships with My Documents as admin-only**, plus an admin-only Investment Card view (with upload) in the Order tab itself.

### 4.1 Sub-tab structure

```
Order | Treasury | Runtime | KNYT Shelf | Investor          ← visible to investors only
Order | Treasury | Runtime | KNYT Shelf | Investments (admin) ← visible to admins only
```

The investor-facing **Investor** tab and the admin-facing **Investments** tab are TWO distinct tabs because their visibility rules differ:
- Investor tab: gated by `personas.isInvestor` flag (or presence in `nakamoto_knyt_personas`)
- Investments tab: gated by `isAdmin === true`

Admins can also have `isInvestor=true` → both tabs appear.

### 4.2 Investor tab content (Phase 1)

| Card | Status |
|---|---|
| My Investment | full content (amount, vehicle, round, vesting) |
| My Equity | full content (shares, class, valuation) |
| My Tokens & Allocations | full content (KNYT, Q¢, allocations, future drops) |
| **My Documents** | **STUB — shows "Documents available on request — contact your investor relations rep"** with no list/download. Real list rendered behind admin gate (see 4.3). |

Sticky header: KnytRewardView (Order rank) + investor-exclusive content access status.

### 4.3 Admin Investments tab content

Lists all investors (rows from `nakamoto_knyt_personas` + investor-flagged `personas`), each row expandable to a per-investor card mirroring the Investor tab plus:

- **Capital events ledger** (read/write — admin can record new investment, share grant, distribution)
- **Documents** section with **Upload** affordance — admin uploads investor docs to `master_content_qubes` via the existing admin/codex/storage flow, then attaches to `investor_documents` row keyed by persona_id + doc_type. PDFs render via the gated `PDFPageViewer` proxy (per CLAUDE.md gated-content rule). New doc types: `subscription_agreement | side_letter | k1 | 1099_b | quarterly_letter | annual_report`.
- **Send to investor** action that flips the doc's `visible_to_investor` flag from default `false` → `true` (the investor-tab "My Documents" stub starts populating as soon as docs are unflagged).

Phase 1 keeps all docs at `visible_to_investor = false` by default. Going public per-doc is a deliberate admin action.

### 4.4 Tables (Phase 1, RLS-enforced)

```sql
CREATE TABLE IF NOT EXISTS investor_capital_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('investment','share_grant','token_grant','vesting_milestone','distribution')),
  amount_usd NUMERIC,
  amount_shares NUMERIC,
  amount_knyt NUMERIC,
  vehicle TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES personas(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE investor_capital_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY investor_events_self_view ON investor_capital_events
  FOR SELECT USING (
    persona_id IN (SELECT id FROM personas WHERE user_id = auth.uid())
  );
-- Admin RLS handled via service-role bypass at the API layer.

CREATE TABLE IF NOT EXISTS investor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  title TEXT NOT NULL,
  storage_master_id TEXT,            -- master_content_qubes pk for PDF
  visible_to_investor BOOLEAN NOT NULL DEFAULT FALSE,
  effective_date DATE,
  uploaded_by UUID REFERENCES personas(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE investor_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY investor_docs_self_view ON investor_documents
  FOR SELECT USING (
    visible_to_investor = TRUE
    AND persona_id IN (SELECT id FROM personas WHERE user_id = auth.uid())
  );
```

PDFs use `master_content_qubes` so they automatically benefit from the gated `PDFPageViewer` proxy (`/api/content/pdf-page-by-master/[masterId]`). The `storage_master_id` is what gets passed to the viewer.

### 4.5 Implementation order

1. **Tables + RLS** (`investor_capital_events`, `investor_documents`)
2. **Codex config** — add `investor` (investorGated) + `investments` (adminOnly) sub-tabs to `knyt-codex` order group
3. **Backend APIs**:
   - `GET /api/codex/investor-dashboard?personaId=` — investor-facing assembly
   - `GET /api/admin/investor-dashboard?personaId=` — admin per-investor view
   - `POST /api/admin/investor-events` — record capital events
   - `POST /api/admin/investor-documents` — upload & attach
   - `PATCH /api/admin/investor-documents/[id]` — flip `visible_to_investor`
4. **UI**:
   - `KnytInvestorDashboardTab.tsx` — investor-facing 4 cards (My Documents stubbed)
   - `KnytInvestmentsAdminTab.tsx` — admin per-investor expandable rows + upload + flip-visible
5. **Right HUD complement (optional)** — for investors viewing the regular Order tab, swap the right HUD to a quick-glance investor strip (KNYT balance, rank, last update). Phase 2.

---

## 5. Sequencing recommendation

Both threads (tasks integration and investor dashboard) share underlying infrastructure (admin upload pattern, RLS-gated documents, gated PDF viewer). Suggest:

**Sprint 1:** Phase A + B + D — DB seed + user-facing tasks API + Order tab right HUD wire-up. Minimum delta to make the Order tab right column live.

**Sprint 2:** Phase C — Wallet Tasks/Reputation/Rewards tabs full wire-up.

**Sprint 3:** Investor Dashboard tables + Investor tab (full but with My Documents stub).

**Sprint 4:** Admin Investments tab (per-investor card + upload + flip-visible). Once admins start populating, the investor "My Documents" stub becomes live.

**Sprint 5:** Phase E — verify full task→reward→reputation loop end-to-end across all 6 task families.

---

## 6. References

- `services/rewards/rewardService.ts` — `RewardTaskType` enum (locked vocabulary for the 6 task families)
- `services/crm/taskService.ts` — `completeTask` flow (atomic reward + reputation event emission)
- `supabase/migrations/20251130010000_task_contribution_engine.sql` — schema
- `supabase/migrations/20260329030000_knyt_task_templates_v1.sql` — Living Canon templates seed
- `app/components/content/SmartWalletDrawer.tsx` lines 3155–3260 — current hardcoded Tasks tab UI (to be replaced)
- `app/triad/components/codex/templates/KnytTemplateRenderer.tsx` lines 1212–1300 — Order template (right HUD wire-up site)
- CLAUDE.md § Gated Content — investor docs MUST go through PDFPageViewer; no direct URLs
