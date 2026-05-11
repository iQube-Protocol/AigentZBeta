# KNYT v2 Polish — Final Two Items Closed

**Date:** 2026-05-11
**Status:** Items #2 and #3 from the KNYT rep/rewards/tasks v2-polish handoff are now closed. Bring-a-Knight + Living Canon deep-link + viewer episode-complete loop is fully end-to-end.
**Predecessors:**
- `2026-05-10_knyt-rep-rewards-tasks-closure.md` (KNYT v1 + v2 ops kickoff)
- `2026-05-10_knyt-tasks-operationalization-backlog.md` (v2 polish remaining items)

---

## What this commit closes

The KNYT agent shipped 3 of 4 v2-polish items in `8c14760a` and filed two
follow-ups for context-budget reasons. This commit closes both:

| Item | Status before | Status after |
|---|---|---|
| #3 Viewer-side episode-complete fire | filed (deferred) | ✅ closed (this commit) |
| #2 21 Sats tab `__knytPendingTaskSlug` consumer | half-closed (parked) | ✅ closed (this commit) |

---

## #3 — Viewer-side episode-complete fire

### Pattern

The viewers (`PDFPageViewer`, `VideoPlayer`) gain an optional `onComplete?: () => void` prop. They fire it once when the user has fully consumed the content. The viewers never know the episode-id format — that decoupling was the format-coupling risk the v2 agent flagged. The caller decides what to do.

`KnytTab` adds a `fireEpisodeComplete(episodeId)` helper that POSTs to the existing `/api/engagement/episode-progress` endpoint with `{ episodeId, eventType: 'completed', progressPercent: 100 }`. The endpoint is spine-conformant — persona resolved via `getActivePersona`, `engagementService.recordEngagement` creates an `engagement_events` row, and on first qualifying completion creates a `crm_rewards` row with `status='approved'` (per Phase D).

### Episode ID derivation

| Viewer | episodeId source |
|---|---|
| `PDFPageViewer` | `currentPdfCid` — the cid is stable per content asset |
| `VideoPlayer` | `currentVideoSegments[0]?.auto_drive_cid ?? currentVideoCid` — the FIRST segment's cid is the stable anchor for multi-segment episodes; for single-segment content the current cid is the anchor |

Idempotency: `engagementService` dedupes via `(personaId, episode_id)` — the dedupe key is the `crm_rewards.source_event_id` (= episodeId) — so re-firing on a re-open is safe.

### What's NOT covered

`PDFLiteReaderModal` (the iframe/object-based fast-preview reader used when `pdf_lite_url` is present) is intentionally skipped. iframe and `<object>`-rendered PDFs don't expose a "last page reached" signal to the parent without invasive postMessage wiring. The page-by-page `PDFPageViewer` and the `VideoPlayer` cover all receipt-eligible completion paths; the lite reader is a fast preview surface where engagement signal is best captured by other means (time-on-page, exit, etc.) if needed in a future phase.

### Files modified

| File | Change |
|---|---|
| `app/triad/components/content/PDFPageViewer.tsx` | adds `onComplete?: () => void` prop; fires once when `currentPage === meta.pages` via `completionFiredRef` guard; resets on cid change |
| `app/triad/components/content/VideoPlayer.tsx` | adds `onComplete?: () => void` prop; existing `onEnded` handler now branches — if `canGoNext` advance segment, else fire `onComplete` once |
| `app/triad/components/codex/tabs/KnytTab.tsx` | adds `fireEpisodeComplete(episodeId)` helper near other viewer state; passes `onComplete` to both viewers with the appropriate anchor cid |

---

## #2 — 21 Sats tab `__knytPendingTaskSlug` consumer

### Pattern

The wallet drawer's tasks tab parks `taskSlug` on `window.__knytPendingTaskSlug` before navigating to `living-canon` (the 21 Sats tab in KnytTab). The `KnytLivingCanonTemplate` now reads + clears this on mount and:

1. Switches `activeBranch` to `community` (where submissions happen)
2. Sets `submissionSlug` to `BRANCH_CONFIG.community.schemaSlug` (`"knyt:community_submission"`) so the submission shell renders open

This puts the user immediately on the surface they need to act, rather than landing on the canon-branch read view.

### Why no taskSlug → schemaSlug mapping

The taskSlug from the wallet drawer is in the task namespace (e.g. `knyt:write:living-canon-submission`). The submission shell takes a `schemaSlug` from a different namespace. The two are not 1:1 and cross-mapping is the kind of format coupling the v2 agent flagged as risky.

The conservative pattern: use the canonical community schemaSlug for now (covers all current task→submission flows). If a future task needs a different submission target, the consumer is the single point to extend.

The original taskSlug is logged in dev for telemetry; production telemetry will land when KnytTasks rep/rewards integrates the click-tracking flow already present at `POST /api/wallet/tasks/track-click`.

### Files modified

| File | Change |
|---|---|
| `app/triad/components/codex/liquidTemplates/KnytLivingCanonTemplate.tsx` | new mount-only `useEffect` that reads + clears `window.__knytPendingTaskSlug`, switches branch + opens submission shell |

---

## End-to-end loop now closed

Bring-a-Knight referral + Living Canon submission + viewer engagement reward:

1. User A opens wallet → Tasks → "Copy Share Link" → ref-code in clipboard
2. User B clicks ref-link → optional `POST /api/wallet/tasks/track-click` (Herald analytics)
3. User B signs up → `GET /api/referral/resolve-code?ref=…` → `referrerPersonaId` returned
4. Signup flow → `/api/referral/process` → records the link
5. User B's first qualifying purchase → `crm_rewards` row created `status='approved'`
6. User A opens wallet → Rewards → Claim → `/api/wallet/knyt/rewards/redeem` → `evaluateAccess('mint')` → DVN credit
7. **NEW (this commit):** User opens KNYT content → `PDFPageViewer` / `VideoPlayer` → completes → `onComplete` fires → `/api/engagement/episode-progress { eventType: 'completed' }` → `crm_rewards` row landed
8. **NEW (this commit):** Wallet drawer tasks tab → "Open in 21 Sats" → Living Canon mounts → parked taskSlug consumed → community branch + submission shell auto-open

---

## Remaining backlog (not in this commit)

Carried over from the v2 polish handoff:

- **Spine bypass flip** — already closed by spine team (commit `a829dd5` in the spine workstream); env-gated default-off
- **`'acquire'` action class** + **`policyResolvers.ts:53` typo** — QubeTalk packets filed; spine team's call
- **Reputation decay rates per dimension** — operator's call before Phase F cron deploys
- **Marketa↔KNYT cross-cartridge tasks** — separate fast-follow backlog already filed
- **Click-tracking endpoint Herald wiring** — endpoint live; analytics consumer is the next pickup

---

## Verification

After deploy:

```sql
-- Verify completion events landing
select episode_id, event_type, persona_id, created_at
from engagement_events
where event_type = 'completed'
  and created_at > now() - interval '15 minutes'
order by created_at desc limit 5;

-- Verify reward rows being created on first completion per (persona, episode)
select persona_id, source_event_id as episode_id, status, amount_qc, created_at
from crm_rewards
where source_event_id in (
  select episode_id from engagement_events
  where event_type = 'completed' and created_at > now() - interval '15 minutes'
)
order by created_at desc limit 5;
```

For #2 — open the wallet drawer's tasks tab → click a Living Canon task with `taskSlug` set → confirm the 21 Sats tab opens with the community branch active and the submission shell visible. The browser console (in dev mode) prints `[living-canon] consumed parked taskSlug <value>`.
