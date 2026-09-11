-- =============================================================================
-- KNYTS Bridge Campaign Activation (Gates A-D)
--
-- Additive only. Three changes, each justified against the existing
-- substrate rather than duplicating it:
--
-- 1. knyts_bridge_campaign_evidence — a dedicated evidence ledger.
--    campaign_events (20260105_campaign_quests.sql) already tracks this
--    exact campaign id ('knyts-bridge-crossing') for SIGNED-IN personas, but
--    campaign_events.persona_id is NOT NULL and campaign_events/campaign_states
--    are shared with two other live campaigns (bring-a-knight, qriptopian-share,
--    constitutional-internet-bridge). The KNYTS Bridge campaign specifically
--    needs to capture pre-authentication, email-only visitors (spec: "email
--    address — required for anonymous/non-authenticated visitors") and needs
--    idempotency + CRM/evidence-grade attribution fields campaign_events does
--    not have. Retrofitting those onto the shared table risks the other
--    campaigns' write paths. This table is the dedupe/idempotency source of
--    truth; existing recordCampaignEvent()/campaign_events continues to be
--    fed (dual-write) whenever a personaId is actually known, so the
--    already-registered share-reward threshold wiring for this campaign id
--    (campaignRegistry.ts) keeps working unmodified.
--
-- 2. knyts_bridge_story_likes — Crossing Stories are stored as
--    community_generated_content rows tagged campaign_tag. That table has no
--    like/reaction mechanism. knyt_reactions exists but is scoped to
--    knyt_publication_states (a different content type, different feature —
--    Living Canon), not community_generated_content, so it cannot be reused
--    without a schema change to knyt_reactions itself (its publication_id FK
--    is NOT NULL). This is a small, purpose-built table mirroring
--    knyt_reactions' unique-per-actor-per-target shape.
--
-- 3. crm_reputation_events_source_type_check — widened by exactly one value,
--    'campaign_contribution', so campaign evidence can write through the
--    existing createReputationEvent()/RQH sync path without inventing a
--    parallel reputation store.
-- =============================================================================

-- -------------------------------------------------------------------------
-- 1. Campaign evidence ledger
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS knyts_bridge_campaign_evidence (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id            TEXT NOT NULL DEFAULT 'knyts-bridge-crossing',
  action_type            TEXT NOT NULL CHECK (action_type IN (
                             'campaign_preregistered',
                             'kickstarter_preview_clicked',
                             'kickstarter_follow_confirmed',
                             'bridge_shared',
                             'qualified_campaign_visit',
                             'crossing_story_published',
                             'crossing_story_liked',
                             'crossing_story_engagement_threshold_reached',
                             'campaign_referral_converted'
                           )),
  -- Identity-spine persona, when the actor is signed in. Nullable —
  -- anonymous/email-only pre-registration is the entire point of this table.
  persona_id             UUID,
  -- crm_personas.id once dedupe has resolved/created a CRM contact.
  crm_persona_id         UUID REFERENCES crm_personas(id),
  normalized_email       TEXT,
  investor_known         BOOLEAN NOT NULL DEFAULT false,
  evidence_grade         TEXT NOT NULL DEFAULT 'observed'
                           CHECK (evidence_grade IN ('observed', 'verified', 'attested', 'external-confirmed')),
  source_surface         TEXT,
  external_ref           TEXT,
  content_id             UUID,
  referrer_persona_id    UUID,
  metadata               JSONB,
  idempotency_key        TEXT NOT NULL,
  reputation_applied_at  TIMESTAMPTZ,
  standing_applied_at    TIMESTAMPTZ,
  standing_withheld_reason TEXT,
  reward_applied_at      TIMESTAMPTZ,
  reward_amount_knyt     NUMERIC(10,4),
  dual_write_event_id    UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knyts_bridge_evidence_idempotency
  ON knyts_bridge_campaign_evidence(campaign_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_knyts_bridge_evidence_persona ON knyts_bridge_campaign_evidence(persona_id);
CREATE INDEX IF NOT EXISTS idx_knyts_bridge_evidence_crm_persona ON knyts_bridge_campaign_evidence(crm_persona_id);
CREATE INDEX IF NOT EXISTS idx_knyts_bridge_evidence_email ON knyts_bridge_campaign_evidence(normalized_email);
CREATE INDEX IF NOT EXISTS idx_knyts_bridge_evidence_action_type ON knyts_bridge_campaign_evidence(action_type);
CREATE INDEX IF NOT EXISTS idx_knyts_bridge_evidence_content ON knyts_bridge_campaign_evidence(content_id);
CREATE INDEX IF NOT EXISTS idx_knyts_bridge_evidence_created_at ON knyts_bridge_campaign_evidence(created_at);

ALTER TABLE knyts_bridge_campaign_evidence ENABLE ROW LEVEL SECURITY;
-- Server-side (service role) only — this ledger carries T0/attribution
-- fields (persona_id, crm_persona_id, normalized_email) that must never be
-- readable client-side. No anon/authenticated policies are created.

-- -------------------------------------------------------------------------
-- 2. Crossing Story likes
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS knyts_bridge_story_likes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_content_id  UUID NOT NULL REFERENCES community_generated_content(id) ON DELETE CASCADE,
  liker_persona_id       UUID NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(community_content_id, liker_persona_id)
);

CREATE INDEX IF NOT EXISTS idx_knyts_bridge_story_likes_content ON knyts_bridge_story_likes(community_content_id);
CREATE INDEX IF NOT EXISTS idx_knyts_bridge_story_likes_liker ON knyts_bridge_story_likes(liker_persona_id);

ALTER TABLE knyts_bridge_story_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knyts_bridge_story_likes_read_all" ON knyts_bridge_story_likes
  FOR SELECT USING (true);

CREATE POLICY "knyts_bridge_story_likes_insert_auth" ON knyts_bridge_story_likes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "knyts_bridge_story_likes_delete_own" ON knyts_bridge_story_likes
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- -------------------------------------------------------------------------
-- 3. Widen crm_reputation_events source_type by one campaign value
-- -------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crm_reputation_events' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE public.crm_reputation_events DROP CONSTRAINT IF EXISTS crm_reputation_events_source_type_check;
    ALTER TABLE public.crm_reputation_events
      ADD CONSTRAINT crm_reputation_events_source_type_check
      CHECK (source_type IS NULL OR source_type IN (
        'task_completion', 'usage_reward', 'manual_attestation',
        'external_verification', 'dispute_resolution', 'decay', 'correction',
        'campaign_contribution'
      ));
  END IF;
END $$;
