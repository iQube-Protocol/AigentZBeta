-- ============================================================================
-- CRM Persona Linking Migration
-- ============================================================================
-- Links CRM personas to identity personas via registry profiles
-- Ensures single source of truth between CRM and Identity systems
-- ============================================================================

-- ============================================================================
-- 1. Add identity linking columns to crm_personas if not exists
-- ============================================================================

ALTER TABLE crm_personas 
ADD COLUMN IF NOT EXISTS identity_persona_id UUID,
ADD COLUMN IF NOT EXISTS root_did TEXT,
ADD COLUMN IF NOT EXISTS kybe_did TEXT,
ADD COLUMN IF NOT EXISTS reputation_bucket INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reputation_score DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS reputation_updated_at TIMESTAMPTZ;

-- Index for identity lookups
CREATE INDEX IF NOT EXISTS idx_crm_personas_identity_persona 
ON crm_personas(identity_persona_id) WHERE identity_persona_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_personas_root_did 
ON crm_personas(root_did) WHERE root_did IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_personas_kybe_did 
ON crm_personas(kybe_did) WHERE kybe_did IS NOT NULL;

-- ============================================================================
-- 2. Create view to join CRM personas with identity personas
-- ============================================================================

CREATE OR REPLACE VIEW crm_personas_with_identity AS
SELECT 
  cp.*,
  p.id AS identity_id,
  p.fio_handle,
  p.default_identity_state,
  p.world_id_status,
  p.app_origin,
  ri.did_uri AS root_did_uri,
  ri.kyc_status,
  ki.kybe_did AS kybe_did_value,
  ki.state AS kybe_state
FROM crm_personas cp
LEFT JOIN persona p ON cp.identity_persona_id = p.id
LEFT JOIN root_identity ri ON p.root_id = ri.id
LEFT JOIN kybe_identity ki ON ri.kybe_id = ki.id;

-- ============================================================================
-- 3. Function to link CRM persona to identity persona
-- ============================================================================

CREATE OR REPLACE FUNCTION link_crm_persona_to_identity(
  p_crm_persona_id UUID,
  p_identity_persona_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_root_did TEXT;
  v_kybe_did TEXT;
BEGIN
  -- Get identity info
  SELECT 
    ri.did_uri,
    ki.kybe_did
  INTO v_root_did, v_kybe_did
  FROM persona p
  LEFT JOIN root_identity ri ON p.root_id = ri.id
  LEFT JOIN kybe_identity ki ON ri.kybe_id = ki.id
  WHERE p.id = p_identity_persona_id;
  
  -- Update CRM persona with identity link
  UPDATE crm_personas
  SET 
    identity_persona_id = p_identity_persona_id,
    root_did = v_root_did,
    kybe_did = v_kybe_did,
    updated_at = NOW()
  WHERE id = p_crm_persona_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Function to sync reputation from ReputationHub to CRM
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_crm_persona_reputation(
  p_crm_persona_id UUID,
  p_reputation_bucket INTEGER,
  p_reputation_score DECIMAL(10,4)
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE crm_personas
  SET 
    reputation_bucket = p_reputation_bucket,
    reputation_score = p_reputation_score,
    reputation_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_crm_persona_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Auto-link existing CRM personas by email/fio_handle match
-- ============================================================================

-- Link by email match (if persona has matching fio_handle pattern)
UPDATE crm_personas cp
SET identity_persona_id = p.id
FROM persona p
WHERE cp.identity_persona_id IS NULL
  AND cp.email IS NOT NULL
  AND p.fio_handle IS NOT NULL
  AND (
    cp.email = p.fio_handle 
    OR cp.email LIKE '%' || SPLIT_PART(p.fio_handle, '@', 1) || '%'
  );

-- ============================================================================
-- 6. Ensure registry persona links table has proper structure
-- ============================================================================

-- Add reputation columns to registry persona links if not exists
ALTER TABLE crm_registry_persona_links
ADD COLUMN IF NOT EXISTS reputation_bucket INTEGER,
ADD COLUMN IF NOT EXISTS reputation_score DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- ============================================================================
-- 7. Create trigger to auto-update registry links on CRM persona changes
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_registry_persona_link()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_uuid UUID;
BEGIN
  -- If CRM persona has identity link, ensure registry link exists
  IF NEW.identity_persona_id IS NOT NULL THEN
    -- Resolve tenant UUID (crm_personas.tenant_id may be a UUID string or a slug like 'demo-tenant')
    SELECT t.id
    INTO v_tenant_uuid
    FROM crm_tenants t
    WHERE t.id::text = NEW.tenant_id
       OR t.slug = NEW.tenant_id
    LIMIT 1;

    -- If tenant cannot be resolved, skip linking to avoid type mismatch / bad data
    IF v_tenant_uuid IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO crm_registry_persona_links (
      registry_profile_id,
      persona_id,
      tenant_id,
      is_primary_for_tenant
    )
    SELECT 
      rp.id,
      NEW.id,
      v_tenant_uuid,
      TRUE
    FROM crm_registry_profiles rp
    WHERE rp.kybe_did = NEW.kybe_did
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_registry_persona_link ON crm_personas;
CREATE TRIGGER trg_sync_registry_persona_link
AFTER INSERT OR UPDATE OF identity_persona_id, kybe_did ON crm_personas
FOR EACH ROW
EXECUTE FUNCTION sync_registry_persona_link();

-- ============================================================================
-- 8. Comments
-- ============================================================================

COMMENT ON COLUMN crm_personas.identity_persona_id IS 'Links to identity.persona table for unified identity';
COMMENT ON COLUMN crm_personas.root_did IS 'Root DID from identity system (for admin/regulated contexts)';
COMMENT ON COLUMN crm_personas.kybe_did IS 'KybeDID from identity system (personhood anchor)';
COMMENT ON COLUMN crm_personas.reputation_bucket IS 'Cached reputation bucket from ReputationHub (0-5)';
COMMENT ON COLUMN crm_personas.reputation_score IS 'Cached reputation score from ReputationHub';
COMMENT ON FUNCTION link_crm_persona_to_identity IS 'Links a CRM persona to an identity persona and syncs DID info';
COMMENT ON FUNCTION sync_crm_persona_reputation IS 'Updates cached reputation data from ReputationHub canister';
