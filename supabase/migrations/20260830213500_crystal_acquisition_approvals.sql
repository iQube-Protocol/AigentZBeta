-- 20260830213500_crystal_acquisition_approvals.sql
--
-- Crystal v2 targeted acquisition — the ONE durable fact a "Discover Sources"
-- Copilot approval writes (operator directive, 2026-08-30, "turn Discover
-- Sources into a precise Copilot authorization, not another navigation
-- exercise").
--
-- WHY A NEW TABLE, NOT A NEW FIELD ON AN EXISTING ONE: this is a genuinely
-- new fact ("has a steward authorized targeted acquisition for this
-- experiment/domain, and under what target"), not a projection of anything
-- that already exists. Per this repo's own established discipline
-- (services/research/track2Programme.ts's header, services/threshold/
-- constitutionalNavigator.ts's — "never persist a derived decision; persist
-- the underlying facts and let the decision re-derive"), this migration adds
-- ONLY the fact. The pending-decision text, the CTA, and the readiness
-- deficit are ALL still recomputed fresh on every read
-- (services/research/researchProgrammeOrchestrator.ts) — this table is
-- consulted only to answer "is acquisition currently authorized", never to
-- cache a decision.
--
-- STATUS LIFECYCLE: 'approved' -> 'completed' | 'superseded'. A row never
-- transitions back to 'approved'; a fresh approval after completion/
-- supersession is a NEW row, so the approval history is never overwritten.
-- 'completed' is set once readiness no longer needs acquisition
-- (acquisitionBriefApplies(readiness) === false); 'superseded' is set if a
-- steward approves a NEW acquisition while an older one is still 'approved'
-- (never two simultaneously active rows for the same experiment+domain).

CREATE TABLE IF NOT EXISTS public.crystal_acquisition_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id text NOT NULL,
  acquisition_domain text NOT NULL,
  crystal_domain text NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  -- The readiness deficit AS OF APPROVAL TIME — informational provenance
  -- only. The orchestrator's own re-read of live readiness on every act,
  -- never this snapshot, is what decides when acquisition is still needed;
  -- this column exists so an approval receipt can say what was targeted
  -- when the steward clicked, not so anything downstream trusts it as
  -- current.
  target_snapshot jsonb NOT NULL,
  approved_by_persona_id uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  receipt_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crystal_acquisition_approvals
  DROP CONSTRAINT IF EXISTS crystal_acquisition_approvals_status_check;
ALTER TABLE public.crystal_acquisition_approvals
  ADD CONSTRAINT crystal_acquisition_approvals_status_check
  CHECK (status IN ('approved', 'completed', 'superseded'));

-- The one query this fact is read through: "the active approval for this
-- experiment+domain, if any" — services/research/crystalAcquisitionJob.ts.
CREATE INDEX IF NOT EXISTS crystal_acquisition_approvals_active_idx
  ON public.crystal_acquisition_approvals (experiment_id, acquisition_domain, status)
  WHERE status = 'approved';

ALTER TABLE public.crystal_acquisition_approvals ENABLE ROW LEVEL SECURITY;
-- Service-role only — every read/write goes through
-- services/research/crystalAcquisitionJob.ts's server-side admin client,
-- exactly like every other Track 2 substrate table (reciprocal_exchanges,
-- exchange_artifacts, etc.). No client-side row ever reaches the browser
-- directly.
DROP POLICY IF EXISTS crystal_acquisition_approvals_service_role ON public.crystal_acquisition_approvals;
CREATE POLICY crystal_acquisition_approvals_service_role
  ON public.crystal_acquisition_approvals
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
