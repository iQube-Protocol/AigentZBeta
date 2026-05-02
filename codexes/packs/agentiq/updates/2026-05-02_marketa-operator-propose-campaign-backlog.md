# Marketa: Operator/Admin Version of "Propose a Campaign" — Backlog

**Date raised:** 2026-05-02
**Status:** backlog — not yet implemented
**Operator request:** "Within the Marketa cartridge it seems the operator needs a version of the Propose a Campaign page that is in the Partners tab for operators/admins to use to Propose campaigns for Marketa to run. Such campaigns need to be able to be configured into the cohort pipeline so we can get Marketa to send an activation email out to our investor base and m[ore]"

## Scope

Today the **Partners** tab in the Marketa cartridge exposes a "Propose a Campaign" surface for partner accounts (external creators / collaborators) to submit campaign requests. The operator (admin) does not have an equivalent surface — they can only see and approve partner submissions, not author them directly.

**Goal**: give the operator/admin a parallel "Propose a Campaign" form that:

1. Authors a campaign with the same fields available to partners
2. **Targets a cohort segment** in the existing CRM cohort pipeline (e.g. all CRM-verified investors, Zero KNYT holders, KS backers, etc.)
3. Schedules Marketa to send the activation email
4. Produces sequence cards in the Marketa My Campaigns / Send Sequence views so the operator can monitor delivery

## Suggested implementation

1. **New tab or section** in the Marketa cartridge admin layer (next to "My Campaigns"): "**Operator Campaigns**" — admin-only via codex tab `adminOnly` flag
2. **Form** mirrors the Partners "Propose a Campaign" form but with three additions:
   - **Cohort selector**: dropdown over named cohort segments (registered via `services/campaign/` or a new `campaign_cohorts` table)
   - **Activation trigger**: "Send Now" / "Schedule" with date-time picker
   - **Pipeline routing**: select sequence template (e.g. "investor activation v1", "zero knyt reactivation")
3. **Backend**:
   - `POST /api/admin/marketa/campaigns/propose` — writes campaign row + sequence schedule
   - Reuses `services/campaign/adapters/mailjetAdapter.ts` (or current send adapter) for the actual delivery
   - Cohort resolution lives server-side (resolves `'crm-verified-investors'` → list of recipient persona ids at send time)
4. **Visibility**: operator-authored campaigns appear in the existing My Campaigns / Send Sequence views with an "Origin: Operator" badge so they're distinguishable from partner-proposed ones

## Cohort hookup

The operator wants Marketa to send an activation email **to the investor base** — that's a single specific cohort. The MVP cohort list to support at launch:

- `crm-investors` — all CRM-flagged investors (queries `nakamoto_knyt_personas` where `crm_status` indicates investor)
- `zero-knyt-holders` — personas with Zero KNYT entitlement
- `ks-backers` — Kickstarter backers (table already synced)
- `knyt-cartridge-active-30d` — recently engaged personas (engagement events)

Future cohorts can be added incrementally; the schema should be a simple `cohort_id` text column with resolution dispatched server-side.

## Why this matters now

The operator wants to fire an investor activation email **before / at launch** to drive bundle purchases via the investor store tab (the launch-today golden path). Without an operator-facing propose flow, the only way to trigger that send today is to author it as a partner submission and then approve it — workable as a one-off, but not the right architecture longer term.

**Short-term workaround for launch**: send the investor activation email via the partner-proposed-then-admin-approved path, or run the Mailjet send manually from the existing operator scripts. Productize the operator surface in the next sprint.

## Related files

- `app/triad/components/codex/tabs/MarketaPartnersTab.tsx` (or wherever "Propose a Campaign" lives today)
- `services/campaign/` — campaign service layer
- `services/campaign/adapters/mailjetAdapter.ts` — actual send adapter (high-collision file per CLAUDE.md)
- `app/api/crm/campaign/` — existing campaign management API surface
- `data/codex-configs.ts` — register the new Operator Campaigns tab (admin-only)
