# 2026-06-16 — C-b Implementation Plan: Live Grant Wiring for the Consumer Task Runner

**Status:** PLAN — awaiting operator sign-off before any code is written.

## 1. Objective

Replace the consumer task runner's localStorage-only completion seam
(`ExperienceLiquidRenderer.tsx:toggleTask()` line 175) with a server-side
POST that:

1. Records task completion as an `orchestration_events` receipt.
2. Maps the completed experience task to a `crm_task_templates` row.
3. Calls the existing KNYT grant pipeline (`grantRewardForTask()` →
   `reward_grants` → `crm_rewards` bridge → wallet Rewards tab).
4. Emits a `reputation_events` row using both reputation models:
   - **Cartridge-level policy** (default) — template-driven `rep_weight_*`.
   - **Per-experience override** (exception) — optional
     `wallet_rewards.reputation_bump` authored in Studio.
5. Makes the receipt DVN-anchorable for chain-of-provenance.
6. Normalizes behind a cartridge-resolved interface so KNYT is the blueprint
   and Qriptopian + metaMe extend it.

## 2. Schema Changes

### 2a. `wallet_rewards` multi-asset fields (C1, already proposed)

Add optional asset discriminator fields. Default preserves today's Q¢
behaviour. No migration needed — these are JSONB keys inside
`experience_qubes.configuration`.

```jsonc
wallet_rewards: {
  unlock_price: number,
  unlock_asset?: "Q¢" | "KNYT",           // default "Q¢"
  reward_amount: number,
  reward_asset?: "Q¢" | "KNYT",           // default "Q¢"
  require_wallet_connect: boolean,
  // C-b additions ↓
  task_template_slug?: string,             // maps to crm_task_templates.slug
  task_template_tenant?: string,           // default: cartridge tenant
  reputation_bump?: {                      // per-experience override (option a)
    dimension: "technical" | "creative" | "entrepreneurial" | "dataArch" | "community",
    weight: number                         // e.g. 0.5 — added on top of template weights
  }
}
```

- `task_template_slug` is the link from an experience's tasks to the reward
  pipeline. When present, completing all tasks in the experience triggers a
  grant for that template's configured reward. When absent, completion is
  recorded but no grant fires (pure tracking).
- `reputation_bump` is the per-experience Studio override (C1 option a). It
  stacks additively on top of the template's `rep_weight_*` values, never
  replaces them. Authoring surface: Studio Customizer asset-selector (C-b
  follow-on UI work).

### 2b. New migration: experience completion tracking

```sql
-- Prevents double-granting: one grant per (persona, experience, template).
CREATE TABLE IF NOT EXISTS experience_task_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id      UUID NOT NULL,
  experience_id   UUID NOT NULL,
  tenant_id       TEXT NOT NULL,
  task_template_id UUID REFERENCES crm_task_templates(id),
  tasks_completed TEXT[] NOT NULL,          -- the nextActions strings completed
  total_tasks     INTEGER NOT NULL,
  reward_grant_id UUID,                     -- FK to reward_grants (null if no grant)
  source_event_id UUID,                     -- FK to orchestration_events
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_persona_experience UNIQUE (persona_id, experience_id)
);

CREATE INDEX idx_etc_persona ON experience_task_completions(persona_id);
CREATE INDEX idx_etc_experience ON experience_task_completions(experience_id);
CREATE INDEX idx_etc_tenant ON experience_task_completions(tenant_id);
```

The `UNIQUE (persona_id, experience_id)` constraint is the idempotency
gate — a persona can only complete a given experience once. Partial progress
is tracked client-side (localStorage); the server row is written only on
full completion (all `nextActions` checked).

### 2c. DVN anchoring — extend `ANCHORABLE_ACTION_TYPES`

Add `'experience_task_completed'` to the set in
`services/dvn/activityReceiptDvnPipeline.ts`. This is the only permitted
unilateral DVN change per CLAUDE.md.

## 3. Endpoint Design

### `POST /api/experience/complete-tasks`

**Auth:** `getActivePersona(request)` — spine-mediated, Bearer token required.

**Request body:**
```typescript
{
  experienceId: string,          // UUID
  completedTasks: string[],      // the nextActions strings the user checked
  cartridgeSlug: string          // e.g. "knyt-codex", "qriptopian-codex"
}
```

