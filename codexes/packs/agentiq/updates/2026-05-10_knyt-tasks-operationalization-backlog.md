# Backlog — Operationalize KNYT tasks (deep links → real share/track/grant flows)

**Date filed:** 2026-05-10
**Workstream:** KNYT rep/rewards/tasks v2 (fast follow-up to the v1 closure shipped 2026-05-10)
**Severity:** medium-high (tasks are visible in the wallet UI but don't yet drive real attribution / track / reward flows; users can claim earned rewards but the supply of rewards is gated on the chains below being live)
**Discovered by:** Operator review at v1 closure 2026-05-10
**Closure doc:** `2026-05-10_knyt-rep-rewards-tasks-closure.md`

---

## Context

v1 of the rep/rewards/tasks workstream landed:

- The wallet Tasks tab showing real KNYT tasks (3 General families + 3 Living Canon families)
- Spine-mediated reward redemption end-to-end (`/api/wallet/knyt/rewards/redeem` → `evaluateAccess('mint')` → DVN credit)
- The Order tab right-HUD QuestRail wired to live `/api/wallet/tasks` data
- Privacy contract enforced (T0 stripped from JSON; receipts attribute via T2 alias commitments)

**What's NOT yet operationalised:** the task UI surfaces show task cards with deep-link buttons (Share Invite Link, Open Codex Scrolls, etc.) but **clicking them today fires `knyt:navigate-tab` events that just navigate the user to a different tab** — they don't actually:

- Generate per-persona share links with referral attribution
- Track outbound shares + clicks + conversions
- Tie episode completions to the Knight-of-Attention streak engine
- Deep-link Living Canon cards into the 21 Sats tab's specific submission / vote / dispatch surfaces
- Emit OrchestrationEvents on task progression (only on redemption, post-grant)
- Create `crm_rewards` rows on qualified events (referral converts, episode completes, etc.)

So the wallet UI shows "Bring a Knight: +2 KNYT per referral" and the user can click "Share Invite Link", but the share doesn't track and no reward is ever granted. The redemption path works (we tested it) but the supply of redeemable rewards is gated on the operationalisation work below.

---

## Per-task scope

### 1. Bring-a-Knight — referral attribution

| Step | Today | Operationalised |
|---|---|---|
| User clicks "Share Invite Link" | Fires `knyt:navigate-tab` to a 'referral' tab that doesn't exist | Generate a per-persona referral code; copy a deep-link `https://dev-beta.aigentz.me/?ref=<code>` to clipboard + share-sheet |
| Friend clicks the link | n/a | Server records `referral_clicks` row with `ref_code` + UTM context |
| Friend signs up | n/a | `personas.referred_by_persona_id` populated via `ref_code` lookup at signup |
| Friend makes first qualifying purchase | n/a | `referralService.creditQualifiedReferral` fires → `crm_rewards` row with `status='approved'` and `task_template_id='knyt:bring-a-knight'` |
| Original user redeems | Already works (Phase D) | (no change) |

Existing services: `services/rewards/referralService.ts` already has the partial logic; needs UI wiring + share-link generation + click-tracking endpoint.

**Spine integration point:** the qualified-referral grant emits an OrchestrationEvent via `evaluateAccess(persona, descriptor, 'invoke')` per decisions doc §3 (eligibility checks → async-batched). When the user later redeems, the `'mint'` action fires the sync receipt.

### 2. Knight-of-Attention — episode completion + streaks

| Step | Today | Operationalised |
|---|---|---|
| User opens an episode | Already tracked client-side | Fire `engagementService.recordEpisodeOpen(personaId, episodeId)` server-side |
| User completes (scrolls to end / video reaches X% / N-min spent) | n/a | `engagementService.recordEpisodeComplete` → check streak (2 episodes/week target) → `crm_rewards` row(s) for episode + streak bonus |
| Streak updated | n/a | Update `weekly_engagement_streaks` table; surface in Reputation tab |

Existing services: `services/rewards/engagementService.ts` has the primitives; needs the client → server emission + streak detection cron.

**Spine integration point:** episode-complete emission goes through `evaluateAccess('invoke')` for the audit trail; reward grants bundle in via the same Phase A → C lifecycle.

### 3. Herald-of-the-Order — share attribution chain

Same shape as Bring-a-Knight but differentiates by:
- Click tracking (`HeraldCuriosityClicks` reward type)
- Signup tracking (`HeraldAudienceSignups`)
- Conversion tracking (`HeraldConversionPayingUser`)

Reuses the same `referral_clicks` table (or a sibling `share_clicks`) but with a different `source_task` field.

### 4. Living Canon — deep-link to 21 Sats tab

| Card | Today | Operationalised |
|---|---|---|
| "Vote on open elections" | Navigates to 21 Sats tab | Land directly on the active election's vote surface; pre-select the user's persona; emit OrchestrationEvent on submit |
| "Submit community contribution" | Navigates to 21 Sats tab | Land on the contribution form; pre-fill author from active persona; on accept, route through `services/crm/taskService.completeTask` → `crm_rewards` |
| "File Correspondent dispatch" | Navigates to 21 Sats tab | Same shape as community contribution but for correspondent-tier templates |

Existing API: `/api/codex/knyt/living-canon/{contribute,review}` already wires the contribution + reward-on-accept logic. What's missing is the UI deep-link from the wallet Tasks card → the specific 21 Sats surface.

`buildCodexUrl('knyt-codex', { tab: '21-sats', subTab: '<vote|contribute|dispatch>', personaSessionToken })` is the canonical link shape per CLAUDE.md inter-cartridge nav rule.

---

## Cross-cutting work

- **Click-tracking endpoint** — `POST /api/wallet/tasks/track-click` accepting `{ taskSlug, refCode?, target }` and writing to a `task_click_events` table (audit trail + analytics).
- **Share-link generation** — server-side endpoint that mints per-persona referral codes (deterministic from persona id + secret + epoch so they survive without storing in DB).
- **Reward-creation chain** — every qualified event from the 4 task families terminates in a `crm_rewards` row with `status='approved'`, `cohort_id='knyt:backers'`, and `source_event_id` linking back to the OrchestrationEvent. The existing `/api/wallet/knyt/rewards/redeem` endpoint then handles redemption through the spine.

---

## Acceptance criteria

- [ ] Bring-a-Knight: end-to-end test — operator persona shares a link, a fresh test persona signs up via the link, makes a qualifying purchase, original persona's `crm_rewards` shows `+2 KNYT (status=approved)` linked to the referral, redeem flow credits DVN balance.
- [ ] Knight-of-Attention: end-to-end test — persona completes an episode, `crm_rewards` shows `+0.5 KNYT (status=approved)`. Persona completes 2 episodes in a week, streak bonus row appears.
- [ ] Herald-of-the-Order: click + signup + conversion attributions all create their respective reward rows.
- [ ] Living Canon: cards deep-link into 21 Sats tab on the right surface for each task type. Submission accept by editor creates the reward row.
- [ ] Every reward-creation step emits an OrchestrationEvent with T2 alias commitment + `cohort_id='knyt:backers'` per decisions doc §4.
- [ ] No T0 leak in any new endpoint or response — extend `tests/access-spine-rewards.test.ts` to cover the new endpoints.
- [ ] `verify-spine.mjs` passes (with strict auth + JWT once the spine bypass flip lands).

---

## Estimated scope

This is roughly 8–12 commits across the 4 task families:
- 2–3 commits for Bring-a-Knight (share link + click tracking + qualified-referral grant)
- 2 commits for Knight-of-Attention (episode complete + streak)
- 2 commits for Herald-of-the-Order (mostly reuses BaK plumbing)
- 2 commits for Living Canon deep-links (4 cards × wallet-side wiring + 21 Sats tab landing)
- 1–2 commits for the cross-cutting endpoints + tests

Each chain is independently shippable. Recommend doing Bring-a-Knight first since it's the most operator-visible (and has the existing referralService partials); Living Canon last since it depends on the 21 Sats surface state.

---

---

## v2 polish status (2026-05-10 — late session)

After the v2 ops kickoff (`1fd09fcf`), the remaining polish items were
addressed in commit `<this-commit>`:

| # | Item | Status |
|---|---|---|
| 4 | Bring-a-Knight signup-side ref-code → persona resolver | ✅ Closed: new migration `20260511030000_referral_codes_index.sql` adds `referral_codes` table; share-link endpoint upserts on every code mint; new `GET /api/referral/resolve-code?ref=<code>` returns the matching referrer for the signup flow to call `/api/referral/process` against |
| 1 | Click-tracking endpoint | ✅ Closed: new `POST /api/wallet/tasks/track-click` accepts `{ refCode, source }`, resolves the refCode → referrer via the same index, writes a `referral_clicks` row. Same migration adds the table |
| 2 | 21 Sats tab side: receiver of `taskSlug` event detail | ✅ Half-closed: `KnytTab` navigate-tab handler now reads `detail.taskSlug` and parks it on `window.__knytPendingTaskSlug` for the receiving tab to consume on mount. The 21 Sats tab side that READS the parked value is the remaining half — small, mechanical follow-up |
| 3 | Codex viewer client-side: fire `/api/engagement/episode-progress` on PDF-end / video-end | ❌ Deferred: touches `PdfPageViewer` + `VideoPlayer` shared components + has episode-id format coupling concerns. Filed for a fresh-context commit |

The `referral_codes` table is the substrate that closes the BaK loop end
to end: share-link → click attribution → signup resolution. Once a fresh
session lands the viewer-side episode-complete fire (item #3), the four
task chains are fully operationalised and v2 can close.

---

## References

- v1 closure: `2026-05-10_knyt-rep-rewards-tasks-closure.md`
- Decisions doc: `2026-05-10_knyt-rep-rewards-tasks-decisions.md`
- Predecessor plan (pre-spine): `2026-05-04_tasks-rewards-reputation-integration-plan.md`
- Existing service primitives:
  - `services/rewards/referralService.ts`
  - `services/rewards/engagementService.ts`
  - `services/rewards/rewardService.ts`
  - `services/crm/taskService.ts`
  - `app/api/codex/knyt/living-canon/contribute/route.ts`
  - `app/api/codex/knyt/living-canon/review/route.ts`
- Spine integration brief: `2026-05-09_spine-integration-brief-knyt-rep-rewards-tasks.md`
