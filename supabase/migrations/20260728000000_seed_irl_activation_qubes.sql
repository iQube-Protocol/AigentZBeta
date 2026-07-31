-- ============================================================================
-- Seed the IRL OS + metaMe IRL activation_tab ContentQubes
--
-- The `researcher` (label "IRL OS") and `metame-irl` activations were added to
-- ACTIVATION_CATALOG (data/activation-catalog.ts) after the earlier activation
-- seed migrations (20260524000000 through ac100c). Without a backing
-- content_qubes row of content_kind='activation_tab' whose content_type equals
-- the activation id, the activation_tab_qubes view never surfaces them, so:
--   - readActivationQubes() returns no row for 'researcher' / 'metame-irl'
--   - activate(...) fails with 'content_qube-missing — migration not applied?'
--   - the Activations card can never persist to 'active'
--
-- This seeds the two missing qubes + their access policies. gating_kind is
-- 'free' at the qube level (matching aigent-z / agentiq-os, which are likewise
-- catalog-`gated` but qube-'free'): the real entitlement gate is enforced in
-- code by activate() → planAllowsSelfActivate / ACTIVATION_PLAN_GATE, and the
-- adminOnly flag on metaMe IRL is enforced there too. Additive and idempotent.
-- ============================================================================

INSERT INTO public.content_qubes
  (id, series, content_kind, content_type, title, description, lifecycle_state)
VALUES
  ('00000000-0000-4000-8000-000000ac100d', 'metame', 'activation_tab', 'researcher',
    'IRL OS',
    'The Invariant Research Lab OS — read the lab free; unlock the Research Agent to run experiments.',
    'canonized'),
  ('00000000-0000-4000-8000-000000ac100e', 'metame', 'activation_tab', 'metame-irl',
    'metaMe IRL',
    'The internal Invariant Research Laboratory — operator instruments, live experiments, and stewardship.',
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
  ('00000000-0000-4000-8000-000000ac100d', 'free'),   -- IRL OS (plan gate in code)
  ('00000000-0000-4000-8000-000000ac100e', 'free')    -- metaMe IRL (adminOnly gate in code)
ON CONFLICT (content_qube_id) DO UPDATE SET
  gating_kind = EXCLUDED.gating_kind;
