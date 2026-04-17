-- ============================================================================
-- AVL Relationship Builder α — Phase 0 DB Infrastructure
--
-- Per doc 27: avl-dev-implementation-prd.md
-- Creates the three core RB tables and seeds all 18 partner contacts
-- (16 Wave 1 + 2 Wave 2) from the KNYT partner activation addendum.
-- ============================================================================

-- ── Partner contact registry ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.avl_partner_contacts (
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text         NOT NULL,
  org                   text         NOT NULL,
  wave                  int          NOT NULL CHECK (wave IN (1, 2)),
  contact_email         text,
  contact_name          text,
  outreach_status       text         NOT NULL DEFAULT 'uncontacted',
    -- uncontacted | contacted | responded | committed | declined | deferred
  bd_stage              text         NOT NULL DEFAULT 'uncontacted',
    -- uncontacted | first_contact | responded | active | co_activation_agreed |
    -- integration_scoped | integration_active | live_partner | low_signal
  first_contact_at      timestamptz,
  last_contact_at       timestamptz,
  response_signal       text,
    -- none | acknowledged | interested | meeting_booked
  strategic_value_tier  int          CHECK (strategic_value_tier BETWEEN 1 AND 3),
    -- 1=highest, 3=lowest
  audience_overlap_notes text,
  next_action           text,
  assigned_agent        text         NOT NULL DEFAULT 'marketa',
  notes                 text,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avl_partners_wave   ON public.avl_partner_contacts (wave);
CREATE INDEX IF NOT EXISTS idx_avl_partners_stage  ON public.avl_partner_contacts (bd_stage);
CREATE INDEX IF NOT EXISTS idx_avl_partners_status ON public.avl_partner_contacts (outreach_status);

ALTER TABLE public.avl_partner_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avl_partners_admin_full"
  ON public.avl_partner_contacts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.personas p
      WHERE p.auth_profile_id = auth.uid() AND p.is_admin = true
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_avl_partner_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_avl_partner_updated_at ON public.avl_partner_contacts;
CREATE TRIGGER trg_avl_partner_updated_at
  BEFORE UPDATE ON public.avl_partner_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_avl_partner_updated_at();

-- ── Partner pipeline stage history ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.avl_partner_stage_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  uuid        NOT NULL REFERENCES public.avl_partner_contacts(id) ON DELETE CASCADE,
  from_stage  text,
  to_stage    text        NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  text,
  notes       text
);

CREATE INDEX IF NOT EXISTS idx_avl_stage_events_partner ON public.avl_partner_stage_events (partner_id);

ALTER TABLE public.avl_partner_stage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avl_stage_events_admin_full"
  ON public.avl_partner_stage_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.personas p
      WHERE p.auth_profile_id = auth.uid() AND p.is_admin = true
    )
  );

-- ── Comms packs registry ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.avl_comms_packs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text        NOT NULL UNIQUE,
  title             text        NOT NULL,
  audience_type     text        NOT NULL CHECK (audience_type IN ('partner', 'customer', 'both')),
  comms_type        text        NOT NULL,
    -- first_contact | reengagement | offer | post_campaign | integration_invite | etc.
  template_markdown text,
  subject_lines     jsonb,      -- array of 3 subject line variants
  cta_options       jsonb,
  send_rules        jsonb,
  active            boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.avl_comms_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avl_comms_packs_admin_full"
  ON public.avl_comms_packs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.personas p
      WHERE p.auth_profile_id = auth.uid() AND p.is_admin = true
    )
  );

-- ── Partner seed data — 18 partners from KNYT activation addendum ─────────────
-- Wave 1 (16): Autonomys → PubKey
-- Wave 2 (2):  Comic Republic, World Class Scholars

INSERT INTO public.avl_partner_contacts
  (name, org, wave, strategic_value_tier, audience_overlap_notes, assigned_agent)
VALUES
  ('Autonomys',           'Autonomys',           1, 1, 'Core infra partner; shared Web3/AI narrative; existing relationship',                         'marketa'),
  ('Fio Protocol',        'Fio Protocol',        1, 2, 'Web3 identity layer; blockchain UX audience; ecosystem alignment',                            'marketa'),
  ('ChainGPT',            'ChainGPT',            1, 2, 'AI + Web3 crossover; builder and developer audience',                                         'marketa'),
  ('Lamina1',             'Lamina1',             1, 1, 'Web3 creative/IP platform; high KNYT thematic overlap; collector audience',                   'marketa'),
  ('LayerZero',           'LayerZero',           1, 1, 'Cross-chain infra; large developer + investor community; broad reach',                        'marketa'),
  ('Project Liberty',     'Project Liberty',     1, 1, 'High-profile Web3 social + data sovereignty; aligned mission; strong institutional credibility', 'marketa'),
  ('CryptoMondays/DAIA',  'CryptoMondays/DAIA',  1, 2, 'Community-first Web3 events network; engaged retail and builder audience',                    'marketa'),
  ('PAL Capital',         'PAL Capital',         1, 2, 'Crypto-native investor community; backer and collector overlap',                              'marketa'),
  ('Distro',              'Distro',              1, 2, 'Web3 distribution and growth platform; amplification reach',                                  'marketa'),
  ('NEAR Protocol',       'NEAR',                1, 1, 'Major L1 ecosystem; large developer and creator community',                                   'marketa'),
  ('Polygon',             'Polygon',             1, 1, 'Major L2 ecosystem; massive reach; creator economy focus',                                    'marketa'),
  ('Secret Network',      'Secret Network',      1, 2, 'Privacy-focused Web3; niche but loyal community; data sovereignty alignment',                 'marketa'),
  ('Decentralized Media', 'Decentralized Media', 1, 2, 'Web3 media org; content amplification and editorial reach',                                   'marketa'),
  ('Horizen',             'Horizen',             1, 2, 'Privacy blockchain; developer and enthusiast community',                                      'marketa'),
  ('Bitcoin Harlem',      'Bitcoin Harlem',       1, 2, 'Culture + Bitcoin community; collector and patron audience; KNYT thematic alignment',         'marketa'),
  ('PubKey',              'PubKey',              1, 2, 'Bitcoin community hub; event-driven; engaged collector and enthusiast audience',               'marketa'),
  ('Comic Republic',      'Comic Republic',      2, 1, 'Top-tier media/comics; high KNYT IP overlap; activate on Wave 1 ignition signal',             'marketa'),
  ('World Class Scholars','World Class Scholars', 2, 1, 'Education/culture; collector and patron audience alignment; activate on Wave 1 ignition signal', 'marketa')
ON CONFLICT DO NOTHING;
