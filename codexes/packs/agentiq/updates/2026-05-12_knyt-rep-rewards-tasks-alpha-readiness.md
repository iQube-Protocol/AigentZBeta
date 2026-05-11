# KNYT Tasks & Reputation — Alpha-Readiness Audit

**Date filed:** 2026-05-12
**Workstream:** KNYT rep/rewards/tasks (closure of v2 + alpha-readiness audit)
**Severity:** **Ready for alpha live-user testing** with the gaps below acknowledged + tracked
**Status:** v1 + v2 closed; admin surface live; canary suites green; end-to-end paths bridged

---

## Workstream status — what shipped today

| Phase | Status | Closing commit | Notes |
|---|---|---|---|
| **v1 (Phases A–F)** | ✅ closed 2026-05-10 | `closure doc` | Spine receipts, schema bridge, redeem endpoint, QuestRail HUD, canary tests |
| **v2 ops kickoff** | ✅ closed 2026-05-10 | various | Share-link endpoint, click-tracking, referral codes index, Living Canon wiring |
| **Phase 1 — viewer-side episode-complete** | ✅ verified | (pre-existing) | KnytTab already wires PDFPageViewer.onComplete + VideoPlayer.onComplete → /api/engagement/episode-progress |
| **Phase 2 — bridge reward_grants → crm_rewards + spine OrchestrationEvent** | ✅ shipped | `a18efecb` | Closes the broken grant→display loop for 3 of 4 task families |
| **Phase 3 — admin Tasks & Rewards tab** | ✅ shipped | `ed2dae09` | Live CRUD over crm_task_templates with aggregates from crm_rewards |
| **Phase 4 — privacy-guard test extension** | ✅ shipped | `6849d738` | New endpoints + admin PATCH allowlist + bridge receipt canary |
| **Phase 5 — E2E shape-contract tests** | ✅ shipped | `7783067f` | 4-family suite + cross-family invariants |
| **Phase 6 — alpha-readiness audit** | this doc | | Below |

---

## End-to-end integration map

The full grant→display→claim→on-chain flow now connects, for each of the four families:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TRIGGER                                                                 │
│  Bring-a-Knight   : POST /api/referral/process (qualified purchase)     │
│  Knight-of-Attention : POST /api/engagement/episode-progress (completed)│
│  Herald-of-the-Order  : POST /api/wallet/tasks/track-click → aggregates │
│  Living Canon       : POST /api/codex/knyt/living-canon/review (accept) │
├─────────────────────────────────────────────────────────────────────────┤
│ GRANT SERVICE                                                           │
│  rewardService.grantRewardForTask() OR living-canon/review route        │
│   → INSERT reward_grants (or knyt_reward_grants for Living Canon)       │
│   → bridgeGrantToCrmRewards()                                           │
│       ↓                                                                 │
│      INSERT orchestration_events  ← T2 alias commitment + cohort_id     │
│      INSERT crm_rewards            ← status='approved', source_event_id │
├─────────────────────────────────────────────────────────────────────────┤
│ DISPLAY                                                                 │
│  Wallet Tasks tab           ← GET /api/wallet/tasks (reads crm_rewards) │
│  Order tab QuestRail HUD    ← same endpoint                             │
│  Admin Tasks & Rewards tab  ← GET /api/admin/knyt/tasks-rewards         │
├─────────────────────────────────────────────────────────────────────────┤
│ CLAIM                                                                   │
│  User clicks Claim          → POST /api/wallet/knyt/rewards/redeem      │
│   → evaluateAccess(persona, descriptor, 'mint')  ← FIO-required gate    │
│   → creditKnyt(personaId, amount, 'reward', {...})  ← DVN ledger        │
│   → UPDATE crm_rewards.status='redeemed', claim_id={...}                │
├─────────────────────────────────────────────────────────────────────────┤
│ CARTRIDGES + CRM                                                        │
│  21 Sats (Living Canon)  : KnytLivingCanonTemplate reads crm_contribs   │
│  Community               : knyt_publication_states + crm_contributions  │
│  CRM dashboards          : crm_persona_reputation cache (RQH per cohort)│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Spine ↔ wallet ↔ cartridge ↔ 21 Sats ↔ community ↔ CRM integration verification

