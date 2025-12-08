-- ════════════════════════════════════════════════════════
-- Fix Home Page Content Assignment
-- ════════════════════════════════════════════════════════
--
-- Problem: Home page content is mixed with pennydrops domain
-- Solution: Create 'home' domain for home-only content
--
-- Run this in Supabase SQL Editor
--
-- ════════════════════════════════════════════════════════

-- STEP 1: Update constraint to include 'home' domain
-- ════════════════════════════════════════════════════════

ALTER TABLE content DROP CONSTRAINT IF EXISTS content_domain_check;

ALTER TABLE content ADD CONSTRAINT content_domain_check
  CHECK (domain IN (
    'home',         -- Home page only content (NEW)
    'pennydrops',   -- Q¢ use cases
    'scrolls',      -- Chronicles (metaKnyts, SynthSims)
    'kn0wdz',       -- Builder knowledge (Dev, Creative, Exec)
    'signals',      -- Market signals (hidden)
    'qriptopian'    -- Legacy/default
  ));

-- STEP 2: Move home page content to 'home' domain
-- ════════════════════════════════════════════════════════

-- Home Hero (3 items)
UPDATE content 
SET domain = 'home' 
WHERE placement->>'section' = 'home-hero';

-- Latest News carousel (5 items)
UPDATE content 
SET domain = 'home' 
WHERE placement->>'section' = 'latest-news';

-- Second Hero (2 items)
UPDATE content 
SET domain = 'home' 
WHERE placement->>'section' = 'second-hero';

-- ════════════════════════════════════════════════════════
-- STEP 3: Verify the changes
-- ════════════════════════════════════════════════════════

-- Check domain distribution
SELECT 
  domain, 
  COUNT(*) as count
FROM content 
WHERE status = 'published' 
GROUP BY domain 
ORDER BY domain;

-- Expected result:
--   home:       10 items (home-hero + latest-news + second-hero)
--   kn0wdz:     15 items
--   pennydrops:  7 items (was 17, now 7 - removed 10 home items)
--   scrolls:    15 items
-- Total: 47 items

-- Check home page content
SELECT 
  placement->>'section' as section,
  COUNT(*) as count
FROM content 
WHERE domain = 'home' AND status = 'published'
GROUP BY placement->>'section';

-- Expected result:
--   home-hero:     3 items
--   latest-news:   5 items
--   second-hero:   2 items

-- ════════════════════════════════════════════════════════
