-- Wallet Alias Commitments — privacy-preserving external wallet linkage
-- ─────────────────────────────────────────────────────────────────────
-- Step 2 of the wallet alias privacy refactor (after deprecating plaintext
-- writes to personas.evm_address / btc_address / sol_address on 2026-04-29).
--
-- This table stores ONLY commitments — never plaintext wallet addresses.
-- The commitment is a one-way hash of (persona_uuid + wallet_address + salt)
-- registered on the Escrow ICP canister (`register_alias`). The actual wallet
-- address lives in the persona's blakQube (encrypted, key derived from FIO
-- handle), not in any queryable Supabase table.
--
-- See:
--   codexes/packs/agentiq/updates/2026-04-29_plaintext-wallet-address-deprecation.md
--   codexes/packs/agentiq/updates/2026-04-27_cohort-escrow-root-did-reputation-backlog.md
--   services/ops/idl/escrow.ts

CREATE TABLE IF NOT EXISTS public.wallet_alias_commitments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_identity_id  uuid REFERENCES public.root_identity(id) ON DELETE CASCADE,
  did_persona_id    uuid REFERENCES public.did_persona(id) ON DELETE CASCADE,
  chain             text NOT NULL CHECK (chain IN ('evm','btc','sol')),
  alias_commitment  text NOT NULL UNIQUE,
  mailbox_id        text NOT NULL,
  alias_ttl_days    integer NOT NULL DEFAULT 90 CHECK (alias_ttl_days > 0),
  expires_at        timestamptz NOT NULL,
  status            text NOT NULL
    CHECK (status IN ('active','expired','revoked'))
    DEFAULT 'active',
  last_used_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.wallet_alias_commitments IS
  'Privacy-preserving external-wallet linkage. Stores only the commitment hash (registered on the Escrow ICP canister). The plaintext wallet address lives in the persona blakQube, never in this table.';
COMMENT ON COLUMN public.wallet_alias_commitments.alias_commitment IS
  'hash(persona_uuid + wallet_address + salt) — the commitment registered on the Escrow ICP canister via register_alias().';
COMMENT ON COLUMN public.wallet_alias_commitments.mailbox_id IS
  'ICP Escrow mailbox ID used by DVN to deliver credit notices (e.g. KNYT deposit confirmations) without exposing the persona<->wallet link.';
COMMENT ON COLUMN public.wallet_alias_commitments.chain IS
  'Chain family: evm | btc | sol. Distinguishes the address space the commitment was derived from.';
COMMENT ON COLUMN public.wallet_alias_commitments.alias_ttl_days IS
  'Time-to-live of the alias on the Escrow canister. Sweeper job revokes after expires_at.';

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wac_root_identity_id  ON public.wallet_alias_commitments (root_identity_id);
CREATE INDEX IF NOT EXISTS idx_wac_did_persona_id    ON public.wallet_alias_commitments (did_persona_id);
CREATE INDEX IF NOT EXISTS idx_wac_persona_chain     ON public.wallet_alias_commitments (did_persona_id, chain, status);
CREATE INDEX IF NOT EXISTS idx_wac_expires_at_active ON public.wallet_alias_commitments (expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_wac_status            ON public.wallet_alias_commitments (status);

-- ─── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.wac_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wac_set_updated_at ON public.wallet_alias_commitments;
CREATE TRIGGER trg_wac_set_updated_at
  BEFORE UPDATE ON public.wallet_alias_commitments
  FOR EACH ROW EXECUTE FUNCTION public.wac_set_updated_at();

-- ─── RLS — same pattern as did_persona ───────────────────────────────────────
ALTER TABLE public.wallet_alias_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wac select own" ON public.wallet_alias_commitments;
CREATE POLICY "wac select own" ON public.wallet_alias_commitments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.root_identity ri
      WHERE ri.id = wallet_alias_commitments.root_identity_id
        AND (ri.auth_user_id = auth.uid() OR auth.role() = 'service_role')
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "wac insert own" ON public.wallet_alias_commitments;
CREATE POLICY "wac insert own" ON public.wallet_alias_commitments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.root_identity ri
      WHERE ri.id = wallet_alias_commitments.root_identity_id
        AND (ri.auth_user_id = auth.uid() OR auth.role() = 'service_role')
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "wac update own" ON public.wallet_alias_commitments;
CREATE POLICY "wac update own" ON public.wallet_alias_commitments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.root_identity ri
      WHERE ri.id = wallet_alias_commitments.root_identity_id
        AND (ri.auth_user_id = auth.uid() OR auth.role() = 'service_role')
    )
    OR auth.role() = 'service_role'
  );

-- Deletes are NOT allowed via RLS — use status='revoked' for audit continuity.
-- Service role bypass remains via the policies above only by explicit ALTER.
