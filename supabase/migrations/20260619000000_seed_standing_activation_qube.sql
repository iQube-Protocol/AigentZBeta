-- ============================================================================
-- Seed the Standing Cartridge activation_tab ContentQube
--
-- The `standing-cartridge` activation was added to ACTIVATION_CATALOG
-- (data/activation-catalog.ts) AFTER the original activation seed migration
-- (20260524000000_activation_tab_content_qubes.sql), which only seeded
-- entries through `polity-passport` (ac1009). Without a backing
-- content_qubes row of content_kind='activation_tab' and content_type=
-- 'standing-cartridge', the activation_tab_qubes view never surfaces it, so:
--   - readActivationQubes() returns no row for 'standing-cartridge'
--   - activate('standing-cartridge') fails with 'content_qube-missing'
--   - listActivations() can never resolve an edition → status stays null
--   - the Standing tab can never become active → never renders in runtime
--
-- This migration seeds the missing qube + its access policy (gate 'open' in
-- the catalog → gating_kind='free' so any persona can self-activate via the
-- Activations catalog card). Additive and idempotent.
-- ============================================================================

INSERT INTO public.content_qubes
  (id, series, content_kind, content_type, title, description, lifecycle_state)
VALUES
  ('00000000-0000-4000-8000-000000ac100a', 'standing-cartridge', 'activation_tab', 'standing-cartridge',
    'Standing Cartridge',
    'Your personal capability & standing ledger — evidence-derived, principal-verified, anchored to your Polity Passport.',
    'canonized')
ON CONFLICT (id) DO UPDATE SET
  series = EXCLUDED.series,
  content_kind = EXCLUDED.content_kind,
  content_type = EXCLUDED.content_type,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  lifecycle_state = EXCLUDED.lifecycle_state;

INSERT INTO public.content_qube_access_policies
  (content_qube_id, gating_kind)
VALUES
  ('00000000-0000-4000-8000-000000ac100a', 'free')   -- standing-cartridge (open self-activation)
ON CONFLICT (content_qube_id) DO UPDATE SET
  gating_kind = EXCLUDED.gating_kind;
