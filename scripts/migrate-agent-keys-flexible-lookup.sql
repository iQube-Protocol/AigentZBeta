-- ============================================================================
-- Agent Keys Flexible Lookup Migration
-- ============================================================================
-- This migration enhances the agent_keys table to support lookups by:
-- 1. UUID (persona/agent ID)
-- 2. FIO handle (e.g., moneypenny@aigent, know1@aigent)
-- 3. Public key (EVM address, BTC address, SOL address)
--
-- Applies to both humans and agents.
-- ============================================================================

-- ============================================================================
-- 1. Add FIO handle column to agent_keys if not exists
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'agent_keys' 
    AND column_name = 'fio_handle'
  ) THEN
    ALTER TABLE public.agent_keys ADD COLUMN fio_handle TEXT;
  END IF;
END $$;

-- ============================================================================
-- 2. Add entity_type column to distinguish humans from agents
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'agent_keys' 
    AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE public.agent_keys ADD COLUMN entity_type TEXT DEFAULT 'agent' CHECK (entity_type IN ('agent', 'human', 'service'));
  END IF;
END $$;

-- ============================================================================
-- 3. Add persona_id column for UUID-based lookups (links to persona table)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'agent_keys' 
    AND column_name = 'persona_id'
  ) THEN
    ALTER TABLE public.agent_keys ADD COLUMN persona_id UUID REFERENCES public.persona(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. Create indexes for efficient lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_agent_keys_fio_handle ON public.agent_keys(fio_handle);
CREATE INDEX IF NOT EXISTS idx_agent_keys_persona_id ON public.agent_keys(persona_id);
CREATE INDEX IF NOT EXISTS idx_agent_keys_evm_address ON public.agent_keys(evm_address);
CREATE INDEX IF NOT EXISTS idx_agent_keys_btc_address ON public.agent_keys(btc_address);
CREATE INDEX IF NOT EXISTS idx_agent_keys_solana_address ON public.agent_keys(solana_address);

-- ============================================================================
-- 5. Create function to lookup agent keys by multiple identifiers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_agent_keys_flexible(
  p_identifier TEXT
)
RETURNS TABLE (
  agent_id TEXT,
  agent_name TEXT,
  fio_handle TEXT,
  persona_id UUID,
  entity_type TEXT,
  evm_address TEXT,
  btc_address TEXT,
  solana_address TEXT,
  evm_private_key_encrypted TEXT,
  btc_private_key_encrypted TEXT,
  solana_private_key_encrypted TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_uuid BOOLEAN;
  v_is_evm_address BOOLEAN;
  v_is_fio_handle BOOLEAN;
BEGIN
  -- Determine identifier type
  v_is_uuid := p_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_is_evm_address := p_identifier ~ '^0x[a-fA-F0-9]{40}$';
  v_is_fio_handle := p_identifier ~ '@';

  -- Try lookup by different identifier types
  RETURN QUERY
  SELECT 
    ak.agent_id,
    ak.agent_name,
    ak.fio_handle,
    ak.persona_id,
    ak.entity_type,
    ak.evm_address,
    ak.btc_address,
    ak.solana_address,
    ak.evm_private_key_encrypted,
    ak.btc_private_key_encrypted,
    ak.solana_private_key_encrypted,
    ak.created_at,
    ak.updated_at
  FROM public.agent_keys ak
  WHERE 
    -- Match by agent_id (string identifier like 'aigent-z')
    ak.agent_id = p_identifier
    -- Match by persona_id (UUID)
    OR (v_is_uuid AND ak.persona_id = p_identifier::UUID)
    -- Match by FIO handle
    OR (v_is_fio_handle AND LOWER(ak.fio_handle) = LOWER(p_identifier))
    -- Match by EVM address
    OR (v_is_evm_address AND LOWER(ak.evm_address) = LOWER(p_identifier))
    -- Match by BTC address
    OR ak.btc_address = p_identifier
    -- Match by Solana address
    OR ak.solana_address = p_identifier
  LIMIT 1;
END;
$$;

-- ============================================================================
-- 6. Create function to get public addresses only (safe for client-side)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_agent_addresses_flexible(
  p_identifier TEXT
)
RETURNS TABLE (
  agent_id TEXT,
  agent_name TEXT,
  fio_handle TEXT,
  entity_type TEXT,
  evm_address TEXT,
  btc_address TEXT,
  solana_address TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_is_uuid BOOLEAN;
  v_is_evm_address BOOLEAN;
  v_is_fio_handle BOOLEAN;
BEGIN
  -- Determine identifier type
  v_is_uuid := p_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_is_evm_address := p_identifier ~ '^0x[a-fA-F0-9]{40}$';
  v_is_fio_handle := p_identifier ~ '@';

  RETURN QUERY
  SELECT 
    ak.agent_id,
    ak.agent_name,
    ak.fio_handle,
    ak.entity_type,
    ak.evm_address,
    ak.btc_address,
    ak.solana_address
  FROM public.agent_keys ak
  WHERE 
    ak.agent_id = p_identifier
    OR (v_is_uuid AND ak.persona_id = p_identifier::UUID)
    OR (v_is_fio_handle AND LOWER(ak.fio_handle) = LOWER(p_identifier))
    OR (v_is_evm_address AND LOWER(ak.evm_address) = LOWER(p_identifier))
    OR ak.btc_address = p_identifier
    OR ak.solana_address = p_identifier
  LIMIT 1;
END;
$$;

-- ============================================================================
-- 7. Create function to register/update keys for a persona
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_agent_keys(
  p_agent_id TEXT,
  p_agent_name TEXT,
  p_fio_handle TEXT DEFAULT NULL,
  p_persona_id UUID DEFAULT NULL,
  p_entity_type TEXT DEFAULT 'agent',
  p_evm_address TEXT DEFAULT NULL,
  p_btc_address TEXT DEFAULT NULL,
  p_solana_address TEXT DEFAULT NULL,
  p_evm_private_key_encrypted TEXT DEFAULT NULL,
  p_btc_private_key_encrypted TEXT DEFAULT NULL,
  p_solana_private_key_encrypted TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.agent_keys (
    agent_id,
    agent_name,
    fio_handle,
    persona_id,
    entity_type,
    evm_address,
    btc_address,
    solana_address,
    evm_private_key_encrypted,
    btc_private_key_encrypted,
    solana_private_key_encrypted,
    created_at,
    updated_at
  ) VALUES (
    p_agent_id,
    p_agent_name,
    p_fio_handle,
    p_persona_id,
    p_entity_type,
    p_evm_address,
    p_btc_address,
    p_solana_address,
    p_evm_private_key_encrypted,
    p_btc_private_key_encrypted,
    p_solana_private_key_encrypted,
    NOW(),
    NOW()
  )
  ON CONFLICT (agent_id) DO UPDATE SET
    agent_name = COALESCE(EXCLUDED.agent_name, agent_keys.agent_name),
    fio_handle = COALESCE(EXCLUDED.fio_handle, agent_keys.fio_handle),
    persona_id = COALESCE(EXCLUDED.persona_id, agent_keys.persona_id),
    entity_type = COALESCE(EXCLUDED.entity_type, agent_keys.entity_type),
    evm_address = COALESCE(EXCLUDED.evm_address, agent_keys.evm_address),
    btc_address = COALESCE(EXCLUDED.btc_address, agent_keys.btc_address),
    solana_address = COALESCE(EXCLUDED.solana_address, agent_keys.solana_address),
    evm_private_key_encrypted = COALESCE(EXCLUDED.evm_private_key_encrypted, agent_keys.evm_private_key_encrypted),
    btc_private_key_encrypted = COALESCE(EXCLUDED.btc_private_key_encrypted, agent_keys.btc_private_key_encrypted),
    solana_private_key_encrypted = COALESCE(EXCLUDED.solana_private_key_encrypted, agent_keys.solana_private_key_encrypted),
    updated_at = NOW();
  
  RETURN p_agent_id;
END;
$$;

-- ============================================================================
-- 8. Link existing personas to agent_keys via FIO handle
-- ============================================================================
-- This updates agent_keys records to link them with persona records
-- based on matching FIO handles
UPDATE public.agent_keys ak
SET persona_id = p.id
FROM public.persona p
WHERE LOWER(ak.fio_handle) = LOWER(p.fio_handle)
  AND ak.persona_id IS NULL
  AND p.fio_handle IS NOT NULL;

-- ============================================================================
-- 9. Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_agent_keys_flexible(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_agent_addresses_flexible(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_addresses_flexible(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.upsert_agent_keys(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ============================================================================
-- 10. Add comments for documentation
-- ============================================================================
COMMENT ON FUNCTION public.get_agent_keys_flexible(TEXT) IS 
  'Retrieves agent keys by UUID, FIO handle, agent_id string, or public address. Returns encrypted private keys (service_role only).';

COMMENT ON FUNCTION public.get_agent_addresses_flexible(TEXT) IS 
  'Retrieves public addresses only by UUID, FIO handle, agent_id string, or public address. Safe for client-side use.';

COMMENT ON FUNCTION public.upsert_agent_keys(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS 
  'Creates or updates agent keys record. Links persona_id and fio_handle for flexible lookups.';

COMMENT ON COLUMN public.agent_keys.fio_handle IS 'FIO handle for this agent/human (e.g., moneypenny@aigent)';
COMMENT ON COLUMN public.agent_keys.persona_id IS 'UUID linking to persona table for human users';
COMMENT ON COLUMN public.agent_keys.entity_type IS 'Type of entity: agent, human, or service';

-- ============================================================================
-- Verification queries
-- ============================================================================
-- Check new columns exist:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agent_keys';

-- Test flexible lookup:
-- SELECT * FROM get_agent_keys_flexible('aigent-z');
-- SELECT * FROM get_agent_keys_flexible('moneypenny@aigent');
-- SELECT * FROM get_agent_keys_flexible('0x1234...');
-- SELECT * FROM get_agent_keys_flexible('53926312-4d3c-4915-bb84-0962d8f5e0e9');

-- Check public addresses only:
-- SELECT * FROM get_agent_addresses_flexible('moneypenny@aigent');
