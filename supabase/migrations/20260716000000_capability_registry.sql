-- Capability Registry — Constitutional Acceptance (CFS-032 §4, ratified
-- 2026-07-16). Registry Registration IS Constitutional Acceptance: the
-- admission of a SHIPPED capability into the registry as a governed
-- constitutional asset is the acceptance event. This table is the durable
-- ledger of accepted capabilities — the write-side counterpart to the
-- capability_evidence read path, and what makes a shipped capability
-- discoverable by the NEXT capability request's Gap Analysis.
--
-- T2 discipline: rows carry the capability's constitutional object (identity,
-- provenance receipt ids, governing invariants, reuse disposition) — no
-- persona identifiers, no subject data. Ownership inside the object payload
-- is a one-way steward commitment by construction (canonicalAssets pattern).

CREATE TABLE IF NOT EXISTS public.capability_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable capability slug (the pack slug for pack-born capabilities) —
  -- idempotent registration key.
  capability_id text NOT NULL UNIQUE,
  display_label text NOT NULL,
  -- The full ConstitutionalObject (types/constitutionalObject.ts, kind
  -- 'capability') — T2-safe by construction.
  object jsonb NOT NULL,
  -- Standing facet mirrored out of the object for cheap querying. Standing
  -- accrues ONLY via operational validation (CFS-032 §5): registration is the
  -- eligibility gate, operational evidence is the accrual trigger.
  standing numeric NOT NULL DEFAULT 0.3,
  standing_band text NOT NULL DEFAULT 'experimental',
  lifecycle_state text NOT NULL DEFAULT 'published',
  operational_validations integer NOT NULL DEFAULT 0,
  registered_receipt_id uuid,
  last_operational_receipt_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capability_registry_created
  ON public.capability_registry (created_at DESC);

ALTER TABLE public.capability_registry ENABLE ROW LEVEL SECURITY;

-- Server-side only (service role) — the registry is read/written exclusively
-- through the admin-gated route + the gap-analysis ground-data seam.
DROP POLICY IF EXISTS capability_registry_service_all ON public.capability_registry;
CREATE POLICY capability_registry_service_all ON public.capability_registry
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ── activity_receipts CHECK rebuild: + capability_registered,
--    capability_operationally_validated (CFS-032 §4/§5) ────────────────────
-- Same complete union as 20260715000000, extended with the two new types.
-- (The CHECK must be rebuilt wholesale — see the 2026-07-15 constraint-drift
-- incident: types added without a rebuild silently fail to persist.)

ALTER TABLE activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;

ALTER TABLE activity_receipts
  ADD CONSTRAINT activity_receipts_action_type_check
  CHECK (action_type IN (
    'intent_queued','specialist_consulted','artifact_created','artifact_published','artifact_sent',
    'approval_granted','approval_rejected','experience_model_updated','session_started','session_completed',
    'passport_application_submitted','passport_issued','passport_status_changed',
    'passport_revoked','passport_privilege_changed','passport_infraction_recorded',
    'governance_decision_ratified','governance_decision_amended',
    'governance_authority_exercised','governance_escalation_triggered',
    'experience_task_completed',
    'agent_revocation_state_changed',
    'agent_delegated','agent_delegation_revoked',
    'operator_action_logged','standing_document_added',
    'plan_purchased','plan_renewed',
    'invariant_discovered','invariant_validated','invariant_canonized','invariant_superseded',
    'invariant_qube_published',
    'knowledge_curated','consequence_forecast_recorded','knowledge_evolved',
    'experience_render_validated',
    'implementation_pack_generated',
    'implementation_dispatched',
    'deployment_proposed',
    'constitutional_validation_recorded',
    'remediation_recorded',
    'deployment_authorized',
    'validation_override_granted',
    'research_lifecycle_transition',
    'experiment_result_published',
    'venture_blueprint_handoff',
    'standing_accrued',
    -- Constitutional Acceptance + capability Standing (CFS-032, 2026-07-16)
    'capability_registered',
    'capability_operationally_validated'
  ));
