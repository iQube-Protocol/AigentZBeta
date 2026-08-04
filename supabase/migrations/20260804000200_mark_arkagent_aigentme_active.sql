-- Mark ArkAgent's aigentMe stage as activated
--
-- This allows testing of the aigentMe receipt visibility without needing to
-- interact with the aigentMe disposition flow. The receipts created here mark
-- aigentMe as activated for the ArkAgent persona.

-- Get the ArkAgent persona ID (or use a known value if available)
-- For now we'll use a placeholder that references the persona by email/name

-- First, find the ArkAgent persona - assuming it exists and can be looked up
-- This is a safe operation that only creates receipts if aigentMe is not already activated

WITH arkagent_persona AS (
  -- Find the ArkAgent persona via the account email or persona data
  SELECT p.id as persona_id
  FROM personas p
  WHERE p.slug = 'arkagent' OR p.display_name = 'ArkAgent'
  LIMIT 1
),
existing_receipts AS (
  -- Check if aigentme_activated receipt already exists
  SELECT COUNT(*) as count
  FROM activity_receipts ar
  WHERE ar.action_type = 'aigentme_activated'
    AND ar.persona_id = (SELECT persona_id FROM arkagent_persona)
)
INSERT INTO activity_receipts (
  persona_id, active_cartridge, action_type, summary, created_at
)
SELECT
  ap.persona_id,
  'metame-codex',
  'aigentme_activated',
  'aigentMe activated as the principal''s constitutional companion',
  now()
FROM arkagent_persona ap, existing_receipts er
WHERE er.count = 0
ON CONFLICT DO NOTHING;

-- Also create a disposition receipt to mark it as fully initialized
WITH arkagent_persona AS (
  SELECT p.id as persona_id
  FROM personas p
  WHERE p.slug = 'arkagent' OR p.display_name = 'ArkAgent'
  LIMIT 1
)
INSERT INTO activity_receipts (
  persona_id, active_cartridge, action_type, summary, action_input, agents_invoked, created_at
)
SELECT
  ap.persona_id,
  'metame-codex',
  'experienceqube_focus_disposition_recorded',
  'Principal recorded disposition ''central'' on MoneyPenny''s Financial Services domain focus',
  '{"disposition": "central", "domainFocus": "financial-services"}'::jsonb,
  '["aigent-moneypenny"]'::jsonb,
  now()
FROM arkagent_persona ap
WHERE NOT EXISTS (
  SELECT 1 FROM activity_receipts ar
  WHERE ar.action_type = 'experienceqube_focus_disposition_recorded'
    AND ar.persona_id = ap.persona_id
)
ON CONFLICT DO NOTHING;
