-- 20260723000000_research_report_published.sql
--
-- Stage 3 of the report lifecycle (2026-07-18 operator direction):
--   live draft (in-browser) → canonical (regenerated + DVN-receipted version)
--   → PUBLISHED (a canonical version made public).
--
-- published_at is the publication flag: NULL = internal canonical record;
-- set = the version renders in the public Publications → Reports tab
-- (/api/public/irl/reports). Publishing is an admin action gated on the
-- version being canonical (receipt-minted) at the route layer.
--
-- Additive/idempotent (CFS-010 §3).

ALTER TABLE public.research_report_versions
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
