-- Constitutional Agreement (CRP-003a Increment 1 / N1; CFI-002, WS2, lifecycle
-- step 3). The single load-bearing greenfield of the Constitutional Financial
-- Services Programme: an explicit, attributable, machine-readable record binding
-- {requesting operator · requested capability · selected agent · delegated
-- authority · constraints · verification requirements · settlement terms} BEFORE
-- delegated execution. Delegated execution refuses (HTTP 409) without an
-- authorized agreement — the x409 gate idiom, native to this codebase's
-- capability-registry and merge gates.
--
-- Extend-don't-duplicate: mirrors capability_registry (20260716000000) — same
-- durable-ledger + service-role-RLS + object-jsonb shape. The row carries the
-- agreement's ConstitutionalObject (kind 'agreement', T2-safe by construction).
--
-- T2 discipline: NO persona identifiers. The requesting operator is stored only
-- as a one-way owner_commitment (sha256, server-computed); the object's
-- ownership.ownerCommitment carries the same. The acceptance record is
-- provider-produced (local stub or x409/Consenti) and carries commitments +
-- an optional external anchor ref, never a raw acceptor id.

CREATE TABLE IF NOT EXISTS public.constitutional_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable agreement slug — idempotent formation key.
  agreement_id text NOT NULL UNIQUE,
  display_label text NOT NULL,
  -- The full ConstitutionalObject (types/constitutionalObject.ts, kind
  -- 'agreement') — T2-safe by construction.
  object jsonb NOT NULL,
  -- proposed → accepted → authorized → executed → settled → reconstitutable.
  -- N1 implements proposed → accepted → authorized (Domain 3 read-only; no
  -- execution / settlement path yet).
  status text NOT NULL DEFAULT 'proposed',
  -- Facets mirrored out of the object for cheap querying + the 409 gate lookup.
  capability_ref text,
  selected_agent_ref text,
  -- One-way commitment of the requesting operator persona (NOT a personaId).
  owner_commitment text NOT NULL,
  -- Provider-produced acceptance record (local | x409): commitments + anchor ref.
  acceptance jsonb,
  formed_receipt_id uuid,
  authorized_receipt_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_constitutional_agreements_created
  ON public.constitutional_agreements (created_at DESC);
-- The 409-gate lookup: (capability, agent, requesting operator) → authorized?
CREATE INDEX IF NOT EXISTS idx_constitutional_agreements_gate
  ON public.constitutional_agreements (capability_ref, selected_agent_ref, owner_commitment, status);

ALTER TABLE public.constitutional_agreements ENABLE ROW LEVEL SECURITY;

-- Server-side only (service role) — agreements are read/written exclusively
-- through the spine-gated route + the 409-gate seam.
DROP POLICY IF EXISTS constitutional_agreements_service_all ON public.constitutional_agreements;
CREATE POLICY constitutional_agreements_service_all ON public.constitutional_agreements
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ── activity_receipts CHECK rebuild: + agreement_formed, agreement_authorized ──
-- This is the LATEST action-type migration (sorts after 20260718020000). The
-- CHECK must be rebuilt wholesale with the COMPLETE union — see the 2026-07-15
-- constraint-drift incident: an action type added without a full rebuild
-- silently fails to persist (and its DVN anchor is lost). agreement_formed +
-- agreement_authorized are DVN-anchorable (ANCHORABLE_ACTION_TYPES) — DVN is the
-- constitutional anchor of record; x409 is the acceptance-proof provider.

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
    'capability_registered',
    'capability_operationally_validated',
    'invariant_node_flipped',
    -- Constitutional Agreement (CRP-003a N1 / CFI-002) — formation/acceptance +
    -- authorization of a pre-execution agreement. DVN anchor of record.
    'agreement_formed',
    'agreement_authorized'
  ));
