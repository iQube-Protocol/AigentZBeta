-- ============================================================================
-- ActivationTab ContentQube subcategory — Aigent Me Phase 4.b
--
-- Folds the metaMe Activations catalog into the canonical ContentQube graph
-- so per-persona activation state is resolved by the spine
-- (claimEditionForPurchase → releaseEdition + content_qube_editions row +
-- DVN receipts) rather than a parallel persona_activations table.
--
-- Schema changes:
--   1. Extend content_qubes.content_kind CHECK to include 'activation_tab'.
--   2. Seed seven activation_tab ContentQubes (one per catalog entry).
--   3. Seed their access policies (gating_kind='free' for open and
--      auto-grant entries; gating_kind='sku_required' for gated entries —
--      the required_sku list is empty for now and will be wired to the
--      cohort/invite/payment layer when those land).
--   4. Seed a placeholder common edition per ContentQube so the existing
--      append-common claim path returns a usable edition. (Activation
--      doesn't use rarity tiers; everything is common.)
--
-- Migration is additive and idempotent — ON CONFLICT clauses preserve any
-- hand-edits in dev. persona_activations table stays in place for one
-- release as a fallback; a follow-up migration drops it.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Extend content_kind enum.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.content_qubes
  DROP CONSTRAINT IF EXISTS content_qubes_content_kind_check;

ALTER TABLE public.content_qubes
  ADD CONSTRAINT content_qubes_content_kind_check
  CHECK (content_kind IN (
    'episode', 'character', 'gn', 'lore_scroll', 'powers_sheet',
    'bundle', 'activation_tab', 'other'
  ));

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Seed ActivationTab ContentQubes.
--
-- `content_type` carries the activation id (stable identifier the catalog
-- + the UI reference). `title` + `description` mirror the catalog labels.
-- `series` is the source cartridge the surface ultimately belongs to.
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO public.content_qubes
  (id, series, content_kind, content_type, title, description, lifecycle_state)
VALUES
  ('00000000-0000-4000-8000-000000ac1001', 'metame', 'activation_tab', 'mycanvas',
    'myCanvas',
    'Personal publishing surface for works-in-progress and ideas. Private by default — invite specific people, or later republish into a community surface or social platform.',
    'canonized'),
  ('00000000-0000-4000-8000-000000ac1002', 'knyt', 'activation_tab', 'order-of-metaye',
    'Order of Metayé',
    'The participation layer of the KNYT cartridge. Surfaces the Order tab and its sub-tabs (rituals, standing, missions) directly inside metaMe.',
    'canonized'),
  ('00000000-0000-4000-8000-000000ac1003', 'metame', 'activation_tab', 'agentiq-os',
    'AgentiQ OS',
    'Build, bind, and deploy your own agents on the AgentiQ runtime — Home, Docs, Build, Bind, Deploy, Missions, and Community.',
    'canonized'),
  ('00000000-0000-4000-8000-000000ac1004', 'qriptopian', 'activation_tab', 'qriptopian',
    'Qriptopian',
    'The editorial surface — frame moments, briefs, and angles with Quill.',
    'canonized'),
  ('00000000-0000-4000-8000-000000ac1005', 'avl', 'activation_tab', 'venture-lab',
    'Venture Lab',
    'Venture-building workspace — KPIs, partners, runway moves, and alpha-activation checkpoints with Aigent Z.',
    'canonized'),
  ('00000000-0000-4000-8000-000000ac1006', 'marketa', 'activation_tab', 'marketa',
    'Marketa',
    'Campaign + partner motion — sequences, proposals, and outreach via the Marketa agent.',
    'canonized'),
  ('00000000-0000-4000-8000-000000ac1007', 'metame', 'activation_tab', 'metame-studio',
    'metaMe Studio',
    'Full-depth authoring surface — build StudioArtifacts (briefs, post-sets, image prompts, video scripts, slide outlines).',
    'canonized'),
  ('00000000-0000-4000-8000-000000ac1008', 'metame', 'activation_tab', 'aigent-z',
    'aigentZ',
    'Development Command Center — consequence-engineered building with aigentZ.',
    'canonized'),
  ('00000000-0000-4000-8000-000000ac1009', 'polity-passport-bureau', 'activation_tab', 'polity-passport',
    'Polity Passport',
    'Identity sovereignty — apply for a Polity Passport, manage ENS, delegate to agents.',
    'canonized')
ON CONFLICT (id) DO UPDATE SET
  series = EXCLUDED.series,
  content_kind = EXCLUDED.content_kind,
  content_type = EXCLUDED.content_type,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  lifecycle_state = EXCLUDED.lifecycle_state;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Seed access policies.
--
-- gating_kind='free' → any persona may claim (covers both auto-grant and
-- open self-activation; the application layer differentiates by reading
-- the activation catalog's `autoGrant` flag for now).
--
-- gating_kind='sku_required' → activation requires a SKU. required_sku is
-- intentionally empty: the application layer (or future admin grant flow)
-- will mint a per-persona claim out-of-band. This is the spine-compatible
-- shape; the actual invite/cohort/payment wiring lands incrementally.
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO public.content_qube_access_policies
  (content_qube_id, gating_kind)
VALUES
  ('00000000-0000-4000-8000-000000ac1001', 'free'),           -- mycanvas
  ('00000000-0000-4000-8000-000000ac1002', 'free'),           -- order-of-metaye
  ('00000000-0000-4000-8000-000000ac1003', 'free'),           -- agentiq-os
  ('00000000-0000-4000-8000-000000ac1004', 'free'),           -- qriptopian
  ('00000000-0000-4000-8000-000000ac1005', 'sku_required'),   -- venture-lab
  ('00000000-0000-4000-8000-000000ac1006', 'sku_required'),   -- marketa
  ('00000000-0000-4000-8000-000000ac1007', 'sku_required'),   -- metame-studio
  ('00000000-0000-4000-8000-000000ac1008', 'free'),           -- aigent-z
  ('00000000-0000-4000-8000-000000ac1009', 'free')            -- polity-passport
ON CONFLICT (content_qube_id) DO UPDATE SET
  gating_kind = EXCLUDED.gating_kind;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Helper view — activation_tab_qubes
--
-- Joins activation_tab content_qubes with their access policy + each
-- persona's edition (if any). Driven by the application service layer
-- (services/activations/spineActivations.ts).
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.activation_tab_qubes AS
  SELECT
    cq.id                AS qube_id,
    cq.content_type      AS activation_id,
    cq.series            AS source_cartridge,
    cq.title             AS label,
    cq.description       AS long_description,
    cq.created_at        AS created_at,
    cq.updated_at        AS updated_at,
    pol.gating_kind      AS gating_kind,
    pol.required_sku     AS required_sku,
    pol.price_qc         AS price_qc
  FROM public.content_qubes cq
  LEFT JOIN public.content_qube_access_policies pol ON pol.content_qube_id = cq.id
  WHERE cq.content_kind = 'activation_tab'
  ORDER BY cq.created_at;

GRANT SELECT ON public.activation_tab_qubes TO service_role;
