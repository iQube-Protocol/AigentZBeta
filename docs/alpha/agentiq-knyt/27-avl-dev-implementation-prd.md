# AVL Relationship Builder — Dev Implementation PRD
*Doc 27 of 29 — Engineering spec for building the Relationship Builder surface*

---

## Product Goal

Build the AVL Relationship Builder as a new tab group within the Venture Lab α cartridge. The surface is an internal operator tool — admin-only, Marketa-led, Studio-powered. It covers both partner relationship management and customer/end-user relationship management from a single surface.

---

## System Architecture

```
Venture Lab α Cartridge
  └── Relationship Builder α tab
        ├── Partners
        │   ├── Contact list (18 partners, Wave 1/2)
        │   ├── Pipeline kanban (bd_stage)
        │   └── Priority queue (signal-driven)
        ├── Customers
        │   ├── Search (all 3748 personas, fixed)
        │   ├── Cohort view (A–F + Zero)
        │   ├── Campaign state filter
        │   ├── Ladder view (patronage × PCS)
        │   └── Pipeline candidates
        ├── Programs (KNYT Wheel, KS timeline)
        ├── Composer (Studio-powered, partner + customer)
        ├── Packs (approved templates)
        ├── Reports (signal, partner, ladder)
        ├── QubeTalk (Marketa delegation)
        └── Settings
```

---

## Data Model

### New tables

```sql
-- Partner contact registry
avl_partner_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org text not null,
  wave int not null check (wave in (1, 2)),
  contact_email text,
  contact_name text,
  outreach_status text default 'uncontacted',
  bd_stage text default 'uncontacted',
  first_contact_at timestamptz,
  last_contact_at timestamptz,
  response_signal text,           -- none | acknowledged | interested | meeting_booked
  strategic_value_tier int,       -- 1=highest, 3=lowest
  audience_overlap_notes text,
  next_action text,
  assigned_agent text default 'marketa',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Partner pipeline stage history
avl_partner_stage_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references avl_partner_contacts(id),
  from_stage text,
  to_stage text,
  changed_at timestamptz default now(),
  changed_by text,
  notes text
);

-- Comms packs registry
avl_comms_packs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  audience_type text not null,    -- partner | customer | both
  comms_type text not null,       -- first_contact | reengagement | offer | etc.
  template_markdown text,
  subject_lines jsonb,            -- array of 3 variants
  cta_options jsonb,
  send_rules jsonb,
  active bool default true,
  created_at timestamptz default now()
);
```

### Existing tables used (read)
- `crm_personas` — customer name, email, cohort, campaign state, offer fit tags
- `personas` — display_name, fio_handle, status
- `journey_states` — patronage stage, PCS depth, active_at (tenant_id=nakamoto)
- `nakamoto_knyt_personas` — investment band, Zero KNYT flag
- `nbe_plans` — next-best-experience prescriptions
- `knyt_reward_events` — $KNYT balance
- `dvn_receipts` — comms audit trail

---

## API Surface

### Partner endpoints
- `GET /api/avl/partners` — list all partners with status + bd_stage
- `GET /api/avl/partners/:id` — partner detail
- `PATCH /api/avl/partners/:id` — update outreach_status, bd_stage, next_action, notes
- `POST /api/avl/partners/:id/stage` — record stage transition event
- `GET /api/avl/partners/pipeline` — partners grouped by bd_stage

### Customer endpoints
- `GET /api/avl/customers` — paginated customer list (search, cohort, campaign_state, stage filters)
- `GET /api/avl/customers/:personaId` — full customer detail (CRM + ladder + NBE)
- `GET /api/avl/customers/pipeline-candidates` — First/Zero stage + recruiter tag customers
- `PATCH /api/avl/customers/:personaId` — update campaign_state, offer_fit tags, next_action

### Composer endpoints
- `GET /api/avl/packs` — list available comms packs
- `GET /api/avl/packs/:slug` — pack detail with template
- `POST /api/avl/compose` — generate draft via Marketa (body: audience_type, comms_type, pack_slug, personaIds or partnerIds, overrides)
- `POST /api/avl/send` — send composed message (Mailjet for email, SMS via provider)

### Program endpoint
- `GET /api/avl/programs/knyt-wheel` — campaign calendar, sequence status, open/click rates

### Reports endpoints
- `GET /api/avl/reports/campaign-signal` — cohort × open/click/conversion
- `GET /api/avl/reports/partner-response` — wave × response_signal counts
- `GET /api/avl/reports/ladder-movement` — stage transitions this week
- `GET /api/avl/reports/pipeline-candidates` — count of candidates by type

---

## Frontend Architecture

### Route
`/codex/viewer` → Venture Lab α cartridge → Relationship Builder α tab

