-- 20260930130000_crystal_acquisition_approval_identity.sql
--
-- Gives `crystal_acquisition_approvals` a durable identity beyond
-- experiment_id + acquisition_domain (2026-08-31, "targeted-acquisition
-- state-machine" repair, operator requirement: "a durable identity such as
-- experimentId + crystalVersion/successor + acquisitionBriefHash").
--
-- WHY: without these columns, `getActiveAcquisitionApproval` can only ever
-- answer "is SOME approval active for this experiment+domain", never "is
-- THIS EXACT brief already approved" — so a steward re-approving an
-- unchanged plan and a steward approving a materially different one (a new
-- crystal generation, or a readiness re-read with different deficits) were
-- indistinguishable at the identity layer. `crystal_generation` and
-- `brief_hash` (services/research/crystalAcquisitionBrief.ts::
-- hashAcquisitionBrief) let the approve route tell the two apart: an
-- unchanged brief short-circuits to the existing row (no new act, no
-- duplicate receipt); a materially changed one is recognised as a genuinely
-- new judgement.
--
-- Backfill: existing rows predate the brief hash and cannot be
-- retroactively hashed (the brief itself was never persisted, only its
-- target_snapshot projection) — backfilled to '' , which never matches a
-- freshly computed hash, so an existing 'approved' row from before this
-- migration is treated as "identity unknown" and a fresh approve click
-- inserts a new row rather than silently trusting a stale match. This is
-- the fail-closed direction: it costs one extra approval click on upgrade,
-- never a false "already approved".

ALTER TABLE public.crystal_acquisition_approvals
  ADD COLUMN IF NOT EXISTS crystal_generation text NOT NULL DEFAULT '';
ALTER TABLE public.crystal_acquisition_approvals
  ADD COLUMN IF NOT EXISTS brief_hash text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.crystal_acquisition_approvals.crystal_generation IS
  'The crystal artifact generation this approval targeted (currentCrystalArtifactId at approval time) — part of the durable approval identity alongside brief_hash.';
COMMENT ON COLUMN public.crystal_acquisition_approvals.brief_hash IS
  'hashAcquisitionBrief(brief) at approval time — a deterministic content fingerprint of what was targeted, so a materially unchanged brief is recognised as the SAME already-consumed judgement, never re-asked.';
