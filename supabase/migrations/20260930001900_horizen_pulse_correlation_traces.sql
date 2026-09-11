-- 20260930001900_horizen_pulse_correlation_traces.sql
--
-- "Close Nakamoto Pulse Enrollment — Final Correlated Trace" (operator
-- directive, 2026-08-06). Constraint on that directive, verbatim: "Do not
-- change agreement identifiers, ratification, Standing, Agent Bench, wallet
-- selection, signature generation, message selection or health routing. The
-- sole objective is to determine why a fresh, locally valid
-- enable_pulse_monitoring submission does not become an enrolled state."
--
-- ONE ROW PER FRESH ENROLLMENT ATTEMPT (attempt_id, not the deterministic
-- per-agent authorizationId — a re-run of the trace for the same agent is a
-- NEW row, never reusing an earlier attempt's id, so no earlier attempt's
-- evidence is ever overwritten by a later one). The row IS updated, though —
-- INSERTed once by startPulseEnrollmentTrace (build->sign->submit->t+0
-- read), then UPDATEd in place by continuePulseEnrollmentTrace as each
-- +5/+15/+30s reread appends to status_reads (Al's review, 2026-08-06: one
-- HTTP request must never hold open through the full 30s schedule — see
-- pulseEnrollmentTrace.ts's own header). Never itself a decision input for
-- the agreement/Standing/Agent Bench/wallet-selection/signing/health
-- pipelines — see services/horizen/pulseEnrollmentTrace.ts, the only writer.
--
-- NEVER THE RAW SIGNATURE. Mirrors partner_authorization_requests.signature_ref
-- (20260930000500) — a sha256 commitment only. The exact signed bytes and
-- exact signature already have an established, narrower-audience home
-- (console.error's [HORIZEN ESCALATION] line in authorizationClient.ts,
-- server-log-only) when a human escalation genuinely needs them; this table
-- does not duplicate that exposure.

BEGIN;

CREATE TABLE IF NOT EXISTS public.horizen_pulse_correlation_traces (
  attempt_id                 TEXT PRIMARY KEY,
  authorization_id           TEXT,
  agent_slug                 TEXT NOT NULL,
  agent_id                   TEXT,
  chain                      TEXT,
  wallet_address              TEXT,
  issued_at                  TEXT,

  selected_message_source    TEXT,
  selected_message_length    INTEGER,
  selected_message_hash      TEXT,
  -- sha256 commitment of the produced signature, never the signature itself
  -- — see this file's own header.
  signature_ref               TEXT,

  submit_arguments            JSONB,
  raw_submit_response         JSONB,
  normalized_submission       JSONB,

  status_reread_arguments     JSONB,
  -- Array of {atSeconds, timestamp, ok, refusalCode, rawStatusResult,
  -- enrollmentState} — one entry per reread (t=0, +5s, +15s, +30s).
  status_reads                 JSONB NOT NULL DEFAULT '[]'::jsonb,

  reached_partner_submission   BOOLEAN NOT NULL,
  local_contract_error         TEXT,

  classification               TEXT NOT NULL
    CHECK (classification IN (
      'ENROLLED', 'PARTNER_REJECTED', 'PARTNER_ACCEPTED_NOT_PERSISTED',
      'PARTNER_RESPONSE_UNRESOLVED', 'LOCAL_CONTRACT_ERROR'
    )),
  classification_reason        TEXT NOT NULL,

  -- True once every scheduled reread (t+0/5/15/30s) has run, or the
  -- classification is conclusive without further reads (ENROLLED /
  -- PARTNER_REJECTED / LOCAL_CONTRACT_ERROR). The UI stops calling
  -- continuePulseEnrollmentTrace once this is true.
  complete                     BOOLEAN NOT NULL DEFAULT false,

  -- {step: isoTimestamp} for every stage of the sequence.
  timestamps                   JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_horizen_pulse_correlation_traces_agent
  ON public.horizen_pulse_correlation_traces (agent_slug, created_at DESC);

COMMENT ON TABLE public.horizen_pulse_correlation_traces IS
  'Read-only correlation record for one fresh Horizen Pulse enrollment attempt (build->sign->submit->repeated status reread), captured for partner-escalation diagnosis. Never itself a decision input for agreements/Standing/Agent Bench/signing/health routing.';
COMMENT ON COLUMN public.horizen_pulse_correlation_traces.signature_ref IS
  'sha256 commitment of the produced signature, never the signature itself — mirrors partner_authorization_requests.signature_ref.';

-- RLS — service-role only, same posture as partner_authorization_requests.
ALTER TABLE public.horizen_pulse_correlation_traces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS horizen_pulse_correlation_traces_service_only ON public.horizen_pulse_correlation_traces;
CREATE POLICY horizen_pulse_correlation_traces_service_only ON public.horizen_pulse_correlation_traces
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
