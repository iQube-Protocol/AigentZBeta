-- =============================================================================
-- KNYT Living Canon Task Templates
-- Seeds crm_task_templates with KNYT-specific Experience Laddering schemas.
--
-- Each template:
--   - defines the structured form schema injected into the Runtime submission shell
--   - maps to a PoKW weight in ENGAGEMENT_POKW_WEIGHTS
--   - maps to a RewardTaskType for settlement
--   - has a branch_target: community | correspondent
--
-- Guided submission shell (RuntimeCapsuleAdminEditor, democratised version)
-- reads these templates to render the appropriate fields and prompts.
-- =============================================================================

INSERT INTO crm_task_templates (
  slug,
  title,
  description,
  category,
  difficulty,
  impact_level,
  verification_mode,
  reward_qct,
  reward_qoyn,
  reward_knyt,
  rep_weight_technical,
  rep_weight_creative,
  rep_weight_entrepreneurial,
  rep_weight_data_arch,
  rep_weight_community,
  schema_json,
  metadata
) VALUES

-- ----------------------------------------------------------------------------
-- Community branch — base contribution types
-- ----------------------------------------------------------------------------

(
  'knyt:dispatch',
  'Field Dispatch',
  'A first-person report from within the 21 Sats world. What you witnessed, heard, or experienced.',
  'living_canon',
  'easy',
  'medium',
  'editor_review',
  0, 0, 0.5,
  0, 0.4, 0, 0, 0.6,
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

(
  'knyt:theory',
  'Theory Submission',
  'A structured theory about lore, character motivation, or world mechanics.',
  'living_canon',
  'medium',
  'high',
  'editor_review',
  0, 0, 0.5,
  0.2, 0.5, 0, 0.1, 0.2,
  '{
    "branch_target": "community",
    "reward_task_type": "LivingCanonContributionAccepted",
    "fields": [
      {"id": "title",      "label": "Theory Title",     "type": "text",     "required": true,  "maxLength": 120},
      {"id": "thesis",     "label": "Core Thesis",      "type": "textarea", "required": true,  "minLength": 80,  "maxLength": 500},
      {"id": "evidence",   "label": "Evidence",         "type": "textarea", "required": true,  "minLength": 100, "maxLength": 2000},
      {"id": "conclusion", "label": "Conclusion",       "type": "textarea", "required": false, "maxLength": 500},
      {"id": "tags",       "label": "Tags",             "type": "tags",     "required": false}
    ],
    "prompts": [
      "What is your theory in one sentence?",
      "What evidence from canon or community supports it?",
      "What does this theory change about how we understand the world?"
    ]
  }',
  '{"pokw_weight": 1.0, "laddering_rung": "contribute", "world_id": "21sats"}'
),

(
  'knyt:observation',
  'Observation',
  'A brief, focused observation about a character, event, or world detail.',
  'living_canon',
  'easy',
  'low',
  'editor_review',
  0, 0, 0.25,
  0, 0.3, 0, 0, 0.7,
  '{
    "branch_target": "community",
    "reward_task_type": "LivingCanonContributionAccepted",
    "fields": [
      {"id": "subject", "label": "Subject",      "type": "text",     "required": true,  "maxLength": 120},
      {"id": "body",    "label": "Observation",  "type": "textarea", "required": true,  "minLength": 50, "maxLength": 800},
      {"id": "tags",    "label": "Tags",         "type": "tags",     "required": false}
    ],
    "prompts": [
      "What detail caught your attention?",
      "Why does it matter to the world or story?"
    ]
  }',
  '{"pokw_weight": 0.5, "laddering_rung": "contribute", "world_id": "21sats"}'
),

(
  'knyt:lore_note',
  'Lore Note',
  'A canonical lore detail, etymology, or world-building note tied to the 21 Sats universe.',
  'living_canon',
  'medium',
  'high',
  'editor_review',
  0, 0, 0.75,
  0.1, 0.6, 0, 0.2, 0.1,
  '{
    "branch_target": "community",
    "reward_task_type": "LivingCanonContributionAccepted",
    "fields": [
      {"id": "title",      "label": "Lore Entry Title",  "type": "text",     "required": true,  "maxLength": 120},
      {"id": "entry_type", "label": "Entry Type",        "type": "select",   "required": true,
        "options": ["person", "place", "object", "event", "concept", "faction", "other"]},
      {"id": "body",       "label": "Lore Content",      "type": "textarea", "required": true,  "minLength": 100, "maxLength": 3000},
      {"id": "sources",    "label": "Canon Sources",     "type": "textarea", "required": false, "maxLength": 500},
      {"id": "tags",       "label": "Tags",              "type": "tags",     "required": false}
    ],
    "prompts": [
      "What is this entry about?",
      "What canon material supports or references it?",
      "How does it deepen the 21 Sats world?"
    ]
  }',
  '{"pokw_weight": 1.2, "laddering_rung": "contribute", "world_id": "21sats"}'
),

