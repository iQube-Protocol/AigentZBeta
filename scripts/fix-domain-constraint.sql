-- ════════════════════════════════════════════════════════
-- Fix Domain Constraint for The Qriptopian
-- ════════════════════════════════════════════════════════
--
-- Issue: content_domain_check constraint only allows 'qriptopian'
-- Solution: Drop and recreate with all Issue #0 domains
--
-- Run this FIRST, then run domain-assignments.sql
--
-- ════════════════════════════════════════════════════════

-- Step 1: Drop the existing constraint
ALTER TABLE content DROP CONSTRAINT IF EXISTS content_domain_check;

-- Step 2: Add new constraint with all Issue #0 domains
ALTER TABLE content ADD CONSTRAINT content_domain_check
  CHECK (domain IN (
    'pennydrops',   -- Q¢ use cases
    'scrolls',      -- Chronicles (metaKnyts, SynthSims)
    'kn0wdz',       -- Builder knowledge (Dev, Creative, Exec)
    'signals',      -- Market signals (hidden)
    'qriptopian'    -- Legacy/default (will be migrated)
  ));

-- Step 3: Verify constraint is updated
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'content_domain_check';

-- ════════════════════════════════════════════════════════
-- Expected output:
--   constraint_name: content_domain_check
--   constraint_definition: CHECK ((domain = ANY (ARRAY['pennydrops'::text, ...
--
-- ════════════════════════════════════════════════════════
