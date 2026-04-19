-- ============================================================================
-- Venture Lab α — Growth Matrix Scorecard Table
--
-- Stores venture assessments plotted on the 7×7 Growth Matrix.
-- Y-axis: Venture Development Maturity (Y1 Ideation → Y7 Scale)
-- X-axis: Commercialization Strength (X1 Pre-Market → X7 Market Leader)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.venture_lab_scorecard (
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_name          text         NOT NULL,
  venture_slug          text         NOT NULL UNIQUE,
  y_maturity            int          NOT NULL CHECK (y_maturity BETWEEN 1 AND 7),
  x_commercialization   int          NOT NULL CHECK (x_commercialization BETWEEN 1 AND 7),
  -- zone computed at write time for fast reads (formation|validation|activation|strategic|scale)
  zone                  text         NOT NULL DEFAULT 'formation',
  status                text         NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'draft', 'archived')),
  -- Full agent-ops record as JSONB
  -- Shape: { description, team, focus_area, key_milestones, risks, next_steps,
  --          council_agenda_items, owners, tags, overlay }
  payload               jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_by            text,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vls_maturity        ON public.venture_lab_scorecard (y_maturity);
CREATE INDEX IF NOT EXISTS idx_vls_commercialization ON public.venture_lab_scorecard (x_commercialization);
CREATE INDEX IF NOT EXISTS idx_vls_zone            ON public.venture_lab_scorecard (zone);
CREATE INDEX IF NOT EXISTS idx_vls_status          ON public.venture_lab_scorecard (status);

ALTER TABLE public.venture_lab_scorecard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vls_read_authenticated"
  ON public.venture_lab_scorecard FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "vls_write_service"
  ON public.venture_lab_scorecard FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.set_vls_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_vls_updated_at ON public.venture_lab_scorecard;
CREATE TRIGGER trg_vls_updated_at
  BEFORE UPDATE ON public.venture_lab_scorecard
  FOR EACH ROW EXECUTE FUNCTION public.set_vls_updated_at();
