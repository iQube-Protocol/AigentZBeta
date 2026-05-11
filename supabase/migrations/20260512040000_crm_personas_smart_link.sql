-- =============================================================================
-- crm_personas smart-link — replace the v1 auto-mirror with DIDQube-aware
-- linking that respects the operator's "PersonaSpine is SoT" mandate.
--
-- v1 (20260512030000_crm_personas_auto_mirror.sql) created a NEW crm_personas
-- row for every persona INSERT. That works for users without prior CRM
-- profiles, but for the thousands of users who already exist in CRM (e.g.
-- onboarded via Marketa, partner imports, signed up without ever creating
-- a persona), it would have created a DUPLICATE — splitting their identity
-- across two crm_personas rows. The operator's directive:
--
--   "When someone creates a persona anywhere in the estate and they have
--    a CRM profile those two identities are instantly mapped so the
--    PersonaSpine can manage their identity using the DIDQube framework
--    from then onwards"
--
-- This migration replaces the v1 trigger with one that:
--   1. Looks for an EXISTING crm_personas row matching the new persona via
--      DIDQube identity anchors first (root_did), then by the user's email
--      (resolved via auth.users → crm_auth_profiles).
--   2. If a match is found, UPDATEs that row to set identity_persona_id +
--      backfill root_did / display_name if absent.
--   3. Only INSERTs a new crm_personas row when no match exists.
--
-- Idempotent; safe to re-run. SECURITY DEFINER on the function so it can
-- read auth.users (the trigger runs as table owner, not the inserting
-- session role).
-- =============================================================================

-- ── 1. Drop the v1 naive trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_persona_to_crm_persona ON personas;

-- ── 2. Smart-link function ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_persona_to_crm_persona()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- needs to read auth.users for email lookup
SET search_path = public, auth
AS $$
DECLARE
  v_existing_id        UUID;
  v_user_email         TEXT;
  v_crm_auth_profile_id UUID;
BEGIN
  -- 0. Idempotency: already linked? bail.
  IF EXISTS (
    SELECT 1 FROM crm_personas
    WHERE identity_persona_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- 1. PRIMARY MATCH: by DIDQube root_did. The most reliable anchor
  --    because both personas + crm_personas store it.
  IF NEW.root_did IS NOT NULL AND NEW.root_did <> '' THEN
    SELECT id INTO v_existing_id
      FROM crm_personas
     WHERE root_did = NEW.root_did
       AND identity_persona_id IS NULL
     ORDER BY created_at ASC
     LIMIT 1;
  END IF;

  -- 2. FALLBACK: by email. Resolve the persona's auth user's email,
  --    then look up matching crm_personas via crm_auth_profiles join.
  --    Many legacy CRM users have email but no root_did populated.
  IF v_existing_id IS NULL AND NEW.auth_profile_id IS NOT NULL THEN
    -- Get the email from auth.users for this auth_profile_id.
    BEGIN
      SELECT email INTO v_user_email
        FROM auth.users
       WHERE id = NEW.auth_profile_id;
    EXCEPTION WHEN OTHERS THEN
      -- auth.users read denied in some configurations; fall through.
      v_user_email := NULL;
    END;

    IF v_user_email IS NOT NULL THEN
      -- 2a. Direct match on crm_personas.email (legacy + Marketa imports).
      SELECT id INTO v_existing_id
        FROM crm_personas
       WHERE LOWER(email) = LOWER(v_user_email)
         AND identity_persona_id IS NULL
       ORDER BY created_at ASC
       LIMIT 1;

      -- 2b. Match via crm_auth_profiles.email → crm_personas.auth_profile_id.
      --     Covers CRM users who were onboarded with an auth profile
      --     but never had email on the persona row itself.
      IF v_existing_id IS NULL THEN
        SELECT cap.id INTO v_crm_auth_profile_id
          FROM crm_auth_profiles cap
         WHERE LOWER(cap.email) = LOWER(v_user_email)
         LIMIT 1;

        IF v_crm_auth_profile_id IS NOT NULL THEN
          SELECT id INTO v_existing_id
            FROM crm_personas
           WHERE auth_profile_id = v_crm_auth_profile_id
             AND identity_persona_id IS NULL
           ORDER BY created_at ASC
           LIMIT 1;
        END IF;
      END IF;
    END IF;
  END IF;

  -- 3. LINK if matched: UPDATE the existing CRM row to bind it to this
  --    persona. Backfill root_did + display_name if they were null.
  --    persona_state stays as the CRM row had it (pseudonymous / etc.)
  --    so we don't downgrade an already-verified persona.
  IF v_existing_id IS NOT NULL THEN
    UPDATE crm_personas
       SET identity_persona_id = NEW.id,
           root_did = COALESCE(NULLIF(root_did, ''), NULLIF(NEW.root_did, '')),
           display_name = COALESCE(NULLIF(display_name, ''), NULLIF(NEW.display_name, '')),
           updated_at = NOW()
     WHERE id = v_existing_id;
    RETURN NEW;
  END IF;

  -- 4. NO MATCH: create a fresh crm_personas row (same as v1 behavior).
  --    This handles personas created by users with no prior CRM presence.
  INSERT INTO crm_personas (
    id,
    tenant_id,
    persona_state,
    display_name,
    identity_persona_id,
    root_did,
    email,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    COALESCE(NEW.tenant_id, 'knyt'),
    'pseudonymous',
    NEW.display_name,
    NEW.id,
    NULLIF(NEW.root_did, ''),
    v_user_email,  -- populated if we resolved it above
    COALESCE(NEW.created_at, NOW()),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- ── 3. Re-create trigger binding ─────────────────────────────────────────
CREATE TRIGGER trg_sync_persona_to_crm_persona
AFTER INSERT ON personas
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION sync_persona_to_crm_persona();

-- ── 4. Re-run backfill for any personas inserted between v1 + v2 that
--      may have created duplicate (orphan) crm_personas rows. We don't
--      DELETE duplicates here (operator review required); we just ensure
--      every persona has at least one crm_personas row linked to it.
INSERT INTO crm_personas (
  id, tenant_id, persona_state, display_name, identity_persona_id,
  root_did, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  COALESCE(p.tenant_id, 'knyt'),
  'pseudonymous',
  p.display_name,
  p.id,
  NULLIF(p.root_did, ''),
  COALESCE(p.created_at, NOW()),
  NOW()
FROM personas p
LEFT JOIN crm_personas cp ON cp.identity_persona_id = p.id
WHERE cp.id IS NULL
  AND p.status = 'active';

-- ── 5. Optional retroactive link: existing CRM rows with no
--      identity_persona_id but matching root_did to a persona that
--      DID get a fresh CRM row in v1 — link them too. This catches
--      the case where v1 created a duplicate fresh row when the
--      operator already had a legacy CRM row by root_did.
UPDATE crm_personas legacy
   SET identity_persona_id = p.id,
       updated_at = NOW()
  FROM personas p
 WHERE legacy.root_did = p.root_did
   AND legacy.root_did IS NOT NULL
   AND legacy.identity_persona_id IS NULL
   AND p.status = 'active';

COMMENT ON FUNCTION sync_persona_to_crm_persona IS
  'Smart link: on personas INSERT, locate an existing crm_personas row ' ||
  'via root_did or email and UPDATE its identity_persona_id; only INSERT ' ||
  'a new row if no match exists. Makes PersonaSpine the canonical SoT ' ||
  'for identity while honouring DIDQube anchors + pre-existing CRM data.';
