-- Threshold Research Publication Gate — Approval Boundary
--
-- Diagnostic finding (2026-09-13, before writing this): no function or code
-- path in this repo/live schema owns the gate_status -> 'approved' transition.
-- grep across supabase/migrations, services/, app/ for approve*, gate_status,
-- publication gate, promotion turned up unrelated CCRL/steward-participation
-- "approval" concepts, none touching content_publication_gates.gate_status.
-- pg_proc confirms the only function referencing arr_disposition/
-- gate_status before this migration was content_publication_gates_guard_arr_write(),
-- which guards arr_disposition/arr_review_record_id only. This migration adds
-- the missing, smallest deterministic Publication Gate approval boundary.
--
-- This file reproduces, verbatim (including one live bugfix applied the same
-- day -- see below), the migration applied directly to the live Supabase
-- project (bsjhfvctmduxhohtllly) on 2026-09-13.
--
-- LIVE BUGFIX NOTE: the first version of
-- content_publication_gates_guard_gate_status_write() had a self-inflicted
-- bug -- its own candidate-mutation auto-invalidation branch (which forces
-- gate_status to 'blocked') tripped its OWN "unauthorized gate_status change"
-- check immediately afterward, since that branch changes gate_status without
-- the transition flag set. Caught live via a direct test (mutating an
-- approved fixture's candidate_text_sha256 raised the guard's own exception
-- instead of downgrading). Fixed by tracking whether the auto-invalidation
-- branch fired and exempting its own resulting change from the subsequent
-- unauthorized-write check. The version below is the corrected one.

alter table public.content_publication_gates
  add column if not exists approved_at timestamptz;

comment on column public.content_publication_gates.approved_at is
'Set only by approve_threshold_research_gate(). Cleared automatically if the gate is later auto-invalidated (candidate mutated after approval, or the bound review record is superseded/downgraded by a later admit_research_review() call).';

-- ---------------------------------------------------------------------------
-- gate_status write guard (+ candidate-mutation auto-invalidation safety net)
-- ---------------------------------------------------------------------------

create or replace function public.content_publication_gates_guard_gate_status_write()
returns trigger
language plpgsql
as $$
declare
  v_auto_invalidated boolean := false;
begin
  -- Safety net: an approved gate whose candidate text changes underneath it
  -- is downgraded automatically, regardless of what the statement otherwise
  -- intended for gate_status. Downgrade-only; never an upgrade path. This
  -- branch's own resulting change to gate_status is exempt from the guard
  -- below -- it is the guard reacting protectively, not an unauthorized write.
  if old.gate_status = 'approved'
     and new.candidate_text_sha256 is distinct from old.candidate_text_sha256 then
    new.gate_status := 'blocked';
    new.approved_at := null;
    v_auto_invalidated := true;
  end if;

  if (not v_auto_invalidated) and new.gate_status is distinct from old.gate_status then
    if coalesce(current_setting('research.gate_transition_in_progress', true), '') <> 'true' then
      raise exception 'content_publication_gates.gate_status may only be changed by approve_threshold_research_gate() (promotion) or admit_research_review()''s own auto-invalidation path (downgrade)';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_content_publication_gates_guard_gate_status on public.content_publication_gates;
create trigger trg_content_publication_gates_guard_gate_status
  before update on public.content_publication_gates
  for each row execute function public.content_publication_gates_guard_gate_status_write();

-- ---------------------------------------------------------------------------
-- admit_research_review() — extended with auto-invalidation of an already-
-- approved gate when a newly admitted review disqualifies it (e.g. a later
-- REVISION_REQUIRED ARR_ADDENDUM supersedes a PASS_WITH_DISCLOSED_GAPS that
-- had already been approved). Everything else about the function is
-- unchanged from the ARR Admission Boundary v0.1 build
-- (20260913200000_research_review_arr_admission_boundary.sql).
-- ---------------------------------------------------------------------------

