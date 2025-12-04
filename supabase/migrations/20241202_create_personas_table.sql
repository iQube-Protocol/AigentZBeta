-- Create personas table for PersonaQube storage
-- This table stores encrypted wallet keys and persona metadata

CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL DEFAULT 'PersonaQube',
  
  -- FIO Identity
  fio_handle VARCHAR(128) NOT NULL UNIQUE,
  fio_domain VARCHAR(64) NOT NULL,
  root_did VARCHAR(128) NOT NULL,
  
  -- Display
  display_name VARCHAR(255) NOT NULL,
  avatar_uri TEXT,
  
  -- Encrypted EVM Key (stored as JSONB)
  -- Contains: publicKey, address, encryptedPrivateKey (ciphertext, iv, salt, authTag), keySource, createdAt
  evm_key JSONB NOT NULL,
  
  -- Chain Addresses (derived from EVM key)
  chain_addresses JSONB NOT NULL DEFAULT '{}',
  
  -- Reputation
  reputation_score INTEGER NOT NULL DEFAULT 0,
  reputation_bucket SMALLINT NOT NULL DEFAULT 0 CHECK (reputation_bucket >= 0 AND reputation_bucket <= 5),
  badges TEXT[] NOT NULL DEFAULT '{}',
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),
  
  -- Multi-tenancy
  tenant_id VARCHAR(128) NOT NULL,
  auth_profile_id UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- FIO Registration (optional, stored when registered on-chain)
  fio_registration JSONB
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_personas_tenant_id ON personas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_personas_auth_profile_id ON personas(auth_profile_id);
CREATE INDEX IF NOT EXISTS idx_personas_fio_domain ON personas(fio_domain);
CREATE INDEX IF NOT EXISTS idx_personas_status ON personas(status);
CREATE INDEX IF NOT EXISTS idx_personas_created_at ON personas(created_at DESC);

-- Unique constraint on FIO handle
CREATE UNIQUE INDEX IF NOT EXISTS idx_personas_fio_handle_unique ON personas(fio_handle);

-- Enable Row Level Security
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own personas (via auth_profile_id)
CREATE POLICY "Users can view own personas" ON personas
  FOR SELECT
  USING (auth.uid()::text = auth_profile_id::text OR auth_profile_id IS NULL);

-- Policy: Users can insert their own personas
CREATE POLICY "Users can insert own personas" ON personas
  FOR INSERT
  WITH CHECK (auth.uid()::text = auth_profile_id::text OR auth_profile_id IS NULL);

-- Policy: Users can update their own personas
CREATE POLICY "Users can update own personas" ON personas
  FOR UPDATE
  USING (auth.uid()::text = auth_profile_id::text OR auth_profile_id IS NULL);

-- Service role can do everything (for API routes)
CREATE POLICY "Service role full access" ON personas
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_personas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER personas_updated_at_trigger
  BEFORE UPDATE ON personas
  FOR EACH ROW
  EXECUTE FUNCTION update_personas_updated_at();

-- Comments for documentation
COMMENT ON TABLE personas IS 'PersonaQube storage - encrypted wallet keys and persona metadata';
COMMENT ON COLUMN personas.evm_key IS 'Encrypted EVM key pair with AES-256-GCM encryption';
COMMENT ON COLUMN personas.chain_addresses IS 'Derived addresses for each supported chain';
COMMENT ON COLUMN personas.reputation_bucket IS 'RQH reputation bucket (0-5 stars)';
