-- 20260930140000_ctp_transition_evidence.sql
--
-- CTP-001 — Constitutional Transition Primitive evidence (2026-08-31, "CTP
-- foundation", Phase 1 of AEE-XP-001A / CTP-001A). ONE table, ONE shape,
-- discriminated by `outcome` ('SUCCESS' | 'REFUSED') — a successful row is
-- the canonical transition receipt (delivery amendment §2.3); a refused row
-- is refusal evidence written WITHOUT ever mutating the protected state a
-- primitive guards (charter §11, "failed attempts are also evidence").
--
-- REUSE, NOT DUPLICATION (inv.engineering.036/037): this is a NEW table
-- rather than an extension of `activity_receipts` because the shape this
-- charter requires (subject/principal/actor/delegate separately, authority
-- and authorization resolutions, prior/projected/resulting state, a
-- refusal-with-no-mutation variant) is structurally different from a
-- generic activity receipt's free-text summary — forcing it into
-- `activity_receipts` would either lose the structure (back to a prose
-- summary a consumer has to re-parse) or require extending that table's own
-- CHECK-constrained `action_type` for every future primitive, coupling an
-- unrelated general-purpose receipt table to the CTP domain. The domain
-- service's own receipt (e.g. `exchange_operator_assisted_artifact_confirmed`
-- via createActivityReceipt) is UNCHANGED and continues to be written by the
-- bound implementation itself — this table is the CONSTITUTIONAL evidence
-- layer, additive to that, never a replacement of it.
--
-- T0/T2 DISCIPLINE: persona ids are stored server-side only (same exposure
-- class as reciprocal_exchanges/exchange_artifacts — service-role RLS,
-- never a client-side read, no client policies at all).
--
-- Idempotent (CREATE TABLE IF NOT EXISTS) per this repo's migration-safety
-- convention.

CREATE TABLE IF NOT EXISTS public.ctp_transition_evidence (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  primitive_id              text NOT NULL,
  -- Null ONLY for a refusal on an unknown primitive (no version to report).
  primitive_version         text,
  implementation_ref        text,
  implementation_hash       text,

  subject_persona_id        uuid,
  principal_persona_id      uuid,
  actor_persona_id          uuid,
  actor_kind                text CHECK (actor_kind IN ('principal', 'delegate')),
  delegate_grant_ref        text,

  channel                   text NOT NULL CHECK (channel IN ('web', 'mcp', 'agent', 'api', 'operator')),
  channel_session_ref       text,
  -- The caller as originally asserted — always present, even on the
  -- earliest possible refusal (an unknown primitive).
  caller_persona_id         uuid NOT NULL,

  authority_resolution      jsonb,
  authorization_resolution  jsonb,
  prior_state               jsonb,
  projected_consequence     jsonb,
  resulting_state           jsonb,
  realized_consequence      jsonb,

  outcome                   text NOT NULL CHECK (outcome IN ('SUCCESS', 'REFUSED')),
  reason_code               text,
  reason                    text,

  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ctp_transition_evidence_primitive_idx
  ON public.ctp_transition_evidence (primitive_id, primitive_version);
CREATE INDEX IF NOT EXISTS ctp_transition_evidence_subject_idx
  ON public.ctp_transition_evidence (subject_persona_id) WHERE subject_persona_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ctp_transition_evidence_caller_idx
  ON public.ctp_transition_evidence (caller_persona_id);
CREATE INDEX IF NOT EXISTS ctp_transition_evidence_created_at_idx
  ON public.ctp_transition_evidence (created_at DESC);

ALTER TABLE public.ctp_transition_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ctp_transition_evidence_service_all ON public.ctp_transition_evidence;
CREATE POLICY ctp_transition_evidence_service_all ON public.ctp_transition_evidence
  FOR ALL TO service_role USING (true) WITH CHECK (true);