create or replace function public.admit_research_review(p_review_record_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.research_review_records%rowtype;
  v_gate public.content_publication_gates%rowtype;
  v_auth public.research_reviewer_authorities%rowtype;
  v_parent public.research_review_records%rowtype;
  v_revert_gate boolean := false;
begin
  select * into v_review from public.research_review_records where id = p_review_record_id;
  if not found then
    return jsonb_build_object('admitted', false, 'reason', 'record_not_found');
  end if;

  select * into v_gate
  from public.content_publication_gates
  where content_id = v_review.content_id
    and edition_id = 'research'
    and candidate_version = v_review.candidate_version;
  if not found then
    return jsonb_build_object('admitted', false, 'reason', 'gate_not_found', 'review_record_id', p_review_record_id);
  end if;

  if v_gate.candidate_text_sha256 is distinct from v_review.candidate_sha256 then
    return jsonb_build_object(
      'admitted', false, 'reason', 'candidate_mutated_or_mismatched_since_review',
      'gate_candidate_sha256', v_gate.candidate_text_sha256,
      'review_bound_sha256', v_review.candidate_sha256
    );
  end if;

  select * into v_auth from public.research_reviewer_authorities where id = v_review.reviewer_authority_id;
  if not found then
    return jsonb_build_object('admitted', false, 'reason', 'reviewer_authority_not_found');
  end if;

  if v_auth.revoked_at is not null then
    return jsonb_build_object('admitted', false, 'reason', 'reviewer_authority_revoked', 'revoked_at', v_auth.revoked_at);
  end if;

  if v_auth.role <> 'adversary' then
    return jsonb_build_object('admitted', false, 'reason', 'reviewer_authority_role_insufficient', 'role', v_auth.role);
  end if;

  if v_auth.scope_content_id is not null and v_auth.scope_content_id <> v_review.content_id then
    return jsonb_build_object('admitted', false, 'reason', 'reviewer_authority_out_of_scope');
  end if;

  if v_gate.author_principal_ref is not null and v_auth.principal_ref = v_gate.author_principal_ref then
    return jsonb_build_object('admitted', false, 'reason', 'reviewer_is_author_principal_self_certification_refused');
  end if;

  if v_review.material_evidence_regression then
    return jsonb_build_object('admitted', false, 'reason', 'material_evidence_regression_reported');
  end if;

  if v_review.review_type = 'ORIGINAL_ARR' and v_review.parent_review_id is not null then
    return jsonb_build_object('admitted', false, 'reason', 'original_arr_must_not_have_parent');
  end if;

  if v_review.review_type in ('ARR_ADDENDUM','CANDIDATE_DELTA_CONFIRMATION') and v_review.parent_review_id is null then
    return jsonb_build_object('admitted', false, 'reason', 'missing_required_parent_lineage');
  end if;

  if v_review.parent_review_id is not null then
    select * into v_parent from public.research_review_records where id = v_review.parent_review_id;
    if not found or v_parent.content_id <> v_review.content_id then
      return jsonb_build_object('admitted', false, 'reason', 'parent_lineage_content_mismatch');
    end if;
  end if;

  if v_gate.arr_review_record_id = v_review.id then
    return jsonb_build_object('admitted', true, 'already_admitted', true, 'gate_id', v_gate.id, 'disposition', v_review.disposition);
  end if;

  -- Auto-invalidation: this admission disqualifies an already-approved gate.
  if v_gate.gate_status = 'approved' and v_review.disposition not in ('PASS','PASS_WITH_DISCLOSED_GAPS') then
    v_revert_gate := true;
  end if;

  perform set_config('research.admission_in_progress', 'true', true);
  perform set_config('research.gate_transition_in_progress', 'true', true);
  update public.content_publication_gates
  set arr_disposition = v_review.disposition,
      arr_review_record_id = v_review.id,
      gate_status = case when v_revert_gate then 'arr_pending' else gate_status end,
      approved_at = case when v_revert_gate then null else approved_at end,
      updated_at = now()
  where id = v_gate.id;

  return jsonb_build_object(
    'admitted', true, 'already_admitted', false,
    'gate_id', v_gate.id, 'disposition', v_review.disposition,
    'review_record_id', v_review.id,
    'gate_auto_reverted', v_revert_gate
  );
end;
$$;

comment on function public.admit_research_review(uuid) is
'The ONLY function permitted to write content_publication_gates.arr_disposition / arr_review_record_id. Verifies candidate-SHA currency, reviewer authority (unrevoked, role=adversary, in-scope, not the content''s own author), absence of a reported material evidence regression, and review-type lineage, before projecting a review record''s disposition onto the gate. Auto-reverts an already-approved gate to arr_pending if the newly admitted review disqualifies it (candidate mutation, superseding disposition downgrade, etc.).';

-- ---------------------------------------------------------------------------
-- The approval function
-- ---------------------------------------------------------------------------

create or replace function public.approve_threshold_research_gate(
  p_content_id uuid,
  p_candidate_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gate public.content_publication_gates%rowtype;
  v_review public.research_review_records%rowtype;
  v_superseded boolean;
begin
  select * into v_gate
  from public.content_publication_gates
  where content_id = p_content_id
    and edition_id = 'research'
    and candidate_version = p_candidate_version;
  if not found then
    return jsonb_build_object('approved', false, 'reason', 'gate_not_found');
  end if;

  if v_gate.gate_status = 'approved' then
    return jsonb_build_object('approved', true, 'already_approved', true, 'gate_id', v_gate.id, 'approved_at', v_gate.approved_at);
  end if;

  if v_gate.gate_status in ('blocked','superseded') then
    return jsonb_build_object('approved', false, 'reason', 'gate_already_blocked_or_superseded', 'gate_status', v_gate.gate_status);
  end if;

  if v_gate.arr_review_record_id is null then
    return jsonb_build_object('approved', false, 'reason', 'no_admitted_review');
  end if;

  select * into v_review from public.research_review_records where id = v_gate.arr_review_record_id;
  if not found then
    return jsonb_build_object('approved', false, 'reason', 'admitted_review_missing');
  end if;

  if v_review.candidate_sha256 is distinct from v_gate.candidate_text_sha256 then
    return jsonb_build_object(
      'approved', false, 'reason', 'candidate_mutated_since_admission',
      'gate_candidate_sha256', v_gate.candidate_text_sha256,
      'review_bound_sha256', v_review.candidate_sha256
    );
  end if;

  if v_gate.arr_disposition is null or v_gate.arr_disposition not in ('PASS','PASS_WITH_DISCLOSED_GAPS') then
    return jsonb_build_object('approved', false, 'reason', 'disposition_not_admissible_for_approval', 'arr_disposition', v_gate.arr_disposition);
  end if;

  if v_review.publication_blockers <> 0 then
    return jsonb_build_object('approved', false, 'reason', 'publication_blockers_present', 'publication_blockers', v_review.publication_blockers);
  end if;

  if v_review.material_evidence_regression then
    return jsonb_build_object('approved', false, 'reason', 'material_evidence_regression_reported');
  end if;

  if not v_gate.evidence_resolved then
    return jsonb_build_object('approved', false, 'reason', 'evidence_not_resolved');
  end if;

  if not v_gate.no_evidence_regression then
    return jsonb_build_object('approved', false, 'reason', 'evidence_regression_present');
  end if;

  select exists (
    select 1 from public.research_review_records
    where parent_review_id = v_review.id and lineage_relation = 'supersedes'
  ) into v_superseded;
  if v_superseded then
    return jsonb_build_object('approved', false, 'reason', 'admitted_review_superseded');
  end if;

  perform set_config('research.gate_transition_in_progress', 'true', true);
  update public.content_publication_gates
  set gate_status = 'approved',
      approved_at = now(),
      provenance = coalesce(provenance, '{}'::jsonb) || jsonb_build_object(
        'gateApproval', jsonb_build_object(
          'approvalFunction', 'approve_threshold_research_gate',
          'approvedAt', now(),
          'admittedReviewRecordId', v_review.id,
          'candidateSha256', v_gate.candidate_text_sha256,
          'arrDispositionAtApproval', v_gate.arr_disposition
        )
      ),
      updated_at = now()
  where id = v_gate.id;

  return jsonb_build_object(
    'approved', true, 'already_approved', false,
    'gate_id', v_gate.id, 'admitted_review_record_id', v_review.id,
    'candidate_sha256', v_gate.candidate_text_sha256
  );
end;
$$;

comment on function public.approve_threshold_research_gate(uuid, text) is
'The ONLY function permitted to advance content_publication_gates.gate_status to ''approved''. Performs deterministic constitutional admission only -- it never reassesses the science, reinterprets the ARR, or changes disposition/evidence/maturity. Verifies: gate exists and is not already blocked/superseded; an admitted review exists and its bound candidate SHA still matches the gate''s live candidate; arr_disposition is PASS or PASS_WITH_DISCLOSED_GAPS; the review reports zero publication_blockers and no material evidence regression; evidence_resolved and no_evidence_regression are true; and the admitted review has not been superseded by a later review record. Idempotent on an already-approved gate.';
