# Aigent Me — Operator Runbook (Migrations & Smoke Tests)

**Date:** 2026-05-12
**Status:** Live — apply when the relevant phase deploys
**Workstream:** metaMe Personal Assistant Alpha (Aigent Me)
**Reading order:** Run each section in order the first time you deploy the corresponding phase. Idempotent — safe to re-run.

---

## Why this exists

Phases 1, 2, 3 each add at least one new Supabase table. If the migration isn't applied, the route layer either returns a clean 500 with a diagnostic (after the 2026-05-12 hardening commit) or a 504 Gateway Timeout (the symptom that surfaced this runbook). This doc gives the exact steps + verification queries so apply-checks are fast.

---

## Phase 1 — `assistant_sessions`

**Migration:** `supabase/migrations/20260512000000_assistant_sessions.sql`
**Used by:** Phase 6 receipt pipeline (not yet wired). Safe to defer until Phase 6 lands.

### Apply

Paste the entire migration file into the Supabase SQL editor and run. Idempotent.

### Verify

```sql
SELECT count(*) AS table_exists
FROM pg_tables WHERE schemaname='public' AND tablename='assistant_sessions';

SELECT policyname, cmd FROM pg_policies WHERE tablename='assistant_sessions';
```

Expected:
- `table_exists`: `1`
- Two policies: `assistant_sessions_read_service` (SELECT), `assistant_sessions_write_service` (ALL).

---

## Phase 2 — `experience_qubes`

**Migration:** `supabase/migrations/20260513000000_experience_qubes.sql`
**Used by:** `POST/GET /api/assistant/experience-model`, the welcome surface's ExperienceModel Card, and the brief generator.
**Required to: complete the ExperienceModel setup wizard. Without it the wizard's Save button returns 504 (pre-hardening) or 500 (post-hardening).**

### Symptom if missing

- Setup wizard "Save" hangs and eventually returns **504 Gateway Timeout** (pre-2026-05-12-hardening).
- After hardening: returns **500** with `detail: upsertExperienceQube: experience_qubes table is missing. Apply supabase/migrations/20260513000000_experience_qubes.sql…`.
- Bootstrap and brief endpoints continue to work (they degrade gracefully — show "ExperienceModel: not yet set up").

### Apply

```bash
# Read the migration content
cat supabase/migrations/20260513000000_experience_qubes.sql
```

Paste into Supabase SQL editor and run. Idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE POLICY IF NOT EXISTS` semantics — the second run is a no-op).

### Verify

```sql
SELECT count(*) AS table_exists
FROM pg_tables WHERE schemaname='public' AND tablename='experience_qubes';

SELECT policyname, cmd FROM pg_policies WHERE tablename='experience_qubes';

SELECT count(*) AS trigger_exists
FROM pg_trigger WHERE tgname='trg_experience_qubes_touch';
```

Expected:
- `table_exists`: `1`
- Two policies: `experience_qubes_read_service` (SELECT), `experience_qubes_write_service` (ALL).
- `trigger_exists`: `1` (the `updated_at` auto-touch trigger).

### Smoke test (after apply)

1. Refresh `dev-beta.aigentz.me/codex/viewer` → metaMe Cartridge → Aigent Me.
2. Click **Set up my ExperienceModel** → wizard opens.
3. Fill all three steps with anything valid → Save.
4. Wizard closes; the ExperienceModelCard re-renders with the saved name + stage chips + counts.
5. The iQube disclosure strip flips from "Using: PersonaQube" → "Using: PersonaQube, ExperienceQube".

If the wizard's Save still fails after the migration applies, check Amplify logs for the route — the new diagnostic strings name the root cause.

---

## Phase 3 — no migration

Brief + Move-Forward endpoints are pure reads of `experience_qubes` + the static `nbeCatalog`. No new tables. Requires Phase 2 migration applied to surface a configured-state brief; degrades to a setup-time brief otherwise.

### Smoke test

1. Click **Brief me** → BriefCard renders with 3-5 NextBestActionCards.
2. Click **Move this forward** → cartridge picker, then pick KNYT → hero NBE + 2 alternates.

---

## Future phases — placeholder

Phases 4-7 will each likely add a small migration. They'll be added to this runbook as they land.

---

## Hardening note (2026-05-12)

The ExperienceQube service now wraps every DB call in a 6-second timeout + detects the `42P01`/`PGRST205` "relation does not exist" error code. Missing-table conditions surface as fast 500s with actionable diagnostics rather than hanging to the 30s Lambda ceiling and returning 504.

Tunable: set `EXPERIENCE_QUBE_DB_TIMEOUT_MS` in the Amplify env to override the default 6s.

---

## Cross-references

- `codexes/packs/agentiq/updates/2026-05-11_metame-personal-assistant-alpha-decisions.md` — locked operator decisions for Aigent Me
- `codexes/packs/agentiq/updates/2026-05-12_aigent-me-phase-2-experience-qube.md` — Phase 2 details
- `codexes/packs/agentiq/updates/2026-05-12_supabase-security-advisor-sweep-backlog.md` — separate backlog for the 128 RLS errors flagged by Supabase Advisor (not caused by Aigent Me)