### Component tree
```
RelationshipBuilderTab
  ├── AVLNav (Partners | Customers | Programs | Composer | Packs | Reports | QubeTalk | Settings)
  ├── PartnersPanel
  │   ├── PartnerList (sortable, filterable)
  │   ├── PartnerDetail (edit outreach status, stage, notes)
  │   └── PartnerPipelineKanban
  ├── CustomersPanel
  │   ├── CustomerSearch (fixed — all records, not paginated window)
  │   ├── CohortFilterBar
  │   ├── CustomerList
  │   ├── CustomerDetail (CRM + ladder + NBE + comms history)
  │   ├── LadderHeatMap (patronage × PCS)
  │   └── PipelineCandidatesView
  ├── ProgramsPanel (KNYT Wheel calendar, sequence status)
  ├── ComposerPanel
  │   ├── AudienceSelector (Partner | Customer)
  │   ├── CommsTypeSelector
  │   ├── PackSelector
  │   ├── PersonalisationEditor (Marketa copilot inline)
  │   ├── PreviewPane
  │   └── SendControls
  ├── PacksPanel (template library)
  ├── ReportsPanel
  │   ├── CampaignSignalReport
  │   ├── PartnerResponseReport
  │   ├── LadderMovementReport
  │   └── PipelineCandidateReport
  ├── QubeTalkPanel (Marketa outbox/inbox)
  └── SettingsPanel
```

### Design tokens
- Follow existing `rounded-xl border border-white/5 bg-slate-950/80` pattern
- Section labels: `text-[10px] uppercase tracking-widest text-slate-500`
- Nav: same tab pill style as existing KNYT cartridge tabs
- Partner pipeline stages: colour-coded chips (uncontacted=slate, first_contact=blue, responded=amber, active=green, live=rose)
- Customer cohort badges: match existing cohort colour mapping (A=violet, B=blue, C=amber, etc.)
- Ladder stages: amber for patronage axis, indigo for PCS axis

---

## Composer — Marketa Integration

The Composer calls `/api/codex/chat` with:
- `personaId: 'aigent-marketa'`
- System context injected: selected audience segment, comms type, pack template, personalisation overrides
- KB domain: metaKnyts (KNYT Wheel 19 docs + campaign addendum)
- Response renders inline in Personalisation Editor as editable draft

Operator can:
- Accept Marketa's draft as-is
- Edit inline
- Ask Marketa to revise (re-prompt in same context)
- Finalise and send

Every composed and sent communication issues a `dvn_receipts` row with:
- `event_type: 'comms_sent'`
- `payload: { audience_type, comms_type, pack_slug, recipient_count, sent_at }`

---

## Customer Surface Sections (required)

| Section | Description |
|---------|------------|
| **Customer surface** | Primary customer list view with search, filters, cohort chips |
| **Customer cohort management** | Assign/update cohort tags, bulk tag operations |
| **Ladder ascension monitoring** | Show customers near stage transition; flag for priority NBE |
| **Venture Lab candidate pipeline** | Customers at First/Zero stage or with recruiter tag |
| **Customer comms campaigns** | Active sequences, scheduled sends, open/click tracking |
| **Customer NBE / next-best-experience** | Read from Experience Matrix; show prescription per customer |
| **Customer loyalty / affiliate / referral actions** | Reward $KNYT for referrals, affiliates, and share actions |
| **Customer-to-franchise / customer-to-pipeline progression** | Visual showing customer's path to franchise or VL candidate status |

---

## Build Order — 4 Waves

**Wave 1 — Data Layer (Sprint 1)**
- `avl_partner_contacts` table + seed 18 partners
- `avl_comms_packs` table + seed 5 initial packs
- `GET /api/avl/partners` + `GET /api/avl/customers` routes
- Basic Partners + Customers panels (list + search)

**Wave 2 — Core Operator Flows (Sprint 2)**
- Partner detail + edit (status, stage, notes)
- Partner pipeline kanban
- Customer cohort + campaign state filters
- Ladder ascension monitoring view
- Pipeline candidates view

**Wave 3 — Composer + Marketa (Sprint 3)**
- Composer panel: audience selector → pack → Marketa draft → preview → send
- Marketa copilot inline in Personalisation Editor
- Pack library browser
- DVN receipt issuance on send

**Wave 4 — Reports + QubeTalk + Polish (Sprint 4)**
- Campaign signal report (real Mailjet data)
- Partner response report
- Ladder movement report
- QubeTalk panel (Marketa outbox/inbox)
- Settings panel
- Full design token alignment

---

## Acceptance Criteria

| Area | Gate |
|------|------|
| Partners | 18 partners seeded, searchable, status updatable, pipeline kanban renders |
| Customers | Search works across all 3748 personas; cohort + stage filters functional |
| Ladder monitoring | Near-transition customers surfaced; pipeline candidates view accurate |
| Composer | End-to-end: select audience → pick pack → Marketa draft → send → DVN receipt |
| Reports | Campaign signal renders with real cohort data |
| Marketa | Copilot active in Composer; KB context includes KNYT Wheel docs |
| DVN | Every sent communication has a valid receipt |
| Security | Admin-only gate confirmed; RLS on avl_* tables enforced |
