-- ============================================================================
-- Seed the MoneyPenny activation_tab ContentQube
--
-- The `moneypenny` activation was added to ACTIVATION_CATALOG
-- (data/activation-catalog.ts) as part of the Financial Services / AEE
-- reference-surface closeout (2026-08-24) — MoneyPenny's metaMe Catalogue
-- card, mirroring its real Orchestration console into metaMe. Without a
-- backing content_qubes row of content_kind='activation_tab' and
-- content_type='moneypenny', the activation_tab_qubes view never surfaces
-- it, so:
--   - readActivationQubes() returns no row for 'moneypenny'
--   - activate('moneypenny') fails with 'content_qube-missing — migration not applied?'
--   - the MoneyPenny card in the Activations tab can never persist to 'active'
--   - the metame-codex 'moneypenny' tabGroup (activationId: 'moneypenny')
--     can never become visible
--
-- This seeds the missing qube + its access policy (gate 'open' in the
-- catalog → gating_kind='free', matching mycanvas/agentiq-os/standing-
-- cartridge). Additive and idempotent — see 20260524000000, 20260619000000,
-- 20260728000000 for the identical precedent this mirrors.
-- ============================================================================

INSERT INTO public.content_qubes
  (id, series, content_kind, content_type, title, description, lifecycle_state)
VALUES
  ('00000000-0000-4000-8000-000000ac100f', 'metame', 'activation_tab', 'moneypenny',
    'MoneyPenny',
    'Aigent MoneyPenny — the Constitutional Financial Services Agent. Advisor, Architect, and Runtime orchestration.',
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
  ('00000000-0000-4000-8000-000000ac100f', 'free')   -- moneypenny (open self-activation)
ON CONFLICT (content_qube_id) DO UPDATE SET
  gating_kind = EXCLUDED.gating_kind;
