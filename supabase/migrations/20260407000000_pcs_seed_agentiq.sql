-- ============================================================================
-- Phase D — PCS Seed: AgentiQ Participant-to-Upstream Contributor Ladder
-- WS5 / Gate 5
--
-- Seeds the canonical AgentiQ PCS progression model into:
--   experience_strategies  — AgentiQ PCS strategy
--   experience_models      — PCS journey model with 6 stage names
--   experience_matrices    — one row per PCS stage with depth_ladder
--
-- PCS rendered form for AgentiQ alpha:
--   participant → community → correspondent → operator → creator → upstream_contributor
--
-- Depth ladder per stage (cumulative — each stage adds one depth level):
--   participant:           [pill]
--   community:             [pill, capsule]
--   correspondent:         [pill, capsule, mini_runtime]
--   operator:              [pill, capsule, mini_runtime, codex]
--   creator:               [pill, capsule, mini_runtime, codex]
--   upstream_contributor:  [pill, capsule, mini_runtime, codex]
--
-- Idempotent: skips inserts if strategy already exists (by name).
-- ============================================================================

DO $$
DECLARE
  v_strategy_id uuid;
  v_model_id    uuid;
BEGIN

  -- ── Skip if already seeded ─────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM public.experience_strategies
    WHERE name = 'AgentiQ PCS Strategy'
  ) THEN
    RAISE NOTICE 'AgentiQ PCS seed already present — skipping.';
    RETURN;
  END IF;

  -- ── experience_strategies ──────────────────────────────────────────────
  INSERT INTO public.experience_strategies (
    name,
    description,
    target_segments,
    active
  ) VALUES (
    'AgentiQ PCS Strategy',
    'Participant-to-Upstream-Contributor progression ladder for the AgentiQ alpha program. '
    'Each stage maps to increasing depth access and contribution rights. '
    'Unlock criteria: L0 first_participation_signal → L1 repeat_participation+3signals → '
    'L2 curation_or_remix+community_action → L3 contribution_submission_accepted → '
    'L4 repeated_accepted_contributions → L5 contributor_pathway_flag+aigent_c_handoff.',
    ARRAY['all'],
    true
  )
  RETURNING id INTO v_strategy_id;

  -- ── experience_models ──────────────────────────────────────────────────
  INSERT INTO public.experience_models (
    strategy_id,
    name,
    description,
    stages
  ) VALUES (
    v_strategy_id,
    'AgentiQ PCS Journey Model',
    'Six-stage PCS ladder: Participant (L0) → Community (L1) → Correspondent (L2) → '
    'Operator (L3) → Creator (L4) → Upstream Contributor (L5). '
    'Each stage unlocks deeper experience depths and higher trust-band contribution ceilings.',
    ARRAY[
      'participant',
      'community',
      'correspondent',
      'operator',
      'creator',
      'upstream_contributor'
    ]
  )
  RETURNING id INTO v_model_id;

  -- ── experience_matrices (one row per stage) ────────────────────────────
  -- depth_ladder = ordered array of experience depths available at this stage
  INSERT INTO public.experience_matrices (model_id, stage, depth_ladder) VALUES
    (v_model_id, 'participant',          ARRAY['pill']),
    (v_model_id, 'community',            ARRAY['pill', 'capsule']),
    (v_model_id, 'correspondent',        ARRAY['pill', 'capsule', 'mini_runtime']),
    (v_model_id, 'operator',             ARRAY['pill', 'capsule', 'mini_runtime', 'codex']),
    (v_model_id, 'creator',              ARRAY['pill', 'capsule', 'mini_runtime', 'codex']),
    (v_model_id, 'upstream_contributor', ARRAY['pill', 'capsule', 'mini_runtime', 'codex']);

  RAISE NOTICE 'AgentiQ PCS seed inserted: strategy=%, model=%', v_strategy_id, v_model_id;

END $$;
