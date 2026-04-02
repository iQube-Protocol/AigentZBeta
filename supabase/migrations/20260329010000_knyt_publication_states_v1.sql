-- =============================================================================
-- KNYT Publication States
-- Tracks the review and publication lifecycle for all KNYT Living Canon content.
--
-- Storage boundary:
--   Supabase = fast cache + query layer
--   Autodrive CID = canonical on-chain record (written on Canon state changes)
--
-- Branch:     canon | community | correspondent
-- State FSM:  draft → submitted → under_review → approved/rejected/archived
--             approved → canon_eligible → canon
-- All state transitions are role-controlled and audit-logged.
-- =============================================================================

-- Branch type
CREATE TYPE knyt_canon_branch AS ENUM (
  'canon',
  'community',
  'correspondent'
);

-- Publication state type
CREATE TYPE knyt_publication_state AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'archived',
  'canon_eligible',
  'canon'
);

-- Publication state records
CREATE TABLE IF NOT EXISTS knyt_publication_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Subject of this state record
  subject_type    TEXT NOT NULL,   -- 'submission' | 'contribution' | 'episode' | 'lore_entry'
  subject_id      UUID NOT NULL,   -- FK to the subject table (enforced at app layer for flexibility)
  branch          knyt_canon_branch NOT NULL DEFAULT 'community',
  state           knyt_publication_state NOT NULL DEFAULT 'draft',
  -- On-chain authority (written when state reaches 'canon')
  autodrive_cid   TEXT,            -- Autonomys Auto-Drive CID once canonised
  autodrive_tx    TEXT,            -- Optional: on-chain tx reference
  -- Review metadata
  reviewed_by     UUID,            -- persona_id of reviewer
  review_notes    TEXT,
  reviewed_at     TIMESTAMPTZ,
  -- Canon elevation (written when state reaches 'canon')
  elevated_by     UUID,            -- persona_id of steward who elevated
  elevated_at     TIMESTAMPTZ,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log for every state transition
CREATE TABLE IF NOT EXISTS knyt_publication_state_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id  UUID NOT NULL REFERENCES knyt_publication_states(id) ON DELETE CASCADE,
  from_state      knyt_publication_state,
  to_state        knyt_publication_state NOT NULL,
  actor_persona   UUID NOT NULL,   -- persona_id who made the change
  reason          TEXT,
  autodrive_cid   TEXT,            -- CID of this specific version if written to chain
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_knyt_pub_states_subject   ON knyt_publication_states(subject_type, subject_id);
CREATE INDEX idx_knyt_pub_states_branch    ON knyt_publication_states(branch);
CREATE INDEX idx_knyt_pub_states_state     ON knyt_publication_states(state);
CREATE INDEX idx_knyt_pub_log_pub          ON knyt_publication_state_log(publication_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION knyt_pub_states_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER knyt_pub_states_updated_at
  BEFORE UPDATE ON knyt_publication_states
  FOR EACH ROW EXECUTE FUNCTION knyt_pub_states_set_updated_at();

-- RLS: visible to authenticated users; mutations require review/admin role (enforced via app)
ALTER TABLE knyt_publication_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE knyt_publication_state_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knyt_pub_states_read_all" ON knyt_publication_states
  FOR SELECT USING (true);

CREATE POLICY "knyt_pub_states_insert_auth" ON knyt_publication_states
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "knyt_pub_states_update_auth" ON knyt_publication_states
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "knyt_pub_log_read_all" ON knyt_publication_state_log
  FOR SELECT USING (true);

CREATE POLICY "knyt_pub_log_insert_auth" ON knyt_publication_state_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
