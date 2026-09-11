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
├─ 7. Issue the reward — BRANCH on wallet_rewards.reward_asset
│     ┌─ reward_asset === 'KNYT' (and template resolved):
│     │    → grantRewardForTask({
│     │        taskType: template.schema_json.reward_task_type,
│     │        personaId, sourceEventId: orchestration_events.id,
│     │        metadata: { experienceId, completionSource: 'consumer-task-runner' }
│     │      })
│     │    → returns { rewardGrantId, finalAmount, repMultiplier }
│     └─ reward_asset ∈ {'Q¢','QC','QCT'}:
│          → creditQc(personaId,
│                     template?.reward_qct ?? wallet_rewards.reward_amount,
│                     reason: `experience-completion:${experienceId}`,
│                     referenceId: completionId)
│          → credits qc_balances + logs qc_transactions
│          → rewardGrantId = null (no reward_grants analogue for Q¢)
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
| `services/experience/experienceTaskCompletion.ts` | **CREATE** | Service layer: template resolution, asset-branched credit (`grantRewardForTask` for KNYT / `creditQc` for Q¢), reputation update |
| `components/composer/ExperienceLiquidRenderer.tsx` | **MODIFY** | Wire `toggleTask()` seam → POST on full completion |
| `services/dvn/activityReceiptDvnPipeline.ts` | **MODIFY** | Add `'experience_task_completed'` to `ANCHORABLE_ACTION_TYPES` |
| `supabase/migrations/YYYYMMDD_experience_task_completions.sql` | **CREATE** | New table + indexes (Section 2b) |
| `app/api/admin/knyt/tasks-rewards/route.ts` | **MODIFY** | Add `rep_weight_*` to PATCH whitelist; add completion count to GET |

### Files NOT modified (spine contract — operator approval required)

- `services/identity/getActivePersona.ts` — consumed, not changed
- `services/access/evaluateAccess.ts` — not involved in this flow
- `services/rewards/rewardService.ts` — called as-is via `grantRewardForTask()` (KNYT branch); not modified
- `creditQc()` in `app/api/community-content/_lib/generate.ts` — reused as-is for the Q¢ branch (may be lifted into a shared `services/wallet/` helper if reuse warrants it)
- `services/dvn/activityReceiptDvnPipeline.ts` — only the `ANCHORABLE_ACTION_TYPES` set is extended (permitted)

## BUILD RECORD — shipped 2026-06-16

C-b is implemented. Files:

- **NEW** `supabase/migrations/20260616000000_experience_task_completions.sql`
  — completion table (UNIQUE idempotency gate) + `activity_receipts`
  action_type CHECK extended with `experience_task_completed`.
- **NEW** `services/experience/experienceTaskCompletion.ts` —
  `recordExperienceTaskCompletion()`: idempotent slot claim → template
  resolution → asset-branched credit (`grantRewardForTask` for KNYT /
  `creditQc` for Q¢) → reputation (template weights + per-experience bump) →
  DVN activity receipt → finalise row.
- **NEW** `app/api/experience/complete-tasks/route.ts` — POST, spine-auth via
  `getActivePersona`, returns T1-safe payload (no personaId).
- **MODIFIED** `components/composer/ExperienceLiquidRenderer.tsx` — task runner
  fires the completion POST via `personaFetch` on full completion; clears
  localStorage on 200/409; surfaces a grant notice.
- **MODIFIED** `services/receipts/activityReceiptService.ts` +
  `services/dvn/activityReceiptDvnPipeline.ts` — added
  `experience_task_completed` to the action-type union + anchorable set.
- **MODIFIED** `services/crm/taskService.ts` — exported `updatePersonaReputation`
  for reuse (no logic change).
- **MODIFIED** `app/api/admin/knyt/tasks-rewards/route.ts` — PATCH now accepts
  `rep_weight_*`; GET returns `experience_completions_count` per template.

### Operator action — run this migration in Supabase

```sql
-- supabase/migrations/20260616000000_experience_task_completions.sql
CREATE TABLE IF NOT EXISTS public.experience_task_completions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id       UUID NOT NULL,
  experience_id    UUID NOT NULL,
  tenant_id        TEXT NOT NULL,
  task_template_id UUID REFERENCES public.crm_task_templates(id),
  tasks_completed  TEXT[] NOT NULL DEFAULT '{}',
  total_tasks      INTEGER NOT NULL DEFAULT 0,
  reward_asset     TEXT,
  reward_amount    NUMERIC(36,12) NOT NULL DEFAULT 0,
  reward_grant_id  UUID,
  grant_failed     BOOLEAN NOT NULL DEFAULT false,
  source_event_id  UUID,
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_persona_experience UNIQUE (persona_id, experience_id)
);
CREATE INDEX IF NOT EXISTS idx_etc_persona ON public.experience_task_completions(persona_id);
CREATE INDEX IF NOT EXISTS idx_etc_experience ON public.experience_task_completions(experience_id);
CREATE INDEX IF NOT EXISTS idx_etc_tenant ON public.experience_task_completions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_etc_template ON public.experience_task_completions(task_template_id);

ALTER TABLE public.activity_receipts DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;
ALTER TABLE public.activity_receipts ADD CONSTRAINT activity_receipts_action_type_check
  CHECK (action_type IN (
    'intent_queued','specialist_consulted','artifact_created','artifact_sent',
    'approval_granted','approval_rejected','experience_model_updated','session_started','session_completed',
    'passport_application_submitted','passport_issued','passport_status_changed',
    'passport_revoked','passport_privilege_changed','passport_infraction_recorded',
    'governance_decision_ratified','governance_decision_amended',
    'governance_authority_exercised','governance_escalation_triggered',
    'experience_task_completed'
  ));
```

