-- DEPRECATED 2026-04-29 — DO NOT WRITE TO THESE COLUMNS.
-- See codexes/packs/agentiq/updates/2026-04-29_plaintext-wallet-address-deprecation.md
-- Plaintext wallet addresses on personas violate the iQube identity sovereignty
-- model. Replacement: Escrow alias commitment scheme.
--
-- Add wallet address columns to persona table (singular)
-- This mirrors the migration for personas (plural) table
-- Both human and agent personas can have linked external wallet addresses

ALTER TABLE persona 
ADD COLUMN IF NOT EXISTS evm_address VARCHAR(42),
ADD COLUMN IF NOT EXISTS btc_address VARCHAR(64),
ADD COLUMN IF NOT EXISTS sol_address VARCHAR(44),
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add indexes for wallet address lookups
CREATE INDEX IF NOT EXISTS idx_persona_evm_address ON persona(evm_address) WHERE evm_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_persona_btc_address ON persona(btc_address) WHERE btc_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_persona_sol_address ON persona(sol_address) WHERE sol_address IS NOT NULL;

-- Comments
COMMENT ON COLUMN persona.evm_address IS 'External EVM wallet address (MetaMask, etc.) - synced to FIO network';
COMMENT ON COLUMN persona.btc_address IS 'External Bitcoin wallet address - synced to FIO network';
COMMENT ON COLUMN persona.sol_address IS 'External Solana wallet address - synced to FIO network';
COMMENT ON COLUMN persona.bio IS 'User bio/description';
