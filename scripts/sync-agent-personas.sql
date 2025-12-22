-- ============================================================================
-- Sync Agent Personas with @aigent FIO Handles
-- ============================================================================
-- This script ensures all agent personas have the correct @aigent FIO handles
-- and links them to the agent_keys table via persona_id
-- ============================================================================

-- First, let's see what personas exist with agent-related handles
SELECT id, fio_handle, world_id_status, created_at 
FROM persona 
WHERE fio_handle LIKE '%moneypenny%' 
   OR fio_handle LIKE '%aigentz%' 
   OR fio_handle LIKE '%kn0w1%' 
   OR fio_handle LIKE '%nakamoto%'
   OR fio_handle LIKE '%@aigent%';

-- ============================================================================
-- Update any @qripto agent handles to @aigent
-- ============================================================================

-- Update moneypenny@qripto to moneypenny@aigent
UPDATE persona 
SET fio_handle = 'moneypenny@aigent'
WHERE fio_handle = 'moneypenny@qripto';

-- Update aigentz@qripto to aigentz@aigent
UPDATE persona 
SET fio_handle = 'aigentz@aigent'
WHERE fio_handle = 'aigentz@qripto';

-- Update kn0w1@qripto to kn0w1@aigent
UPDATE persona 
SET fio_handle = 'kn0w1@aigent'
WHERE fio_handle = 'kn0w1@qripto';

-- Update nakamoto@qripto to nakamoto@aigent
UPDATE persona 
SET fio_handle = 'nakamoto@aigent'
WHERE fio_handle = 'nakamoto@qripto';

-- ============================================================================
-- Create agent personas if they don't exist
-- ============================================================================

-- Insert Aigent Z persona if not exists
INSERT INTO persona (fio_handle, default_identity_state, world_id_status, app_origin)
SELECT 'aigentz@aigent', 'semi_anonymous', 'agent_declared', 'aigentiq'
WHERE NOT EXISTS (SELECT 1 FROM persona WHERE fio_handle = 'aigentz@aigent');

-- Insert MoneyPenny persona if not exists
INSERT INTO persona (fio_handle, default_identity_state, world_id_status, app_origin)
SELECT 'moneypenny@aigent', 'semi_anonymous', 'agent_declared', 'aigentiq'
WHERE NOT EXISTS (SELECT 1 FROM persona WHERE fio_handle = 'moneypenny@aigent');

-- Insert Kn0w1 persona if not exists
INSERT INTO persona (fio_handle, default_identity_state, world_id_status, app_origin)
SELECT 'kn0w1@aigent', 'semi_anonymous', 'agent_declared', 'aigentiq'
WHERE NOT EXISTS (SELECT 1 FROM persona WHERE fio_handle = 'kn0w1@aigent');

-- Insert Nakamoto persona if not exists
INSERT INTO persona (fio_handle, default_identity_state, world_id_status, app_origin)
SELECT 'nakamoto@aigent', 'semi_anonymous', 'agent_declared', 'aigentiq'
WHERE NOT EXISTS (SELECT 1 FROM persona WHERE fio_handle = 'nakamoto@aigent');

-- ============================================================================
-- Link agent_keys to persona via persona_id
-- ============================================================================

-- Link aigent-z to its persona
UPDATE agent_keys 
SET persona_id = (SELECT id FROM persona WHERE fio_handle = 'aigentz@aigent' LIMIT 1)
WHERE agent_id = 'aigent-z' 
  AND persona_id IS NULL;

-- Link aigent-moneypenny to its persona
UPDATE agent_keys 
SET persona_id = (SELECT id FROM persona WHERE fio_handle = 'moneypenny@aigent' LIMIT 1)
WHERE agent_id = 'aigent-moneypenny' 
  AND persona_id IS NULL;

-- Link aigent-kn0w1 to its persona
UPDATE agent_keys 
SET persona_id = (SELECT id FROM persona WHERE fio_handle = 'kn0w1@aigent' LIMIT 1)
WHERE agent_id = 'aigent-kn0w1' 
  AND persona_id IS NULL;

-- Link aigent-nakamoto to its persona
UPDATE agent_keys 
SET persona_id = (SELECT id FROM persona WHERE fio_handle = 'nakamoto@aigent' LIMIT 1)
WHERE agent_id = 'aigent-nakamoto' 
  AND persona_id IS NULL;

-- ============================================================================
-- Verify the results
-- ============================================================================

-- Show all agent personas
SELECT p.id as persona_id, p.fio_handle, p.world_id_status, 
       ak.agent_id, ak.evm_address, ak.btc_address, ak.solana_address
FROM persona p
LEFT JOIN agent_keys ak ON ak.persona_id = p.id OR ak.fio_handle = p.fio_handle
WHERE p.fio_handle LIKE '%@aigent%'
ORDER BY p.fio_handle;

-- Show agent_keys with their linked personas
SELECT ak.agent_id, ak.agent_name, ak.fio_handle, ak.persona_id,
       ak.evm_address, ak.btc_address, ak.solana_address
FROM agent_keys ak
WHERE ak.agent_id IN ('aigent-z', 'aigent-moneypenny', 'aigent-kn0w1', 'aigent-nakamoto')
ORDER BY ak.agent_id;
