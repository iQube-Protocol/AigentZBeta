-- Threshold Cohort Activation Phase A (2026-08-05 canonical Agent Bench plan).
-- Adds external-registry fields to marketa_candidate_agents so a candidate
-- discovered on Horizen (or any future ERC-8004-style registry) carries its
-- own registration facts, rather than a parallel ExternalAgentProspect
-- table (inv.engineering.036/037 — extend, don't duplicate).
--
-- Nullable throughout: a candidate discovered from a non-registry source
-- (an A2A card, an MCP listing) legitimately has none of these. NULL means
-- "not registry-backed / not yet resolved" and must never be read as false.

ALTER TABLE marketa.marketa_candidate_agents
  ADD COLUMN IF NOT EXISTS registry_provider TEXT,
  ADD COLUMN IF NOT EXISTS registry_network TEXT,
  ADD COLUMN IF NOT EXISTS on_chain_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS registry_contract TEXT,
  ADD COLUMN IF NOT EXISTS owner_wallet TEXT,
  ADD COLUMN IF NOT EXISTS pulse_state TEXT,
  ADD COLUMN IF NOT EXISTS pnl_state TEXT,
  -- Set only by an explicit steward act linking this candidate to a
  -- services/horizen/registrableAgents.ts entry — never inferred.
  ADD COLUMN IF NOT EXISTS runtime_agent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_marketa_candidate_agents_registry_provider
  ON marketa.marketa_candidate_agents (registry_provider);
