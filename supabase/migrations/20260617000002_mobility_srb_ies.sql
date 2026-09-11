ALTER TABLE mobility_cases
  ADD COLUMN IF NOT EXISTS srb_content      jsonb,
  ADD COLUMN IF NOT EXISTS srb_status       text NOT NULL DEFAULT 'not_generated',
  ADD COLUMN IF NOT EXISTS srb_approved_at  timestamptz,
  ADD COLUMN IF NOT EXISTS ies_content      jsonb,
  ADD COLUMN IF NOT EXISTS ies_status       text NOT NULL DEFAULT 'not_generated',
  ADD COLUMN IF NOT EXISTS ies_approved_at  timestamptz;
