# AVL Relationship Builder — KNYT PRD
*Doc 25 of 29 — Product requirements for the Relationship Builder surface, KNYT-first launch*

---

## Product Goal

Deliver a single internal operator surface (AVL Relationship Builder) that enables Marketa — and the operator team — to manage relationships, compose communications, and monitor progression for both **partners** and **customers** across the live KNYT campaign and beyond.

---

## Alpha Scope

### Must Ship
- Partners section: contact list, outreach status, BD pipeline tracking (Wave 1/2)
- Customers section: investor/backer CRM view, cohort tags, ladder stage, campaign state
- Composer: Studio-powered message authoring for partner and customer audiences
- Packs: pre-approved comms templates (partner intro, investor re-engagement, offer sequences)
- Reports: engagement signals by cohort, partner response tracking, ladder movement
- QubeTalk: Marketa delegation panel, agent message log
- Marketa copilot wired throughout with KNYT Wheel KB context

### Should Ship
- Programs section: KNYT Wheel / KS program dashboard, sequence calendar
- Customer NBE prescription view (read from Experience Matrix)
- Partner pipeline stages (prospect → active → co-activation → live)

### Must Not Ship (Alpha)
- Public-facing partner portal
- Automated partner onboarding flow
- Full CRM integration with external platforms (HubSpot, Salesforce)
- Revenue reporting

---

## User Stories

| As a… | I want to… | So that… |
|-------|-----------|---------|
| Operator | See all Wave 1 partners and their outreach status | I know who to follow up with today |
| Operator | Search a customer by name and see their ladder stage + offer fit | I can personalise my next conversation |
| Marketa | Draft a partner intro email using an approved template | I can personalise at scale without starting from scratch |
| Marketa | See which customer cohort has the highest open rate this week | I can prioritise follow-up sequences |
| Operator | Tag a partner as "responding" and trigger a deeper-ask sequence | I can act on signal immediately |
| Operator | See which customers are close to a ladder stage transition | I can identify Venture Lab pipeline candidates |
| Marketa | Delegate a batch outreach task to myself via QubeTalk | The operator can see what I'm working on |

---

## System Boundaries

| Layer | Owner | What It Does |
|-------|-------|-------------|
| AVL Relationship Builder UI | Lovable / CX | Navigation shell, Partner/Customer/Composer/Reports tabs |
| Marketa inference | CC / Codex | `/api/codex/chat` with persona_id=marketa, KB=metaKnyts |
| CRM data layer | CC / Codex | `crm_personas`, `personas`, `journey_states`, `nakamoto_knyt_personas` |
| Studio Composer backend | CC / Codex | Existing Studio Plan/Design/Workflows APIs |
| Signal data | CC / Codex | Mailjet webhook data, campaign state tags |
| QubeTalk bridge | CC | File-based relay, outbox packets |

---

## Partners Section

### Data Model
- Source: `KNYT_PARTNER_AND_INVESTOR_ACTIVATION_ADDENDUM.md` partner list (18 total)
- Wave 1 (16): relationship-ordered
- Wave 2 (2): Comic Republic, World Class Scholars

### Fields per partner contact
```
name, org, wave, outreach_status, first_contact_date, last_contact_date,
response_signal, strategic_value_tier, audience_overlap_notes, next_action,
assigned_agent (default: Marketa), bd_stage
```

### Partner pipeline stages
`uncontacted → first_contact_sent → responded → call_scheduled → active_conversation → co_activation_agreed → live`

### Views
- **List**: all 18 partners with status badges, wave indicator, last contact
- **Pipeline**: kanban by bd_stage
- **Priority queue**: signal-driven follow-up order (responsiveness × strategic value × signal)

---

## Customers Section

### Data Source
- `crm_personas` + `nakamoto_knyt_personas` + `journey_states`
- 3748 synced personas (as of current sync)
- Cohorts: A, B, C, D, E, F + cohort_zero_knyt_legacy_1000_plus

### Fields per customer
```
display_name, email, cohort, campaign_state, ladder_stage (patronage + PCS),
offer_fit, knyt_balance, last_active, ks_backed, investment_band,
codex_value_awareness, collector_tags
```

### Views
- **Search**: by name, email, KNYT handle — searches all records (not just recent)
- **Cohort view**: filter by A–F + Zero cohort
- **Campaign state filter**: dormant / warming / reactivated / engaged / advocate / recruiter
- **Ladder view**: patronage stage × PCS stage heat map
- **Pipeline candidates**: customers near stage transition (likely Venture Lab candidates)

### Ladder Ascension Monitoring
Show customers within 1 action of a stage transition prominently. These are the highest-value next-best-experience targets.

---

## Composer Section

Studio-powered authoring for both audiences.

### Partner comms types
- First contact / intro email
- Follow-up (signal-driven)
- Co-activation proposal
- Deep-ask (post-positive-signal)

### Customer comms types
- Re-engagement sequence (dormant → warming)
- KS offer email (cohort-personalised)
- Backed confirmation / welcome sequence
- Ladder ascension prompt (next-best-experience)
- Advocate / recruiter unlock prompt
- Post-campaign retention sequence

### Composer workflow
1. Select audience: Partner or Customer
2. Select cohort / partner subset
3. Choose comms type → loads approved pack template
4. Personalise via Marketa copilot (suggest copy variations, subject lines, CTA)
5. Preview → send or schedule
6. Receipt issued to DVN trail

---

## Packs Section

Pre-approved content packs. Each pack contains:
- Template markdown
- Approved subject lines (3 variants)
- CTA options mapped to offer-fit tags
- Send rules (who gets it, when, under what campaign state)

**Initial packs:**
- KNYT Wheel — Investor Launch (cohorts A–F)
- Zero KNYT Legacy — Premium Outreach
- Partner Wave 1 — First Contact
- Partner Wave 2 — Top Tier Activation
- Post-Campaign Retention

---

## Reports Section

| Report | Data Source | Key Metric |
|--------|------------|-----------|
| Campaign signal by cohort | Mailjet webhook | Open rate, click rate, KS conversion |
| Partner response rate | Partner pipeline | Responded / uncontacted ratio |
| Ladder movement | journey_states active_at | Stage transitions this week |
| Offer conversion | ks_backed flag | Backed rate by cohort |
| Top advocates | campaign_state tag | advocate + recruiter count |

---

## QubeTalk Panel

- Shows Marketa's outbox packets (sent delegations, status messages)
- Shows inbox packets (Codex/Lovable relay responses)
- Operator can compose a delegation to Marketa from this panel
- Thread filter: `dev-exec`, `spec`, `api-wiring`

---

## Acceptance Criteria

| Area | Gate |
|------|------|
| Partners | All 18 partners searchable; outreach status updateable |
| Customers | Search returns correct results across all 3748 personas |
| Composer | Partner intro email composed + sent via Marketa copilot in < 3 steps |
| Packs | ≥ 5 approved packs available and loadable |
| Reports | Campaign signal report renders with real Mailjet data |
| Marketa | Copilot active throughout; KB context injected correctly |
| Ladder monitoring | Customers near stage transition surfaced in Customer section |
