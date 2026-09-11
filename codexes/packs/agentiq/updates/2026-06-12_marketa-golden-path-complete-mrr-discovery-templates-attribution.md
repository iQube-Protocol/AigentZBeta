# 2026-06-12 — Marketa golden path complete: MRR, discovery, templates, attribution

Session branch: `claude/optimistic-davinci-exiykx` (continuation of the
2026-06-11 golden-path sessions). All five items in
`docs/marketa/MARKETA_GOLDEN_PATH_PLAN.md` are now shipped, plus the last
"partial" box (revenue attribution). The Activation Engine is feature-complete
against the operator's priority redirect.

## Shipped in this session

### 1. Subscription revenue semantics (MRR) — `486fc9c1`

Operator decision: Marketa revenue = per closed opportunity + activation/
subscription fees. Implemented as `opportunity_type = 'subscription'` with
monthly-value semantics in `rollUpRevenue`:

- ACTIVE subscriptions sum into the new
  `RevenueTrackingSummary.recurringMonthlyRevenue` — not the one-shot pipeline
- proposed/approved/paused subscriptions sit in pipeline at monthly value
- completed (ended) subscriptions roll into closed revenue

UI: opportunity add form gained a type select (one-shot / subscription /
qualified intro / integration); subscription rows render `$X/mo`; new MRR
card on the cartridge metric grid.

### 2. Discovery automation — `0daa5055`

`POST /api/marketa/activation/discover` fetches operator-supplied sources
(`{ kind: 'a2a_card' | 'mcp_registry', url }`), parses them via the new pure
`services/marketa/activation/discovery.ts`, dedupes against existing
candidates by normalized URL + name, inserts new candidates, and logs
`candidate_discovered` events. Cartridge header gained a Discover control.
Scheduled polling: set `MARKETA_DISCOVERY_SOURCES` (JSON `[{kind,url}]`,
added to the env allowlist) and call the route with an empty body. No
third-party URLs hardcoded.

### 3. Outreach template library — `f26eb06c`

Operator-curated per-lane templates in `marketa.marketa_outreach_templates`
(migration `20260612000000_marketa_outreach_templates.sql` — **operator must
run it in Supabase before curating**; until then drafting silently uses the
built-in copy). CRUD at `/api/marketa/activation/templates` (+ `[id]` PATCH).
Rendering is pure placeholder substitution in
`services/marketa/activation/outreachTemplates.ts`; the legacy hard-coded
`buildDraft` copy became `BUILT_IN_OUTREACH_TEMPLATE`. Draft resolution:
scorecard picker templateId → lane match → `any` → built-in; the
`outreach_drafted` event records which template was used.

### 4. Revenue attribution — `d8f88971`

`attributeRevenue` (normalizers.ts) groups each candidate's rolled-up
`revenueTracking` by primary strategic lane and by discovery `sourceType`.
Two attribution tables (Pipeline / MRR / Closed) render under the cartridge
metric grid whenever revenue activity exists. Pure client-side grouping —
no new route or table.

## Test state

`tests/marketa-activation.test.ts`: 22 tests pass (roll-up + subscription
semantics, discovery parsers/dedupe/env-config, template render/pick/
validate, attribution grouping). Typecheck clean.

## Open items (operator)

- Run the `20260612000000_marketa_outreach_templates.sql` migration
- Step-8 passport retest on "Example Agent Candidate 1781206694852"
- CRM bridge decision: mirror opportunities into the existing CRM?
- Discovery smoke test: Discover → A2A card →
  `/api/marketa/activation/sample-agent-card?seed=discovery-test` twice
  (second run should skip as already known)

## Backlog candidates (post-golden-path)

- Automated inbound reply ingestion (Mailjet webhook → mark_responded)
- Template editor UI (curation currently via API/SQL)
- OpenAPI repo scan as a third discovery source kind
