# AVL Relationship Builder — Claude Code Operator Pack
*Doc 28 of 29 — Canonical instructions for Claude Code agents building the AVL Relationship Builder*

---

## Scope of Work

Build the **AVL Relationship Builder** — a new tab in the Venture Lab α cartridge — covering:

1. Database tables (`avl_partner_contacts`, `avl_partner_stage_events`, `avl_comms_packs`)
2. API routes under `app/api/avl/`
3. Frontend component: `RelationshipBuilderTab` and child panels
4. Marketa copilot wiring in the Composer
5. Initial data seeds (18 partners, 5 comms packs)

---

## Files to Create

```
supabase/migrations/YYYYMMDD000000_avl_relationship_builder.sql
app/api/avl/partners/route.ts
app/api/avl/partners/[id]/route.ts
app/api/avl/partners/[id]/stage/route.ts
app/api/avl/partners/pipeline/route.ts
app/api/avl/customers/route.ts
app/api/avl/customers/[personaId]/route.ts
app/api/avl/customers/pipeline-candidates/route.ts
app/api/avl/packs/route.ts
app/api/avl/compose/route.ts
app/api/avl/send/route.ts
app/api/avl/reports/campaign-signal/route.ts
app/api/avl/reports/partner-response/route.ts
app/api/avl/reports/ladder-movement/route.ts
app/triad/components/codex/tabs/RelationshipBuilderTab/index.tsx
app/triad/components/codex/tabs/RelationshipBuilderTab/PartnersPanel.tsx
app/triad/components/codex/tabs/RelationshipBuilderTab/CustomersPanel.tsx
app/triad/components/codex/tabs/RelationshipBuilderTab/ComposerPanel.tsx
app/triad/components/codex/tabs/RelationshipBuilderTab/PacksPanel.tsx
app/triad/components/codex/tabs/RelationshipBuilderTab/ReportsPanel.tsx
app/triad/components/codex/tabs/RelationshipBuilderTab/QubeTalkPanel.tsx
```

---

## Files to Modify

- `data/codex-configs.ts` — add Relationship Builder α tab to VENTURE_LAB_CODEX, shift AgentiQ α and AgentiQ OS α order numbers
- `codexes/packs/alpha-knyt/collections.json` — add `col_relationship_builder_alpha`
- `app/triad/components/codex/TabRenderer.tsx` — register `RelationshipBuilderTab` component

---

## Migration Script

```sql
-- AVL partner contacts (18 initial, seeded post-migration)
create table avl_partner_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org text not null,
  wave int not null check (wave in (1, 2)),
  contact_email text,
  contact_name text,
  outreach_status text not null default 'uncontacted',
  bd_stage text not null default 'uncontacted',
  first_contact_at timestamptz,
  last_contact_at timestamptz,
  response_signal text default 'none',
  strategic_value_tier int default 2,
  audience_overlap_notes text,
  next_action text,
  assigned_agent text default 'marketa',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table avl_partner_stage_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references avl_partner_contacts(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_at timestamptz default now(),
  changed_by text,
  notes text
);

create table avl_comms_packs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  audience_type text not null,
  comms_type text not null,
  template_markdown text,
  subject_lines jsonb default '[]',
  cta_options jsonb default '[]',
  send_rules jsonb default '{}',
  active bool default true,
  created_at timestamptz default now()
);

alter table avl_partner_contacts enable row level security;
alter table avl_partner_stage_events enable row level security;
alter table avl_comms_packs enable row level security;

-- Service role has full access; anon blocked; auth.users read their own? 
-- For admin-only surface: only service role can write
create policy "service role full access partners" on avl_partner_contacts
  for all using (auth.role() = 'service_role');
create policy "service role full access stage events" on avl_partner_stage_events
  for all using (auth.role() = 'service_role');
create policy "service role full access packs" on avl_comms_packs
  for all using (auth.role() = 'service_role');
```

---

## Partner Seed Data

Run after migration. Seed all 18 partners from `KNYT_PARTNER_AND_INVESTOR_ACTIVATION_ADDENDUM.md`:

**Wave 1 (in order):** Autonomys, Fio Protocol, ChainGPT, Lamina1, LayerZero, Project Liberty, CryptoMondays/DAIA, PAL Capital, Distro, NEAR, Polygon, Secret Network, Decentralized Media, Horizen, Bitcoin Harlem, PubKey

**Wave 2:** Comic Republic (strategic_value_tier=1, audience_overlap_notes='top-tier media/comics; high KNYT IP overlap'), World Class Scholars (strategic_value_tier=1, audience_overlap_notes='education/culture; collector and patron audience alignment')

---

## API Implementation Notes

### `GET /api/avl/customers`
- Reuse the search fix from `/api/runtime/experience/dashboard` — separate `.ilike()` calls per column, not `.or()` with `%`
- Accept: `?search=`, `?cohort=`, `?campaign_state=`, `?stage=`, `?limit=`, `?offset=`
- Join: `crm_personas` + `journey_states` + `nakamoto_knyt_personas`
- Return: display_name, cohort, campaign_state, ladder_stage (patronage+PCS), offer_fit, ks_backed, investment_band

### `POST /api/avl/compose`
- Call Marketa inference at `/api/codex/chat` with `personaId: 'aigent-marketa'`
- Inject system context: `{ audience_type, comms_type, pack_template, recipient_summary }`
- Return: `{ draft_subject, draft_body, suggested_cta }` — let operator edit before sending

### `POST /api/avl/send`
- Validate: draft must be present, recipient list non-empty
- Send via existing Mailjet adapter for email
- Issue DVN receipt: `{ event_type: 'comms_sent', payload: { audience_type, comms_type, pack_slug, recipient_count, sent_at } }`
- Update campaign_state tags for reached personas

---

## Frontend Implementation Notes

### RelationshipBuilderTab/index.tsx
- `"use client"` — this is an operator interactive surface
- Top-level nav: `['partners', 'customers', 'programs', 'composer', 'packs', 'reports', 'qubetalk', 'settings']`
- Active panel rendered based on `activeSection` state
- Marketa copilot available in Composer panel via the existing SmartTriad chat infrastructure

### Design system rules
- **Do not** use `Card`, `Badge`, `Button`, `Progress` from shadcn/ui — use raw className with design tokens
- Section labels: `text-[10px] uppercase tracking-widest text-slate-500`
- Containers: `rounded-xl border border-white/5 bg-slate-950/80 p-4`
- Partner status chips: `rounded-full px-2 py-0.5 text-[10px] font-semibold`
- Customer cohort badges: match existing cohort colour scheme in ExperienceDashboardTab

### CustomerSearch
- Reuse the same search pattern from the individual search fix in `ExperienceDashboardTab`
- Must search across all 3748 personas — not just paginated window
- Debounce with 300ms before triggering API call (or Enter-triggered with search button)

### PipelineCandidatesView
Show in priority order:
1. Zero KNYT stage + ks_backed (highest)
2. First KNYT stage + ks_backed
3. Recruiter campaign_state
4. investment_band ≥ $2,000 + Zero/First stage

---

## Tab Registration

In `app/triad/components/codex/TabRenderer.tsx`, add:

```tsx
import { RelationshipBuilderTab } from './tabs/RelationshipBuilderTab';

// In the component map:
case 'RelationshipBuilderTab':
  return <RelationshipBuilderTab {...props} />;
```

---

## Sequencing

1. Migration + seed first (P0)
2. Customer search + list (reuse individual search fix pattern)
3. Partner list + edit
4. Composer + Marketa wiring
5. Pipeline candidates view
6. Reports
7. QubeTalk panel
8. Polish + design token alignment
