# KNYT Reputation / Rewards / Tasks — Spine Integration Closure (v1)

**Date:** 2026-05-10
**Status:** v1 closed end-to-end. Decisions doc, schema bridge, route refactors,
wallet UI claim affordance, QuestRail HUD live data, canary tests all shipped.
**Decisions doc:** `2026-05-10_knyt-rep-rewards-tasks-decisions.md`
**Spine state at close:** Phase 1 + 2 + 3 live (`2026-05-08_phase-1-iam-spine-closure.md`,
`2026-05-09_phase-2-encryption-decisions.md`, `2026-05-10_phase-3-closure.md`).
**Branch:** `claude/review-session-setup-V82mB` → dev

---

## What v1 closed

The KNYT rep/rewards/tasks workstream now sits on top of the spine
(Phases 1–3) without any parallel resolvers, parallel gates, or T0 leaks
into browser-bound JSON / orchestration_events metadata. Every gated
action this workstream owns flows through `getActivePersona`,
`evaluateAccess`, and the spine's receipt emitter.

Phase status:

| # | Status | Commit |
|---|---|---|
| A — Decisions doc, operator-locked | ✅ shipped | `752bffa7` + `6b3866b3` (operator answers + Marketa fast-follow + spine QubeTalk) |
| B.1 — `/api/wallet/tasks` spine-conformed | ✅ shipped | `244689d0` |
| B.2 — `/api/purchase/complete` spine receipt | ✅ shipped | `0bfef906` |
| B.3 — `/paypal/recover` batch receipt + `'acquire'` action proposal | ✅ shipped | `945aa47c` |
| C — Schema bridge migration (`cohort_id`, `source_event_id`, `claim_id`, status enum) | ✅ shipped | `87a68b61` |
| D — Wallet UI Claim button + spine-mediated redeem endpoint | ✅ shipped | `2111fd3f` |
| E — Order tab right-HUD QuestRail live-data + claim wire-up | ✅ shipped | `c5444d5c` |
| F — Canary tests + this closure doc | ✅ shipped | this commit |

---

## Privacy contract — verification artefacts

### T0 fields stripped from browser-bound JSON

Routes refactored to drop `personaId` / `crmPersonaId` / `authProfileId`
/ `rootDid` / cross-persona `fioHandle` from response payloads:

- `GET /api/wallet/tasks` — `personaId`, `crmPersonaId` removed (B.1)
- `POST /api/purchase/complete` — `body.personaId` no longer trusted; route
  resolves persona via `getActivePersona`. Response carries only
  `purchaseId`, `entitlementsGranted`, `rewardsTriggered` (B.2)
- `POST /api/wallet/knyt/rewards/redeem` — new in D; response carries
  `aliasCommitment` + `cohortId` (T2-safe) and `transactionId` (DB
  primary key, not a persona id)

### Canary test asserts

`tests/access-spine-rewards.test.ts` enforces:

- `/api/wallet/tasks` happy-path response has no T0 fields
- Redeem success + error responses have no T0 fields
- Redeem descriptor uses synthetic `reward:<id>` asset id (no
  `master_content` correlation in receipt metadata)
- Action class contracts: redemption is `'mint'` (sync receipt),
  eligibility is `'invoke'` (async-batched). Both locked so future
  agents can't silently downgrade.

### Receipt emission

Three new spine receipt emission sites:

| Site | Action | Receipt mode | T2 attribution |
|---|---|---|---|
| `/api/purchase/complete` post-grant | `'payment-settle'` | sync | `aliasCommitment` + `cohortId` |
| `/api/wallet/knyt/rewards/redeem` | `'mint'` | sync | `aliasCommitment` + `cohortId` |
| `/api/wallet/knyt/paypal/recover` end-of-batch | `'access_decision'` (event_type, ops aggregate) | async-batched | null + null (operator-side) with `recovered_count` + `affected_persona_count` |

Per the operator-confirmed call (decisions doc §13.1), reputation deltas
attribute to the `knyt:backers` cohort. Phase C's seed migration
(`20260511020000_knyt_rep_rewards_tasks_spine_bridge.sql`) backfills
`cohort_id='knyt:backers'` on the 6 existing KNYT task templates.

---

## What's NOT in v1 (operator-acknowledged + tracked)

### 1. Operationalisation of the actual task flows

The wallet UI now SHOWS the 3 General task families and the Living Canon
families with rewards previews and Claim buttons that work end-to-end
through the spine. **What's NOT done yet** is the actual task
side-effect plumbing — the user clicks "Share Invite Link" and it
should activate the social-share flow with referral attribution; clicks
on Living Canon tasks should deep-link into the 21 Sats tab and the
specific task surface there; episode completions should track against
Knight-of-Attention with the streak engine; etc.

Today the deep-link handlers fire `knyt:navigate-tab` events but the
destination tabs don't yet **track** the task progress and the spine
receipt for "task accepted" doesn't fire on each completion event.

Filed as a separate fast-follow backlog:
**`2026-05-10_knyt-tasks-operationalization-backlog.md`**

### 2. Spine bypass (`services/access/debugBypass.ts:51`)

Hardcoded `return true` during the spine team's Phase 1–3 build.
**Spine team is flipping it themselves** per operator note 2026-05-10.
Affects only the 3 debug endpoints (`/api/access/{inspect,whoami,
list-assets}`) — real content + purchase + persona flows are still
strict. `verify-spine.mjs` re-run with strict auth + JWT is a follow-up
once the flip lands.

### 3. The `'acquire'` action class proposal

