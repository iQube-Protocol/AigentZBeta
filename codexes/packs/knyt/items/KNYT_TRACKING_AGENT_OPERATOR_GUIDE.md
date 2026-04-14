# KNYT Tracking Agent — Operator Guide

**Audience:** Campaign operator (Marketa / admin)
**Location:** KNYT Codex → Investors & Prospects tab → Tracking / Queue / Metrics views
**Access:** Admin-gated. You must be signed in with an admin account to see these views.

---

## Overview

The KNYT Tracking Agent is a set of tools built into the Codex admin tab that gives you real-time visibility and control over the KNYT Wheel campaign. It has four parts:

| View | What it does |
|------|-------------|
| **Directory** | Browse, search, filter, and edit all investors and prospects |
| **Metrics** | 11 KPI tiles — funnel from sends through to KS backed |
| **Tracking** | Instrumentation health + full link registry with click counts |
| **Queue** | Ranked follow-up priority list, updated live by the signal steering engine |

---

## Daily operating routine

### Morning check (2 minutes)

1. Open **Metrics** view
2. Scan the top row: Total Sends → Clicks → KS Visits → KS Backed
3. If KS Backed increased overnight → go to **Directory**, filter `campaign_state = backed`, confirm names match KS dashboard
4. Open **Queue** view → note the top 5 investors by priority score
5. Take action on anyone with score ≥ 80 (personal outreach within 24 h)

### After a batch send

1. Open **Metrics** — refresh — confirm Total Sends incremented
2. Check **Tracking** → all-time clicks counter baseline
3. Return to **Metrics** after 2 hours to see opens/clicks starting to flow in (requires Make.com write-back to be configured)

---

## Directory view

### Filters

| Filter row | Options | How to use |
|------------|---------|------------|
| Activation | All / Activated / Inactive | "Activated" = has signed in to the app |
| Cohort | top_shelf / zero_knyt / reactivation / partner / cold / unassigned | Filter before bulk assign |
| Band | <500 / 500–1999 / 2000–4999 / 5000+ / unassigned | Find high-value investors for personal outreach |
| Search | Name, email, KNYT-ID | Find a specific person |
| Sort | OM Tier / Invested ↓ / Name / Activated first | Default is OM Tier |

### Tagging a cohort (before first send)

1. Use Band filter to select a segment (e.g., `5000+`)
2. Use Cohort filter to confirm they are `unassigned`
3. Click the checkbox at the top of the table to select all on the page
4. In the bulk toolbar: pick `top_shelf` from "Set cohort…" dropdown → click **Apply**
5. Repeat for the next page if there are more than 100
6. Switch to `2000-4999` band → assign `top_shelf` or `zero_knyt` as appropriate
7. Lower bands → `cold` or `reactivation`

### Sending a sequence

1. Select the investors you want to send to (use Cohort filter to isolate a group)
2. Click **Send Sequence** in the bulk toolbar
3. Pick the sequence: `knyt_top_shelf_v1` / `knyt_zero_v1` / `knyt_reactivation_v1` / `knyt_general_v1`
4. Pick channel: `email` (default for launch)
5. Click Send — this fires the Make.com webhook with all recipient details
6. Confirm in Make.com scenario history that the scenario triggered

> **Prerequisite:** `KNYT_WHEEL_WEBHOOK_URL` must be set in Amplify env vars. If it's missing the dispatch is logged but not sent, and the API returns a `warning` field.

### Editing a single investor

Click the pencil icon on any row to open the inline edit panel. Fields:

| Field | What to change |
|-------|---------------|
| Campaign cohort | Re-tag if their offer fit changes |
| Campaign state | Manually advance if needed (e.g., mark as backed after CSV import) |
| Campaign notes | Free text — record call outcomes, objections, context |
| Preferred channel | Override if you know they prefer SMS or Telegram |

### Adding a new prospect or KS backer

Click **Add Prospect** (top left of Directory view). Fill in name, email, cohort, and source (e.g., `ks_backer`). This creates a row in `nakamoto_knyt_personas` immediately. They can be bulk-dispatched as soon as their cohort is tagged.

---

## Metrics view

Refresh button top-right. Metrics are live from the database.

| Tile | Source | Notes |
|------|--------|-------|
| Total Sends | `last_campaign_sent_at IS NOT NULL` | Incremented by dispatch |
| Opens | Make.com write-back | Shows 0 until webhook write-back is wired |
| Clicks | `campaign_state IN ('clicked','backed')` | KS link clicks tracked end-to-end |
| KS Visits | `kickstarter_clicked_at IS NOT NULL` | Set by `/api/crm/track/ks` redirect |
| KS Backed | `kickstarter_backed_at IS NOT NULL` | Set manually or by backer sync script |
| Top Shelf Conv. | Cohort = top_shelf AND backed | |
| Zero KNYT Conv. | Cohort = zero_knyt AND backed | |
| Slots Remaining | 500 minus backed count | Hard cap of 500 campaign slots |
| Reactivated | Cohort = reactivation AND activated | Signed-in reactivations |
| Shares | 0 — Phase 2 (social tracking) | |
| Runtime Follow-ups | 0 — Phase 2 (runtime event tracking) | |

---

## Tracking view

### Health panel

Four status cards show whether the critical env vars are configured:

