-- Threshold Research — Canonical Promotion Boundary v0.1
--
-- Diagnostic (prior turn): the metaMe Threshold MCP bridge exposes exactly two
-- live Qriptopian capabilities, both read-only projections (papers/magazines
-- list; Threshold essay machine projection). Nothing publishes/promotes/
-- canonicalizes a Research Edition anywhere in the bridge, in app code, or as
-- a described-only/planned entry. This migration builds the smallest
-- production-safe canonical promotion mechanism directly against the
-- deterministic gate this session already built (content_publication_gates /
-- approve_threshold_research_gate / admit_research_review), rather than an
-- ad hoc metadata edit.
--
-- This file reproduces, verbatim, the migration applied directly to the live
-- Supabase project (bsjhfvctmduxhohtllly) on 2026-09-13.

-- ---------------------------------------------------------------------------
-- 1. research_publication_records -- append-only canonical publication ledger
-- ---------------------------------------------------------------------------

create table if not exists public.research_publication_records (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content(id) on delete cascade,
  candidate_version text not null,
  candidate_sha256 text not null,
  publication_type text not null check (publication_type in ('RESEARCH_EDITION')),
  publication_status text not null check (publication_status in ('CANONICAL')),
  gate_id uuid not null references public.content_publication_gates(id),
  admitted_review_record_id uuid not null references public.research_review_records(id),
  arr_disposition_at_publication text not null,
  evidence_resolved_at_publication boolean not null,
  no_evidence_regression_at_publication boolean not null,
  published_at timestamptz not null default now(),
  publication_provenance jsonb,
  predecessor_publication_record_id uuid references public.research_publication_records(id),
  created_at timestamptz not null default now(),
  created_by text not null
);

-- Defense in depth: at most one CANONICAL record per (content, candidate).
-- The promotion function itself also checks this and replays idempotently;
-- this index makes the invariant hold even if that check were ever bypassed.
create unique index if not exists uq_research_publication_records_canonical_candidate
  on public.research_publication_records(content_id, candidate_sha256)
  where publication_status = 'CANONICAL';

create index if not exists idx_research_publication_records_content
  on public.research_publication_records(content_id, candidate_version);

alter table public.research_publication_records enable row level security;

comment on table public.research_publication_records is
'Append-only canonical Research Edition publication ledger. candidate_sha256 is server-derived from the live, approved content_publication_gates row at promotion time -- never trusted from a caller. A later edition creates a NEW row with predecessor_publication_record_id set, rather than mutating this one. Rows are never updated or deleted.';

create or replace function public.research_publication_records_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'research_publication_records is append-only: % is not permitted. A later edition creates a new row with predecessor_publication_record_id set.', tg_op;
end;
$$;

drop trigger if exists trg_research_publication_records_immutable on public.research_publication_records;
create trigger trg_research_publication_records_immutable
  before update or delete on public.research_publication_records
  for each row execute function public.research_publication_records_block_mutation();

-- ---------------------------------------------------------------------------
-- 2. Write protection for the ai_metadata.researchCompanionStatus = 'canonical'
--    transition specifically (narrow guard -- does not restrict any other
--    ai_metadata write on any content row; only this one field/value).
-- ---------------------------------------------------------------------------

create or replace function public.content_guard_research_canonical_status()
returns trigger
language plpgsql
as $$
begin
  if (new.ai_metadata->>'researchCompanionStatus') is distinct from (old.ai_metadata->>'researchCompanionStatus')
     and new.ai_metadata->>'researchCompanionStatus' = 'canonical' then
    if coalesce(current_setting('research.publication_in_progress', true), '') <> 'true' then
      raise exception 'content.ai_metadata.researchCompanionStatus may only be set to ''canonical'' by promote_threshold_research_edition()';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_content_guard_research_canonical_status on public.content;
create trigger trg_content_guard_research_canonical_status
  before update on public.content
  for each row execute function public.content_guard_research_canonical_status();

-- ---------------------------------------------------------------------------
-- 3. The canonical promotion function
-- ---------------------------------------------------------------------------

