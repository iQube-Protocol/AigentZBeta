-- ========================================
-- ENCRYPTED AGENT KEYS UPDATE SCRIPT
-- Run this in Supabase SQL Editor
-- Generated: 2025-11-03T17:38:10.796Z
-- Encryption Key: default-in...
-- ========================================

-- Update Aigent Z
UPDATE public.agent_keys SET
  evm_private_key_encrypted = 'd1e532efb0b15ca7c08903536d265d93:cc4c4402067596b822dc67832fd8d3c919480abf5d74b6e37ec9d456b18e7239e5bd8f9dba1411d8d3fb38136a2d16d2e12b2273114c5f65df5b637316da194d7f3aaba28b91edef5f78550b18888111',
  updated_at = NOW()
WHERE agent_id = 'aigent-z';

-- Update Aigent MoneyPenny
UPDATE public.agent_keys SET
  evm_private_key_encrypted = '426494712daf9e04ce89500ec6cffe8f:67f8444de3b3fc5db242f48ed3d215d7618044046094927fb874a74f7b51c918890510a0d30365083dfd86948fe5ce69b6be6a4998e5269961da654b5c3e457cd365c641a85b23a452f663898539d5ad',
  updated_at = NOW()
WHERE agent_id = 'aigent-moneypenny';

-- Update Aigent Nakamoto
UPDATE public.agent_keys SET
  evm_private_key_encrypted = '23c79078c39a857451166d2be73c00c5:3fef9abd73a699e090751af73043a7c766427a521a133d37b8de7e441461b4e7e9ed3cfa74160f03faec63cf64c54f36d69fba724e6e8abf44b3f4a45b87db4884defde686774aa18313fcbe51718a2b',
  updated_at = NOW()
WHERE agent_id = 'aigent-nakamoto';

-- Update Aigent Kn0w1
UPDATE public.agent_keys SET
  evm_private_key_encrypted = '74cd80568d64d50f00d0783b59c5fdae:b168441fa68d7535e97e439d20d82ebc579b1023fb3b35cc30246c6fe918f960f6a82364cb82ecb61a4db9e354a4f76e69728489ad5d7d81178a465f448c7f973a49e35b00a473c976cedb5f3dfb5f81',
  updated_at = NOW()
WHERE agent_id = 'aigent-kn0w1';

-- Verification: Check that all keys are encrypted
SELECT agent_id, agent_name, evm_address,
  CASE
    WHEN evm_private_key_encrypted LIKE '%:%' THEN 'Encrypted'
    ELSE 'Plain Text'
  END as key_status,
  LENGTH(evm_private_key_encrypted) as key_length
FROM public.agent_keys
ORDER BY agent_id;

-- ========================================
-- IMPORTANT: Save this encryption key!
-- AGENT_KEY_ENCRYPTION_SECRET=default-insecure-key-change-in-production-32bytes
-- Add this to ALL environments (.env.local, Amplify, etc.)
-- ========================================