| Card | Env var checked | Action if "Not set" |
|------|----------------|---------------------|
| KS URL | `NEXT_PUBLIC_KS_URL` / `KICKSTARTER_CAMPAIGN_URL` | Add to Amplify → redeploy |
| Make Webhook | `KNYT_WHEEL_WEBHOOK_URL` | Add to Amplify → redeploy |
| GA4 | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Optional — add when ready |
| Meta CAPI | `META_PIXEL_ID` | Optional — add when ready |

Two click counters: **Clicks today** and **All-time clicks** — both live from the `knyt_tracking_click_events` table. **Last click** shows the most recent event timestamp.

### Link registry table

28 canonical tracking links — 4 investor cohort, 19 partner, 5 surface. Each row shows:
- Tag name (the `utm_content` value)
- Channel
- Owner type / name
- Click count (denormalised counter — fast read)
- Full redirect URL — click **Copy** to grab it

**Regenerate Pack** button re-upserts all 28 links from the canonical seed. Safe to run at any time — uses `ON CONFLICT DO NOTHING` so existing click counts are preserved.

### How a KS click is tracked

```
Investor clicks link in email
         ↓
/api/crm/track/ks?uid=<nakamoto_id>&utm_source=knyt_wheel&utm_medium=email&utm_content=<cohort>
         ↓
Sets kickstarter_clicked_at on nakamoto_knyt_personas row
Logs row in knyt_tracking_click_events
Increments click_count on knyt_tracking_link_registry
         ↓ (fire-and-forget)
GA4 event  |  Meta CAPI event  (when env vars are set)
         ↓
302 redirect → Kickstarter campaign URL
```

Total time before redirect: < 50 ms (all tracking is non-blocking).

---

## Queue view

The follow-up priority queue is the most actionable view during an active campaign.

### How scores are computed

| Signal | Base score |
|--------|-----------|
| Clicked KS link | 60 |
| Opened email | 35 |
| Email bounced | 5 (logged; not queued) |

Bonuses added on top:

| Condition | Bonus |
|-----------|-------|
| Investor has activated (signed in) | +15 |
| Investment band 5000+ | +20 |
| Investment band 2000–4999 | +12 |
| Investment band 500–1999 | +6 |

Maximum score: 100. A top-shelf investor who clicks and is activated = 60 + 20 + 15 = 95.

### Queue columns

| Column | Meaning |
|--------|---------|
| Name / Email | Who to follow up with |
| Type | investor or partner |
| State | Their current campaign_state |
| Score | Urgency score (higher = follow up sooner) |
| Next Action | Recommended action (e.g., "Personal follow-up within 24 h") |
| Channel | Recommended channel |

### When does the queue update?

- **Automatically** — every time Make.com fires an open/click write-back to `/api/crm/webhooks/marketa`, the signal steering engine updates that investor's queue entry in real time.
- **On demand** — click **Recompute Queue** to rescore all investors and partners from scratch (useful after bulk cohort assignments or a CSV import).

### Removing someone from the queue

Investors who back (`campaign_state = backed`) or unsubscribe (`opted_out`) are automatically removed from the queue by the steering engine. No manual action needed.

---

## Make.com configuration (operator must complete)

### Scenario 1 — KNYT Wheel Dispatch receiver

Trigger: Webhook (custom)
URL: Set as `KNYT_WHEEL_WEBHOOK_URL` in Amplify

Filter on `type = knyt_wheel_dispatch`, then route by `sequence_id`:
- `knyt_top_shelf_v1` → send Top Shelf email template to `recipients[]`
- `knyt_zero_v1` → send Zero KNYT email template
- `knyt_reactivation_v1` → send Reactivation template
- `knyt_general_v1` → send General template

Each recipient in `recipients[]` has: `id, name, email, cohort, investment_band, is_activated, ks_tracking_url`.
Use `ks_tracking_url` as the email CTA button href — it is already personalised.

### Scenario 2 — Write-back (after send/open/click)

After each email event, POST to `/api/crm/webhooks/marketa`:
```json
{
  "event":       "opened",
  "investor_id": "{{recipient.id}}",
  "sequence_id": "{{sequence_id}}",
  "channel":     "email"
}
```

Set header: `Authorization: Bearer <MARKETA_WEBHOOK_SECRET>`

The webhook advances `campaign_state` and triggers the signal steering engine automatically.

---

## Env vars quick reference

| Variable | Where to set | Used for |
|----------|-------------|---------|
| `KNYT_WHEEL_WEBHOOK_URL` | Amplify | Make.com dispatch receiver webhook URL |
| `MARKETA_WEBHOOK_SECRET` | Amplify + Make.com HTTP header | Authenticate write-back events |
| `KICKSTARTER_CAMPAIGN_URL` | Amplify | Final redirect destination for all KS tracking links |
| `NEXT_PUBLIC_APP_URL` | Amplify | Base URL for tracking link generation (already set) |
| `NEXT_PUBLIC_KS_URL` | Amplify | Public-facing KS URL (same as KICKSTARTER_CAMPAIGN_URL) |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Amplify | GA4 tracking (Phase 2) |
| `GA4_API_SECRET` | Amplify | GA4 server-side events (Phase 2) |
| `META_PIXEL_ID` | Amplify | Meta CAPI (Phase 2) |
| `META_CAPI_TOKEN` | Amplify | Meta CAPI server events (Phase 2) |
