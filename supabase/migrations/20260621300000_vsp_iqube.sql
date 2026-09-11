-- Verified Standing Assets as sovereign iQubes (Standing PRD Tier 2).
--
-- When a citizen verifies/compiles a Standing profile and purchases the asset
-- (pay-per-asset), it is minted as a citizen-owned iQube in the registry SoT
-- (iqube_id_map + persona_token_qube_ownership) by services/vsp/registerVspIqube.
-- This column links the VSP profile to its minted sovereign asset.
--
-- Additive ALTER on vsp_profiles (created in 20260618000000).

BEGIN;

ALTER TABLE public.vsp_profiles
  ADD COLUMN IF NOT EXISTS iqube_id uuid;

CREATE INDEX IF NOT EXISTS idx_vsp_profiles_iqube
  ON public.vsp_profiles (iqube_id) WHERE iqube_id IS NOT NULL;

COMMENT ON COLUMN public.vsp_profiles.iqube_id IS
  'Registry-canonical UUID of the minted Verified Standing Asset iQube (Tier 2). Null until minted.';

COMMIT;
