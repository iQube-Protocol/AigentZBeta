-- ============================================================================
-- Polity Passport Activation Tab ContentQube
--
-- Registers the Polity Passport Bureau as a first-class metaMe activation.
-- Pairs with:
--   - data/activation-catalog.ts        (catalog entry id='polity-passport')
--   - data/codex-configs.ts             (metaMe tabGroup 'passport', activationId 'polity-passport')
--
-- gating_kind='free' — open self-activation (identity is a right, not a privilege).
-- Additive and idempotent (ON CONFLICT upserts).
-- ============================================================================

INSERT INTO public.content_qubes
  (id, series, content_kind, content_type, title, description, lifecycle_state)
VALUES
  ('00000000-0000-4000-8000-000000ac1009', 'metame', 'activation_tab', 'polity-passport',
    'Polity Passport',
    'Identity sovereignty — apply for a Polity Passport, manage ENS, delegate to agents. Irrevocable proof of personhood with privacy-preserving self-custody identity.',
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
  ('00000000-0000-4000-8000-000000ac1009', 'free')
ON CONFLICT (content_qube_id) DO UPDATE SET
  gating_kind = EXCLUDED.gating_kind;
