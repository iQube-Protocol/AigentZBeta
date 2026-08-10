-- KNYTS Bridge — editorial configuration
--
-- The light Bridge Admin surface (reconstitution spec, point 6) edits ONLY
-- Bridge-owned copy/media for its two net-new cinematic stages — HOME and
-- ORIENT, both sharing KnytsBridgeMediaStage — never Pulse content, Passport
-- mechanics, myCanvas templates, Standing, or Store products, which stay
-- owned by their canonical systems. One row per section, additive.

CREATE TABLE IF NOT EXISTS knyts_bridge_editorial_config (
  section       TEXT PRIMARY KEY,
  headline      TEXT,
  short_copy    TEXT,
  video_url     TEXT,
  poster_url    TEXT,
  campaign_cta  TEXT,
  reward_copy   TEXT,
  updated_by    TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the HOME section with the copy already live on the front door today,
-- so an admin who never opens the config surface sees no change at all.
INSERT INTO knyts_bridge_editorial_config (section, headline, short_copy, campaign_cta, reward_copy)
VALUES (
  'home',
  'Cross the Threshold. Come home.',
  E'The KNYTS Bridge is one path into the Polity — a constitutional home for people and their agents in the emerging Constitutional Internet.\n\nFollow the stories of those who are crossing. When you''re ready, claim your Passport, cross the Threshold and tell your own.\n\nShare your crossing. Discover others. Earn Standing. Win rewards.',
  'Explore the crossings',
  'Every crossing builds the bridge.'
)
ON CONFLICT (section) DO NOTHING;

-- Seed the ORIENT section likewise, so it too renders unchanged if an admin
-- never opens the config surface.
INSERT INTO knyts_bridge_editorial_config (section, headline, short_copy, campaign_cta, reward_copy)
VALUES (
  'orient',
  'Before you cross',
  E'Your personhood comes before your identity. Whatever name or persona you use here, it is you — a person — the Polity recognises.\n\nClaiming your Passport is your first constitutional act. Everything before it was browsing; this is the actual crossing.',
  'Claim your Passport',
  NULL
)
ON CONFLICT (section) DO NOTHING;
