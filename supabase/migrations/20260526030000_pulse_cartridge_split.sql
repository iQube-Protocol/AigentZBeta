-- =============================================================================
-- Pulse cartridge split + note-kind support for community_generated_content
--
-- Phase 1 of the Qriptopian Pulse wiring (backlog item from
-- codexes/packs/agentiq/updates/2026-05-26_qriptopian-pulse-wiring-and-
-- moderation-backlog.md).
--
-- 1. Adds `cartridge` column to community_generated_content so each row
--    knows whether it belongs to KNYT Pulse or Qriptopian Pulse.
-- 2. Widens the `skill` CHECK to accept 'note' so user-authored markdown
--    ideas (from myCanvas) ride the same table as AI-generated articles
--    and stories. The shared table lets a 'note' graduate into rich
--    media (image / Q¢ / generated body) via Studio exQubes without a
--    row migration.
-- 3. Creates qripto_publication_states mirroring knyt_publication_states
--    so the Qriptopian Pulse has its own publication-state spine.
--
-- All changes are additive — existing KNYT rows continue to work unchanged
-- (cartridge defaults to 'knyt').
-- =============================================================================

-- 1) Add cartridge column to community_generated_content. Default to 'knyt'
--    for back-compat — every existing row was KNYT-flavoured.
ALTER TABLE community_generated_content
  ADD COLUMN IF NOT EXISTS cartridge TEXT NOT NULL DEFAULT 'knyt'
    CHECK (cartridge IN ('knyt', 'qripto'));

CREATE INDEX IF NOT EXISTS idx_cgc_cartridge ON community_generated_content(cartridge);
CREATE INDEX IF NOT EXISTS idx_cgc_cartridge_status ON community_generated_content(cartridge, status);

-- 2) Widen the `skill` CHECK to accept 'note'. Plain markdown ideas from
--    myCanvas land here; Studio exQubes can later upgrade a 'note' into
--    an 'article' or 'story' in-place.
ALTER TABLE community_generated_content
  DROP CONSTRAINT IF EXISTS community_generated_content_skill_check;

ALTER TABLE community_generated_content
  ADD CONSTRAINT community_generated_content_skill_check
    CHECK (skill IN ('article', 'story', 'note'));

-- 3) qripto_publication_states — mirror of knyt_publication_states but
--    scoped to Qriptopian content. Reuses the existing knyt_canon_branch
--    + knyt_publication_state enums so both cartridges share the canon /
--    community / correspondent vocabulary.
CREATE TABLE IF NOT EXISTS qripto_publication_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type    TEXT NOT NULL,
  subject_id      UUID NOT NULL,
  branch          knyt_canon_branch NOT NULL DEFAULT 'community',
  state           knyt_publication_state NOT NULL DEFAULT 'draft',
  autodrive_cid   TEXT,
  autodrive_tx    TEXT,
  reviewed_by     UUID,
  review_notes    TEXT,
  reviewed_at     TIMESTAMPTZ,
  elevated_by     UUID,
  elevated_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qripto_publication_state_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id  UUID NOT NULL REFERENCES qripto_publication_states(id) ON DELETE CASCADE,
  from_state      knyt_publication_state,
  to_state        knyt_publication_state NOT NULL,
  actor_persona   UUID NOT NULL,
  reason          TEXT,
  autodrive_cid   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qripto_pub_states_subject ON qripto_publication_states(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_qripto_pub_states_branch  ON qripto_publication_states(branch);
CREATE INDEX IF NOT EXISTS idx_qripto_pub_states_state   ON qripto_publication_states(state);
CREATE INDEX IF NOT EXISTS idx_qripto_pub_log_pub        ON qripto_publication_state_log(publication_id);

-- Reuse the existing knyt_pub_states_set_updated_at function (same shape).
CREATE TRIGGER qripto_pub_states_updated_at
  BEFORE UPDATE ON qripto_publication_states
  FOR EACH ROW EXECUTE FUNCTION knyt_pub_states_set_updated_at();

ALTER TABLE qripto_publication_states     ENABLE ROW LEVEL SECURITY;
ALTER TABLE qripto_publication_state_log  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qripto_pub_states_read_all"    ON qripto_publication_states;
DROP POLICY IF EXISTS "qripto_pub_states_insert_auth" ON qripto_publication_states;
DROP POLICY IF EXISTS "qripto_pub_states_update_auth" ON qripto_publication_states;
DROP POLICY IF EXISTS "qripto_pub_log_read_all"       ON qripto_publication_state_log;
DROP POLICY IF EXISTS "qripto_pub_log_insert_auth"    ON qripto_publication_state_log;

CREATE POLICY "qripto_pub_states_read_all"    ON qripto_publication_states    FOR SELECT USING (true);
CREATE POLICY "qripto_pub_states_insert_auth" ON qripto_publication_states    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "qripto_pub_states_update_auth" ON qripto_publication_states    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "qripto_pub_log_read_all"       ON qripto_publication_state_log FOR SELECT USING (true);
CREATE POLICY "qripto_pub_log_insert_auth"    ON qripto_publication_state_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE qripto_publication_states IS
  'Per-row publication state for Qriptopian content. Mirror of knyt_publication_states; same canon branch + state vocabulary so both cartridges share the Canon / Community / Correspondent surface logic.';

COMMENT ON COLUMN community_generated_content.cartridge IS
  'Which cartridge owns this row: knyt | qripto. Drives which *_publication_states table the publish endpoint writes to. Defaults to knyt for back-compat.';
