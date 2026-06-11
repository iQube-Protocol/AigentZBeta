# Marketa Golden Path — operational candidate recruiting + revenue generation

**Operator priority redirect, 2026-06-11:** the Marketa Activation Engine
becoming an operational tool for recruiting agents and generating revenue is
the priority. Passport credential phases B/C/D move to backlog.

## What the golden path looks like end-to-end

```
discover candidates → score & screen → outreach (drafted + sent + replied)
  → qualified → opportunity logged → revenue closed → revenue attributed
  ↑                                                                    │
  └──────────────────── activation_event audit ────────────────────────┘
```

Every box above eventually flips a candidate's `activationStatus` and lands a
row in `marketa_activation_events`. The pipeline ends at attributed revenue
the operator can read off the cartridge.

## What is built today

| Box | Status |
|-----|--------|
| Discover (manual / sample / JSON-CSV import) | shipped |
| Score & screen (classification + clean-revenue + risk/policy + human mobility) | shipped |
| Outreach **drafted** | shipped |
| Outreach **sent** | **shipped 2026-06-11** — operator decision: reuse Marketa Mailjet send path (`marketa.send-transactional`). Operator supplies recipient + reviews/edits subject and body in the UI; `{ action: "send" }` on the outreach route. Marketa never auto-sends or infers a recipient |
| Outreach **reply tracked** | **shipped 2026-06-11 (manual flip)** — `{ action: "mark_responded" }` + "Mark responded" button flips sent → responded. Automated inbound reply ingestion (webhook) NOT BUILT |
| Opportunity logged (`marketa_candidate_opportunities` table) | **shipped 2026-06-11** — GET/POST/PATCH at `/api/marketa/activation/candidates/[id]/opportunities` + scorecard panel (add / advance / reject through proposed→approved→active→completed) |
| Revenue closed | **shipped 2026-06-11** — mechanical roll-up on every opportunity change: open opps → `estimatedPipelineValue`, completed → `closedCleanRevenue`; rejected counts nowhere |
| Revenue attributed (per source, per lane) | partial — cartridge top metrics show Pipeline value + Closed revenue across all candidates; per-source/per-lane attribution NOT BUILT |
| Activation events audit | shipped end-to-end (opportunity_created / opportunity_updated included) |

## Gap analysis — what blocks "operational" today

In rough order of value to the golden path:

1. **Opportunities CRUD + scorecard drawer.** The schema is there and types
   are wired through `dbToCandidate`, but the detail GET drops the
   opportunities array and there is no create/update path. Without
   opportunities the entire revenue half of the funnel is invisible.

2. **Outreach send + reply loop.** Draft-only is correct for safety, but
   "send via existing Marketa outreach pattern after human approval" is the
   next obvious step — every drafted email currently has zero exit. Wire
   into the existing Mailjet / Marketa outreach send path (already used by
   the campaign tab); add a reply ingestion hook so a reply flips the
   candidate's outreachStatus and logs an activation_event.

3. **Revenue attribution & roll-up.** Each opportunity carries
   `estimatedValue` + `cleanRevenueStatus`; rolling those onto the candidate
   then onto a Marketa-wide dashboard answers "what is Marketa earning."
   Cartridge top metrics could surface: pipeline value (open
   opportunities), closed clean revenue (this month / total), top lanes.

4. **Discovery automation.** Today the only inflows are manual / sample /
   import. A scheduled discovery job (Agent Card crawl, MCP server
   directory poll, OpenAPI repo scan) keeps the pipeline filling without
   the operator clicking Add sample. Lower priority than send + opportunity
   tracking — manual discovery is enough to validate revenue flow.

5. **Outreach template library.** Currently every draft is hard-coded in
   `buildDraft`. A small set of operator-curated templates per lane is a
   conversion-rate lever once #2 is live.

## Recommended attack order

1. ~~Opportunity CRUD + scorecard panel~~ — **DONE 2026-06-11**
2. ~~Outreach send via existing Marketa send path + reply-flip hook~~ — **DONE 2026-06-11** (manual reply flip; webhook ingestion later)
3. Revenue roll-up + dashboard metrics
4. Discovery automation
5. Template library

(1) and (2) together produce the first real revenue path. (3) makes the
result visible to the operator. (4) and (5) scale it.

## Operator decisions (resolved 2026-06-11 unless noted)

- **Outreach send path** — DECIDED: reuse the Marketa Mailjet identity.
  Implemented via the `marketa.send-transactional` connector skill
  (`services/marketa/marketaConnector.ts`) — the one-off transactional
  send that already shares the campaign system's Mailjet account/env.
- **Revenue model** — DECIDED: (a) per closed opportunity at recorded
  value (what the roll-up does today), plus (b) subscription revenue
  from activated agents. Subscription tracking (recurring rather than
  one-shot) is the next roll-up increment — likely an
  `opportunity_type = 'subscription'` with a monthly-value semantic.
- **CRM bridge** — OPEN: opportunities probably want to mirror into the
  existing CRM (or its successor). Confirm target table / connector

## Deferred — passport credential workstream (Phase A shipped)

Phase A landed (`a046544d`, dev) and is live behind
`GET /api/polity-passport/credential/[passportId]` plus a "claim credential"
link in the Marketa scorecard. The lazy-issuance design means it doesn't
interfere with anything in the golden path.

Backlogged behind the golden path:

- **Phase B** — @aigent FIO handle minted at passport acceptance
  (`<ref>@aigent`, human-readable; keypair stub initially)
- **Phase C** — keypair + self-custody blakQube envelope + on-chain FIO
  register; replaces the HMAC stub proof with an asymmetric, publicly
  verifiable proof
- **Phase D** — "claim your passport" UI with bounded-delegation policy on
  the persona_id ↔ passport_id binding
- "aigent" as a brand class for polity-compliant agents
  (`polity_passported_agent` badge gated via spine `evaluateAccess`)

Open decisions to capture before Phase C resumes:
- VC signing key custody — Bureau KMS vs IC canister identity
- @aigent FIO domain reservation — coordinate with the existing @knyt /
  @polity registration owner
