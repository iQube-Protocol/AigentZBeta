-- ============================================================================
-- persona_activations — per-persona runtime surface activations.
--
-- Phase: Aigent Me Phase 4 — Activations.
--
-- An "activation" is the user-controlled switch that surfaces a cartridge's
-- active surface (community / participation tabs) inside the metaMe
-- cartridge runtime. The catalog of activations lives in code at
-- data/activation-catalog.ts; this table records each persona's status.
--
-- gate types (catalog-side, NOT enforced here):
--   - 'open'   — user can self-activate.
--   - 'gated'  — admin grant, invite, cohort, or payment required.
--                Admins are implicitly eligible to self-activate gated rows.
--
-- status:
--   - 'active'   — surface is visible in the user's runtime.
--   - 'pending'  — user requested access to a gated activation; awaiting admin.
--   - 'revoked'  — explicitly turned off. Row kept for history.
--
-- granted_via:
--   - 'self'     — open self-activation
--   - 'invite'   — invited by another persona (stubbed)
--   - 'cohort'   — assigned by cohort (cohort_id stub for now)
--   - 'payment'  — gated by payment / token (stubbed)
--   - 'admin'    — admin-grant route
--   - 'auto'     — auto-granted on first read (order-of-metaye, mycanvas)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.persona_activations (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id         text NOT NULL,
  activation_id      text NOT NULL,
  status             text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','pending','revoked')),
  granted_via        text NOT NULL DEFAULT 'self'
    CHECK (granted_via IN ('self','invite','cohort','payment','admin','auto')),
  cohort_id          text,
  inviter_persona_id text,
  granted_at         timestamptz NOT NULL DEFAULT now(),
  revoked_at         timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (persona_id, activation_id)
);

CREATE INDEX IF NOT EXISTS idx_persona_activations_persona ON public.persona_activations(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_activations_status  ON public.persona_activations(status);

ALTER TABLE public.persona_activations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "persona_activations_read_service"  ON public.persona_activations;
DROP POLICY IF EXISTS "persona_activations_write_service" ON public.persona_activations;
CREATE POLICY "persona_activations_read_service"  ON public.persona_activations FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "persona_activations_write_service" ON public.persona_activations FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.persona_activations IS
  'Per-persona activations of metaMe runtime surfaces. Service-role write only — all access via /api/assistant/activations/*.';
COMMENT ON COLUMN public.persona_activations.persona_id IS 'T0 — server-internal only.';
