-- Add missing columns to crm_contributions for task submission workflow
-- These columns support the notes and review feedback features

ALTER TABLE public.crm_contributions 
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS impact_level INTEGER CHECK (impact_level >= 1 AND impact_level <= 5);

COMMENT ON COLUMN public.crm_contributions.notes IS 'Contributor notes when submitting work';
COMMENT ON COLUMN public.crm_contributions.review_notes IS 'Reviewer feedback notes';
COMMENT ON COLUMN public.crm_contributions.rejection_reason IS 'Reason for rejection if rejected';
COMMENT ON COLUMN public.crm_contributions.impact_level IS 'Assessed impact level (1-5)';
