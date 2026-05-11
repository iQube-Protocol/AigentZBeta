-- =============================================================================
-- crm_personas auto-mirror — backfill + trigger
--
-- Root cause closure: users see incorrect order tier + zero rewards in
-- the HUD because their `personas` row has no matching `crm_personas`
-- row. /api/wallet/tasks reads `crm_rewards` joined via crm_personas;
-- when crm_personas.identity_persona_id = personas.id has no match the
-- query returns empty, so the HUD computes `lifetimeKnytEarned = 0`
-- and always derives tier='Initiate'.
--
-- The fix: every `personas` INSERT triggers a matching `crm_personas`
-- INSERT (idempotent via WHERE NOT EXISTS). Existing personas without
-- a CRM row are backfilled. All future persona creation paths
-- (create-with-fio, admin, migration, etc.) inherit the mirror with
-- no code changes.
--
-- Idempotent migration; safe to re-run.
-- =============================================================================

-- ── 1. Backfill: every existing persona without a crm_personas row ───────
INSERT INTO crm_personas (
  id,
  tenant_id,
  persona_state,
  display_name,
  identity_persona_id,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  COALESCE(p.tenant_id, 'knyt'),  -- fall back to knyt tenant if persona tenant unset
  'pseudonymous',
  p.display_name,
  p.id,
  COALESCE(p.created_at, NOW()),
  NOW()
FROM personas p
LEFT JOIN crm_personas cp ON cp.identity_persona_id = p.id
WHERE cp.id IS NULL
  AND p.status = 'active';

-- ── 2. Trigger function: auto-mirror on personas INSERT ───────────────────
CREATE OR REPLACE FUNCTION sync_persona_to_crm_persona()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Idempotency guard — only insert if the mirror doesn't already exist.
  -- (Manual links or admin scripts might pre-populate; we never overwrite.)
  IF NOT EXISTS (
    SELECT 1 FROM crm_personas
    WHERE identity_persona_id = NEW.id
  ) THEN
    INSERT INTO crm_personas (
      id,
      tenant_id,
      persona_state,
      display_name,
      identity_persona_id,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      COALESCE(NEW.tenant_id, 'knyt'),
      'pseudonymous',
      NEW.display_name,
      NEW.id,
      COALESCE(NEW.created_at, NOW()),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. Trigger binding ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_persona_to_crm_persona ON personas;
CREATE TRIGGER trg_sync_persona_to_crm_persona
AFTER INSERT ON personas
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION sync_persona_to_crm_persona();

COMMENT ON FUNCTION sync_persona_to_crm_persona IS
  'Auto-mirrors a new personas row into crm_personas so the wallet/tasks ' ||
  'HUD + reward redemption flow has a working CRM identity. Idempotent ' ||
  'via WHERE NOT EXISTS — manual links are never overwritten.';
