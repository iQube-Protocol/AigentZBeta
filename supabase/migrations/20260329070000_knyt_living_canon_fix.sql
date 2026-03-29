-- =============================================================================
-- KNYT Living Canon Fix Migration
--
-- Fixes:
--   1. Add schema_json + metadata JSONB columns to crm_task_templates
--   2. Add metadata JSONB column to crm_contributions
--   3. Extend category + status constraints
--   4. Re-seed KNYT task templates with correct column names + tenant_id
--   5. Grant knyt_persona_roles (steward/admin/correspondent) to admin personas
-- =============================================================================

-- 1. Extend crm_task_templates
-- ---------------------------------------------------------------------------
ALTER TABLE crm_task_templates
  ADD COLUMN IF NOT EXISTS schema_json JSONB,
  ADD COLUMN IF NOT EXISTS metadata    JSONB;

-- Drop and recreate category constraint to include 'living_canon'
ALTER TABLE crm_task_templates
  DROP CONSTRAINT IF EXISTS crm_task_templates_category_check;

ALTER TABLE crm_task_templates
  ADD CONSTRAINT crm_task_templates_category_check
  CHECK (category IN (
    'technical', 'creative', 'entrepreneurial',
    'data', 'iqube_design', 'community', 'living_canon'
  ));

-- 2. Extend crm_contributions
-- ---------------------------------------------------------------------------
ALTER TABLE crm_contributions
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Drop and recreate status constraint to include 'draft'
ALTER TABLE crm_contributions
  DROP CONSTRAINT IF EXISTS crm_contributions_status_check;

ALTER TABLE crm_contributions
  ADD CONSTRAINT crm_contributions_status_check
  CHECK (status IN (
    'draft', 'claimed', 'submitted', 'under_review',
    'accepted', 'rejected', 'cancelled'
  ));

-- 3. Seed KNYT task templates (correct column names + tenant_id)
-- ---------------------------------------------------------------------------
-- NOTE: difficulty_level  INTEGER 1-5 (1=trivial…5=expert)
--       expected_impact_level INTEGER 1-5
-- Mapping from old text values: easy→2, medium→3, hard→4, very_high→5, low→1

INSERT INTO crm_task_templates (
  tenant_id,
  slug,
  title,
  description,
  category,
  difficulty_level,
  expected_impact_level,
  verification_mode,
  reward_qct, reward_qoyn, reward_knyt,
  rep_weight_technical, rep_weight_creative,
  rep_weight_entrepreneurial, rep_weight_data_arch, rep_weight_community,
  schema_json,
  metadata
) VALUES

-- community_submission — generic entry point for "Contribute" button
(
  'knyt', 'knyt:community_submission',
  'Community Submission',
  'Submit a contribution to the Living Canon community branch.',
  'living_canon', 2, 3, 'editor_review',
  0, 0, 0.5,  0, 0.4, 0, 0, 0.6,
  '{
    "branch_target": "community",
    "reward_task_type": "LivingCanonContributionAccepted",
    "fields": [
      {"id": "title",    "label": "Title",              "type": "text",     "required": true,  "maxLength": 120},
      {"id": "location", "label": "Location / Realm",   "type": "text",     "required": false, "maxLength": 80},
      {"id": "body",     "label": "Your Contribution",  "type": "textarea", "required": true,  "minLength": 80, "maxLength": 2000},
      {"id": "tags",     "label": "Tags",               "type": "tags",     "required": false}
    ],
    "prompts": [
      "What are you contributing to the Living Canon?",
      "What details will matter to other SatoshiKNYTs?",
      "Is there a connection to the broader 21 Sats narrative?"
    ]
  }',
  '{"pokw_weight": 0.8, "laddering_rung": "contribute", "world_id": "21sats",
    "campaign_active": true, "campaign_prompt": "Share your perspective on the Living Canon."}'
),

