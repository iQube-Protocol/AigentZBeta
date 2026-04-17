-- Add ks_backer flag to nakamoto_knyt_personas
-- Allows the KS backers staging import to mark canonical personas
-- who are confirmed KS backers without waiting for Phase 2 merge.

ALTER TABLE nakamoto_knyt_personas
  ADD COLUMN IF NOT EXISTS ks_backer boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_nakamoto_knyt_personas_ks_backer
  ON nakamoto_knyt_personas (ks_backer)
  WHERE ks_backer = true;

COMMENT ON COLUMN nakamoto_knyt_personas.ks_backer IS
  'True when this canonical persona is confirmed as a Kickstarter backer '
  '(matched via normalized email against ks_backers_staging on import).';
