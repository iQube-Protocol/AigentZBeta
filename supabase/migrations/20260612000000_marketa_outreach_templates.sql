-- Marketa Activation Engine — outreach template library (golden path #5).
-- Operator-curated outreach templates per strategic lane; 'any' is the
-- catch-all. Drafting falls back to the built-in copy when no template
-- matches, so this table is optional until the operator curates.

CREATE TABLE IF NOT EXISTS marketa.marketa_outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  strategic_lane TEXT NOT NULL DEFAULT 'any',
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  cta TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketa_outreach_templates_lane
  ON marketa.marketa_outreach_templates (strategic_lane) WHERE enabled;

COMMENT ON TABLE marketa.marketa_outreach_templates IS
  'Operator-curated outreach templates per strategic lane (any = catch-all). Placeholders: {{operator}}, {{candidate_name}}, {{primary_lane}}, {{capabilities_bullets}}, {{legal_line}}, {{mobility_line}}, {{angle_note}}.';