| System | Read path (display) | Write path (grant/claim) | Status |
|---|---|---|---|
| **Spine receipts** | — | `orchestration_events` (T2 alias + cohort_id) on grant via `bridgeGrantToCrmRewards`; on claim via `evaluateAccess('mint')` | ✅ Both paths emit canonical receipts |
| **Wallet (Tasks tab)** | `/api/wallet/tasks` reads `crm_rewards` | `/api/wallet/knyt/rewards/redeem` flips status | ✅ Connected to live data |
| **Wallet (HUD QuestRail)** | Same `/api/wallet/tasks` | Same redeem endpoint | ✅ Same data plane |
| **KNYT cartridge — Codex/Store/Order** | n/a (display only) | n/a | ✅ Unaffected by tasks workstream |
| **KNYT cartridge — 21 Sats** | `KnytLivingCanonTemplate` reads `/api/codex/knyt/living-canon` | `/api/codex/knyt/living-canon/contribute` + `/review` — review now bridges to crm_rewards | ✅ Closed loop |
| **KNYT cartridge — Community Content** | `KnytCommunityContentTab` | `KnytCommunityContentAdminTab` (promotion queue) | ✅ Pre-existing; unaffected |
| **CRM** | `/api/wallet/tasks` reads `crm_persona_reputation` cache | `taskService.approveContribution` updates reputation deltas | ✅ Reputation vector flows |
| **DVN balance** | `useKnytBalance` reads from wallet ledger | `creditKnyt` on redeem | ✅ Same path as direct credits |
| **Admin surface** | New `KnytTasksRewardsAdminTab` | New `/api/admin/knyt/tasks-rewards` PATCH | ✅ Shipped this session |

---

## Alpha checks + balances — recommended for live user testing

### 1. Anti-abuse / fairness

| Concern | Current state | Mitigation in place? |
|---|---|---|
| **Same-persona repeat-claiming on one episode** | `engagementService.hasEpisodeReward` checks reward_grants for the (persona, episode) pair before granting | ✅ Yes |
| **Same-persona repeat-claiming on one referral** | `referralService` deduplicates by `referred_persona_id` (one reward per unique referred persona) | ✅ Yes |
| **Multi-account abuse (persona farms)** | The FIO-handle gate on `mint` requires a registered FIO handle for redemption — raises the cost of fake-account farming | ⚠️ Partial — depends on FIO handle scarcity. **Recommend:** alpha cap of 50 KNYT lifetime per persona until handle issuance is rate-limited |
| **Click farming (Herald)** | `referral_clicks` table is append-only; tier rewards (10 unique clicks / 7 days) require IP-distinct + UA-distinct clicks at aggregation time | ⚠️ The current aggregation isn't implemented yet — Herald clicks accrue but the qualified-click count → reward step is a follow-up |
| **Reward-amount inflation by admin** | The Tasks & Rewards admin tab emits `orchestration_events` for every edit + locks the patch allowlist to (reward_knyt, is_active, title, description, reward_qct, reward_qoyn) | ✅ Audit trail in place |
| **Cohort-id tampering** | Admin PATCH allowlist explicitly excludes `cohort_id`, `slug`, `tenant_id`, `schema_json`, `metadata` (asserted by the privacy canary suite) | ✅ Enforced |

### 2. Rate limits

| Endpoint | Current limit | Recommendation for alpha |
|---|---|---|
| `/api/wallet/tasks/share-link` | None | **Add:** 30/hour/persona (the endpoint is idempotent — same secret + same persona → same code — so the limit only matters for distinguishing personas) |
| `/api/wallet/tasks/track-click` | None | **Add:** 10/min/IP (the endpoint is public — no auth — and writes to `referral_clicks`. Without a limit a malicious referrer could inflate their click count) |
| `/api/referral/resolve-code` | None | **Add:** 5/min/IP (rate limit to deter ref-code enumeration) |
| `/api/wallet/knyt/rewards/redeem` | FIO gate + per-reward idempotency | ✅ Sufficient for alpha (the FIO check + single-row UPDATE makes brute-force pointless) |
| `/api/engagement/episode-progress` | `hasEpisodeReward` dedup | ✅ Sufficient for alpha (the dedup prevents farming + the viewer fires once per episode) |
| `/api/admin/knyt/tasks-rewards` | Admin-only flag | ✅ Sufficient — admin role is rate-limited by Supabase auth |

