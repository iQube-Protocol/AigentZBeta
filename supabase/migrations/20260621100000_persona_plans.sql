-- Persona plan tiers — the entitlement layer for metaMe's commercial model.
--
-- One row per persona. `plan_tier` is the (free) citizen/agency ladder (room for
-- future premium citizen levels); `venture_tier` gates Venture Lab access:
--   none  = free Citizen — NO Venture Lab cartridge, 0 ventures (glimpse badge only)
--   lite  = 1 venture + Venture Lab + Marketa
--   pro   = 3 ventures
--   elite = unlimited ventures
-- Venture Lab cartridge ACCESS itself is the paywall (venture_tier != none).
-- Step 4 of the commercial workstream. T0 persona_id, service-role RLS.
-- Checkout is stubbed — rows are admin/granted until payment rails are wired.

BEGIN;

CREATE TABLE IF NOT EXISTS public.persona_plans (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  -- T0 — server-internal only. Never serialised to browser/receipt.
  persona_id          text        NOT NULL UNIQUE,
  plan_tier           text        NOT NULL DEFAULT 'citizen'
    CHECK (plan_tier IN ('citizen','citizen_plus','sovereign_citizen','first_citizen')),
  venture_tier        text        NOT NULL DEFAULT 'none'
    CHECK (venture_tier IN ('none','lite','pro','elite')),
  status              text        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','past_due','cancelled')),
  -- How the plan was set — 'grant'/'admin' until checkout is wired.
  source              text        NOT NULL DEFAULT 'grant',
  current_period_end  timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persona_plans_persona ON public.persona_plans (persona_id);

ALTER TABLE public.persona_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "persona_plans_read_service"
  ON public.persona_plans FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "persona_plans_write_service"
  ON public.persona_plans FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER persona_plans_updated_at
  BEFORE UPDATE ON public.persona_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.persona_plans IS
  'Persona plan tiers — entitlement layer. venture_tier gates Venture Lab access (none=free citizen, lite/pro/elite=paid).';
COMMENT ON COLUMN public.persona_plans.persona_id IS
  'T0 — server-internal only. Never serialised to the browser or a receipt.';

COMMIT;

