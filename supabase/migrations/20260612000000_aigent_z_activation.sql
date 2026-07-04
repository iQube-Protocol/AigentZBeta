-- ============================================================================
-- aigentZ Activation Tab ContentQube — Operation Chrysalis Phase 1
--
-- Registers the aigentZ Development Command Center as an activation in the
-- metaMe Activations catalog spine. Pairs with:
--   - data/activation-catalog.ts        (catalog entry id='aigent-z')
--   - data/codex-configs.ts             (metaMe tabGroup 'agentz', activationId 'aigent-z')
--
-- gating_kind='free' — open self-activation, same as agentiq-os.
-- Additive and idempotent (ON CONFLICT upserts).
-- ============================================================================

INSERT INTO public.content_qubes
  (id, series, content_kind, content_type, title, description, lifecycle_state)
VALUES
  ('00000000-0000-4000-8000-000000ac1008', 'metame', 'activation_tab', 'aigent-z',
    'aigentZ',
    'Development Command Center — consequence-engineered building with aigentZ. Distill intents, assemble context packs, analyze capability gaps, model consequences, and validate implementations through the full dev loop.',
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
  ('00000000-0000-4000-8000-000000ac1008', 'free')             -- aigent-z
ON CONFLICT (content_qube_id) DO UPDATE SET
  gating_kind = EXCLUDED.gating_kind;
