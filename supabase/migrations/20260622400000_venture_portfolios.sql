-- ============================================================================
-- venture_portfolios — per-citizen portfolio layer over their own VentureQubes.
--
-- The user-owned venture model (venture_qubes) and the Venture Lab portfolio
-- VIEW (venture_lab_scorecard, admin-curated) already exist. This table adds the
-- thin cross-venture layer the Venture Portfolio wizard (Pro/Elite) needs:
-- portfolio-level thesis, an explicit priority ordering of the citizen's own
-- ventures, and free-form notes. Everything else (the ventures themselves,
-- their matrix positions, shared capabilities) is DERIVED from venture_qubes —
-- this table only stores what the operator decides.
--
-- One portfolio per persona. Additive + idempotent. Service-role RLS (the same
-- model as vsp_* and venture_qubes — all access flows through API routes that
-- resolve the persona via the spine).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.venture_portfolios (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_persona_id  uuid        NOT NULL UNIQUE,
  thesis            text,
  -- Ordered list of venture_qubes.id (the operator's prioritisation).
  priorities        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  notes             text,
  payload           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venture_portfolios_owner ON public.venture_portfolios(owner_persona_id);

-- updated_at trigger (reuses the shared set_updated_at() from the vsp migration).
DROP TRIGGER IF EXISTS venture_portfolios_updated_at ON public.venture_portfolios;
CREATE TRIGGER venture_portfolios_updated_at
  BEFORE UPDATE ON public.venture_portfolios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.venture_portfolios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_venture_portfolios" ON public.venture_portfolios;
CREATE POLICY "service_role_venture_portfolios" ON public.venture_portfolios
  FOR ALL TO service_role USING (true) WITH CHECK (true);
