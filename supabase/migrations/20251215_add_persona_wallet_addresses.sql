-- Add external wallet address columns to personas table
-- These allow users to link external wallets (EVM, BTC, SOL) to their persona

ALTER TABLE personas 
ADD COLUMN IF NOT EXISTS evm_address VARCHAR(42),
ADD COLUMN IF NOT EXISTS btc_address VARCHAR(64),
ADD COLUMN IF NOT EXISTS sol_address VARCHAR(44),
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add indexes for wallet address lookups
CREATE INDEX IF NOT EXISTS idx_personas_evm_address ON personas(evm_address) WHERE evm_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personas_btc_address ON personas(btc_address) WHERE btc_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personas_sol_address ON personas(sol_address) WHERE sol_address IS NOT NULL;

-- Comments
COMMENT ON COLUMN personas.evm_address IS 'External EVM wallet address (MetaMask, etc.)';
COMMENT ON COLUMN personas.btc_address IS 'External Bitcoin wallet address';
COMMENT ON COLUMN personas.sol_address IS 'External Solana wallet address';
COMMENT ON COLUMN personas.bio IS 'User bio/description';
