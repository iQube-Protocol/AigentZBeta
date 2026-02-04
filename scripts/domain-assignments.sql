-- ════════════════════════════════════════════════════════
-- The Qriptopian Domain Assignments
-- Based on Published Issue #0 v0.1 Specification
-- ════════════════════════════════════════════════════════
--
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/bsjhfvctmduxhohtllly/editor
--
-- Expected Distribution:
--   📜 scrolls:    15 items (metaKnyts, SynthSims)
--   💧 pennydrops: 17 items (Q¢ stories)
--   💻 kn0wdz:     15 items (Dev, Creative, Exec)
--
-- ════════════════════════════════════════════════════════

-- ⚠️ STEP 1: Fix the domain constraint first
-- ════════════════════════════════════════════════════════

-- Drop the existing constraint that only allows 'qriptopian'
ALTER TABLE content DROP CONSTRAINT IF EXISTS content_domain_check;

-- Add new constraint with all Issue #0 domains
ALTER TABLE content ADD CONSTRAINT content_domain_check
  CHECK (domain IN (
    'pennydrops',   -- Q¢ use cases
    'scrolls',      -- Chronicles (metaKnyts, SynthSims)
    'kn0wdz',       -- Builder knowledge (Dev, Creative, Exec)
    'signals',      -- Market signals (hidden)
    'qriptopian'    -- Legacy/default
  ));

-- ════════════════════════════════════════════════════════
-- STEP 2: Assign content to proper domains
-- ════════════════════════════════════════════════════════

-- 📜 Assign 15 items to 'scrolls' domain (Chronicles)
UPDATE content SET domain = 'scrolls' WHERE id IN (
  '37266d3b-7ee1-4d0f-ac42-72e296550dc5', -- Primates Protocols
  '14d03c09-461a-4055-9901-f9ef9a10e9ec', -- Fellowship of the Simms
  '17d3796d-8dea-45b6-b988-b9a946f84138', -- Aigent Synth
  'a818daa3-0737-420e-a496-ff236d061bd2', -- Liquidiocracy
  '0b335670-b63d-4006-a89f-dfbc2e2835f7', -- Stack Sats
  'a3c56b25-326c-445b-8da2-225da1a8639d', -- The Dip Skit
  '1edd2b19-c502-4e32-929c-2e79aed1fe06', -- Not Your Keys Not Your Qripto
  '3e307627-7643-470f-ba99-ae928fe83566', -- Satoshi Brew
  '126c0e3e-ebe2-4c8f-9080-82418949ea6a', -- Proof-of-Stake Dinner
  '19873fde-8495-46ca-a5e3-ede6d4bb1f25', -- Primates In Space
  '613f5dbe-ccd5-4a07-9c84-dc17ad893eca', -- Primates, Not Promenade
  '9a6e9be7-7187-485f-b2b5-ede1727c52e2', -- SynthSimms Scrolls
  'ea4a83a8-5537-483a-9632-6a1590f0c608', -- The Meta-verse
  '141cd45f-a4c8-46bb-9c4f-f15bd6fda84e', -- SynthTuesday
  'd69a2436-ee82-4068-a9e4-731e8c449b92'  -- Qriptography For All
);

-- 💧 Assign 17 items to 'pennydrops' domain (Q¢ use cases)
UPDATE content SET domain = 'pennydrops' WHERE id IN (
  '5d1c3a7d-0bac-4522-ac45-62826ea80b37', -- The SynthSimms
  'bb3e3c34-8b4a-4ab0-9916-c466702fd8ae', -- The Busker's Bitcoin
  'ab80184d-ccf7-448b-9532-089a3b11b5ee', -- Gig Economy Pennies
  'a47b5eab-1542-4137-8e5a-395aafbc620e', -- The Tipping Point
  'a76b3c3a-71ca-4ecd-ba59-02b14d7df934', -- Parking Meter Revolution
  'f990cf0f-fbb6-4f68-a3d2-10d168ad9cb0', -- The Day the Penny Went Digital
  '02681a52-ee6e-4cba-9fa0-a4ab8b74a1a8', -- Coffee Shop Chronicles
  '45a9c162-5dba-460c-a1c3-2ae678eb71cb', -- The Library Card
  '94585945-59d2-4dcd-b953-56b1e5c3a135', -- Street Vendor's Dream
  'd63a1602-3337-4d56-b1c5-cdcdf21e3aec', -- Pay-Per-View Busking
  '266c041c-355e-4dc7-b4a1-9093ae9a502a', -- Digital Lemonade Stand
  '6e074ac1-f666-46ef-ac63-ca706f18801b', -- The Penny That Crossed Borders
  '56f70d60-a4bc-41ef-b703-f4916b563aee', -- Micro-Transactions
  '889b939e-dfea-4937-8350-984bf84c93bf', -- Q¢ For Good
  'db1cf2b7-379a-4d46-bdca-ce22567a8da2', -- Lightning Network Lemonade
  '9b7c3b59-1192-44d3-bad4-543c06000c9b', -- Street Food
  'd51579d4-6dad-48d6-9c1a-5b0904fd46f4'  -- Micro-Loans
);

-- 💻 Assign 15 items to 'kn0wdz' domain (Builder knowledge)
UPDATE content SET domain = 'kn0wdz' WHERE id IN (
  '2335afed-bdf2-4d3e-a7ab-113a726c3723', -- Builder Resources
  '7ba84950-599a-454c-8f78-1ecd916eac56', -- Developer Guide
  'ed0a851e-1ddb-4803-a236-e447054a558e', -- Technical Tutorial
  '2b26df84-7573-4899-bf57-d7e0d374e066', -- Creative Workflows
  '2a8b7b36-7d38-480d-b89a-032ab367c635', -- Executive Strategy
  '1c89d604-106f-4ed4-8477-eafe3fd3a3a4', -- Dev Tools
  '83763ce3-b4f3-46eb-8717-1c8639fabe05', -- API Documentation
  '19268e34-d1a7-465c-8925-8cb43ffd194c', -- Smart Contract Guide
  '2a3b19cd-2260-4046-875d-c91c257c7e73', -- Frontend Framework
  'b87fb671-2f6a-46f6-9a36-4187c727ea02', -- Backend Architecture
  'e6093b39-e696-4262-ae0c-79a09e9af6d1', -- Creative Production
  '41b262dc-9074-4929-bd01-e0d3093572ec', -- Content Strategy
  'e531a208-0ea5-416d-a994-89dadf61de5c', -- Business Development
  'aab61786-b3ce-4421-aa71-b7d007089de2', -- Strategic Planning
  '7b47fe3e-872e-4317-a860-a03fb3bd8579'  -- Market Analysis
);

-- ════════════════════════════════════════════════════════
-- Verification Query
-- ════════════════════════════════════════════════════════

SELECT 
  domain, 
  COUNT(*) as count
FROM content 
WHERE status = 'published' 
GROUP BY domain 
ORDER BY domain;

-- Expected result:
--   kn0wdz:     15 items
--   pennydrops: 17 items
--   scrolls:    15 items
-- Total: 47 items

-- ════════════════════════════════════════════════════════