-- dispatch
(
  'knyt', 'knyt:dispatch',
  'Field Dispatch',
  'A first-person report from within the 21 Sats world.',
  'living_canon', 2, 3, 'editor_review',
  0, 0, 0.5,  0, 0.4, 0, 0, 0.6,
  '{
    "branch_target": "community",
    "reward_task_type": "LivingCanonContributionAccepted",
    "fields": [
      {"id": "title",    "label": "Dispatch Title",   "type": "text",     "required": true,  "maxLength": 120},
      {"id": "location", "label": "Location / Realm", "type": "text",     "required": false, "maxLength": 80},
      {"id": "body",     "label": "What happened",    "type": "textarea", "required": true,  "minLength": 100, "maxLength": 2000},
      {"id": "tags",     "label": "Tags",             "type": "tags",     "required": false}
    ],
    "prompts": [
      "Set the scene — where are you and what is happening?",
      "What details will matter to other SatoshiKNYTs?",
      "Is there a connection to the broader 21 Sats narrative?"
    ]
  }',
  '{"pokw_weight": 0.8, "laddering_rung": "contribute", "world_id": "21sats"}'
),

-- theory
(
  'knyt', 'knyt:theory',
  'Theory Submission',
  'A structured theory about lore, character motivation, or world mechanics.',
  'living_canon', 3, 4, 'editor_review',
  0, 0, 0.5,  0.2, 0.5, 0, 0.1, 0.2,
  '{
    "branch_target": "community",
    "reward_task_type": "LivingCanonContributionAccepted",
    "fields": [
      {"id": "title",      "label": "Theory Title",  "type": "text",     "required": true,  "maxLength": 120},
      {"id": "thesis",     "label": "Core Thesis",   "type": "textarea", "required": true,  "minLength": 80,  "maxLength": 500},
      {"id": "evidence",   "label": "Evidence",      "type": "textarea", "required": true,  "minLength": 100, "maxLength": 2000},
      {"id": "conclusion", "label": "Conclusion",    "type": "textarea", "required": false, "maxLength": 500},
      {"id": "tags",       "label": "Tags",          "type": "tags",     "required": false}
    ],
    "prompts": [
      "What is your theory in one sentence?",
      "What evidence from canon or community supports it?",
      "What does this theory change about how we understand the world?"
    ]
  }',
  '{"pokw_weight": 1.0, "laddering_rung": "contribute", "world_id": "21sats"}'
),

-- observation
(
  'knyt', 'knyt:observation',
  'Observation',
  'A brief, focused observation about a character, event, or world detail.',
  'living_canon', 2, 1, 'editor_review',
  0, 0, 0.25,  0, 0.3, 0, 0, 0.7,
  '{
    "branch_target": "community",
    "reward_task_type": "LivingCanonContributionAccepted",
    "fields": [
      {"id": "subject", "label": "Subject",     "type": "text",     "required": true,  "maxLength": 120},
      {"id": "body",    "label": "Observation", "type": "textarea", "required": true,  "minLength": 50, "maxLength": 800},
      {"id": "tags",    "label": "Tags",        "type": "tags",     "required": false}
    ],
    "prompts": [
      "What detail caught your attention?",
      "Why does it matter to the world or story?"
    ]
  }',
  '{"pokw_weight": 0.5, "laddering_rung": "contribute", "world_id": "21sats"}'
),

-- scene_proposal
(
  'knyt', 'knyt:scene_proposal',
  'Scene Proposal',
  'A proposed scene or narrative beat for a future episode.',
  'living_canon', 4, 4, 'editor_review',
  0, 0, 1.0,  0, 0.7, 0.1, 0, 0.2,
  '{
    "branch_target": "community",
    "reward_task_type": "LivingCanonContributionAccepted",
    "fields": [
      {"id": "title",     "label": "Scene Title",      "type": "text",     "required": true,  "maxLength": 120},
      {"id": "setting",   "label": "Setting",          "type": "text",     "required": true,  "maxLength": 200},
      {"id": "synopsis",  "label": "Scene Synopsis",   "type": "textarea", "required": true,  "minLength": 150, "maxLength": 2000},
      {"id": "why_canon", "label": "Why this matters", "type": "textarea", "required": true,  "minLength": 80,  "maxLength": 500},
      {"id": "tags",      "label": "Tags",             "type": "tags",     "required": false}
    ],
    "prompts": [
      "What happens in this scene?",
      "How does this scene advance or complicate the canon narrative?"
    ]
  }',
  '{"pokw_weight": 1.5, "laddering_rung": "contribute", "world_id": "21sats"}'
),

