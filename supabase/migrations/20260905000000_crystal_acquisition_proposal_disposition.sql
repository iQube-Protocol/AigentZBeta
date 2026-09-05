-- 20260905000000_crystal_acquisition_proposal_disposition.sql
--
-- Completes the human proposal-decision contract for the targeted-acquisition
-- "YOUR JUDGMENT — DISCOVER SOURCES" card (2026-09-05). Before this
-- migration, `crystal_acquisition_approvals` could only ever record ONE
-- disposition — approve — leaving the operator with no durable way to
-- decline the proposal or send it back for revision; navigating away was the
-- only other option, and that recorded nothing.
--
-- EXTENDS THE EXISTING TABLE, NEVER A PARALLEL ONE (inv.engineering.036/037):
-- `crystal_acquisition_approvals` already carries the exact durable identity
-- this needs — experiment_id + acquisition_domain + crystal_generation +
-- brief_hash (see 20260930130000_crystal_acquisition_approval_identity.sql) —
-- so a decline/revision-request is recorded against the SAME identity an
-- approval would have used, and "was THIS EXACT proposal already disposed of"
-- is answerable with the SAME comparison `approveAcquisitionJob` already
-- performs. Two new `status` values cover the two new dispositions:
--
--   'declined'            — the operator closed the proposal without
--                            authorizing it. Never marks any readiness/
--                            scientific check as satisfied — `crystalReadiness`
--                            re-derives independently of this table.
--   'revision_requested'  — the operator closed the CURRENT proposal version
--                            and recorded direction (`rationale`) for a
--                            regenerated one. Same non-authorizing property.
--
-- `getActiveAcquisitionApproval` is UNCHANGED — it still matches only
-- `status = 'approved'`, so neither new status can ever be mistaken for an
-- authorization to run acquisition.
--
-- `rationale` is reused across both new dispositions (the operator's
-- optional decline reason, or their revision instruction) and stays NULL for
-- every 'approved'/'completed'/'superseded' row.

ALTER TABLE public.crystal_acquisition_approvals
  DROP CONSTRAINT IF EXISTS crystal_acquisition_approvals_status_check;
ALTER TABLE public.crystal_acquisition_approvals
  ADD CONSTRAINT crystal_acquisition_approvals_status_check
  CHECK (status IN ('approved', 'completed', 'superseded', 'declined', 'revision_requested'));

ALTER TABLE public.crystal_acquisition_approvals
  ADD COLUMN IF NOT EXISTS rationale text;

COMMENT ON COLUMN public.crystal_acquisition_approvals.rationale IS
  'Operator-entered rationale (decline) or direction (revision request), recorded 2026-09-05. NULL for approve/completed/superseded rows.';

COMMENT ON COLUMN public.crystal_acquisition_approvals.status IS
  'approved -> completed | superseded (never back to approved); OR declined | revision_requested — the other two terminal human dispositions of a proposal, recorded 2026-09-05. Neither ever transitions to approved: a changed mind after a decline/revision-request is a fresh row against whatever the (possibly still-identical) brief hashes to next.';

-- The one query every disposition check performs: "the most recent
-- disposition of any kind for this experiment+domain" (approveAcquisitionJob
-- already has its own partial index for the 'approved'-only read above;
-- this one serves `getLatestAcquisitionDisposition`, which must see decline/
-- revision-request rows too).
CREATE INDEX IF NOT EXISTS crystal_acquisition_approvals_latest_idx
  ON public.crystal_acquisition_approvals (experiment_id, acquisition_domain, approved_at DESC);
