-- Threshold Research Publication — ARR Admission Boundary v0.1
--
-- Adds the missing admission mechanism identified by the read-only diagnostic
-- of 2026-09-13: content_publication_gates.arr_disposition was a freely
-- service_role-writable field with no reviewer-identity binding, no
-- candidate-SHA binding, and no code path that authenticated who was writing
-- it. This migration:
--
--   1. Introduces research_reviewer_authorities — a human (operator)-minted
--      record of WHO holds ARR-review authority under WHICH role, scoped to
--      a piece of content. There is no self-service / agent-callable path to
--      create or approve one of these rows: minting a row requires a human
--      operator executing SQL directly (or, later, a real signed ceremony).
--      This is the honest baseline given the diagnostic's finding that no
--      session-level mechanism today distinguishes "the Adversary" from "the
--      Evidence Agent" — see the accompanying update doc for the disclosed
--      gap this leaves open.
--
--   2. Introduces research_review_records — an append-only (trigger-enforced,
--      not just convention-enforced) ledger of ARR review artifacts. The
--      candidate SHA and the reviewer's principal/role are NEVER trusted from
--      the caller: a BEFORE INSERT trigger derives both server-side from the
--      live content_publication_gates row and the referenced
--      research_reviewer_authorities row, overwriting anything the caller
--      supplied.
--
--   3. Adds content_publication_gates.arr_review_record_id and
--      .author_principal_ref, and a BEFORE UPDATE trigger that refuses any
--      write to arr_disposition / arr_review_record_id unless it originates
--      from inside admit_research_review() (a local, transaction-scoped
--      config flag). This is enforced by a trigger, not RLS, so it holds even
--      for service_role (RLS bypass does not bypass triggers).
--
--   4. Adds admit_research_review(uuid) — the ONLY function permitted to
--      write content_publication_gates.arr_disposition /
--      .arr_review_record_id. It verifies: the review record exists; its
--      candidate SHA still matches the gate's live candidate (catching both
--      "reviewed the wrong candidate" and "candidate mutated after review");
--      the bound reviewer authority is unrevoked, holds the 'adversary' role,
--      is in scope for this content, and is not the same principal as the
--      content's own author; the review does not report a material evidence
--      regression; and the review-type lineage (ORIGINAL_ARR has no parent;
--      ARR_ADDENDUM / CANDIDATE_DELTA_CONFIRMATION require one) is present.
--      Re-admitting the SAME review record is a no-op; admitting a
--      DIFFERENT, later, valid review record supersedes the prior one (the
--      normal Addendum/Delta-Confirmation flow).
--
-- This migration does NOT touch Threshold 007's frozen candidate text, does
-- NOT call admit_research_review for it, and does NOT change gate_status.
-- Threshold 007's real ARR-review history is bootstrap-imported as
-- legacy_review_import = true rows in a SEPARATE, already-applied statement
-- run directly against the live project after this migration — see
-- codexes/packs/agentiq/updates/2026-09-13_threshold-007-arr-admission-boundary.md.
--
-- This file reproduces, verbatim, the migration already applied directly to
-- the live Supabase project (bsjhfvctmduxhohtllly) on 2026-09-13. It is added
-- here to close repo/DB drift, following the same convention as
-- 20260912195252_threshold_research_publication_gate.sql.

-- ---------------------------------------------------------------------------
-- 1. Reviewer authorities
-- ---------------------------------------------------------------------------

