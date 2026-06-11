-- Marketa Activation Engine Phase 1
-- Candidate-agent activation spine hosted inside existing Marketa cartridge.

CREATE SCHEMA IF NOT EXISTS marketa;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS marketa.marketa_candidate_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_url TEXT NOT NULL DEFAULT '',
  agent_card_url TEXT NOT NULL DEFAULT '',
  mcp_server_url TEXT NOT NULL DEFAULT '',
  openapi_url TEXT NOT NULL DEFAULT '',
  repository_url TEXT NOT NULL DEFAULT '',
  website_url TEXT NOT NULL DEFAULT '',
  operator_name TEXT NOT NULL DEFAULT '',
  operator_type TEXT NOT NULL DEFAULT 'unknown',
  strategic_lanes JSONB NOT NULL DEFAULT '[]'::jsonb,
  verticals JSONB NOT NULL DEFAULT '[]'::jsonb,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_users JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_bottom_relevance JSONB NOT NULL DEFAULT '{"supportsExecMobility":false,"supportsVulnerablePersonsMobility":false,"mobilityReferenceTag":"none","sharedProcessSpine":[]}'::jsonb,
  legal_track TEXT NOT NULL DEFAULT 'none',
  scores JSONB NOT NULL DEFAULT '{"strategicFitScore":0,"aigentmeFitScore":0,"marketaMultiplierScore":0,"cleanRevenuePotentialScore":0,"trustReadinessScore":0,"passportReadinessScore":0,"technicalIntegrationScore":0,"policyAlignmentScore":0,"riskScore":0,"overallPriorityScore":0}'::jsonb,
  risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  policy_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  outreach_status TEXT NOT NULL DEFAULT 'not_started',
  activation_status TEXT NOT NULL DEFAULT 'discovered',
  passport_integration JSONB NOT NULL DEFAULT '{"integrationStatus":"stub","participantPassportApplicationUrl":"","participantPassportSchemaUrl":"","passportApplicationStatus":"not_started","participantPassportId":"","registryRecordId":"","agentIqubeId":"","reputationBindingId":"","lastSyncAt":null}'::jsonb,
  iqube_registry JSONB NOT NULL DEFAULT '{"registryStatus":"not_registered","agentIqubeId":"","registryRecordId":"","publicRegistryUrl":"","agentCardRef":"","lastRegistrySyncAt":null}'::jsonb,
  reputation JSONB NOT NULL DEFAULT '{"reputationBindingId":"","standingStatus":"unknown","publicScore":null,"infractionCount":0,"activeRestrictions":[],"lastReputationCheckAt":null}'::jsonb,
  revenue_tracking JSONB NOT NULL DEFAULT '{"opportunityCount":0,"estimatedPipelineValue":0,"closedCleanRevenue":0,"revenueAttributionNotes":""}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketa_candidate_agents_activation_status
  ON marketa.marketa_candidate_agents (activation_status);
CREATE INDEX IF NOT EXISTS idx_marketa_candidate_agents_outreach_status
  ON marketa.marketa_candidate_agents (outreach_status);
CREATE INDEX IF NOT EXISTS idx_marketa_candidate_agents_legal_track
  ON marketa.marketa_candidate_agents (legal_track);
CREATE INDEX IF NOT EXISTS idx_marketa_candidate_agents_scores_gin
  ON marketa.marketa_candidate_agents USING gin (scores);
CREATE INDEX IF NOT EXISTS idx_marketa_candidate_agents_lanes_gin
  ON marketa.marketa_candidate_agents USING gin (strategic_lanes);
CREATE INDEX IF NOT EXISTS idx_marketa_candidate_agents_verticals_gin
  ON marketa.marketa_candidate_agents USING gin (verticals);

CREATE TABLE IF NOT EXISTS marketa.marketa_candidate_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_agent_id UUID REFERENCES marketa.marketa_candidate_agents(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_url TEXT NOT NULL DEFAULT '',
  discovery_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  discovered_by TEXT NOT NULL DEFAULT 'marketa',
  terms_compliance_status TEXT NOT NULL DEFAULT 'unknown',
  extraction_status TEXT NOT NULL DEFAULT 'not_started',
  review_status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketa.marketa_candidate_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_agent_id UUID NOT NULL REFERENCES marketa.marketa_candidate_agents(id) ON DELETE CASCADE,
  opportunity_type TEXT NOT NULL DEFAULT 'other',
  target_user TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  estimated_value NUMERIC NOT NULL DEFAULT 0,
  clean_revenue_status TEXT NOT NULL DEFAULT 'unknown',
  policy_risk TEXT NOT NULL DEFAULT 'low',
  requires_passport BOOLEAN NOT NULL DEFAULT true,
  requires_steward_review BOOLEAN NOT NULL DEFAULT false,
  requires_human_signoff BOOLEAN NOT NULL DEFAULT true,
  activation_status TEXT NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketa_candidate_opportunities_candidate
  ON marketa.marketa_candidate_opportunities (candidate_agent_id);

CREATE TABLE IF NOT EXISTS marketa.marketa_activation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_agent_id UUID REFERENCES marketa.marketa_candidate_agents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT 'marketa',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketa_activation_events_candidate
  ON marketa.marketa_activation_events (candidate_agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketa.marketa_score_weights (
  id TEXT PRIMARY KEY DEFAULT 'default',
  weights JSONB NOT NULL DEFAULT '{"strategicFitScore":0.20,"aigentmeFitScore":0.15,"marketaMultiplierScore":0.10,"cleanRevenuePotentialScore":0.25,"trustReadinessScore":0.15,"passportReadinessScore":0.10,"riskScore":0.15}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO marketa.marketa_score_weights (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE marketa.marketa_candidate_agents IS 'Marketa Activation Engine candidate agents: discovery, scoring, clean revenue, Passport/Registry/Reputation stubs.';
COMMENT ON COLUMN marketa.marketa_candidate_agents.top_bottom_relevance IS 'Internal top/bottom mobility model surfaced to users as Exec/Vulnerable persons mobility tagging.';
COMMENT ON COLUMN marketa.marketa_candidate_agents.legal_track IS 'High-Yield Legal vs Polity Legal Aid split; values: none, high_yield_legal, polity_legal_aid, both.';