Filed as QubeTalk packet
`docs/qubetalk-bridge/outbox/claude-code-spine-acquire-action-class-2026-05-10T07-25-17Z.json`
for the spine team. The current B.2 pattern emits a sync receipt
post-grant with action `'payment-settle'` and `reason='owned'` — works
end-to-end but semantically awkward. The proposed `'acquire'` action
gives the spine a buyer-paying-now branch that returns
`reason='acquiring'` (new) and skips the ownership check. Not blocking
v1; cleaner long-term.

### 4. The `policyResolvers.ts:53` typo

Filed as QubeTalk packet
`claude-code-spine-policyresolvers-line53-2026-05-10T05-32-10Z.json`.
Both ternary branches return `'async'`. Spine-team's call.

### 5. Marketa ↔ KNYT cross-cartridge tasks

Filed as
`2026-05-10_marketa-knyt-cross-cartridge-tasks-backlog.md`. Marked as
fast-follow per operator decision. Plumbing in place (`buildCodexUrl`,
`evaluateAccess` is cross-cartridge by design); needs a Marketa-side
emission point + a `cross_cartridge_rewards` registry.

### 6. Reputation decay cron

Decisions doc §13.2 — operator confirmed weekly cron, per-dimension rate
TBD. Cron stub deferred until rates land. `crm_persona_reputation` cache
TTL of 5 min (§13.3) likewise applied at consumer level when a hot read
needs invalidation; explicit cache layer not yet built.

### 7. RQH partition writes

The decisions doc §4 specifies that reputation deltas write to RQH via
`partition_id = '<cohortId>:<personaId>'`. v1 keeps the DB-level
`crm_persona_reputation` writes intact (existing `taskService` /
`rewardService` flows). The RQH-side cutover is gated on the
`source_kind` enumeration being in place server-side and on operator
confirmation that historical rows in `crm_reputation_events` (which v1
deprecated read-side but not write-side) can be archived.

---

## Acceptance criteria (decisions doc §14)

- [x] Operator reviews and approves the 13 numbered sections of the
  decisions doc
- [x] All 6 open questions in §13 have answers (locked in `6b3866b3`)
- [x] Doc registered in `codexes/packs/agentiq/collections.json`
  under `col_updates`
- [x] Doc referenced from every workstream commit's message
  (B.1 → E)
- [x] No feature code lands until decisions doc signed off
  (Phase A pause held)

---

## Smoke test gate — final run

```bash
node scripts/verify-spine.mjs --host=dev-beta.aigentz.me
```

Last run (Phase B verification): all checks PASSED. Privacy guard +
persona-owned ALLOW path were SKIPPED because the spine bypass was
live; operator note confirms spine team is flipping the bypass
themselves. Re-run with strict auth + JWT after the flip is the
follow-up to declare the workstream's spine integration "verified
under strict auth too".

---

## Files added or modified in this workstream

### Decisions docs + backlog

- `codexes/packs/agentiq/updates/2026-05-10_knyt-rep-rewards-tasks-decisions.md` (decisions, locked)
- `codexes/packs/agentiq/updates/2026-05-10_marketa-knyt-cross-cartridge-tasks-backlog.md` (fast-follow)
- `codexes/packs/agentiq/updates/2026-05-10_knyt-tasks-operationalization-backlog.md` (fast-follow — new in this commit)
- `codexes/packs/agentiq/updates/2026-05-10_knyt-rep-rewards-tasks-closure.md` (this doc)
- `docs/qubetalk-bridge/outbox/claude-code-spine-acquire-action-class-*.json`
- `docs/qubetalk-bridge/outbox/claude-code-spine-policyresolvers-line53-*.json`

### Migrations

- `supabase/migrations/20260511020000_knyt_rep_rewards_tasks_spine_bridge.sql`
- *(also pushed earlier in this branch: `20260511000000_store_skus_seed.sql`,
  `20260511010000_fix_user_entitlements_fk.sql` — predate this workstream
  but landed alongside it)*

### Routes

- `app/api/wallet/tasks/route.ts` — spine-conformed (B.1)
- `app/api/purchase/complete/route.ts` — spine-conformed + post-grant receipt (B.2)
- `app/api/wallet/knyt/paypal/recover/route.ts` — batch receipt added (B.3)
- `app/api/wallet/knyt/rewards/redeem/route.ts` — new (D)

### UI

- `app/components/content/SmartWalletDrawer.tsx` — Claim button + redeem handler (D)
- `app/triad/components/codex/tabs/KnytTab.tsx` — QuestRail data fetch + claim wire-up (E)
- `app/triad/components/content/ContentPurchaseModal.tsx` — `credentials: 'include'` (B.2)

### Tests

- `tests/access-spine-rewards.test.ts` — canary (F.1)

---

## Next workstream branch

**Operationalisation of task flows** is the natural next branch. See
`2026-05-10_knyt-tasks-operationalization-backlog.md`. Recommended
scope for that branch:

1. Bring-a-Knight: hook `Share Invite Link` button to the actual share
   flow (referral code generation, `/api/share/track-click` emission,
   conversion tracking → reward grant)
2. Knight-of-Attention: tie episode completion events to
   `engagementService.recordEpisodeComplete` → reward grant chain
3. Herald-of-the-Order: same shape as Bring-a-Knight + share-attribution
   click tracking
4. Living Canon: deep-link from wallet card → 21 Sats tab → file the
   submission/vote/dispatch flow → reward grant chain on operator
   review accept

All four chains terminate in a `crm_rewards` row with status `'approved'`
which the existing `/api/wallet/knyt/rewards/redeem` endpoint redeems
through the spine. The chains themselves don't need new spine surface
area — they reuse what v1 shipped.
