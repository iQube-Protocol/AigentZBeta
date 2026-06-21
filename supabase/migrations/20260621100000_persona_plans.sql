-- Persona plan tiers — the entitlement layer for metaMe's commercial model.
--
-- One row per persona. Captures the agency plan (Citizen / Citizen Plus /
-- Sovereign / First Citizen) and the Founder Office add-on tier (none / Basic /
-- Pro / Elite). Gates VentureQube Lite (free, single venture) vs Pro
-- (multi-venture + premium surfaces). Step 4 of the commercial workstream.
--
-- T0 discipline: persona_id is server-internal only (service-role RLS). Checkout
-- / billing is stubbed for now — rows are set by admin/grant until the payment
-- rails are wired; the read path + gating are live.

BEGIN;

CREATE TABLE IF NOT EXISTS public.persona_plans (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  -- T0 — server-internal only. Never serialised to browser/receipt.
  persona_id          text        NOT NULL UNIQUE,
  plan_tier           text        NOT NULL DEFAULT 'citizen'
    CHECK (plan_tier IN ('citizen','citizen_plus','sovereign_citizen','first_citizen')),
  founder_office_tier text        NOT NULL DEFAULT 'none'
    CHECK (founder_office_tier IN ('none','basic','pro','elite')),
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
  'Persona plan tiers (agency + Founder Office) — entitlement layer for VentureQube Lite/Pro gating.';
COMMENT ON COLUMN public.persona_plans.persona_id IS
  'T0 — server-internal only. Never serialised to the browser or a receipt.';

COMMIT;
