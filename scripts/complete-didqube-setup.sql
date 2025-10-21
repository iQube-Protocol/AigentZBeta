-- Complete DIDQube Phase 3 Setup
-- Run this in Supabase SQL Editor to create test personas with reputation

-- First, clean up any existing test data (optional)
DELETE FROM reputation_bucket WHERE skill_category IN ('blockchain_development', 'defi', 'nft', 'web3', 'smart_contracts');
DELETE FROM persona WHERE fio_handle IN ('alice_blockchain', 'bob_defi', 'charlie_nft', 'diana_web3', 'eve_smartcontracts');

-- Create test personas with reputation buckets
DO $$
DECLARE
  persona_alice uuid;
  persona_bob uuid;
  persona_charlie uuid;
  persona_diana uuid;
  persona_eve uuid;
BEGIN
  -- Alice (blockchain developer - Excellent reputation)
  INSERT INTO public.persona (fio_handle, default_identity_state, world_id_status, app_origin)
  VALUES ('alice_blockchain', 'semi_identifiable', 'verified_human', 'aigentzbeta')
  RETURNING id INTO persona_alice;
  
  INSERT INTO public.reputation_bucket (persona_id, partition_id, skill_category, bucket_level, score, evidence_count, last_synced_at)
  VALUES (persona_alice, persona_alice::text, 'blockchain_development', 4, 85.0, 0, now())
  ON CONFLICT (partition_id) DO UPDATE SET
    bucket_level = EXCLUDED.bucket_level,
    score = EXCLUDED.score,
    last_synced_at = now();
  
  RAISE NOTICE 'Created: alice_blockchain (ID: %, Bucket: 4, Score: 85)', persona_alice;
  
  -- Bob (DeFi specialist - Good reputation)
  INSERT INTO public.persona (fio_handle, default_identity_state, world_id_status, app_origin)
  VALUES ('bob_defi', 'semi_anonymous', 'verified_human', 'aigentzbeta')
  RETURNING id INTO persona_bob;
  
  INSERT INTO public.reputation_bucket (persona_id, partition_id, skill_category, bucket_level, score, evidence_count, last_synced_at)
  VALUES (persona_bob, persona_bob::text, 'defi', 3, 72.0, 0, now())
  ON CONFLICT (partition_id) DO UPDATE SET
    bucket_level = EXCLUDED.bucket_level,
    score = EXCLUDED.score,
    last_synced_at = now();
  
  RAISE NOTICE 'Created: bob_defi (ID: %, Bucket: 3, Score: 72)', persona_bob;
  
  -- Charlie (NFT creator - Good reputation)
  INSERT INTO public.persona (fio_handle, default_identity_state, world_id_status, app_origin)
  VALUES ('charlie_nft', 'identifiable', 'verified_human', 'aigentzbeta')
  RETURNING id INTO persona_charlie;
  
  INSERT INTO public.reputation_bucket (persona_id, partition_id, skill_category, bucket_level, score, evidence_count, last_synced_at)
  VALUES (persona_charlie, persona_charlie::text, 'nft', 3, 65.0, 0, now())
  ON CONFLICT (partition_id) DO UPDATE SET
    bucket_level = EXCLUDED.bucket_level,
    score = EXCLUDED.score,
    last_synced_at = now();
  
  RAISE NOTICE 'Created: charlie_nft (ID: %, Bucket: 3, Score: 65)', persona_charlie;
  
  -- Diana (Web3 developer - Fair reputation)
  INSERT INTO public.persona (fio_handle, default_identity_state, world_id_status, app_origin)
  VALUES ('diana_web3', 'semi_anonymous', 'unverified', 'aigentzbeta')
  RETURNING id INTO persona_diana;
  
  INSERT INTO public.reputation_bucket (persona_id, partition_id, skill_category, bucket_level, score, evidence_count, last_synced_at)
  VALUES (persona_diana, persona_diana::text, 'web3', 2, 55.0, 0, now())
  ON CONFLICT (partition_id) DO UPDATE SET
    bucket_level = EXCLUDED.bucket_level,
    score = EXCLUDED.score,
    last_synced_at = now();
  
  RAISE NOTICE 'Created: diana_web3 (ID: %, Bucket: 2, Score: 55)', persona_diana;
  
  -- Eve (smart contract auditor - Fair reputation)
  INSERT INTO public.persona (fio_handle, default_identity_state, world_id_status, app_origin)
  VALUES ('eve_smartcontracts', 'anonymous', 'agent_declared', 'aigentzbeta')
  RETURNING id INTO persona_eve;
  
  INSERT INTO public.reputation_bucket (persona_id, partition_id, skill_category, bucket_level, score, evidence_count, last_synced_at)
  VALUES (persona_eve, persona_eve::text, 'smart_contracts', 2, 40.0, 0, now())
  ON CONFLICT (partition_id) DO UPDATE SET
    bucket_level = EXCLUDED.bucket_level,
    score = EXCLUDED.score,
    last_synced_at = now();
  
  RAISE NOTICE 'Created: eve_smartcontracts (ID: %, Bucket: 2, Score: 40)', persona_eve;
  
  RAISE NOTICE '✨ Successfully created 5 test personas with reputation buckets!';
END $$;

-- Verify the data
SELECT 
  p.fio_handle,
  p.default_identity_state,
  p.world_id_status,
  rb.skill_category,
  rb.bucket_level,
  rb.score,
  rb.evidence_count
FROM persona p
JOIN reputation_bucket rb ON rb.persona_id = p.id
WHERE p.fio_handle IN ('alice_blockchain', 'bob_defi', 'charlie_nft', 'diana_web3', 'eve_smartcontracts')
ORDER BY rb.score DESC;
