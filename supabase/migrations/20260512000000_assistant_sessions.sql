-- ============================================================================
-- assistant_sessions — Aigent Me Phase 1 (metaMe Personal Assistant Alpha)
--
-- Per-session record for Aigent Me. One row per user-initiated assistant
-- interaction; lives alongside (not replacing) journey_states + nbe_plans.
--
-- See:
--   PRD §11 (Data objects → AssistantSession)
--   codexes/packs/agentiq/updates/2026-05-11_metame-personal-assistant-alpha-decisions.md
--
-- Persona reference is stored as text (mirrors journey_states / nbe_plans
-- convention) — personas.id is uuid but those tables already use text for
-- cross-tenant flexibility. The privacy contract (T0/T1/T2) is enforced at
-- the route layer; this is a server-internal table.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assistant_sessions (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id            text NOT NULL,
  active_cartridge      text,                                    -- e.g. 'metame', 'knyt', 'qriptopian', 'marketa', 'avl'
  experience_model_id   uuid REFERENCES public.experience_models(id) ON DELETE SET NULL,
  nbe_plan_id           uuid REFERENCES public.nbe_plans(id)        ON DELETE SET NULL,
  mode                  text NOT NULL DEFAULT 'brief'
    CHECK (mode IN ('brief','create','coordinate','specialist_request','venture_review','experience_setup')),
  status                text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','cancelled','failed')),
  policy_envelope_id    text,                                    -- opaque envelope reference; resolved via evaluateAccess
  context_summary       text,                                    -- short server-side summary; never browser-bound
  started_at            timestamptz DEFAULT now(),
  ended_at              timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_sessions_persona    ON public.assistant_sessions(persona_id);
CREATE INDEX IF NOT EXISTS idx_assistant_sessions_status     ON public.assistant_sessions(status);
CREATE INDEX IF NOT EXISTS idx_assistant_sessions_started_at ON public.assistant_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_sessions_cartridge  ON public.assistant_sessions(active_cartridge);

ALTER TABLE public.assistant_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assistant_sessions_read_service"  ON public.assistant_sessions FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "assistant_sessions_write_service" ON public.assistant_sessions FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE  public.assistant_sessions IS 'Aigent Me session ledger. One row per user-initiated assistant interaction. Linked to ExperienceModel + NBE plan when present.';
COMMENT ON COLUMN public.assistant_sessions.policy_envelope_id IS 'Opaque reference resolved by evaluateAccess() — never browser-bound.';
COMMENT ON COLUMN public.assistant_sessions.context_summary IS 'Server-internal summary string; T0 — never serialised to JSON responses.';
