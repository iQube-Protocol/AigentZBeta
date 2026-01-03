CREATE TABLE IF NOT EXISTS campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  persona_id UUID NOT NULL,
  referrer_persona_id UUID,
  event_type TEXT NOT NULL,
  tenant_id TEXT,
  franchise_id TEXT,
  content_id TEXT,
  source TEXT,
  metadata JSONB,
  dvn_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaign_events_persona_id_idx ON campaign_events(persona_id);
CREATE INDEX IF NOT EXISTS campaign_events_campaign_id_idx ON campaign_events(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_events_event_type_idx ON campaign_events(event_type);
CREATE INDEX IF NOT EXISTS campaign_events_created_at_idx ON campaign_events(created_at);

CREATE TABLE IF NOT EXISTS campaign_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  persona_id UUID NOT NULL,
  tenant_id TEXT NOT NULL,
  franchise_id TEXT NOT NULL,
  progress NUMERIC(5,2) DEFAULT 0,
  current_phase_id TEXT,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_states_campaign_persona_idx ON campaign_states(campaign_id, persona_id);
CREATE INDEX IF NOT EXISTS campaign_states_persona_id_idx ON campaign_states(persona_id);
