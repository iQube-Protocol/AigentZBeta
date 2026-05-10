-- =============================================================================
-- Re-point user_entitlements.persona_id FK back to `personas` (plural).
--
-- Diagnostic on fost@knyt revealed the entitlement-grant insert was failing
-- silently with PG 23503 — the FK was pointing at `persona_legacy_20260125`,
-- a renamed/archived snapshot of the original persona table. fost@knyt's
-- persona row lives in the canonical `personas` table per the spine
-- integration brief, so the insert kept getting rejected.
--
-- IMPORTANT: NOT VALID is required. The legacy table contains historical
-- persona rows that were never migrated into the canonical `personas`,
-- and existing user_entitlements rows reference some of those legacy
-- persona_ids (orphans). A standard ADD CONSTRAINT validates all existing
-- rows and aborts on the first orphan; NOT VALID applies the constraint
-- to FUTURE inserts/updates only and leaves the orphans untouched until
-- a separate cleanup decides what to do with them.
-- =============================================================================

ALTER TABLE user_entitlements
  DROP CONSTRAINT IF EXISTS user_entitlements_persona_id_fkey;

ALTER TABLE user_entitlements
  ADD CONSTRAINT user_entitlements_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
  NOT VALID;

-- Same fix for purchases for parity. If purchases inserts have been
-- working under the legacy FK, this is a no-op for new rows.
ALTER TABLE purchases
  DROP CONSTRAINT IF EXISTS purchases_persona_id_fkey;

ALTER TABLE purchases
  ADD CONSTRAINT purchases_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
  NOT VALID;

