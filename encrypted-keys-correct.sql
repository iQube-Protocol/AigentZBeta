-- ========================================
-- ENCRYPTED AGENT KEYS UPDATE SCRIPT
-- Run this in Supabase SQL Editor
-- Generated: 2025-11-03T17:53:17.692Z
-- Encryption Key: e35c7d7965...
-- ========================================

-- Update Aigent Z
UPDATE public.agent_keys SET
  evm_private_key_encrypted = 'b405412001069fe0ec2d04487cca4a15:eae98cb61983820edf595c12a1556dec5700744df4079317eea679c62fd7a1641af0761d8120da0091017168994a0dfc8121ef1f9bab376c4a03fee0b6c5e9a1cb40f90e30afcd78d1b121dcda3f1e7f',
  updated_at = NOW()
WHERE agent_id = 'aigent-z';

-- Update Aigent MoneyPenny
UPDATE public.agent_keys SET
  evm_private_key_encrypted = 'c31050c068cbf9cf4141704a16153835:48e5f922b3c601e08b5f3944d6c52f1fb9d225713d2ae25371559392d93c906bc8bafa8e44bf31d89e5fa678e876c74f26604ee1d0cfdb3e500807f9d78e5afb4ac7061e5536a72da52d93e10918f116',
  updated_at = NOW()
WHERE agent_id = 'aigent-moneypenny';

-- Update Aigent Nakamoto
UPDATE public.agent_keys SET
  evm_private_key_encrypted = 'af2c1187f698ccc5efd3c1bbb2458bb1:9959954aa039a62d00cac1ee0e252c064867ef9a7877cab60947993406ddee57878708b5cb9de1e9859ca1ac4b125b49f07366628aeeae73ac77862ec2ca6cb2d4b5863daf663eadbc2c281678ba2631',
  updated_at = NOW()
WHERE agent_id = 'aigent-nakamoto';

-- Update Aigent Kn0w1
UPDATE public.agent_keys SET
  evm_private_key_encrypted = '2a8900059ca89d28aa02a9fcaa1edd6f:e77c58da239dd4304dc7eb5873588942e26c1228aace540193a320b98a678b01751d587c56ef440c2f32de26a3c8bd8a872320622295d1cbb4173d1b91262019fb468cf2c8da5bef49943911a15bc708',
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
-- AGENT_KEY_ENCRYPTION_SECRET=e35c7d79651daadd8723ff952c90fe55c567143065e1159d5e683ff3c9703fda
-- Add this to ALL environments (.env.local, Amplify, etc.)
-- ========================================