-- correspondent report (requires entitlement)
(
  'knyt', 'knyt:correspondent_report',
  'Correspondent Report',
  'An editorial-quality report from a credentialed 21 Sats correspondent.',
  'living_canon', 4, 5, 'editor_review',
  0, 0, 1.5,  0.2, 0.5, 0.1, 0.1, 0.1,
  '{
    "branch_target": "correspondent",
    "required_entitlement": "knyt:correspondent",
    "reward_task_type": "LivingCanonCorrespondentDispatch",
    "fields": [
      {"id": "headline",    "label": "Headline",          "type": "text",     "required": true,  "maxLength": 160},
      {"id": "lede",        "label": "Opening (Lede)",    "type": "textarea", "required": true,  "minLength": 80,  "maxLength": 400},
      {"id": "body",        "label": "Report Body",       "type": "textarea", "required": true,  "minLength": 400, "maxLength": 6000},
      {"id": "sources",     "label": "Sources/Evidence",  "type": "textarea", "required": false, "maxLength": 800},
      {"id": "significance","label": "Significance",      "type": "textarea", "required": true,  "minLength": 80,  "maxLength": 500},
      {"id": "tags",        "label": "Tags",              "type": "tags",     "required": false}
    ],
    "prompts": [
      "What is the most important thing you are reporting?",
      "What sources or canon records support this?",
      "Why does this matter to the Order?"
    ]
  }',
  '{"pokw_weight": 2.0, "laddering_rung": "chronicle", "world_id": "21sats",
    "campaign_active": true, "campaign_prompt": "Report on a significant event or development in the 21 Sats world.",
    "reward_preview": "+1.5 KNYT on acceptance"}'
)

ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title                    = EXCLUDED.title,
  description              = EXCLUDED.description,
  difficulty_level         = EXCLUDED.difficulty_level,
  expected_impact_level    = EXCLUDED.expected_impact_level,
  schema_json              = EXCLUDED.schema_json,
  metadata                 = EXCLUDED.metadata,
  reward_knyt              = EXCLUDED.reward_knyt,
  rep_weight_creative      = EXCLUDED.rep_weight_creative,
  rep_weight_community     = EXCLUDED.rep_weight_community;

-- 4. Grant admin roles in knyt_persona_roles
-- ---------------------------------------------------------------------------
-- Find admin personas by email/handle and grant steward + correspondent access.
-- This uses a DO block so it's safe to re-run (ON CONFLICT handles duplicates).

DO $$
DECLARE
  v_dele_id   UUID;
  v_aigent_id UUID;
BEGIN
  -- dele@metame.com
  SELECT id INTO v_dele_id
  FROM personas
  WHERE email = 'dele@metame.com'
     OR fio_handle ILIKE 'dele%'
  ORDER BY created_at ASC
  LIMIT 1;

  -- aigentz@aigent (system persona)
  SELECT id INTO v_aigent_id
  FROM personas
  WHERE email ILIKE 'aigentz@aigent%'
     OR fio_handle ILIKE 'aigentz@aigent%'
     OR fio_handle = 'aigentz'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Grant roles to dele
  IF v_dele_id IS NOT NULL THEN
    INSERT INTO knyt_persona_roles (persona_id, role, world_id)
    VALUES
      (v_dele_id, 'knyt:steward',       '21sats'),
      (v_dele_id, 'knyt:admin',         '21sats'),
      (v_dele_id, 'knyt:correspondent', '21sats')
    ON CONFLICT (persona_id, role, world_id) DO NOTHING;
  END IF;

  -- Grant roles to aigentz
  IF v_aigent_id IS NOT NULL THEN
    INSERT INTO knyt_persona_roles (persona_id, role, world_id)
    VALUES
      (v_aigent_id, 'knyt:steward',       '21sats'),
      (v_aigent_id, 'knyt:admin',         '21sats'),
      (v_aigent_id, 'knyt:correspondent', '21sats')
    ON CONFLICT (persona_id, role, world_id) DO NOTHING;
  END IF;
END $$;
