-- Add 'device_session' to crm_auth_profile_links.relationship_mode CHECK constraint.
-- This allows link-device to record device UUID associations without merging
-- persona visibility — getMergedLinkedAuthProfileIds only follows 'merged' links.

ALTER TABLE public.crm_auth_profile_links
  DROP CONSTRAINT IF EXISTS crm_auth_profile_links_relationship_mode_check;

ALTER TABLE public.crm_auth_profile_links
  ADD CONSTRAINT crm_auth_profile_links_relationship_mode_check
  CHECK (relationship_mode IN ('merged', 'delegated', 'device_session'));