create table if not exists public.research_reviewer_authorities (
  id uuid primary key default gen_random_uuid(),
  principal_ref text not null,
  role text not null check (role in ('adversary','evidence_agent','author','publication_gate')),
  scope_content_id uuid references public.content(id) on delete cascade,
  authorized_by text not null,
  authorized_at timestamptz not null default now(),
  authorization_note text,
  revoked_at timestamptz,
  revoked_by text,
  revocation_note text,
  legacy_authorization boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_research_reviewer_authorities_scope
  on public.research_reviewer_authorities(scope_content_id, role);

alter table public.research_reviewer_authorities enable row level security;

comment on table public.research_reviewer_authorities is
'Human (operator)-minted record of who holds ARR-review authority under which role, optionally scoped to one piece of content. No agent-callable path creates these rows today — minting one is a human act performed directly against the database, consistent with the platform-wide rule that only the human authorizes changes of authority.';

-- ---------------------------------------------------------------------------
-- 2. Review records (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.research_review_records (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content(id) on delete cascade,
  candidate_version text not null,
  candidate_sha256 text not null,
  review_type text not null check (review_type in ('ORIGINAL_ARR','ARR_ADDENDUM','CANDIDATE_DELTA_CONFIRMATION')),
  reviewer_authority_id uuid not null references public.research_reviewer_authorities(id),
  reviewer_role_at_review text not null,
  reviewer_principal_ref text not null,
  reviewer_session_or_authority_context text,
  disposition text not null check (disposition in ('PASS','PASS_WITH_DISCLOSED_GAPS','REVISION_REQUIRED','BLOCK_PUBLICATION')),
  publication_blockers integer not null default 0 check (publication_blockers >= 0),
  material_evidence_regression boolean not null default false,
  evidentiary_maturity text,
  conceptual_ceiling text,
  review_receipt jsonb,
  review_body text,
  parent_review_id uuid references public.research_review_records(id),
  lineage_relation text check (lineage_relation is null or lineage_relation in ('supersedes','supplements')),
  legacy_review_import boolean not null default false,
  legacy_provenance jsonb,
  created_at timestamptz not null default now(),
  created_by text not null
);

create index if not exists idx_research_review_records_content
  on public.research_review_records(content_id, candidate_version);

alter table public.research_review_records enable row level security;

comment on table public.research_review_records is
'Append-only ARR review ledger. candidate_sha256, reviewer_role_at_review and reviewer_principal_ref are server-derived at insert time (trigger), never trusted from the caller. Rows are never updated or deleted (trigger-enforced) -- corrections are new rows linked via parent_review_id / lineage_relation.';

-- Server-side derivation of the fields a caller must never author directly.
create or replace function public.research_review_records_derive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gate public.content_publication_gates%rowtype;
  v_auth public.research_reviewer_authorities%rowtype;
begin
  select * into v_gate
  from public.content_publication_gates
  where content_id = new.content_id
    and edition_id = 'research'
    and candidate_version = new.candidate_version
  limit 1;

  if not found then
    raise exception 'no content_publication_gates row for content_id=%, candidate_version=%',
      new.content_id, new.candidate_version;
  end if;

  if v_gate.candidate_text_sha256 is null then
    raise exception 'content_publication_gates.candidate_text_sha256 is not yet computed for content_id=%, candidate_version=%',
      new.content_id, new.candidate_version;
  end if;

  -- Never trust a caller-supplied SHA: always bind to the live gate's own
  -- server-computed candidate hash at the moment this review record is written.
  new.candidate_sha256 := v_gate.candidate_text_sha256;

  select * into v_auth
  from public.research_reviewer_authorities
  where id = new.reviewer_authority_id;

  if not found then
    raise exception 'reviewer_authority_id % does not exist', new.reviewer_authority_id;
  end if;

  -- Never trust caller-supplied reviewer role/principal: snapshot from the
  -- authority row itself.
  new.reviewer_role_at_review := v_auth.role;
  new.reviewer_principal_ref := v_auth.principal_ref;

  return new;
end;
$$;

drop trigger if exists trg_research_review_records_derive on public.research_review_records;
create trigger trg_research_review_records_derive
  before insert on public.research_review_records
  for each row execute function public.research_review_records_derive_fields();

-- Append-only enforcement -- holds even for service_role, since RLS bypass
-- does not bypass triggers.
create or replace function public.research_review_records_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'research_review_records is append-only: % is not permitted. Record a correction as a new row linked via parent_review_id.', tg_op;
end;
$$;

drop trigger if exists trg_research_review_records_immutable on public.research_review_records;
create trigger trg_research_review_records_immutable
  before update or delete on public.research_review_records
  for each row execute function public.research_review_records_block_mutation();

-- ---------------------------------------------------------------------------
-- 3. Gate columns + write guard
-- ---------------------------------------------------------------------------

alter table public.content_publication_gates
  add column if not exists arr_review_record_id uuid references public.research_review_records(id),
  add column if not exists author_principal_ref text;

comment on column public.content_publication_gates.arr_review_record_id is
'The admitted research_review_records row currently backing arr_disposition. Writable only via admit_research_review().';

comment on column public.content_publication_gates.author_principal_ref is
'Principal ref of this content''s author/authoring context (e.g. the Operator/Aletheon dyad for Threshold 007). Used by admit_research_review() to refuse self-certification: a reviewer authority whose principal_ref matches this can never admit a review for this content.';

create or replace function public.content_publication_gates_guard_arr_write()
returns trigger
language plpgsql
as $$
begin
  if (new.arr_disposition is distinct from old.arr_disposition)
     or (new.arr_review_record_id is distinct from old.arr_review_record_id) then
    if coalesce(current_setting('research.admission_in_progress', true), '') <> 'true' then
      raise exception 'content_publication_gates.arr_disposition / arr_review_record_id may only be written by admit_research_review()';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_content_publication_gates_guard_arr on public.content_publication_gates;
create trigger trg_content_publication_gates_guard_arr
  before update on public.content_publication_gates
  for each row execute function public.content_publication_gates_guard_arr_write();

-- ---------------------------------------------------------------------------
-- 4. The admission function
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

  perform set_config('research.admission_in_progress', 'true', true);
  update public.content_publication_gates
  set arr_disposition = v_review.disposition,
      arr_review_record_id = v_review.id,
      updated_at = now()
  where id = v_gate.id;

  return jsonb_build_object(
    'admitted', true, 'already_admitted', false,
    'gate_id', v_gate.id, 'disposition', v_review.disposition,
    'review_record_id', v_review.id
  );
end;
$$;

comment on function public.admit_research_review(uuid) is
'The ONLY function permitted to write content_publication_gates.arr_disposition / arr_review_record_id. Verifies candidate-SHA currency, reviewer authority (unrevoked, role=adversary, in-scope, not the content''s own author), absence of a reported material evidence regression, and review-type lineage, before projecting a review record''s disposition onto the gate.';
