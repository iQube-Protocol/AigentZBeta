-- 2026-06-15 — Runtime content lifecycle (metaMe admin controller)
--
-- The metaMe admin panel becomes the central controller for what surfaces in
-- the metaMe Runtime. Two changes to community_generated_content support the
-- publish/unpublish/archive lifecycle and the cartridge→runtime submit flow:
--
--   1. Extend the status CHECK to add 'unpublished' and 'archived' so admins
--      can pull live content out of the runtime (unpublish → back-pocketed,
--      archive → retained-but-hidden) without a hard delete.
--   2. Add origin_cartridge so a metame-runtime row that was submitted FROM a
--      cartridge Pulse (KNYT / Qriptopian) remembers where it came from. The
--      metaMe admin queue surfaces this tag alongside the runtime menu filter.
--
-- The status check is named by Postgres as
-- community_generated_content_status_check (inline CHECK on the original
-- 20260429000000 migration).

ALTER TABLE community_generated_content
  DROP CONSTRAINT IF EXISTS community_generated_content_status_check;
ALTER TABLE community_generated_content
  ADD CONSTRAINT community_generated_content_status_check
    CHECK (status IN (
      'draft',
      'shared',
      'pending_promotion',
      'runtime_promoted',
      'rejected',
      'unpublished',
      'archived'
    ));

ALTER TABLE community_generated_content
  ADD COLUMN IF NOT EXISTS origin_cartridge TEXT
    CHECK (origin_cartridge IS NULL OR origin_cartridge IN ('knyt', 'qripto', 'metame-runtime'));

CREATE INDEX IF NOT EXISTS idx_cgc_origin_cartridge
  ON community_generated_content(origin_cartridge);
