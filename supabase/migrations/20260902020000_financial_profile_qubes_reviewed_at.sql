-- ============================================================================
-- financial_profile_qubes.reviewed_at — Turn E (2026-09-02), operator
-- directive: "'real aggregates exist' establishes data availability, while
-- prepared evidence reflects the required user review. A successful
-- extraction alone must not silently count as a reviewed profile."
--
-- Additive only (IF NOT EXISTS) — safe to run against the live table without
-- touching any existing row. NULL means "not yet reviewed" (the honest
-- default for every row that predates this column, and every row where a
-- fresh compute/manual-entry pass has not yet been explicitly acknowledged
-- by the person it's about).
--
-- Set ONLY by markFinancialProfileReviewed() (services/iqube/financialProfileQube.ts),
-- called ONLY from POST /api/moneypenny/financial-profile/review — an
-- explicit, deliberate user action (a real button click), never inferred
-- from opening/viewing the panel (CLAUDE.md "Prepare completion must
-- reflect a reviewed financial profile... not navigation" — the same
-- discipline this column now extends from "not navigation" to "not even
-- successful extraction alone").
--
-- A fresh compute/manual-entry pass (upsertFinancialProfileQube) clears this
-- column back to NULL — a NEW profile has not yet been reviewed, even if
-- the previous one was. hasPreparedFinancialProfile() now requires BOTH
-- has_profile = true AND reviewed_at IS NOT NULL.
-- ============================================================================

ALTER TABLE public.financial_profile_qubes
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

COMMENT ON COLUMN public.financial_profile_qubes.reviewed_at IS
  'NULL until the person explicitly acknowledges reviewing this exact compute pass (POST /api/moneypenny/financial-profile/review). Cleared to NULL on every fresh upsert — review does not carry over to a new profile.';
