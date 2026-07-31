-- 20260617000000 — Human Mobility Services: Mobility Activation File (MAF)
--
-- Polity Service Cartridge PSC-001: Strategic Repatriation and Capability
-- Preservation. Three tables cover a complete mobility case lifecycle:
--
--   mobility_cases             — case metadata + generated scores
--   mobility_workstreams       — the 7 operational workstreams (A–G)
--   mobility_critical_dates    — the critical-date register (MAF §13)
--
-- Case profile data (MAF §2–12) is stored as structured JSONB columns on
-- mobility_cases to keep the intake schema flexible as the MAF evolves.
--
-- Classification: Black Cube — all rows are service_role-only by default;
-- the case owner SELECT policy is the only citizen-facing gate.
-- Case managers gain full access via the service role in API routes.

BEGIN;

-- ─── CASES ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobility_cases (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   text NOT NULL DEFAULT 'default',

  -- Case metadata (MAF §1)
  case_type                   text NOT NULL DEFAULT 'repatriation'
    CHECK (case_type IN ('repatriation', 'relocation', 'displacement', 'asylum', 'family_reunification', 'other')),
  cartridge_type              text NOT NULL DEFAULT 'psc-001',
  priority_level              text NOT NULL DEFAULT 'critical'
    CHECK (priority_level IN ('critical', 'high', 'medium', 'low')),
  case_status                 text NOT NULL DEFAULT 'intake'
    CHECK (case_status IN ('intake', 'active', 'paused', 'complete', 'closed')),

  -- Spine-linked owner (T0 — never serialized on T1)
  owner_persona_id            text NOT NULL,
  assigned_case_manager_id    text,

  -- Confidentiality classification
  classification              text NOT NULL DEFAULT 'black_cube'
    CHECK (classification IN ('white', 'grey', 'black', 'black_cube')),

  -- MAF §2 — Household Profile
  household_profile           jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- MAF §3 — Capability Profile
  capability_profile          jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- MAF §4 — Continuity Profile
  continuity_profile          jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- MAF §5 — Standing Profile
  standing_profile            jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- MAF §6 — Housing Profile
  housing_profile             jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- MAF §7 — Education Profile
  education_profile           jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- MAF §8 — Business Continuity Profile
  business_profile            jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- MAF §9 — Financial Profile
  financial_profile           jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- MAF §10 — Mobility Profile
  mobility_profile            jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- MAF §11 — Family Stabilization Profile
  family_profile              jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- MAF §12 — Confidentiality Profile
  confidentiality_profile     jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- MAF §14 — Generated Outputs (computed on activation, updated on profile changes)
  capability_score            integer,          -- 0–100
  continuity_score            integer,          -- 0–100
  recovery_velocity_class     text              -- 'RV-1' | 'RV-2' | 'RV-3' | 'RV-4'
    CHECK (recovery_velocity_class IN ('RV-1', 'RV-2', 'RV-3', 'RV-4')),
  standing_risk_level         text              -- 'low' | 'medium' | 'high'
    CHECK (standing_risk_level IN ('low', 'medium', 'high')),
  housing_risk_level          text
    CHECK (housing_risk_level IN ('low', 'medium', 'high')),
  education_risk_level        text
    CHECK (education_risk_level IN ('low', 'medium', 'high')),
  business_continuity_risk    text
    CHECK (business_continuity_risk IN ('low', 'medium', 'high')),

  -- Intake completion tracking
  intake_sections_complete    text[] NOT NULL DEFAULT '{}',
  intake_completed_at         timestamptz,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mobility_cases IS
  'PSC-001 Mobility Activation Files. Black Cube — owner + service_role access only.';

CREATE INDEX IF NOT EXISTS idx_mobility_cases_owner
  ON public.mobility_cases (owner_persona_id);
CREATE INDEX IF NOT EXISTS idx_mobility_cases_status
  ON public.mobility_cases (case_status);
CREATE INDEX IF NOT EXISTS idx_mobility_cases_manager
  ON public.mobility_cases (assigned_case_manager_id)
  WHERE assigned_case_manager_id IS NOT NULL;

-- ─── WORKSTREAMS ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobility_workstreams (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                     uuid NOT NULL REFERENCES public.mobility_cases(id) ON DELETE CASCADE,
  tenant_id                   text NOT NULL DEFAULT 'default',

  -- Workstream identity
  workstream_key              text NOT NULL
    CHECK (workstream_key IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  -- A=Strategic Assessment, B=Housing, C=Education, D=Relocation,
  -- E=Business Continuity, F=Economic Reactivation, G=Family Stabilization

  label                       text NOT NULL,
  priority                    text NOT NULL DEFAULT 'high'
    CHECK (priority IN ('immediate', 'critical', 'high', 'medium', 'low')),
  status                      text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'blocked', 'complete', 'deferred')),

  assigned_agent_id           text,
  notes                       text,
  tasks                       jsonb NOT NULL DEFAULT '[]'::jsonb,

  started_at                  timestamptz,
  completed_at                timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (case_id, workstream_key)
);

