-- ─────────────────────────────────────────────────────────────────────────────
-- persona_metame_settings — Personal Sovereignty Template Storage
-- Venture Lab α — Phase 2
--
-- One row per persona; upserted on save. Stores the metaMe alpha controls
-- as defined in 09-metame-template-spec.md. Alpha defaults mirror
-- METAME_ALPHA_DEFAULTS in components/metame/MetaMeSettingsPanel.tsx.
--
-- Columns map 1:1 to MetaMeSettings interface (snake_case ↔ camelCase).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS persona_metame_settings (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id           TEXT        NOT NULL UNIQUE,
  guardian_mode        BOOLEAN     NOT NULL DEFAULT true,
  lead_agent           TEXT        NOT NULL DEFAULT 'aigent-kn0w1',
  budget_posture       TEXT        NOT NULL DEFAULT 'low',
  receipt_visibility   BOOLEAN     NOT NULL DEFAULT true,
  curated_skills_only  BOOLEAN     NOT NULL DEFAULT true,
  explanation_first    BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS persona_metame_settings_persona_id_idx
  ON persona_metame_settings (persona_id);

-- lead_agent: 'aigent-kn0w1' | 'aigent-marketa' | 'aigent-c'
COMMENT ON COLUMN persona_metame_settings.lead_agent IS
  'aigent-kn0w1 | aigent-marketa | aigent-c';

-- budget_posture: 'low' | 'medium' | 'high' (maps to spend autonomy level)
COMMENT ON COLUMN persona_metame_settings.budget_posture IS
  'low | medium | high — how much agents can spend without guardian approval';

COMMENT ON TABLE persona_metame_settings IS
  'Personal sovereignty template for each persona. One row per persona. '
  'Alpha defaults: guardian_mode=true, lead_agent=aigent-kn0w1, budget_posture=low, '
  'receipt_visibility=true, curated_skills_only=true, explanation_first=true. '
  'Source of truth for metaMe alpha controls; localStorage is the fast-path fallback.';
