-- 20260616200000 — Sponsorship Capacity Protocol (Phase 3 MVP)
--
-- Sponsorship is work-potential staking — capacity is earned through
-- Standing-producing sponsorship, not capital, not tokens, not time.
--
-- Capacity = Base (3) + Earned. Used = count(active sponsorships).
-- The sponsor's `sponsorship_capacity_earned` increments when a sponsored
-- participant's standing_overall crosses the Standing threshold (event-
-- driven, never time-driven).
--
-- Base 3 = 1x aigentMe + 2x additional participants (per the Sponsorship
-- Capacity addendum). Existing personas inherit base = 3 via the column
-- default; no data migration needed.

BEGIN;

ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS sponsorship_capacity_base     INTEGER NOT NULL DEFAULT 3
    CHECK (sponsorship_capacity_base >= 0),
  ADD COLUMN IF NOT EXISTS sponsorship_capacity_earned   INTEGER NOT NULL DEFAULT 0
    CHECK (sponsorship_capacity_earned >= 0);

COMMENT ON COLUMN public.personas.sponsorship_capacity_base IS
  'Base sponsorship slots granted at Citizen Passport issuance. Default 3 = 1 aigentMe + 2 additional participants.';
COMMENT ON COLUMN public.personas.sponsorship_capacity_earned IS
  'Sponsorship slots earned through Standing-producing sponsorship; event-driven, never time-driven.';

COMMIT;
