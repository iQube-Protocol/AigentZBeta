-- =============================================================================
-- KNYT Bounded Remix — Publication Lineage
--
-- Adds parent_publication_id to knyt_publication_states so derivative
-- community submissions can trace their lineage back to a source canon
-- or community item.
--
-- Remix constraints (bounded):
--   - Only canon or community items can be remixed (not correspondent)
--   - Remixes always land in the 'community' branch (never directly to canon)
--   - Remix depth is tracked via remix_depth (capped at 3 in application logic)
--   - Source attribution is preserved and surfaced in the review UI
-- =============================================================================

ALTER TABLE knyt_publication_states
  ADD COLUMN IF NOT EXISTS parent_publication_id UUID
    REFERENCES knyt_publication_states(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS remix_depth INTEGER NOT NULL DEFAULT 0;

-- Index for lineage queries (find all remixes of a source)
CREATE INDEX IF NOT EXISTS idx_knyt_pub_parent
  ON knyt_publication_states(parent_publication_id)
  WHERE parent_publication_id IS NOT NULL;
