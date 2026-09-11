-- ============================================================================
-- Standing Cartridge Activation Tab ContentQube
--
-- Registers the Standing Cartridge as a first-class metaMe activation so the
-- activation toggle has a content_qube to write per-persona editions against.
-- Pairs with:
--   - data/activation-catalog.ts   (catalog entry id='standing-cartridge')
--   - data/codex-configs.ts        (human-mobility-services tab 'hms-standing', slug 'standing')
--
-- Without this row, listActivations() finds no qube for 'standing-cartridge';
-- the card still renders (catalog gate='open' ⇒ canSelfActivate) but the
-- toggle has no qube_id to write, so activation never persists.
--
-- gating_kind='free' — open self-activation (matches catalog gate='open').
-- Mirrors the Polity Passport seed: content_qube + access_policy only; the
-- per-persona edition row is created by the activation toggle at runtime.
-- Additive and idempotent (ON CONFLICT upserts).
-- ============================================================================

INSERT INTO public.content_qubes
  (id, series, content_kind, content_type, title, description, lifecycle_state)
VALUES
  ('00000000-0000-4000-8000-000000ac100a', 'hms', 'activation_tab', 'standing-cartridge',
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
  ('00000000-0000-4000-8000-000000ac100a', 'free')
ON CONFLICT (content_qube_id) DO UPDATE SET
  gating_kind = EXCLUDED.gating_kind;