**Response (success):**
```typescript
{
  completionId: string,          // experience_task_completions.id
  grant?: {
    rewardGrantId: string,
    asset: "Q¢" | "KNYT",
    amount: number,
    repMultiplier: number
  },
  reputation?: {
    deltas: {
      technical: number,
      creative: number,
      entrepreneurial: number,
      dataArch: number,
      community: number
    }
  },
  receiptId: string              // orchestration_events.id (DVN-eligible)
}
```

**Error codes:**
- `400` — missing fields, experience not found, tasks mismatch
- `401` — unauthenticated (no Bearer token)
- `409` — already completed (idempotency guard from UNIQUE constraint)
- `500` — grant pipeline failure (receipt still written with `grant_failed` flag)

## 4. Server-Side Flow (step by step)

```
POST /api/experience/complete-tasks
│
├─ 1. Resolve persona via getActivePersona(request)
│     → personaId, cartridgeFlags
│
├─ 2. Fetch experience_qubes row by experienceId
│     → validate it exists, extract configuration.wallet_rewards
│     → extract nextActions from composition bundle
│     → validate completedTasks ⊆ nextActions AND len(completedTasks) === len(nextActions)
│       (full completion required for grant; partial stays client-side)
│
├─ 3. Resolve tenant from cartridgeSlug
│     → e.g. "knyt-codex" → tenant_id "knyt"
│
├─ 4. Check idempotency
│     → SELECT FROM experience_task_completions
│       WHERE persona_id = $1 AND experience_id = $2
│     → if exists → return 409 with existing completionId
│
├─ 5. Resolve task template (if wallet_rewards.task_template_slug is set)
│     → SELECT FROM crm_task_templates
│       WHERE tenant_id = $tenant AND slug = $slug AND is_active = true
│     → if not found → log warning, proceed without grant
│
├─ 6. Write orchestration_events receipt
│     → event_type: 'experience.task-completed'
│     → receipt_eligible: true (DVN-anchorable)
│     → metadata: { experienceId, completedTasks, cartridgeSlug,
│                    task_template_id, cohort_alias_commitment }
│     → cohort_alias_commitment via hashPersonaRef (T2-safe)
│
├─ 7. If task template resolved → call grantRewardForTask()
│     → taskType: template.schema_json.reward_task_type
│     → personaId, sourceEventId: orchestration_events.id
│     → metadata: { experienceId, completionSource: 'consumer-task-runner' }
│     → returns: { rewardGrantId, finalAmount, repMultiplier }
│
├─ 8. Compute reputation deltas
│     a. Template weights (cartridge-level policy — default):
│        → read rep_weight_* from crm_task_templates row
│     b. Per-experience override (if wallet_rewards.reputation_bump exists):
│        → add reputation_bump.weight to the matching dimension
│     c. Write crm_reputation_events row:
│        → source_type: 'task_completion'
│        → source_id: completion record id
│        → delta_*: computed from (a) + (b)
│        → task_template_id
│     d. UPDATE crm_persona_reputation:
│        → increment rep_* columns by deltas
│        → increment total_tasks_completed
│        → recalculate rep_overall (weighted average)
│
├─ 9. Write experience_task_completions row
│     → persona_id, experience_id, tenant_id, task_template_id,
│       tasks_completed, total_tasks, reward_grant_id, source_event_id
│
└─ 10. Return response with grant + reputation + receiptId
```

### Failure modes

| Failure point | Behaviour |
|---|---|
| Experience not found | 400 — no side effects |
| Tasks don't match nextActions | 400 — no side effects |
| Already completed (UNIQUE violation) | 409 — return existing record |
| Task template not found | Proceed without grant; receipt still written |
| `grantRewardForTask()` fails | Receipt written with `grant_failed: true` in metadata; 200 with `grant: null` so the client knows completion was recorded but reward needs retry |
| Reputation update fails | Non-fatal; logged at error level; grant still stands |
| DVN anchoring fails | Handled by existing pipeline — receipt flips to `dvn_failed`, operator retries via receipts view |

### Idempotency contract

- The `UNIQUE (persona_id, experience_id)` constraint prevents double-granting
  at the DB level. A retry of the same POST returns `409` with the existing
  completion record (including the grant details if one was issued).
- `grantRewardForTask()` has its own cap-checking via
  `checkRewardCap(personaId, taskType)` using the template's
  `cap_max_per_period` / `cap_period_days` — this is a second safety net.
- The client clears localStorage on a successful 200/409 response, preventing
  stale local state.

## 5. Client-Side Integration

### `ExperienceLiquidRenderer.tsx` — wire the seam

Replace the localStorage-only `toggleTask()` completion path with:

