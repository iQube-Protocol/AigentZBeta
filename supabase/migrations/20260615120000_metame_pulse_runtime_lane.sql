-- =============================================================================
-- metaMe Pulse — runtime content-approval lane
--
-- Adds a third cartridge lane ('metame-runtime') to community_generated_content
-- so Studio→runtime launches ride the same draft → shared → runtime_promoted
-- approval flow as KNYT and Qriptopian Pulse. Runtime-targeted artifacts land
-- as 'shared' (pending) and only surface on the metaMe Runtime once an admin
-- promotes them to 'runtime_promoted' from the metaMe Pulse admin tab.
--
-- Also records the runtime menu placement an admin assigns at promote time:
--   runtime_menu     — be | make | play | earn | share  (top-level runtime menu)
--   runtime_submenu  — free-text submenu label (e.g. watch, listen, goal, task)
--
-- These map into the runtime's be/make/play/earn/share menus via the existing
-- scoreContent pipeline — the projection in services/community-content/
-- promotedCapsules.ts emits them as capsule modalityHints (→ tags) which
-- scoreContent already reads. No new scoring logic.
--
-- All changes are additive — existing knyt / qripto rows are untouched.
-- =============================================================================

-- 1) Widen the cartridge CHECK to accept 'metame-runtime'. Drop + re-add the
--    constraint (the 20260526030000 migration created it inline on the column;
--    Postgres names it community_generated_content_cartridge_check).
ALTER TABLE community_generated_content
  DROP CONSTRAINT IF EXISTS community_generated_content_cartridge_check;

ALTER TABLE community_generated_content
  ADD CONSTRAINT community_generated_content_cartridge_check
    CHECK (cartridge IN ('knyt', 'qripto', 'metame-runtime'));

-- 2) Runtime menu placement, assigned by the admin at promote time.
ALTER TABLE community_generated_content
  ADD COLUMN IF NOT EXISTS runtime_menu TEXT
    CHECK (runtime_menu IS NULL OR runtime_menu IN ('be', 'make', 'play', 'earn', 'share'));

ALTER TABLE community_generated_content
  ADD COLUMN IF NOT EXISTS runtime_submenu TEXT;

CREATE INDEX IF NOT EXISTS idx_cgc_runtime_menu ON community_generated_content(runtime_menu);

COMMENT ON COLUMN community_generated_content.runtime_menu IS
  'metaMe Pulse: which runtime top-level menu (be|make|play|earn|share) a promoted row surfaces in. Mapped to capsule tags consumed by scoreContent.';
COMMENT ON COLUMN community_generated_content.runtime_submenu IS
  'metaMe Pulse: runtime submenu label (e.g. watch, listen, goal, task) for finer placement within runtime_menu.';
