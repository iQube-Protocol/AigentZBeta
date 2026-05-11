-- ============================================================================
-- activity_receipts — Aigent Me activity ledger.
-- Phase 6 (metaMe Personal Assistant Alpha).
-- Per PRD v0.2 §11 (ActivityReceipt data object) and §10 FR12.
--
-- Records every meaningful Aigent Me action: what happened, which agents/
-- tools/iQubes were invoked, what context was shared, what artifacts were
-- created, whether approval was granted.
--
-- Receipts may be locally-anchored (alpha) and DVN-pending (Phase 6.b).
-- The receipt_status column drives that lifecycle.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.activity_receipts (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id          text NOT NULL,
  session_id          uuid REFERENCES public.assistant_sessions(id) ON DELETE SET NULL,
  intent_id           uuid REFERENCES public.nbe_plans(id)         ON DELETE SET NULL,

  -- ── What happened ───────────────────────────────────────────────────
  active_cartridge    text NOT NULL DEFAULT 'metame',
  action_type         text NOT NULL
    CHECK (action_type IN (
      'intent_queued','specialist_consulted','artifact_created','artifact_sent',
      'approval_granted','approval_rejected','experience_model_updated','session_started','session_completed'
    )),
  summary             text NOT NULL,

  -- ── What was invoked ─────────────────────────────────────────────────
  agents_invoked      text[] NOT NULL DEFAULT '{}',
  tools_used          text[] NOT NULL DEFAULT '{}',
  iqubes_used         text[] NOT NULL DEFAULT '{}',
  context_shared      text[] NOT NULL DEFAULT '{}',
  artifacts_created   text[] NOT NULL DEFAULT '{}',
  approvals_granted   text[] NOT NULL DEFAULT '{}',

  -- ── Anchoring ────────────────────────────────────────────────────────
  policy_envelope_id  text,
  receipt_status      text NOT NULL DEFAULT 'local'
    CHECK (receipt_status IN ('local','dvn_pending','dvn_recorded','dvn_failed')),
  dvn_receipt_id      text,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_receipts_persona     ON public.activity_receipts(persona_id);
CREATE INDEX IF NOT EXISTS idx_activity_receipts_session     ON public.activity_receipts(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_receipts_intent      ON public.activity_receipts(intent_id);
CREATE INDEX IF NOT EXISTS idx_activity_receipts_cartridge   ON public.activity_receipts(active_cartridge);
CREATE INDEX IF NOT EXISTS idx_activity_receipts_action_type ON public.activity_receipts(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_receipts_created_at  ON public.activity_receipts(created_at DESC);

ALTER TABLE public.activity_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_receipts_read_service"  ON public.activity_receipts;
DROP POLICY IF EXISTS "activity_receipts_write_service" ON public.activity_receipts;
CREATE POLICY "activity_receipts_read_service"  ON public.activity_receipts FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "activity_receipts_write_service" ON public.activity_receipts FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE  public.activity_receipts IS 'Aigent Me — per-persona activity ledger. PRD §11 ActivityReceipt.';
COMMENT ON COLUMN public.activity_receipts.persona_id IS 'T0 — server-internal only.';
COMMENT ON COLUMN public.activity_receipts.receipt_status IS 'local | dvn_pending | dvn_recorded | dvn_failed. Phase 6.b wires DVN anchoring.';
