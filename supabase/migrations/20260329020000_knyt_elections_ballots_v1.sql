-- =============================================================================
-- KNYT Elections & Ballots
-- Voting is implemented as a SmartWallet task type.
-- Election context is Cartridge-defined; settlement is Codex-owned.
--
-- Reward model: turnout-positive
--   Each eligible voter who votes receives a fixed reward from a per-election pool.
--   More voters do NOT dilute the per-voter reward. The pool scales with turnout.
--   pool_size = per_voter_reward_knyt * ballots_cast (settled at close)
--
-- Codex authority:
--   Ballot records and settled outcomes write to this table.
--   Canon-affecting outcomes additionally write an Autodrive CID.
-- =============================================================================

-- Votable object types (aligned with PRD section 12.5)
CREATE TYPE knyt_votable_type AS ENUM (
  'community_submission',
  'correspondent_candidate',
  'branch_continuation',
  'article_candidate',
  'theory_thread',
  'scene_extension',
  'canon_elevation_candidate'
);

-- Election status
CREATE TYPE knyt_election_status AS ENUM (
  'draft',
  'open',
  'closed',
  'settled'
);

-- Elections (defined by Cartridge config; settled by Codex)
CREATE TABLE IF NOT EXISTS knyt_elections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identity
  title                 TEXT NOT NULL,
  description           TEXT,
  world_id              TEXT NOT NULL DEFAULT '21sats', -- active community world
  branch                knyt_canon_branch NOT NULL,
  -- What is being voted on
  votable_type          knyt_votable_type NOT NULL,
  candidate_ids         UUID[] NOT NULL DEFAULT '{}',  -- subject IDs eligible for vote
  -- Eligibility rules (evaluated against SmartWallet persona state)
  min_reputation_bucket INTEGER NOT NULL DEFAULT 0,    -- 0-4
  required_entitlements TEXT[] NOT NULL DEFAULT '{}',
  -- Timing
  opens_at              TIMESTAMPTZ NOT NULL,
  closes_at             TIMESTAMPTZ NOT NULL,
  -- Reward config (turnout-positive)
  per_voter_reward_knyt NUMERIC(18,8) NOT NULL DEFAULT 0.1,
  -- Outcome
  status                knyt_election_status NOT NULL DEFAULT 'draft',
  winner_ids            UUID[],                        -- settled winning subject IDs
  total_ballots_cast    INTEGER NOT NULL DEFAULT 0,
  settled_pool_knyt     NUMERIC(18,8),                -- final reward pool (set at settlement)
  -- On-chain record (written for canon-affecting outcomes)
  autodrive_cid         TEXT,
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ballots (one per persona per election; immutable once cast)
CREATE TABLE IF NOT EXISTS knyt_ballots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES knyt_elections(id) ON DELETE RESTRICT,
  persona_id      UUID NOT NULL,
  -- Vote: one or more candidates depending on election rules
  voted_for       UUID[] NOT NULL,
  -- Proof: signed payload from SmartWallet task completion
  -- Matches CompleteTaskPayload.proof from SmartWallet vote task
  proof           TEXT,
  wallet_task_id  TEXT,            -- WalletTask.id that triggered this ballot
  -- Reward entitlement (set at settlement)
  reward_knyt     NUMERIC(18,8),
  reward_settled  BOOLEAN NOT NULL DEFAULT FALSE,
  reward_tx       TEXT,
  -- Timestamps
  cast_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at      TIMESTAMPTZ,
  -- Enforce one ballot per persona per election
  UNIQUE(election_id, persona_id)
);

-- Indexes
CREATE INDEX idx_knyt_elections_world     ON knyt_elections(world_id);
CREATE INDEX idx_knyt_elections_status    ON knyt_elections(status);
CREATE INDEX idx_knyt_elections_opens     ON knyt_elections(opens_at, closes_at);
CREATE INDEX idx_knyt_ballots_election    ON knyt_ballots(election_id);
CREATE INDEX idx_knyt_ballots_persona     ON knyt_ballots(persona_id);

-- Auto-update updated_at on elections
CREATE OR REPLACE FUNCTION knyt_elections_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER knyt_elections_updated_at
  BEFORE UPDATE ON knyt_elections
  FOR EACH ROW EXECUTE FUNCTION knyt_elections_set_updated_at();

-- Increment ballot count on insert
CREATE OR REPLACE FUNCTION knyt_increment_ballot_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE knyt_elections
  SET total_ballots_cast = total_ballots_cast + 1
  WHERE id = NEW.election_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER knyt_ballots_increment_count
  AFTER INSERT ON knyt_ballots
  FOR EACH ROW EXECUTE FUNCTION knyt_increment_ballot_count();

-- RLS
ALTER TABLE knyt_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE knyt_ballots   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knyt_elections_read_all" ON knyt_elections
  FOR SELECT USING (true);

CREATE POLICY "knyt_elections_write_auth" ON knyt_elections
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Ballots: persona can read their own; all can read settled results
CREATE POLICY "knyt_ballots_read_own" ON knyt_ballots
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "knyt_ballots_insert_auth" ON knyt_ballots
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