COMMENT ON TABLE public.mobility_workstreams IS
  'Operational workstreams (A–G) for a mobility case.';

CREATE INDEX IF NOT EXISTS idx_mobility_workstreams_case
  ON public.mobility_workstreams (case_id);

-- ─── CRITICAL DATES ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobility_critical_dates (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                     uuid NOT NULL REFERENCES public.mobility_cases(id) ON DELETE CASCADE,
  tenant_id                   text NOT NULL DEFAULT 'default',

  label                       text NOT NULL,
  date_category               text NOT NULL
    CHECK (date_category IN ('housing', 'school', 'travel', 'compliance', 'business', 'legal', 'other')),
  due_date                    date NOT NULL,
  is_hard_deadline            boolean NOT NULL DEFAULT true,
  status                      text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'at_risk', 'met', 'missed')),
  notes                       text,
  workstream_key              text
    CHECK (workstream_key IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')),

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mobility_critical_dates IS
  'Critical-date register (MAF §13) for mobility cases.';

CREATE INDEX IF NOT EXISTS idx_mobility_dates_case
  ON public.mobility_critical_dates (case_id);
CREATE INDEX IF NOT EXISTS idx_mobility_dates_due
  ON public.mobility_critical_dates (due_date)
  WHERE status = 'pending';

-- ─── UPDATED_AT TRIGGERS ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS mobility_cases_updated_at ON public.mobility_cases;
CREATE TRIGGER mobility_cases_updated_at
  BEFORE UPDATE ON public.mobility_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS mobility_workstreams_updated_at ON public.mobility_workstreams;
CREATE TRIGGER mobility_workstreams_updated_at
  BEFORE UPDATE ON public.mobility_workstreams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS mobility_dates_updated_at ON public.mobility_critical_dates;
CREATE TRIGGER mobility_dates_updated_at
  BEFORE UPDATE ON public.mobility_critical_dates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.mobility_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_workstreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_critical_dates ENABLE ROW LEVEL SECURITY;

-- Service role bypass (API routes use service role)
DROP POLICY IF EXISTS "mobility_cases_service_role" ON public.mobility_cases;
CREATE POLICY "mobility_cases_service_role" ON public.mobility_cases
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "mobility_workstreams_service_role" ON public.mobility_workstreams;
CREATE POLICY "mobility_workstreams_service_role" ON public.mobility_workstreams
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "mobility_dates_service_role" ON public.mobility_critical_dates;
CREATE POLICY "mobility_dates_service_role" ON public.mobility_critical_dates
  FOR ALL USING (auth.role() = 'service_role');

-- Case owner can read their own case (Black Cube: read-only via T1, writes go through API)
DROP POLICY IF EXISTS "mobility_cases_owner_select" ON public.mobility_cases;
CREATE POLICY "mobility_cases_owner_select" ON public.mobility_cases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.personas p
      WHERE p.id::text = mobility_cases.owner_persona_id
        AND p.auth_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "mobility_workstreams_owner_select" ON public.mobility_workstreams;
CREATE POLICY "mobility_workstreams_owner_select" ON public.mobility_workstreams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.mobility_cases mc
      JOIN public.personas p ON p.id::text = mc.owner_persona_id
      WHERE mc.id = mobility_workstreams.case_id
        AND p.auth_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "mobility_dates_owner_select" ON public.mobility_critical_dates;
CREATE POLICY "mobility_dates_owner_select" ON public.mobility_critical_dates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.mobility_cases mc
      JOIN public.personas p ON p.id::text = mc.owner_persona_id
      WHERE mc.id = mobility_critical_dates.case_id
        AND p.auth_profile_id = auth.uid()
    )
  );

COMMIT;
