-- Plan checkout sessions — T0-safe PayPal handoff store.
--
-- The PayPal return handler runs without a spine session (the popup
-- navigates PayPal → our return_url, carrying no Authorization bearer).
-- To recover the buyer's personaId on return WITHOUT leaking a T0
-- identifier into PayPal's custom_id, we persist the checkout intent
-- server-side keyed by a random, non-T0 checkout_id. Only the checkout_id
-- travels to PayPal (as custom_id); personaId stays in this table.
--
-- Rows are short-lived: created at order-create, consumed at capture.
-- A row is idempotent on (paypal_order_id) so a double-capture is a no-op.

CREATE TABLE IF NOT EXISTS public.plan_checkout_sessions (
  checkout_id     text        PRIMARY KEY,
  persona_id      text        NOT NULL,
  tier_key        text        NOT NULL CHECK (tier_key IN (
                                'sovereign_citizen','steward',
                                'venture_lite','venture_pro','venture_elite')),
  rail            text        NOT NULL CHECK (rail IN ('qc','usdc','paypal')),
  price_usd_cents integer     NOT NULL CHECK (price_usd_cents >= 0),
  paypal_order_id text,
  -- On-chain settlement reference (USDC tx hash on Base). Recorded at capture
  -- so the same transfer can never settle two plan purchases.
  external_ref    text,
  status          text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','captured','failed','cancelled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Look up a pending session by the PayPal order id on capture/return.
CREATE INDEX IF NOT EXISTS idx_plan_checkout_sessions_paypal_order
  ON public.plan_checkout_sessions (paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

-- Idempotency: one on-chain transfer settles at most one plan purchase.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_plan_checkout_sessions_external_ref
  ON public.plan_checkout_sessions (external_ref)
  WHERE external_ref IS NOT NULL;

-- Reap stale pending sessions (housekeeping cron can sweep on created_at).
CREATE INDEX IF NOT EXISTS idx_plan_checkout_sessions_pending_created
  ON public.plan_checkout_sessions (created_at)
  WHERE status = 'pending';

-- Server-internal table: no anon/authenticated access. Only the service
-- role (server routes) reads/writes it. RLS on with no policies = deny all
-- to client roles, which is exactly what we want for a T0-bearing store.
ALTER TABLE public.plan_checkout_sessions ENABLE ROW LEVEL SECURITY;
