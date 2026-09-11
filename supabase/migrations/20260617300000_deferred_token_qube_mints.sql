-- 20260617300000 — Deferred tokenQube mint queue
--
-- Per the protocol's deferred-mint aspect: a tokenQube mint can be queued for a
-- later batch process instead of minting synchronously, and mints targeting a
-- chain that isn't live yet are parked here until that chain is wired. The
-- batch processor (future) drains pending rows.
--
-- T0-T2: persona_id is T0 (server-internal only — never returned in client
-- JSON). token_id_commitment is the T2-safe deterministic token id (a one-way
-- commitment), and iqube_id is the registry SoT id. No BlakQube data is stored.

BEGIN;

CREATE TABLE IF NOT EXISTS public.deferred_token_qube_mints (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Registry SoT id (iqube_id_map.iqube_id) this mint anchors to.
  iqube_id             uuid,
  -- T0 — server-internal only.
  persona_id           text        NOT NULL,
  target_chain         text        NOT NULL,
  -- T2-safe deterministic token id (hex uint256 commitment).
  token_id_commitment  text        NOT NULL,
  owner_address        text,
  status               text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'minted', 'failed', 'cancelled')),
  -- Why it was deferred: 'batch' | 'chain_not_live' | 'env_unconfigured'.
  reason               text,
  tx_hash              text,
  error                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  minted_at            timestamptz,
  -- One open queue entry per (persona, chain, token id).
  CONSTRAINT deferred_mint_unique UNIQUE (persona_id, target_chain, token_id_commitment)
);

CREATE INDEX IF NOT EXISTS idx_deferred_mints_status ON public.deferred_token_qube_mints (status);
CREATE INDEX IF NOT EXISTS idx_deferred_mints_chain  ON public.deferred_token_qube_mints (target_chain, status);

COMMENT ON TABLE public.deferred_token_qube_mints IS
  'Queue for tokenQube mints deferred to a batch process or awaiting a non-live chain. persona_id is T0.';
COMMENT ON COLUMN public.deferred_token_qube_mints.persona_id IS 'T0 — server-internal only. Never returned in client JSON.';

ALTER TABLE public.deferred_token_qube_mints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deferred_mints_service" ON public.deferred_token_qube_mints;
CREATE POLICY "deferred_mints_service" ON public.deferred_token_qube_mints
  FOR ALL USING (auth.role() = 'service_role');

-- Link the persona mint to its registry SoT id (iqube_id_map.iqube_id) for
-- idempotency — re-mint reuses the existing registry entry rather than
-- creating a duplicate metaQube.
ALTER TABLE public.persona_qube_mints
  ADD COLUMN IF NOT EXISTS iqube_id uuid;

COMMIT;