### 3. Supply caps

| Family | Per-period cap | Lifetime cap | Status |
|---|---|---|---|
| Bring-a-Knight | None | None | **Recommend:** 100 referrals/persona/year |
| Knight-of-Attention | 14 episodes/week (weekly_streak threshold) | None | ✅ Implicit cap via available episode count |
| Herald-of-the-Order | None | None | **Recommend:** soft cap once Herald aggregation lands |
| Living Canon | None (operator-gated via approve flow) | None | ✅ Editor approval is the cap |

The `REWARD_CAPS` table in `services/rewards/rewardService.ts` already has slots for per-period caps — they just need to be populated. Operator decision before alpha launch: set `BringAKnightQualifiedReferral` to `{ maxPerPeriod: 100, periodDays: 365 }` to limit referral farms.

### 4. Observability

| Signal | Source | Status |
|---|---|---|
| **Reward grants** | `orchestration_events` rows with `event_type='reward.grant'` | ✅ Live — queryable by time + cohort + alias |
| **Admin edits** | `orchestration_events` rows with `event_type='admin.task-template-edit'` | ✅ Live |
| **Redemptions** | `orchestration_events` rows from `evaluateAccess('mint')` | ✅ Live |
| **Failed redemptions** | Caught by route handler, returns 4xx — but not logged to orchestration_events | ⚠️ **Recommend:** log denied redemptions for the abuse-pattern view |
| **CloudWatch alerts** | None yet | **Recommend:** add a CloudWatch metric on `orchestration_events` insert rate per (event_type, cohort_id) — a spike in `reward.grant` for one cohort could indicate farming |
| **Per-persona reward total** | Derivable from `crm_rewards` aggregate per `persona_id` | ⚠️ No alerting on outliers — recommend a daily query to surface top-10 grantees + flag if any exceed the recommended cap |

### 5. Backup / restore

| Data class | Backup strategy | Status |
|---|---|---|
| `crm_rewards` | Supabase daily backup + PITR (point-in-time recovery) | ✅ Inherited from Supabase tier |
| `reward_grants` / `knyt_reward_grants` | Same | ✅ |
| `orchestration_events` | Same — receipt batcher snapshots to DVN periodically | ✅ Anchored on-chain via batcher |
| `crm_task_templates` | Same — seeded via migration | ✅ Restorable via migration replay |
| `referral_codes` | Same | ✅ |

---

## Outstanding follow-ups (non-blocking for alpha)

1. **Herald-of-the-Order click aggregation** — the `referral_clicks` table accrues rows but the rule `10 unique clicks / 7 days → +0.25 KNYT` isn't yet implemented as a cron / aggregation query. Today's grant path for Herald is dormant; the wallet shows the chip + share link works, but no rewards are emitted until aggregation lands. **Estimated: 1 commit (services/rewards/heraldAggregationService.ts + nightly cron).**

2. **Reputation cron + decay rates** — the `crm_persona_reputation` cache (5-min TTL per /api/wallet/tasks) is populated on read but the decay-over-time cron is stubbed pending rates operator decision. Per closure doc note. **Estimated: 1 commit once rates land.**

3. **Marketa ↔ KNYT cross-cartridge tasks** — separate workstream (`2026-05-10_marketa-knyt-cross-cartridge-tasks-backlog.md`). Not part of v2 closure; tracked independently. Adds Marketa-side emission point + cross-cartridge reward registry.

4. **`verify-spine.mjs` strict-auth verification** — the spine bypass was flipped in commit `a829dd53`; need to re-run `node scripts/verify-spine.mjs --host=dev-beta.aigentz.me` against a clean session to confirm all checks still pass under strict auth. **Estimated: 0 commits (operator action).**

5. **Per-persona admin drill-down** — the admin Tasks & Rewards tab shows aggregates only. Drill-down to per-persona reward history (with audit-only T0 surface) is a future enhancement gated on a stricter admin role.

