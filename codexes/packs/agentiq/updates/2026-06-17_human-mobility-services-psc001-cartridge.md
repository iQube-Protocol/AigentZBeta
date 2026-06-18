# Human Mobility Services Cartridge — PSC-001 Implementation

**Date:** 2026-06-17
**Session:** claude/serene-brown-4gybcu
**Classification:** Confidential / Black Cube

---

## What Was Built

This session delivered the Human Mobility Services Cartridge — the first live implementation of the Polity Capability Preservation Standard (PSC-001).

The cartridge provides structured case management for strategic repatriation and family mobility, with a full Mobility Activation File (MAF) intake wizard as the primary interface.

---

## Architecture

### Three-Layer Model

**Layer 1 — Polity Capability Preservation Standard (PSC-001)**
The foundational doctrine. Six capital classes (Human, Social, Reputational, Entrepreneurial, Educational, Civic), the Polity Intervention Hierarchy (5 levels), and the confidentiality classification framework (White / Grey / Black / Black Cube). Surfaced in `MobilityDoctrineTab`.

**Layer 2 — Human Mobility Services Cartridge**
The reusable operational template. Registered as `human-mobility-services` in `CODEX_DEFINITIONS`. Slug: `human-mobility-services`. Currently `adminOnly: true`.

**Layer 3 — Mobility Activation File (MAF)**
The per-case data model covering 14 sections. Stored as structured JSONB profile columns on `mobility_cases`. Populated via the 7-step intake wizard.

---

## Files Changed

### DB Migration
`supabase/migrations/20260617000000_mobility_cases.sql`

Three tables:

| Table | Purpose |
|---|---|
| `mobility_cases` | MAF shell — 14-section JSONB profile columns + generated score columns |
| `mobility_workstreams` | 7 operational workstreams (A–G), auto-seeded on case creation |
| `mobility_critical_dates` | Date register (MAF §13), indexed by `due_date` |

RLS: service_role bypass + case owner SELECT policy. Black Cube by default — no citizen writes directly; all writes route through authenticated API endpoints.

**Migration must be applied manually in Supabase SQL editor before the cartridge is usable.**

### API Routes
All under `app/api/mobility/`:

| Route | Methods | Purpose |
|---|---|---|
| `/cases` | GET, POST | List + create MAF cases |
| `/cases/[caseId]` | GET, PATCH | Full case detail + profile section saves + auto-scoring |
| `/cases/[caseId]/dates` | GET, POST | Critical date register |
| `/cases/[caseId]/workstreams` | GET, PATCH | Workstream status management |

Shared lib (`app/api/mobility/_lib/`):
- `seedWorkstreams.ts` — seeds 7 default workstreams on case creation
- `computeScores.ts` — derives capability score, continuity score, recovery velocity class (RV-1 to RV-4), and 4 risk levels from profile data
- `markSectionComplete.ts` — tracks intake section completion

### Tab Components
All under `app/triad/components/codex/tabs/`:

| Component | Role |
|---|---|
| `HumanMobilityServicesTab` | Root shell — manages list → intake → case view state machine |
| `MobilityActivationTab` | Case list with scores, risk badges, intake progress |
| `MobilityIntakeTab` | 7-step MAF intake wizard with auto-save per step |
| `MobilityCaseOverviewTab` | Live case dashboard — scores, critical date register with countdown, workstream status board |
| `MobilityDoctrineTab` | PSC-001 doctrine — capital classes, intervention hierarchy, confidentiality tiers |

### Cartridge Registration
`data/codex-configs.ts` — `HUMAN_MOBILITY_SERVICES_CARTRIDGE` added and appended to `CODEX_DEFINITIONS`.

Two tabs registered: `hms-activation` (component: `HumanMobilityServicesTab`) and `hms-doctrine` (component: `MobilityDoctrineTab`).

`TabRenderer.tsx` — both new components imported and added to `componentRegistry`.

### PassportBeingTab Update
`app/triad/components/codex/tabs/PassportBeingTab.tsx` — Phase 1 stub marker updated to Phase 2 Live. The "Being" tab in the Passport Bureau Cartridge now indicates the HMS Cartridge is live.

