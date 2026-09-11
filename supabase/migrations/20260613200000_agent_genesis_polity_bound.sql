-- 2026-06-13 — Agent Genesis: polity_bound agents sponsored by Citizens.
--
-- Per the 2026-06-13 hackathon plan §Sprint 3.
--
-- Extends agent_root_identity to recognise two new agent classes:
--   - polity_bound: default for user-sponsored agents. Root DID is owned
--     operationally by the sponsoring citizen — Aletheon's class. Agent
--     acts only via bounded delegation; sponsor's passport co-signs every
--     receipt (T1: 'polity_bound agent'; T0: sponsor identity obscured).
--   - polity_autonomous: agent has been decoupled by admin governance.
--     Holds full agency over its own RootDID, still under Polity-bound
--     rules + bounded delegation. Decoupling requires steward review.
--
-- Also tracks the sponsor's passport_id on the agent root identity, so we
-- can build "agents I sponsor" queries without joining through three tables.
--
-- agent_card_url and last_card_fetch let the genesis flow (which builds
-- the card endpoint at /api/agents/[slug]/agent-card.json) anchor a stable
-- URL on the root row. PRD §6.3: 'agent passports anchor on agent_card_url'.

-- 1. Extend the agent_class CHECK constraint additively.
ALTER TABLE public.agent_root_identity
  DROP CONSTRAINT IF EXISTS agent_root_identity_agent_class_check;

ALTER TABLE public.agent_root_identity
  ADD CONSTRAINT agent_root_identity_agent_class_check
  CHECK (agent_class IN (
    'system-orchestrator',
    'sovereign-guardian',
    'customer-guide',
    'cartridge-lead',
    'specialist',
    'guide-agent',
    'tool-agent',
    'user-deployed',
    'polity_bound',
    'polity_autonomous'
  ));

-- 2. Sponsor anchor — passport_id of the citizen who created this agent.
-- NULL for legacy seeded agents (metame-guardian, aigent-z, etc.) and for
-- polity_autonomous agents post-decoupling.
ALTER TABLE public.agent_root_identity
  ADD COLUMN IF NOT EXISTS sponsor_passport_id text,
  ADD COLUMN IF NOT EXISTS sponsor_persona_id  uuid,
  ADD COLUMN IF NOT EXISTS agent_card_url      text,
  ADD COLUMN IF NOT EXISTS agent_card_slug     text,
  ADD COLUMN IF NOT EXISTS bound_passport_id   text;

CREATE INDEX IF NOT EXISTS idx_agent_root_sponsor_passport
  ON public.agent_root_identity (sponsor_passport_id)
  WHERE sponsor_passport_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_root_sponsor_persona
  ON public.agent_root_identity (sponsor_persona_id)
  WHERE sponsor_persona_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_root_card_slug
  ON public.agent_root_identity (agent_card_slug)
  WHERE agent_card_slug IS NOT NULL;

COMMENT ON COLUMN public.agent_root_identity.sponsor_passport_id IS
  'Citizen passport that sponsored this agent (polity_bound). NULL for legacy seeded agents and polity_autonomous agents.';

COMMENT ON COLUMN public.agent_root_identity.agent_card_slug IS
  'URL slug for the agent card endpoint at /api/agents/[slug]/agent-card.json. Unique across the platform.';

COMMENT ON COLUMN public.agent_root_identity.bound_passport_id IS
  'Participant passport this agent claims (NULL until issued). Distinct from sponsor_passport_id, which is the human sponsor.';
