-- 20260831220000_crystal_relationship_adjudications.sql
--
-- Track 2 Stage 7 ("add-relationships") scientific workflow defect (operator
-- report, 2026-08-31): a steward reviewed Record 1's proposed relationships
-- and rejected all of them because none had sufficient evidentiary basis.
-- The UI correctly said "no suggestion cleared review for this member" — but
-- nothing durable recorded that the review HAPPENED. Rejection was, and
-- remains after this migration, a purely client-side dismiss
-- (components/research/Track2ProgrammePanel.tsx's `rejectSuggestion`: "a
-- rejected suggestion was never written anywhere, so there is nothing to
-- undo and nothing to receipt"). Stage 7's own pending derivation
-- (services/research/populationReconciliation.ts's `reconcilePromotedCohort`)
-- reads ONLY intra-crystal edge degree — zero edges reads as "orphan",
-- indistinguishable from "never reviewed". A member that legitimately has
-- zero relationships (case 2: reviewed, no defensible edge admitted) was
-- therefore indistinguishable from one nobody has looked at yet (case 1),
-- and Stage 7 could never complete for it without inventing an edge.
--
-- THE FACT THIS TABLE ADDS: "a steward reviewed this member's candidate
-- relationship pool, under this specific cohort composition, and confirmed
-- no relationship warrants admission." Append-only — a row is NEVER updated
-- or deleted; a later re-adjudication (e.g. after the cohort gains new
-- members and the steward reviews again) is a NEW row. The pending-decision
-- text, the CTA, and Stage 7's own derivation are still recomputed fresh on
-- every read (services/research/populationReconciliation.ts) — this table
-- is consulted only to answer "was this member's relationship review
-- completed with zero accepted edges, under a cohort that hasn't since
-- changed", never to cache the Stage 7 pending/complete verdict itself.
--
-- WHY `cohort_fingerprint`, NOT A BOOLEAN "reviewed" FLAG: a flag can never
-- legitimately reopen. The candidate relationship pool `suggestRelationships`
-- draws from IS the current crystal's OTHER members (services/invariants/
-- relationshipSuggestion.ts) — so when the cohort gains or loses members,
-- the space of possible relationships for THIS member has genuinely changed,
-- which is new evidence a prior "no defensible edge" verdict never
-- considered. `cohort_fingerprint` is a deterministic hash of the current
-- cohort's member ids (services/research/crystalRelationshipAdjudication.ts's
-- `computeCohortFingerprint`); a read compares the LATEST adjudication row's
-- fingerprint for a member against the CURRENT cohort's fingerprint — a
-- mismatch means the verdict was reached under a cohort that no longer
-- exists, so it does not satisfy Stage 7 and the member reverts to
-- unreviewed-orphan until adjudicated again. No superseded/expiry column is
-- needed: history is never rewritten, and "the latest row's fingerprint
-- still matches" is a cheap, deterministic string comparison — never a
-- fresh model call just to answer whether Stage 7 may proceed.
--
-- WHY A NEW TABLE, NOT A COLUMN ON `invariants`: this is a fact about a
-- REVIEW EVENT (who, when, under what cohort, having seen what candidates),
-- not a static property of the invariant row itself, and the append-only
-- history (every past adjudication, superseded or not) is itself part of
-- the provenance a later steward or auditor may need. Mirrors this repo's
-- own established discipline (services/research/track2Programme.ts,
-- services/research/crystalAcquisitionJob.ts's header — "never persist a
-- derived decision; persist the underlying facts and let the decision
-- re-derive").

CREATE TABLE IF NOT EXISTS public.crystal_relationship_adjudications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id text NOT NULL,
  crystal_domain text NOT NULL,
  invariant_id uuid NOT NULL REFERENCES public.invariants(id),
  -- Single value today ('no-defensible-edge' — the only outcome this repair
  -- needs to persist: "reviewed, nothing warranted admission"). An admitted
  -- relationship is already durably recorded as an invariant_edges row and
  -- needs no adjudication fact of its own; this table exists ONLY for the
  -- zero-accepted-edges outcome. CHECK kept as an explicit enum (rather than
  -- unconstrained text) so a future second disposition is a deliberate,
  -- reviewed migration, never a silent typo.
  disposition text NOT NULL DEFAULT 'no-defensible-edge',
  -- Deterministic hash of the reviewed cohort's member ids at adjudication
  -- time (computeCohortFingerprint) — see header. The ONLY field the Stage 7
  -- derivation compares against the live cohort to decide whether this
  -- adjudication still stands.
  cohort_fingerprint text NOT NULL,
  -- Provenance only, per the operator's request: the candidate relationship
  -- ids (and relation types) the steward actually saw and rejected/dismissed
  -- before concluding no defensible edge existed. Never read by the Stage 7
  -- derivation itself — an audit/debugging trail, not a gate.
  reviewed_candidate_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  adjudicated_by_persona_id uuid NOT NULL,
  adjudicated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crystal_relationship_adjudications
  DROP CONSTRAINT IF EXISTS crystal_relationship_adjudications_disposition_check;
ALTER TABLE public.crystal_relationship_adjudications
  ADD CONSTRAINT crystal_relationship_adjudications_disposition_check
  CHECK (disposition IN ('no-defensible-edge'));

-- The one query this fact is read through: "the latest adjudication for
-- each member of this experiment's current cohort" —
-- services/research/crystalRelationshipAdjudication.ts's
-- `getValidNoDefensibleEdgeInvariantIds`.
CREATE INDEX IF NOT EXISTS crystal_relationship_adjudications_lookup_idx
  ON public.crystal_relationship_adjudications (experiment_id, invariant_id, adjudicated_at DESC);

ALTER TABLE public.crystal_relationship_adjudications ENABLE ROW LEVEL SECURITY;
-- Service-role only — every read/write goes through
-- services/research/crystalRelationshipAdjudication.ts's server-side admin
-- client, exactly like every other Track 2 substrate table
-- (crystal_acquisition_approvals, reciprocal_exchanges, etc.). No
-- client-side row ever reaches the browser directly.
DROP POLICY IF EXISTS crystal_relationship_adjudications_service_role ON public.crystal_relationship_adjudications;
CREATE POLICY crystal_relationship_adjudications_service_role
  ON public.crystal_relationship_adjudications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
