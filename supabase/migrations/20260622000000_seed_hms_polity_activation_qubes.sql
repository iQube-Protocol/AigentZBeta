-- ============================================================================
-- Seed the HMS + Polity Core activation_tab ContentQubes
--
-- Same fix as 20260619000000 (Standing): the 'human-mobility-services' and
-- 'polity-core' activations were added to ACTIVATION_CATALOG after the original
-- seed migration, so they have no backing content_qubes row of
-- content_kind='activation_tab'. Without it:
--   - readActivationQubes() returns no row for the activation
--   - activate(...) fails with 'content_qube-missing'
--   - the optimistic toggle reverts → the tab "flickers on but won't stay on"
--
-- This seeds the missing qubes + access policies (HMS = premium/subscription;
-- Polity Core = free/open). Additive + idempotent. UUIDs continue the ac10xx
-- series (ac100a = standing-cartridge).
-- ============================================================================

INSERT INTO public.content_qubes
  (id, series, content_kind, content_type, title, description, lifecycle_state)
VALUES
  ('00000000-0000-4000-8000-000000ac100b', 'human-mobility-services', 'activation_tab', 'human-mobility-services',
    'Human Mobility Services',
    'Business + emergency mobility cases — relocation, housing, education, and family support, powered by your Standing and Polity Passport.',
    'canonized'),
  ('00000000-0000-4000-8000-000000ac100c', 'polity-core', 'activation_tab', 'polity-core',
    'Polity Core',
    'The constitutional repository — Constitution, charters, frameworks, and amendment records.',
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
  ('00000000-0000-4000-8000-000000ac100b', 'subscription'),  -- HMS (premium; gate enforced in code)
  ('00000000-0000-4000-8000-000000ac100c', 'free')           -- Polity Core (open self-activation)
ON CONFLICT (content_qube_id) DO UPDATE SET
  gating_kind = EXCLUDED.gating_kind;