6. **Anti-abuse caps (item 3 in §1 above)** — recommend populating `REWARD_CAPS` in `services/rewards/rewardService.ts` with the operator's per-family cap decisions before alpha launch.

7. **Rate limits (§2)** — recommend adding edge middleware (or per-route limiter) for the 3 listed endpoints before alpha launch.

8. **CloudWatch alerts (§4)** — recommend dashboards + alerts before scaling beyond alpha.

---

## Alpha launch checklist

Before the first wave of live users:

- [ ] Operator runs `node scripts/verify-spine.mjs --host=dev-beta.aigentz.me --personaId=<test> --owned=<asset> --txGuard=<asset>` and confirms all checks green (item 4 above).
- [ ] Operator decides + populates `REWARD_CAPS` entries for at least `BringAKnightQualifiedReferral` (recommend 100/year/persona) and `HeraldConversionPayingUser` (recommend 50/year/persona).
- [ ] Rate limits added to the 3 public-ish endpoints (item 7).
- [ ] CloudWatch alarm: alert if `orchestration_events` insert rate for `event_type='reward.grant'` in any rolling 1-hour window exceeds 1000 (item 8).
- [ ] Smoke test: operator persona shares a BaK link, a fresh test persona signs up via the link, makes a small qualifying purchase, original persona's wallet Tasks tab shows `+2 KNYT (approved)`, Claim succeeds, DVN balance reflects.
- [ ] Smoke test: operator persona completes a KNYT episode end-to-end (page-by-page PDF or video end), wallet Tasks tab shows `+0.5 KNYT (approved)`, Claim succeeds.
- [ ] Smoke test: operator persona submits a Living Canon contribution via /21 Sats/community, second admin persona approves it, original persona's wallet shows `+0.5 KNYT (approved)`.
- [ ] Smoke test: admin persona edits a reward amount via Tasks & Rewards Admin tab, refreshes Tasks tab → new grants reflect new amount (existing approved rewards unchanged).
- [ ] Smoke test: admin persona disables a task template → subsequent triggers do NOT grant rewards; previously approved rewards remain claimable.
- [ ] Smoke test: thin-client shell `metame:cartridge-closed` ping correctly closes the iframe via `/triad/embed/codex-closed` route.
- [ ] Documentation review: confirm the security-backlog `personaId` carve-out report (`2026-05-12_security-backlog-personaId-hint-carveout.md`) is read by the security review owner before any cross-frame data is shared with Lovable's production shell.

---

## References

- **v1 closure:** `2026-05-10_knyt-rep-rewards-tasks-closure.md`
- **v1 decisions:** `2026-05-10_knyt-rep-rewards-tasks-decisions.md`
- **v2 operationalization backlog:** `2026-05-10_knyt-tasks-operationalization-backlog.md`
- **Marketa fast-follow:** `2026-05-10_marketa-knyt-cross-cartridge-tasks-backlog.md`
- **Spine integration brief:** `2026-05-09_spine-integration-brief-knyt-rep-rewards-tasks.md`
- **Security backlog (personaId hint):** `2026-05-12_security-backlog-personaId-hint-carveout.md`
- **Lovable thin-client brief + addendum:** `2026-05-12_lovable-thin-client-metame-protocol-brief.md` + `-addendum-v1.md`

### Code references

- `services/rewards/grantToCrmRewardsBridge.ts` — the new bridge helper (Phase 2)
- `services/rewards/rewardService.ts` — `grantRewardForTask` (now invokes the bridge)
- `services/rewards/engagementService.ts` — KoA episode-complete path
- `services/rewards/referralService.ts` — BaK qualified-referral path
- `app/api/codex/knyt/living-canon/review/route.ts` — Living Canon approve path (now invokes the bridge)
- `app/api/admin/knyt/tasks-rewards/route.ts` — admin CRUD (new this session)
- `app/triad/components/codex/tabs/KnytTasksRewardsAdminTab.tsx` — admin UI (new this session)
- `tests/access-spine-rewards.test.ts` — privacy canary (extended Phase 4)
- `tests/knyt-task-chains-e2e.test.ts` — E2E shape contract (new Phase 5)
- `app/api/wallet/tasks/route.ts` — wallet read path
- `app/api/wallet/knyt/rewards/redeem/route.ts` — spine-mediated redemption
