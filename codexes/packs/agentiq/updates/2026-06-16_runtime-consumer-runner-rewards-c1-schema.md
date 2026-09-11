# 2026-06-16 — Runtime consumer runner + Workstream C (rewards/reputation) schema proposal

## Context

The metaMe Runtime "Open Experience" launcher was an admin-grade surface that
exposed Studio editing controls to consumers and rendered the experience's
follow-up actions as static text. Workstreams A + B fixed this:

- **A** — the launcher (`ExperienceLiquidRenderer` via `ComposerExperienceViewer`)
  now gates all editing affordances behind a **persona-resolved** admin flag from
  the identity spine (`/api/wallet/active-persona` → `cartridgeFlags.isAdmin` /
  `adminCartridges`). Email is no longer the admin gate — the active persona is.
- **B** — when `canEdit` is false, the experience's `nextActions` render as an
  interactive, checkable task runner with progress + localStorage persistence and
  a documented seam for reward distribution (this doc's Workstream C).
- **C-a** (this push) — the task runner now surfaces reward/cost rails read-only
  from `experience.configuration.wallet_rewards`, supporting **Q¢ and $KNYT** on
  either field.

This doc records the Workstream C schema decisions still open (C1) and the
follow-on integration work (C-b), plus two captured backlog items.

## Current reward/cost fields (verified, not assumed)

`experience.configuration.wallet_rewards`:
- `unlock_price: number` — cost to unlock. Historically rendered as Q¢.
- `reward_amount: number` — completion reward. Historically rendered as Q¢.
- `require_wallet_connect: boolean`

Rendered today at `components/composer/ExperienceContextSidebar.tsx:95` and
`app/triad/components/codex/liquidTemplates/QriptopianReadingSprintTemplate.tsx:280`
— both hardcode the "Qc" label.

KNYT treasury/rewards/reputation pipeline (the blueprint) already exists:
- Treasury: `knyt_treasury_namespaces` / `knyt_treasury_ledger`
- Grant: `services/rewards/rewardService.ts::grantRewardForTask()`
- Templates + admin: `crm_task_templates` ↔ `PATCH /api/admin/knyt/tasks-rewards`
  (the **Tasks & Rewards Admin** tab — the read/write surface for these values),
  gated by `requireCartridgeAdmin('knyt-codex')`, audited via `orchestration_events`.
- Wallet read: `GET /api/wallet/tasks` → Tasks / Rewards / Reputation tabs.
- Reputation: template-driven `rep_weight_*` on `crm_task_templates` →
  `crm_persona_reputation` vector + `reputation_events`.

## C1 — schema proposal (needs sign-off before migration)

### 1. Multi-asset rails (Q¢ + $KNYT, either field)

Add optional asset fields to `wallet_rewards` (default preserves today's Q¢):

```jsonc
wallet_rewards: {
  unlock_price: number,
  unlock_asset?: "Q¢" | "KNYT",   // default "Q¢"
  reward_amount: number,
  reward_asset?: "Q¢" | "KNYT",   // default "Q¢"; KNYT for $KNYT rewards
  require_wallet_connect: boolean
}
```

- Costs are typically Q¢, rewards typically $KNYT — but either rail must be
  selectable on either field. The C-a display layer already honours `*_asset`.
- Studio authoring (Customizer) gains an asset selector per field (C-b).

### 2. Reputation bumps — currently NOT on the ExperienceQube

The ExperienceQube carries reward + cost, but no per-experience reputation bump.
Reputation today is template-driven (`rep_weight_*`). Two complementary options:

- **(a) Studio per-experience input** — optional `wallet_rewards.reputation_bump`
  + dimension (technical/creative/entrepreneurial/dataArch/community). Authored
  directly on the experience when a one-off bump is warranted.
- **(b) Cartridge-level policy (recommended default)** — "complete X tasks of
  class Y → bump reputation by Z", expressed by mapping the experience's task to
  a KNYT `crm_task_templates` class carrying `rep_weight_*`. This reuses the
  existing reputation engine instead of duplicating it on each experience.

Recommendation: support both; prefer (b) for normal flows, (a) for exceptions.

## C-b — live grant wiring (needs explicit sign-off; writes to treasury/rewards/reputation)

1. Replace the task-runner's localStorage-only completion seam with a POST that
   maps completed tasks → a KNYT task template and calls the existing grant path
   (`grantRewardForTask` → `crm_rewards` → wallet Rewards tab).
2. Reputation bumps per C1 option (a)/(b).
3. Read/write the values via the **Tasks & Rewards Admin** surface.
4. Normalize behind a cartridge-resolved interface so Qriptopian + metaMe extend
   it once their treasuries register (KNYT is the blueprint).

## C-c — thumbnail badge (read-only) — SHIPPED

`RuntimeCapsule` already carries `configuration`, so no projection change was
needed. `MetaMeRuntimeClient` reads `configuration.wallet_rewards` directly via
`resolveRuntimeRewardCost()` and renders a high-level "rewarded" badge (emerald,
$KNYT/Q¢) + cost badge (amber) in the experience-chip card's badge cluster.
Detail stays in the task runner (C-a).

## Captured backlog (no action now — alignment only)

- **Migrate the runtime inline editor admin gate to the spine.** `MetaMeRuntimeClient`
  still resolves admin via email → `/api/codex/admin-check`. Should use the same
  persona-based `cartridgeFlags` resolution as the launcher (A) so both surfaces
  are consistent.
- **Integrate Polity Passport + the KybeDID VC into the identity spine.** The new
  Polity Passport issues a KybeDID verifiable credential; align it with the spine's
  identity provisions (persona resolution, `cartridgeFlags`, access evaluation) so
  passport-derived attributes flow through the canonical resolver rather than a
  parallel path.