create or replace function public.promote_threshold_research_edition(
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
  v_publishable boolean;
  v_existing public.research_publication_records%rowtype;
  v_new_record_id uuid;
  v_new_ai_metadata jsonb;
begin
  if not exists (select 1 from public.content where id = p_content_id) then
    return jsonb_build_object('published', false, 'reason', 'content_not_found');
  end if;

  select * into v_gate
  from public.content_publication_gates
  where content_id = p_content_id
    and edition_id = 'research'
    and candidate_version = p_candidate_version;
  if not found then
    return jsonb_build_object('published', false, 'reason', 'gate_not_found');
  end if;

  if v_gate.gate_status <> 'approved' then
    return jsonb_build_object('published', false, 'reason', 'gate_not_approved', 'gate_status', v_gate.gate_status);
  end if;

  select public.threshold_research_gate_is_publishable(p_content_id, p_candidate_version) into v_publishable;
  if not v_publishable then
    return jsonb_build_object('published', false, 'reason', 'gate_not_publishable');
  end if;

  if v_gate.arr_review_record_id is null then
    return jsonb_build_object('published', false, 'reason', 'no_admitted_review');
  end if;

  select * into v_review from public.research_review_records where id = v_gate.arr_review_record_id;
  if not found then
    return jsonb_build_object('published', false, 'reason', 'admitted_review_missing');
  end if;

  -- Redundant with the gate's own guarantees, checked independently here so
  -- this function never relies solely on the gate having stayed consistent.
  if v_review.candidate_sha256 is distinct from v_gate.candidate_text_sha256 then
    return jsonb_build_object(
      'published', false, 'reason', 'candidate_mutated_since_admission',
      'gate_candidate_sha256', v_gate.candidate_text_sha256,
      'review_bound_sha256', v_review.candidate_sha256
    );
  end if;

  select exists (
    select 1 from public.research_review_records
    where parent_review_id = v_review.id and lineage_relation = 'supersedes'
  ) into v_superseded;
  if v_superseded then
    return jsonb_build_object('published', false, 'reason', 'admitted_review_superseded');
  end if;

  if v_gate.arr_disposition is null or v_gate.arr_disposition not in ('PASS','PASS_WITH_DISCLOSED_GAPS') then
    return jsonb_build_object('published', false, 'reason', 'disposition_not_admissible', 'arr_disposition', v_gate.arr_disposition);
  end if;

  if v_review.publication_blockers <> 0 then
    return jsonb_build_object('published', false, 'reason', 'publication_blockers_present', 'publication_blockers', v_review.publication_blockers);
  end if;

  if not v_gate.evidence_resolved then
    return jsonb_build_object('published', false, 'reason', 'evidence_not_resolved');
  end if;

  if not v_gate.no_evidence_regression then
    return jsonb_build_object('published', false, 'reason', 'evidence_regression_present');
  end if;

  -- Idempotent replay: a CANONICAL record already exists for this exact
  -- (content, candidate SHA) -- return it rather than creating a duplicate.
  select * into v_existing
  from public.research_publication_records
  where content_id = p_content_id
    and candidate_sha256 = v_gate.candidate_text_sha256
    and publication_status = 'CANONICAL';
  if found then
    return jsonb_build_object(
      'published', true, 'already_published', true,
      'research_publication_record_id', v_existing.id,
      'published_at', v_existing.published_at
    );
  end if;

  insert into public.research_publication_records (
    content_id, candidate_version, candidate_sha256, publication_type, publication_status,
    gate_id, admitted_review_record_id, arr_disposition_at_publication,
    evidence_resolved_at_publication, no_evidence_regression_at_publication,
    publication_provenance, created_by
  ) values (
    p_content_id, p_candidate_version, v_gate.candidate_text_sha256, 'RESEARCH_EDITION', 'CANONICAL',
    v_gate.id, v_review.id, v_gate.arr_disposition,
    v_gate.evidence_resolved, v_gate.no_evidence_regression,
    jsonb_build_object(
      'promotionFunction', 'promote_threshold_research_edition',
      'promotedAt', now(),
      'gateId', v_gate.id,
      'admittedReviewRecordId', v_review.id,
      'candidateSha256', v_gate.candidate_text_sha256,
      'arrDispositionAtPromotion', v_gate.arr_disposition
    ),
    'promote_threshold_research_edition'
  )
  returning id into v_new_record_id;

  -- Metadata mirror -- narrow, guarded transition (trg_content_guard_research_canonical_status).
  select ai_metadata into v_new_ai_metadata from public.content where id = p_content_id;
  v_new_ai_metadata := coalesce(v_new_ai_metadata, '{}'::jsonb)
    || jsonb_build_object('researchCompanionStatus', 'canonical')
    || jsonb_build_object(
         'currentResearchGate',
         coalesce(v_new_ai_metadata->'currentResearchGate', '{}'::jsonb) || jsonb_build_object(
           'status', 'APPROVED',
           'edition', p_candidate_version,
           'arrPending', false,
           'evidenceResolved', v_gate.evidence_resolved,
           'candidateTextSha256', v_gate.candidate_text_sha256,
           'noEvidenceRegression', v_gate.no_evidence_regression,
           'gateStatus', v_gate.gate_status,
           'arrDisposition', v_gate.arr_disposition,
           'admittedReviewRecordId', v_review.id
         )
       )
    || jsonb_build_object(
         'canonicalResearchPublication', jsonb_build_object(
           'researchPublicationRecordId', v_new_record_id,
           'publishedAt', now(),
           'candidateSha256', v_gate.candidate_text_sha256
         )
       );

  perform set_config('research.publication_in_progress', 'true', true);
  update public.content
  set ai_metadata = v_new_ai_metadata,
      updated_at = now()
  where id = p_content_id;

  return jsonb_build_object(
    'published', true, 'already_published', false,
    'research_publication_record_id', v_new_record_id,
    'gate_id', v_gate.id,
    'admitted_review_record_id', v_review.id,
    'candidate_sha256', v_gate.candidate_text_sha256,
    'arr_disposition', v_gate.arr_disposition
  );
end;
$$;

comment on function public.promote_threshold_research_edition(uuid, text) is
'The ONLY function permitted to create a CANONICAL research_publication_records row or set content.ai_metadata.researchCompanionStatus = ''canonical''. Verifies (server-side, never caller-supplied): the gate exists and is approved; threshold_research_gate_is_publishable() is true; the admitted review''s candidate SHA still matches the gate''s live candidate; the admitted review has not been superseded; arr_disposition is PASS or PASS_WITH_DISCLOSED_GAPS; zero publication_blockers; evidence_resolved and no_evidence_regression are true. Idempotent replay when a CANONICAL record already exists for the exact candidate. Never mutates the manuscript, the candidate SHA, gate_status, or scientific maturity fields.';
