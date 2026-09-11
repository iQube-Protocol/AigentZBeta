-- Polity Passport Bureau — Stage 4 agent flow support.
--
-- application_payload carries the FULL submitted participant application
-- body (agent card refs, capabilities, policy/risk profiles, consents).
-- Participant application material is registry-listing-public by design.
-- CITIZEN private data NEVER lands here — citizen applications carry only
-- vault refs (Addendum A); the submit route enforces this and the canary
-- test asserts it.

ALTER TABLE polity_passport_applications
  ADD COLUMN IF NOT EXISTS application_payload jsonb;

COMMENT ON COLUMN polity_passport_applications.application_payload IS
  'Full submitted body for PARTICIPANT applications (registry-listing-public material). Citizen applications never populate this — citizen private data lives in the self-custody vault only.';

CREATE INDEX IF NOT EXISTS idx_pp_applications_agent_card
  ON polity_passport_applications(agent_card_url) WHERE agent_card_url IS NOT NULL;
