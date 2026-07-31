-- ============================================================================
-- Add passport_id to polity_passport_applications
--
-- Backfills the issued passport_id onto the application row so the
-- credential claim handler can look up the agent_card_url and bind
-- the participant passport to the agent_root_identity.
--
-- Additive and idempotent.
-- ============================================================================

ALTER TABLE public.polity_passport_applications
  ADD COLUMN IF NOT EXISTS passport_id text;

CREATE INDEX IF NOT EXISTS idx_passport_applications_passport_id
  ON public.polity_passport_applications (passport_id)
  WHERE passport_id IS NOT NULL;
