-- Plan payment premium config — admin-tunable rail premiums.
--
-- The per-rail premium model (mirrored from the KNYT cartridge) was previously
-- env-only (USDC_FEE_PERCENT, PAYPAL_FEE_PERCENT, FIAT_PREMIUM_PERCENT). This
-- table makes those premiums editable by a metaMe admin in the Plan Pricing
-- surface, so charges are not hard-wired.
--
-- Values are stored in BASIS POINTS (integer) to keep the same no-float
-- discipline as price_usd_cents. 100 bps = 1%. Effective rail charges:
--   Q¢     = base                                  (house rate, no premium)
--   USDC   = base × (1 + usdc_fee + fiat_premium)  bps
--   PayPal = base × (1 + paypal_fee + fiat_premium) bps

CREATE TABLE IF NOT EXISTS public.plan_premium_config (
  premium_key text        PRIMARY KEY CHECK (premium_key IN (
                            'usdc_fee','paypal_fee','fiat_premium','qct_premium')),
  value_bps   integer     NOT NULL CHECK (value_bps >= 0 AND value_bps <= 10000),
  description text,
  updated_by  text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed defaults matching the historical env knobs.
INSERT INTO public.plan_premium_config (premium_key, value_bps, description) VALUES
  ('usdc_fee',     100, 'USDC network/settlement fee (1.00%)'),
  ('paypal_fee',   300, 'PayPal processing fee (3.00%)'),
  ('fiat_premium', 700, 'Fiat/off-house premium applied to USDC + PayPal (7.00%)'),
  ('qct_premium',    0, 'Q¢ premium — house currency, normally 0')
ON CONFLICT (premium_key) DO NOTHING;

ALTER TABLE public.plan_premium_config ENABLE ROW LEVEL SECURITY;

-- Authenticated reads (quote endpoint resolves premiums); writes are
-- service-role only (admin route uses the server client).
CREATE POLICY "plan_premium_config_read_authenticated"
  ON public.plan_premium_config FOR SELECT TO authenticated USING (true);
