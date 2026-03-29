-- =============================================================================
-- KNYT P1: Reactions + Order Milestones
--
-- knyt_reactions: lightweight per-persona reactions on publication states
--   Reaction types aligned with Experience Laddering engagement signals:
--   spark       — "this sparked an idea" (high-quality engagement signal)
--   like        — simple positive signal
--   question    — "I have a question about this"
--   canon_worthy — community endorsement for elevation consideration
--
-- knyt_order_milestones: audit trail of Order of Metaiye tier ascensions
--   Each tier crossing is recorded exactly once per persona.
--   Used to prevent duplicate ascension rewards and to surface history.
--   Rights-bearing tiers (CHAMPION+) also get an Autodrive CID.
-- =============================================================================

-- -------------------------------------------------------------------------
-- Reactions
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS knyt_reactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id  UUID NOT NULL REFERENCES knyt_publication_states(id) ON DELETE CASCADE,
  persona_id      UUID NOT NULL,
  reaction_type   TEXT NOT NULL CHECK (reaction_type IN ('spark', 'like', 'question', 'canon_worthy')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One reaction per type per persona per publication
  UNIQUE(publication_id, persona_id, reaction_type)
);

CREATE INDEX idx_knyt_reactions_publication ON knyt_reactions(publication_id);
CREATE INDEX idx_knyt_reactions_persona     ON knyt_reactions(persona_id);

ALTER TABLE knyt_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone can read reactions (public engagement signals)
CREATE POLICY "knyt_reactions_read_all" ON knyt_reactions
  FOR SELECT USING (true);

-- Authenticated personas can insert their own reactions
CREATE POLICY "knyt_reactions_insert_auth" ON knyt_reactions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Persona can delete their own reaction (toggle off)
CREATE POLICY "knyt_reactions_delete_own" ON knyt_reactions
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- -------------------------------------------------------------------------
-- Order Milestones
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS knyt_order_milestones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id      UUID NOT NULL,
  tier            TEXT NOT NULL CHECK (tier IN ('INITIATE','SENTINEL','CHAMPION','KNIGHT','SATOSHI')),
  achieved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reward_granted  BOOLEAN NOT NULL DEFAULT FALSE,
  reward_grant_id UUID REFERENCES knyt_reward_grants(id),
  -- Autodrive CID for rights-bearing tiers (CHAMPION+)
  autodrive_cid   TEXT,
  -- Each tier is recorded once per persona
  UNIQUE(persona_id, tier)
);

CREATE INDEX idx_knyt_milestones_persona ON knyt_order_milestones(persona_id);
CREATE INDEX idx_knyt_milestones_tier    ON knyt_order_milestones(tier);

ALTER TABLE knyt_order_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knyt_milestones_read_own" ON knyt_order_milestones
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "knyt_milestones_write_service" ON knyt_order_milestones
  FOR ALL USING (auth.uid() IS NOT NULL);

-- -------------------------------------------------------------------------
-- Election settled_at column (for settlement tracking)
-- -------------------------------------------------------------------------
ALTER TABLE knyt_elections ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