```typescript
// When all tasks are checked, fire the completion POST.
// Partial progress stays in localStorage (existing behaviour).
const allComplete = next.size === totalTasks;
if (allComplete && !hasSubmitted) {
  setHasSubmitted(true);
  personaFetch("/api/experience/complete-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      experienceId,
      completedTasks: [...next],
      cartridgeSlug: experience.metadata?.runtime_publication?.cartridge_id ?? "unknown"
    })
  })
    .then(res => {
      if (res.ok || res.status === 409) {
        // Clear localStorage — server is now the SoT
        localStorage.removeItem(`exp_tasks_${experienceId}`);
        // Optionally surface grant result in a toast/badge
      }
    })
    .catch(() => {
      setHasSubmitted(false); // Allow retry
    });
}
```

Key points:
- Uses `personaFetch` (not raw `fetch`) per CLAUDE.md — attaches Bearer token.
- Fires only on **full** completion (all nextActions checked).
- Partial progress remains localStorage-only — no server chatter for each toggle.
- `hasSubmitted` flag prevents duplicate POSTs during the async window.
- On 409 (already completed), treats as success and clears localStorage.

### Completion confirmation UX

After successful POST, the task runner shows a completion badge:
- Emerald banner: "Completed — N $KNYT earned" (or "N Q¢" per asset).
- If `grant: null` (template not configured), just "Completed" without reward line.
- Badge persists via the server record; localStorage is cleared.

## 6. Reputation: Both Models Working Together

### Model A — Per-experience Studio override

Authored directly on `experience.configuration.wallet_rewards.reputation_bump`:
```jsonc
{
  "dimension": "creative",
  "weight": 0.5
}
```

Use case: one-off experiences where the author wants a specific reputation
bump that doesn't map cleanly to a task template category. Example: a
creative writing sprint that should bump creative reputation regardless of
which task template it maps to.

Authoring surface: Studio Customizer gains a "Reputation Bump" section with
dimension dropdown + weight input. This is a C-b follow-on UI task.

### Model B — Cartridge-level policy (default)

Expressed via `crm_task_templates.rep_weight_*` fields. When an experience
maps to a template (via `task_template_slug`), the template's weights are the
default reputation impact.

Use case: standard flows where completing tasks of class Y bumps reputation
by the template's configured weights. The KNYT Living Canon templates already
carry these weights (seeded in `20260329030000_knyt_task_templates_v1.sql`).

### How they combine

```
final_delta[dimension] = template.rep_weight_[dimension]
                       + (experience.reputation_bump.dimension === dimension
                          ? experience.reputation_bump.weight
                          : 0)
```

The per-experience bump is **additive** — it never replaces the template
weights, only supplements them. If no template is mapped, the per-experience
bump is the sole source. If neither exists, no reputation event is emitted.

## 7. Cartridge-Resolved Interface (KNYT Blueprint → Extensible)

The endpoint is cartridge-agnostic by design:

| Concern | How it's cartridge-resolved |
|---|---|
| Tenant | Derived from `cartridgeSlug` → tenant lookup |
| Task template | Looked up by `(tenant_id, slug)` — each cartridge seeds its own templates |
| Treasury | `grantRewardForTask()` already debits from the tenant's treasury namespace |
| Reward asset | Read from `wallet_rewards.reward_asset` — Q¢ or KNYT per experience |
| Reputation | Template weights are per-template (per-tenant); per-experience bump is on the experience itself |
| Admin surface | `/api/admin/knyt/tasks-rewards` pattern clones for other tenants by parameterising `requireCartridgeAdmin(req, slug)` |

### To onboard Qriptopian or metaMe:

1. Seed `crm_task_templates` rows with `tenant_id = 'qriptopian'` (or `'metame'`).
2. Register a treasury namespace in `knyt_treasury_namespaces` (or its
   successor — the table name is KNYT-specific but the pattern is generic).
3. Set `task_template_slug` on Qriptopian/metaMe experiences in Studio.
4. Clone the admin tab route with `requireCartridgeAdmin(req, 'qriptopian-codex')`.
5. No changes to the completion endpoint or grant pipeline.

## 8. Tasks & Rewards Admin Integration

The existing `/api/admin/knyt/tasks-rewards` PATCH endpoint already edits
`reward_knyt`, `reward_qct`, `reward_qoyn`, `cap_max_per_period`,
`cap_period_days`, `is_active`, `title`, `description`. C-b adds:

