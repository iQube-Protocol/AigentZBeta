-- =============================================================================
-- Re-point user_entitlements.persona_id FK back to `personas` (plural).
--
-- Diagnostic on fost@knyt revealed the entitlement-grant insert was failing
-- silently. Likely cause: an earlier migration (20251217_fix_purchases_fk.sql)
-- attempted to re-point this FK to a `persona` (singular) table that doesn't
-- exist as a CREATE TABLE in any migration in this repo. If that migration
-- applied in production (manually or via an environment-specific path), the
-- FK target is invalid and every user_entitlements insert silently fails.
--
-- This migration is idempotent — drops any existing FK on persona_id and
-- recreates it pointing at `personas(id)`, which is the table the rest of
-- the codebase reads (see services/wallet/knyt/knytLedgerService.resolve-
-- PersonaId, app/api/wallet/personas/route.ts, etc.). Safe to run even if
-- the FK was already correct.
-- =============================================================================

ALTER TABLE user_entitlements
  DROP CONSTRAINT IF EXISTS user_entitlements_persona_id_fkey;

ALTER TABLE user_entitlements
  ADD CONSTRAINT user_entitlements_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;

-- Same fix for purchases — the parallel "fix" migration would have re-pointed
-- both. If purchases inserts have been working, this is a no-op.
ALTER TABLE purchases
  DROP CONSTRAINT IF EXISTS purchases_persona_id_fkey;

ALTER TABLE purchases
  ADD CONSTRAINT purchases_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;
