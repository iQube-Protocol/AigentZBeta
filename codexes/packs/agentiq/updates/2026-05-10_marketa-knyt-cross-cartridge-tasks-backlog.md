# Backlog — Marketa ↔ KNYT cross-cartridge task hand-off

**Date filed:** 2026-05-10
**Workstream:** KNYT rep/rewards/tasks (fast follow-up to v1)
**Severity:** medium (not blocking v1; follow up immediately after wallet UI lands)
**Discovered by:** Operator confirmed during decisions doc review
**Decisions doc:** `2026-05-10_knyt-rep-rewards-tasks-decisions.md` §13.5

---

## Context

The KNYT rep/rewards/tasks v1 workstream (Phases A–F in the decisions doc)
ships the spine-conformant tasks/rewards/reputation surface for KNYT
internal flows. Cross-cartridge task hand-off — where a **Marketa task**
(a campaign-side action like "share campaign X") flows into the buyer's
**KNYT task** view (so they see "you completed a Marketa task → here's
your KNYT reward") — is **explicitly out of scope for v1** but flagged
as a **fast follow-up**.

The plumbing for this already exists conceptually:

- `buildCodexUrl(slug, { personaSessionToken })` from `utils/codex-nav.ts`
  resolves the same persona on both sides without leaking T0 ids
- The spine's `evaluateAccess` is cross-cartridge by design — Marketa-side
  task completion can call `evaluateAccess(persona, descriptor, 'invoke')`
  with a KNYT-side reward descriptor and the receipt anchors uniformly
- `OrchestrationEvent` rows are global (not cartridge-scoped), so the
  audit trail spans both cartridges natively

What's missing is:

1. **Marketa-side emission point** — Marketa's task-completion path
   doesn't yet call `evaluateAccess` against KNYT-side reward descriptors
2. **KNYT-side reward registry for Marketa tasks** — we'd need a small
   table or JSON manifest mapping Marketa task slugs → KNYT reward
   descriptors so Marketa can emit decisions against them
3. **Cross-cartridge entitlement read** — KNYT's wallet UI needs to show
   Marketa-originated tasks/rewards in the unified task list

---

## Proposed scope

A separate PR / branch that depends on KNYT v1 (Phases A–F) being live:

### Step 1 — Reward registry (server-side)

```ts
// types/cross-cartridge-rewards.ts
export interface CrossCartridgeRewardEntry {
  /** Source cartridge slug — 'marketa' for now */
  sourceCartridge: string;
  /** Source-side task slug (e.g. 'campaign-share-knyt-launch') */
  sourceTaskSlug: string;
  /** KNYT reward descriptor that the spine evaluates */
  rewardDescriptor: ContentAccessDescriptor;
  /** RQH cohort partition for the resulting reputation delta */
  cohortId: string;
  /** Default reputation delta if the task doesn't override */
  defaultDelta: number;
}
```

Stored in a new table `cross_cartridge_rewards` with operator-editable rows
in the admin UI.

### Step 2 — Marketa emission point

When a Marketa task completes, Marketa's server code looks up the matching
`CrossCartridgeRewardEntry` and calls:

```ts
const decision = await evaluateAccess(persona, entry.rewardDescriptor, 'invoke');
if (decision.allow) {
  // Create knyt_claims row + crm_rewards row pointing at decision.receipt
  // Async-batched receipt fires automatically per the spine's policy
}
```

This reuses the exact same pattern KNYT-internal task acceptance uses
(decisions doc §5 Phase A). No new gating logic, no new receipt path.

### Step 3 — KNYT wallet UI shows the cross-cartridge rewards

The `/api/wallet/tasks` route Phase B refactors already returns rewards
keyed by `crm_rewards.persona_id`. Cross-cartridge rewards land in the
same table (just with a `source_cartridge` field set), so the wallet UI
gets them for free if we surface that field as a small badge ("From Marketa").

### Step 4 — Cross-cartridge inter-link (optional v2)

`buildCodexUrl('knyt-codex', { tab: 'rewards', personaSessionToken })`
in Marketa's task-completion email/notification so the buyer can click
through to claim. Already supported by the existing nav helper — just
needs the link.

---

## Acceptance criteria

- [ ] `cross_cartridge_rewards` table migration applied with operator-editable
  rows
- [ ] Marketa emits `evaluateAccess` decisions against KNYT reward descriptors
  on task completion
- [ ] `crm_rewards` rows from Marketa-source tasks appear in KNYT's wallet
  UI alongside KNYT-internal rewards
- [ ] OrchestrationEvent receipts for cross-cartridge tasks attribute via
  the same T2 alias commitment + cohort_id structure (no T0 leak across
  the cartridge boundary)
- [ ] Tests in `tests/access-spine-cross-cartridge.test.ts` mirror the
  canary pattern for cross-cartridge metadata

---

## Order of work

This work depends on KNYT v1 (Phases A–F) being landed first. Once v1
ships and is verified, **kick off this work as the next branch — the
operator marked it as a fast follow-up, not a deferred backlog item.**

---

## References

- Decisions doc §13.5 — operator confirmation
- `utils/codex-nav.ts` — `buildCodexUrl` helper
- `services/access/evaluateAccess.ts` — unified gate (cross-cartridge
  capable by design)
- `codexes/packs/agentiq/updates/2026-05-09_spine-integration-brief-knyt-rep-rewards-tasks.md`
  — original spine integration brief
- `codexes/packs/agentiq/updates/2026-05-10_knyt-rep-rewards-tasks-decisions.md`
  — KNYT v1 decisions doc (this backlog item is its fast follow-up)