- **Read:** GET response includes a new `experience_completions_count` aggregate
  per template — how many experience completions have mapped to this template.
- **Write:** PATCH gains optional `rep_weight_*` fields so admins can tune
  reputation weights from the same surface (currently these are seed-only).
- No new admin endpoint is needed — the existing surface extends.

## 9. DVN Receipt Shape

```typescript
{
  action: 'AIGENTME_ACTIVITY_RECEIPT',
  receiptId: orchestration_events.id,
  personaRef: hashPersonaRef(personaId),   // T2-safe SHA-256 prefix
  activeCartridge: cartridgeSlug,
  actionType: 'experience_task_completed',
  summary: `Completed ${totalTasks} tasks in experience "${experienceName}"`,
  agentsInvoked: [],
  toolsUsed: [],
  iqubesUsed: [experienceId],
  contextShared: [],
  artifactsCreated: [],
  approvalsGranted: [],
  timestamp: Date.now()
}
```

The receipt becomes DVN-anchorable because `'experience_task_completed'` is
added to `ANCHORABLE_ACTION_TYPES`. The existing finalizer
(`finalizeReadyActivityReceipts`) picks it up on its next pass.

## 10. Files to Create/Modify

| File | Action | What changes |
|---|---|---|
| `app/api/experience/complete-tasks/route.ts` | **CREATE** | New POST endpoint (Section 4 flow) |
| `services/experience/experienceTaskCompletion.ts` | **CREATE** | Service layer: template resolution, grant call, reputation update |
| `components/composer/ExperienceLiquidRenderer.tsx` | **MODIFY** | Wire `toggleTask()` seam → POST on full completion |
| `services/dvn/activityReceiptDvnPipeline.ts` | **MODIFY** | Add `'experience_task_completed'` to `ANCHORABLE_ACTION_TYPES` |
| `supabase/migrations/YYYYMMDD_experience_task_completions.sql` | **CREATE** | New table + indexes (Section 2b) |
| `app/api/admin/knyt/tasks-rewards/route.ts` | **MODIFY** | Add `rep_weight_*` to PATCH whitelist; add completion count to GET |

### Files NOT modified (spine contract — operator approval required)

- `services/identity/getActivePersona.ts` — consumed, not changed
- `services/access/evaluateAccess.ts` — not involved in this flow
- `services/rewards/rewardService.ts` — called as-is via `grantRewardForTask()`
- `services/dvn/activityReceiptDvnPipeline.ts` — only the `ANCHORABLE_ACTION_TYPES` set is extended (permitted)

## 11. Implementation Order

1. **Migration** — `experience_task_completions` table (operator runs SQL)
2. **Service** — `experienceTaskCompletion.ts` (template resolution + grant bridge + reputation)
3. **Endpoint** — `POST /api/experience/complete-tasks` (wires service to HTTP)
4. **DVN** — add action type to anchorable set
5. **Client** — wire `ExperienceLiquidRenderer` seam + completion UX
6. **Admin** — extend tasks-rewards GET/PATCH for reputation weights + completion counts
7. **Test** — end-to-end: check all tasks → POST fires → grant created → wallet shows reward → DVN receipt anchored

## 12. Open Questions for Operator

1. **Partial completion grants?** Current plan: grant fires only on full
   completion (all nextActions checked). Should partial completion (e.g. 3/5
   tasks) trigger a proportional grant? Recommendation: no — full completion
   keeps the idempotency model clean.

2. **Treasury namespace for non-KNYT cartridges.** The `knyt_treasury_namespaces`
   table is KNYT-branded. Should C-b rename/generalise it to
   `cartridge_treasury_namespaces`, or should Qriptopian/metaMe register their
   own rows in the existing table? Recommendation: register rows in the existing
   table (slug: `qriptopian_treasury`, `metame_treasury`) — rename is cosmetic
   and can happen later.

3. **Q¢ grant path.** `grantRewardForTask()` currently credits KNYT via
   `wallet_balances` + `reward_grants`. Q¢ rewards need a parallel credit path
   (or the same path with `asset_code = 'QC'`). Does the existing
   `wallet_transactions` / `wallet_balances` infrastructure already support Q¢
   as an asset code, or does it need extending? Need to verify before building.

4. **Studio Customizer UI for `task_template_slug` + `reputation_bump`.** This
   is a follow-on UI task — should it be part of C-b or deferred to C-d?
   Recommendation: defer to C-d; C-b wires the server-side; admins set template
   slugs via direct DB or admin tab until the Customizer catches up.
