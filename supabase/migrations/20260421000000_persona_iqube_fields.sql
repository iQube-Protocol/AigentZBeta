-- Persona iQube schema additions
-- Adds: Solana key, FIO/KNYT handles, Qripto KNYT holding, new asset fields,
--       field renames (Paper→Print Comics, KNYT-Cards→Print+Digital Cards)

-- ─────────────────────────────────────────────────────────────────────────────
-- nakamoto_knyt_personas
-- ─────────────────────────────────────────────────────────────────────────────

-- Wallet keys (user-editable / manual or wallet-connect)
ALTER TABLE public."nakamoto_knyt_personas"
  ADD COLUMN IF NOT EXISTS "Solana-Public-Key" text DEFAULT '';

-- DIDQube / wallet-issued handles (system-locked once set)
ALTER TABLE public."nakamoto_knyt_personas"
  ADD COLUMN IF NOT EXISTS "fio_handle" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "knyt_handle" text DEFAULT '';

-- Crypto KNYT Holdings (chain-read / locked)
-- KNYT-COYN-Owned already exists (legacy EVM mainnet)
ALTER TABLE public."nakamoto_knyt_personas"
  ADD COLUMN IF NOT EXISTS "KNYT-COYN-Qripto-Owned" text DEFAULT '',  -- Qripto wallet holdings
  ADD COLUMN IF NOT EXISTS "metaknyts_iqubes_owned" text DEFAULT '';   -- KNYT store purchases (Autonomys/chain)

-- Non-Crypto KNYT Holdings (user-editable)
ALTER TABLE public."nakamoto_knyt_personas"
  ADD COLUMN IF NOT EXISTS "Print-Comics-Owned" text DEFAULT '',   -- replaces Paper-Comics-Owned
  ADD COLUMN IF NOT EXISTS "Print-Cards-Owned" text DEFAULT '',    -- new (split from KNYT-Cards-Owned)
  ADD COLUMN IF NOT EXISTS "Digital-Cards-Owned" text DEFAULT '',  -- new (split from KNYT-Cards-Owned)
  ADD COLUMN IF NOT EXISTS "print_episodes_owned" text DEFAULT '';  -- user-entered print episodes

-- Copy legacy data into new columns and mark old ones deprecated
UPDATE public."nakamoto_knyt_personas"
  SET "Print-Comics-Owned" = "Paper-Comics-Owned"
  WHERE "Print-Comics-Owned" = '' AND "Paper-Comics-Owned" != '';

UPDATE public."nakamoto_knyt_personas"
  SET "Print-Cards-Owned" = "KNYT-Cards-Owned"
  WHERE "Print-Cards-Owned" = '' AND "KNYT-Cards-Owned" != '';

-- ─────────────────────────────────────────────────────────────────────────────
-- nakamoto_qripto_personas
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public."nakamoto_qripto_personas"
  ADD COLUMN IF NOT EXISTS "Solana-Public-Key" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "fio_handle" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "knyt_handle" text DEFAULT '';

-- ─────────────────────────────────────────────────────────────────────────────
-- iqube_mint_stubs — staging table for persona iQube minting
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public."iqube_mint_stubs" (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL,
  iqube_type          text NOT NULL,          -- 'knyt_persona' | 'qripto_persona'
  template_id         text,
  metaqube_payload    jsonb,                  -- plaintext metaQube (template structure + scores + non-PII)
  blakqube_ciphertext bytea,                  -- AES-256-GCM encrypted blakQube payload
  blakqube_iv         bytea,                  -- GCM initialisation vector
  autonomys_cid       text,                   -- Autonomys Drive CID (null until minted)
  chain_tx            text,                   -- On-chain tx hash (null until minted)
  status              text NOT NULL DEFAULT 'staged',  -- staged | minting | minted | failed
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public."iqube_mint_stubs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iqube_mint_stubs_user_select"
  ON public."iqube_mint_stubs" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "iqube_mint_stubs_user_insert"
  ON public."iqube_mint_stubs" FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "iqube_mint_stubs_user_update"
  ON public."iqube_mint_stubs" FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role bypass (for admin reads and background minting jobs)
CREATE POLICY "iqube_mint_stubs_service_role"
  ON public."iqube_mint_stubs"
  USING (auth.role() = 'service_role');
