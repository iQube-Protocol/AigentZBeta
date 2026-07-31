-- 20260616300000 — Passport recommendations (Phase 4 MVP)
--
-- Stewardship-gated recommendations from citizens (and Marketa) to the Bureau
-- review queue. Recommendation != admission — the Bureau remains sovereign.
-- Recommendation rights are GATED by Stewardship Standing (Phase 3); this
-- table is the audit ledger, the gate lives in the POST endpoint.
--
-- Sponsorship grants admission. Standing must be earned. Successful
-- sponsorship expands stewardship. Stewardship expands recommendation rights.

BEGIN;

CREATE TABLE IF NOT EXISTS public.passport_recommendations (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   text NOT NULL DEFAULT 'default',

  -- Target: either an existing application or a still-unsubmitted agent card.
  -- Exactly one populated.
  candidate_application_id    uuid REFERENCES public.polity_passport_applications(id) ON DELETE CASCADE,
  candidate_agent_card_url    text,

  -- Recommender (text persona id from the spine, T0 — never serialised on T1).
  recommender_persona_id      text NOT NULL,
  recommender_kind            text NOT NULL
    CHECK (recommender_kind IN ('citizen_steward', 'marketa', 'system')),

  -- Optional payload — Marketa assessment scores, reviewer notes, etc.
  reason                      text,
  assessment_payload          jsonb,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  withdrawn_at                timestamptz,
  withdrawal_reason           text,

  -- Exactly one target.
  CONSTRAINT recommendation_target_one CHECK (
    (candidate_application_id IS NOT NULL AND candidate_agent_card_url IS NULL)
    OR (candidate_application_id IS NULL AND candidate_agent_card_url IS NOT NULL)
  )
);

COMMENT ON TABLE public.passport_recommendations IS
  'Stewardship-gated recommendations to the Bureau review queue. Recommendation != admission — the Bureau remains sovereign.';

CREATE INDEX IF NOT EXISTS idx_pp_recommendations_application
  ON public.passport_recommendations (candidate_application_id)
  WHERE candidate_application_id IS NOT NULL AND withdrawn_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pp_recommendations_card
  ON public.passport_recommendations (candidate_agent_card_url)
  WHERE candidate_agent_card_url IS NOT NULL AND withdrawn_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pp_recommendations_recommender
  ON public.passport_recommendations (recommender_persona_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.passport_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pp_recommendations_service_role" ON public.passport_recommendations;
CREATE POLICY "pp_recommendations_service_role" ON public.passport_recommendations
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "pp_recommendations_select_own" ON public.passport_recommendations;
CREATE POLICY "pp_recommendations_select_own" ON public.passport_recommendations
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.personas p
      WHERE p.id::text = passport_recommendations.recommender_persona_id
        AND p.auth_profile_id = auth.uid()
    )
  );

COMMIT;
