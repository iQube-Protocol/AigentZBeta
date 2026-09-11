-- Plan price config — admin-editable price table for citizen and Founder Office tiers.
-- One row per tier key. Prices are stored in USD cents (integer) to avoid float math.
-- Only admin-role service_role callers may write this table (RLS below).

CREATE TABLE IF NOT EXISTS public.plan_price_config (
  tier_key        text        PRIMARY KEY
    CHECK (tier_key IN (
      'sovereign_citizen',
      'steward',
      'venture_lite',
      'venture_pro',
      'venture_elite'
    )),
  price_usd_cents integer     NOT NULL CHECK (price_usd_cents >= 0),
  active          boolean     NOT NULL DEFAULT true,
  description     text,
  updated_by      text,         -- FIO handle or admin user ref (T1-safe)
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed default alpha prices (all in USD cents).
INSERT INTO public.plan_price_config (tier_key, price_usd_cents, description) VALUES
  ('sovereign_citizen', 2900,  'Tier 1 — Sovereignty ($29/month)'),
  ('steward',           9900,  'Tier 2 — Stewardship ($99/month)'),
  ('venture_lite',      29900, 'Founder Office Operator ($299/month)'),
  ('venture_pro',       99900, 'Operator Plus ($999/month)'),
  ('venture_elite',     299900,'Portfolio Operator ($2,999/month)')
ON CONFLICT (tier_key) DO NOTHING;

-- RLS: readable by authenticated users (needed for checkout quote);
--      writable only by service_role (admin API routes use the Supabase admin client).
ALTER TABLE public.plan_price_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_price_config_read_authenticated"
  ON public.plan_price_config
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policy for authenticated role — service_role bypasses RLS.