### To make an experience grant rewards (admin/authoring)

Set on `experience.configuration.wallet_rewards`:
- `reward_amount` + `reward_asset` (`"KNYT"` or `"Q¢"`)
- `task_template_slug` — an active `crm_task_templates.slug` in the cartridge's
  tenant. For KNYT rewards the template's `schema_json.reward_task_type` must be
  a valid `RewardTaskType`. For Q¢ the template's `reward_qct` is used if set,
  else `reward_amount`.
- optional `reputation_bump: { dimension, weight }` for a per-experience bump.

## 11. Implementation Order

1. **Migration** — `experience_task_completions` table (operator runs SQL)
2. **Service** — `experienceTaskCompletion.ts` (template resolution + grant bridge + reputation)
3. **Endpoint** — `POST /api/experience/complete-tasks` (wires service to HTTP)
4. **DVN** — add action type to anchorable set
5. **Client** — wire `ExperienceLiquidRenderer` seam + completion UX
6. **Admin** — extend tasks-rewards GET/PATCH for reputation weights + completion counts
7. **Test** — end-to-end: check all tasks → POST fires → grant created → wallet shows reward → DVN receipt anchored

## 12. Resolved Decisions (operator sign-off — 2026-06-16)

1. **Partial completion grants — NO.** Grant fires only on full completion
   (all `nextActions` checked). Partial progress stays client-side in
   localStorage. This keeps the idempotency model clean (one grant per
   persona × experience).

2. **Treasury namespace for non-KNYT cartridges — register rows in the
   existing table.** Qriptopian/metaMe get their own rows in
   `knyt_treasury_namespaces` (slugs `qriptopian_treasury`, `metame_treasury`).
   No rename now — generalising the table name to
   `cartridge_treasury_namespaces` is cosmetic and deferred.

3. **Q¢ grant path — Q¢ is native to the wallet, but via a SEPARATE credit
   path from KNYT.** (Verified against the schema; this corrects an earlier,
   inaccurate "single path handles both" note.)

   Q¢ (a.k.a. Qc, Q¢, QriptoCENT, `QCT`) is a first-class wallet asset, but it
   does **not** flow through `grantRewardForTask()`. Two distinct ledgers exist:

   | Asset | Balance table | Tx table | Credit function | Grant record |
   |---|---|---|---|---|
   | `KNYT` | `wallet_balances` (`asset_code='KNYT'`) | `wallet_transactions` | `grantRewardForTask()` → `_creditImmediate()` | `reward_grants` → `crm_rewards` bridge |
   | `Q¢` (`QCT`) | `qc_balances` (`currency='base_qc'`) | `qc_transactions` | `creditQc()` (`app/api/community-content/_lib/generate.ts:231`) | — (no parallel grant table today) |

   Findings that drive the implementation:
   - `grantRewardForTask()` (`services/rewards/rewardService.ts`) hardcodes
     `asset:'KNYT'` (line ~544) and `asset_code:'KNYT'` (lines ~578, ~595). It
     cannot credit Q¢.
   - `crm_task_templates` carries `reward_qct` / `reward_qoyn` / `reward_knyt`
     columns, but the KNYT grant service ignores `reward_qct`.
   - `creditQc()` already credits `qc_balances` + logs `qc_transactions` — it's
     used today for content-generation refunds and USDC→Q¢ conversions.

   **Implementation:** the C-b completion service branches on
   `wallet_rewards.reward_asset`:
   - `KNYT` → `grantRewardForTask()` (existing KNYT pipeline, unchanged).
   - `Q¢`/`QC`/`QCT` → `creditQc(personaId, reward_qct ?? reward_amount, reason, completionId)`.

   To keep parity with the KNYT side's auditability, the Q¢ branch also writes
   the `experience_task_completions` row (with `reward_grant_id` null, since
   `creditQc` has no `reward_grants` analogue) and the same
   `orchestration_events` receipt. A parallel `qc_reward_grants` table is **not**
   built in C-b — the `experience_task_completions` row + `qc_transactions`
   entry are sufficient provenance for Q¢ task rewards at this stage.

4. **Studio Customizer UI for `task_template_slug` + `reputation_bump` —
   deferred to C-d.** C-b wires the server-side only. Admins set template
   slugs via the Tasks & Rewards admin tab / direct DB until the Customizer
   asset-selector UI lands in C-d.