---

## MAF Intake Wizard — 7 Steps

| Step | Sections Covered | Key Fields |
|---|---|---|
| 1. Household | MAF §2 | Adults/dependents, citizenship, origin, destination, preferred area |
| 2. Capability | MAF §3–4 | Professional background, founder experience, O-1/extraordinary ability, industry sectors, prior UK communities, school continuity, professional networks |
| 3. Housing | MAF §6 | Housing status, departure deadline, budget, preferred area, guarantors |
| 4. Education | MAF §7 | Child details, current/prior/target schools, admissions deadlines |
| 5. Business | MAF §8–9 | US/UK entities, banking, compliance, liquidity range, runway |
| 6. Relocation | MAF §10–11 | Relocation window, possessions, shipping, stress factors, community reintegration |
| 7. Confidentiality | MAF §12–13 | Black Cube classification, disclosure rules, business/children's info rules, critical dates |

Each step auto-saves to `PATCH /api/mobility/cases/[caseId]`. Scores are recomputed server-side on each save. The intake progress bar and section-complete tracking update in real time.

---

## Scoring Model

### Capability Score (0–100)
Derived from capability profile completeness. Founder flag: +20. O-1/extraordinary ability flag: +15.

### Continuity Score (0–100)
Derived from continuity profile anchors. Prior UK community/school/geographic familiarity: +25.

### Recovery Velocity Class
Composite of capability + continuity scores:
- RV-1 (≥75): Immediate recovery, <30 days
- RV-2 (50–74): Rapid recovery, <90 days
- RV-3 (25–49): Moderate recovery, <180 days
- RV-4 (<25): Long-term recovery, 180+ days

### Risk Levels (low / medium / high)
Housing, education, business continuity, and standing risks derived from respective profile sections.

---

## Confidentiality Model

All cases default to `classification = 'black_cube'`. The confidentiality classification maps to the PSC-001 tier framework:

- **White** — public, no restrictions
- **Grey** — routine administrative, restricted disclosure
- **Black** — sensitive personal/financial, need-to-know
- **Black Cube** — material harm risk from disclosure (safety, standing, business interests, economic prospects, family wellbeing, strategic opportunities)

The operator populates disclosure rules, standing protection requirements, business information rules, and children's information rules in Step 7 of the intake wizard.

---

## Operator Run Commands

**Apply the migration:**
```sql
-- Paste contents of supabase/migrations/20260617000000_mobility_cases.sql
-- into the Supabase SQL editor and execute
```

**Verify tables created:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'mobility_%'
ORDER BY table_name;
```

Expected result: `mobility_cases`, `mobility_critical_dates`, `mobility_workstreams`.

**Activate a case (after migration applied):**
Navigate to the Human Mobility Services Cartridge → Cases tab → "Activate Case" button.

---

## What This Session Did Not Build (follow-on)

- **Workstream detail views** — individual tabs for Housing (B), Education (C), Relocation (D), Business (E), Economic Reactivation (F), Family Stabilization (G). Stubs exist in the tab group config; components need building.
- **Agent assignment** — assigning specific agents to workstreams (field exists in `mobility_workstreams.assigned_agent_id`; UI not built)
- **Marketa integration** — surfacing mobility cases in the Marketa dashboard as a case type
- **Citizen-facing view** — `adminOnly: true` currently; opening to case owners requires UX review
- **Task management** — `tasks` JSONB column on workstreams is ready; task-level UI not built

---

## Key Design Decisions

**JSONB profile sections over normalized tables**: The MAF schema evolves rapidly as the PSC-001 standard matures. JSONB gives flexibility without migrations for each new field. Score computation runs server-side in `computeScores.ts` and can be updated without schema changes.

**Black Cube default**: Every case defaults to `black_cube` classification. Agents receive only the profile sections needed for their workstream (enforced at the API layer by the workstream-scoped endpoints). The full MAF is only accessible to the case owner and service role.

**No parallel identity resolver**: All persona lookups route through `getActivePersona(req)`. The `canAccess()` helper checks ownership against `mobility_cases.owner_persona_id` without building a parallel auth gate.
