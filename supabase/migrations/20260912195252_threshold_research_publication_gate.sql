-- Threshold Research Publication Gate
--
-- Edition-level constitutional publication gate for Threshold research editions
-- (Threshold 007 "Invariant Intelligence" is the first consumer). A Research
-- Edition candidate becomes publishable only after evidence resolution, an
-- independent Adversarial Research Review, and a no-evidentiary-regression
-- check all pass -- never by prose assertion alone.
--
-- This file reproduces, verbatim, the migration already applied directly to
-- the live Supabase project (bsjhfvctmduxhohtllly) on 2026-09-12 during the
-- Threshold 007.2 evidence-resolution pass. It is added here to close
-- repo/DB drift -- the live schema was verified column-by-column,
-- constraint-by-constraint and index-by-index against this text before this
-- file was written; nothing here alters the live schema.

create table if not exists public.content_publication_gates (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content(id) on delete cascade,
  edition_id text not null,
  candidate_version text not null,
  gate_status text not null default 'candidate'
    check (gate_status in ('candidate','evidence_resolution_required','arr_pending','approved','blocked','superseded')),
  candidate_text_sha256 text,
  canonical_text_sha256 text,
  evidence_resolved boolean not null default false,
  arr_disposition text
    check (arr_disposition is null or arr_disposition in ('PASS','PASS_WITH_DISCLOSED_GAPS','REVISION_REQUIRED','BLOCK_PUBLICATION')),
  no_evidence_regression boolean not null default false,
  apparatus jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, edition_id, candidate_version)
);

create index if not exists idx_content_publication_gates_content
  on public.content_publication_gates(content_id, edition_id, gate_status);

alter table public.content_publication_gates enable row level security;

create or replace function public.threshold_research_gate_is_publishable(
  p_content_id uuid,
  p_candidate_version text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.content_publication_gates g
    where g.content_id = p_content_id
      and g.edition_id = 'research'
      and g.candidate_version = p_candidate_version
      and g.gate_status = 'approved'
      and g.evidence_resolved = true
      and g.no_evidence_regression = true
      and g.arr_disposition in ('PASS','PASS_WITH_DISCLOSED_GAPS')
  );
$$;

comment on table public.content_publication_gates is
'Edition-level constitutional publication gate. A Threshold Research Edition is publishable only after evidence resolution, independent ARR, and no-evidentiary-regression checks pass.';

comment on function public.threshold_research_gate_is_publishable(uuid,text) is
'Returns true only when the named Research Edition candidate has satisfied the deterministic publication gate.';