(
  'knyt:scene_proposal',
  'Scene Proposal',
  'A proposed scene, moment, or narrative beat for a future episode or branch continuation.',
  'living_canon',
  'hard',
  'high',
  'editor_review',
  0, 0, 1.0,
  0, 0.7, 0.1, 0, 0.2,
  '{
    "branch_target": "community",
    "reward_task_type": "LivingCanonContributionAccepted",
    "fields": [
      {"id": "title",      "label": "Scene Title",        "type": "text",     "required": true,  "maxLength": 120},
      {"id": "setting",    "label": "Setting",            "type": "text",     "required": true,  "maxLength": 200},
      {"id": "characters", "label": "Characters Involved","type": "text",     "required": false, "maxLength": 200},
      {"id": "synopsis",   "label": "Scene Synopsis",     "type": "textarea", "required": true,  "minLength": 150, "maxLength": 2000},
      {"id": "why_canon",  "label": "Why this matters",   "type": "textarea", "required": true,  "minLength": 80,  "maxLength": 500},
      {"id": "tags",       "label": "Tags",               "type": "tags",     "required": false}
    ],
    "prompts": [
      "What happens in this scene?",
      "Which characters are present and what do they want?",
      "How does this scene advance or complicate the canon narrative?"
    ]
  }',
  '{"pokw_weight": 1.5, "laddering_rung": "contribute", "world_id": "21sats"}'
),

(
  'knyt:character_perspective',
  'Character Perspective',
  'An in-character piece written from the perspective of a KNYT character.',
  'living_canon',
  'medium',
  'medium',
  'editor_review',
  0, 0, 0.5,
  0, 0.8, 0, 0, 0.2,
  '{
    "branch_target": "community",
    "reward_task_type": "LivingCanonContributionAccepted",
    "fields": [
      {"id": "character", "label": "Character",        "type": "select",   "required": true,
        "optionsEndpoint": "/api/codex/knyt-cards"},
      {"id": "situation", "label": "Situation",        "type": "text",     "required": true,  "maxLength": 200},
      {"id": "voice",     "label": "In Their Voice",   "type": "textarea", "required": true,  "minLength": 100, "maxLength": 2000},
      {"id": "tags",      "label": "Tags",             "type": "tags",     "required": false}
    ],
    "prompts": [
      "Which character are you speaking as?",
      "What situation are they responding to?",
      "Does their voice stay true to what we know of them?"
    ]
  }',
  '{"pokw_weight": 0.9, "laddering_rung": "contribute", "world_id": "21sats"}'
),

(
  'knyt:world_report',
  'World Report',
  'A structured report on the state of the 21 Sats world — political, economic, or social.',
  'living_canon',
  'hard',
  'high',
  'editor_review',
  0, 0, 0.75,
  0.2, 0.4, 0.2, 0.1, 0.1,
  '{
    "branch_target": "community",
    "reward_task_type": "LivingCanonContributionAccepted",
    "fields": [
      {"id": "title",     "label": "Report Title",    "type": "text",     "required": true,  "maxLength": 120},
      {"id": "domain",    "label": "Domain",          "type": "select",   "required": true,
        "options": ["political", "economic", "social", "technological", "military", "cultural", "other"]},
      {"id": "summary",   "label": "Executive Summary","type": "textarea","required": true,  "minLength": 80,  "maxLength": 500},
      {"id": "body",      "label": "Full Report",     "type": "textarea", "required": true,  "minLength": 300, "maxLength": 4000},
      {"id": "tags",      "label": "Tags",            "type": "tags",     "required": false}
    ],
    "prompts": [
      "What is the current state of this domain in the world?",
      "What are the key tensions or dynamics at play?",
      "What should SatoshiKNYTs know to navigate this situation?"
    ]
  }',
  '{"pokw_weight": 1.3, "laddering_rung": "contribute", "world_id": "21sats"}'
),

-- ----------------------------------------------------------------------------
-- Correspondent branch — elevated contribution types
-- Requires entitlement: knyt:correspondent
-- ----------------------------------------------------------------------------

(
  'knyt:correspondent_report',
  'Correspondent Report',
  'An elevated, editorial-quality report from a credentialed 21 Sats correspondent.',
  'living_canon',
  'hard',
  'very_high',
  'editor_review',
  0, 0, 1.5,
  0.2, 0.5, 0.1, 0.1, 0.1,
  '{
    "branch_target": "correspondent",
    "required_entitlement": "knyt:correspondent",
    "reward_task_type": "LivingCanonCorrespondentDispatch",
    "fields": [
      {"id": "headline",   "label": "Headline",         "type": "text",     "required": true,  "maxLength": 160},
      {"id": "byline_note","label": "Byline Note",      "type": "text",     "required": false, "maxLength": 200},
      {"id": "lede",       "label": "Opening (Lede)",   "type": "textarea", "required": true,  "minLength": 80,  "maxLength": 400},
      {"id": "body",       "label": "Report Body",      "type": "textarea", "required": true,  "minLength": 400, "maxLength": 6000},
      {"id": "sources",    "label": "Sources / Evidence","type":"textarea", "required": false, "maxLength": 800},
      {"id": "significance","label":"Significance",     "type": "textarea", "required": true,  "minLength": 80,  "maxLength": 500},
      {"id": "tags",       "label": "Tags",             "type": "tags",     "required": false}
    ],
    "prompts": [
      "What is the most important thing you are reporting?",
      "What sources, canon records, or direct observations support this?",
      "Why does this matter to the Order and the wider community?"
    ]
  }',
  '{"pokw_weight": 2.0, "laddering_rung": "chronicle", "world_id": "21sats"}'
)

ON CONFLICT (slug) DO UPDATE SET
  title             = EXCLUDED.title,
  description       = EXCLUDED.description,
  schema_json       = EXCLUDED.schema_json,
  metadata          = EXCLUDED.metadata,
  reward_knyt       = EXCLUDED.reward_knyt,
  rep_weight_creative   = EXCLUDED.rep_weight_creative,
  rep_weight_community  = EXCLUDED.rep_weight_community;
