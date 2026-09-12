-- Golden Cycle Evidence Records
--
-- Evidence substrate for the Golden Cycle's paired Value Cycle
-- (Information -> Time-to-Value -> Value -> Price -> Money/Settlement ->
-- Information/Evidence) and countervailing Risk Cycle (Risk of Repair,
-- reversibility, burden bearer, downside, repair externalization). Added
-- because the canonical Horizen/Vela Use Case Zero spec
-- (docs/vela/accelerator/constitutional-financial-services/05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md,
-- Sec.12) requires every run to produce a GoldenCycleRecord-compatible
-- evidence package, and no such table previously existed (the only table
-- returned by a risk/value/journey/consequence name lookup was
-- journey_states).
--
-- This is an evidence SUBSTRATE, not scientific validation: a row in this
-- table records that a Golden Cycle run occurred and what it observed. It
-- does not, by existing, validate either the Value Cycle or Risk Cycle as a
-- scientific invariant -- operational records remain hypothesis-generating
-- unless separately registered under a controlled research protocol (see
-- evidence_status).
--
-- This file reproduces, verbatim, the migration already applied directly to
-- the live Supabase project (bsjhfvctmduxhohtllly) on 2026-09-12 during the
-- Threshold 007.2 evidence-resolution pass. It is added here to close
-- repo/DB drift -- the live schema was verified column-by-column,
-- constraint-by-constraint and index-by-index against this text before this
-- file was written; nothing here alters the live schema.

create table if not exists public.golden_cycle_records (
  id uuid primary key default gen_random_uuid(),
  record_key text not null unique,
  source_surface text not null,
  protocol_ref text,
  evidence_status text not null default 'operational_hypothesis_generating'
    check (evidence_status in ('doctrine','planned','implemented','operational_hypothesis_generating','controlled_research_evidence','demonstrated')),
  principal_ref text,
  action_ref text,
  value_cycle jsonb not null default '{}'::jsonb,
  risk_cycle jsonb not null default '{}'::jsonb,
  information_provenance jsonb not null default '{}'::jsonb,
  time_to_value jsonb not null default '{}'::jsonb,
  risk_prediction jsonb not null default '{}'::jsonb,
  premium_terms jsonb not null default '{}'::jsonb,
  coverage_decision jsonb not null default '{}'::jsonb,
  action_authorization jsonb not null default '{}'::jsonb,
  execution_evidence jsonb not null default '{}'::jsonb,
  observed_outcome jsonb not null default '{}'::jsonb,
  repair_or_claim jsonb not null default '{}'::jsonb,
  burden_bearer jsonb not null default '{}'::jsonb,
  calibration_error jsonb not null default '{}'::jsonb,
  constitutional_conditions jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_golden_cycle_records_status
  on public.golden_cycle_records(evidence_status, created_at desc);

create index if not exists idx_golden_cycle_records_action
  on public.golden_cycle_records(action_ref) where action_ref is not null;

alter table public.golden_cycle_records enable row level security;

comment on table public.golden_cycle_records is
'Golden Cycle evidence package substrate for the paired Value Cycle and Risk/Risk-of-Repair Cycle. Operational records remain hypothesis-generating unless separately registered under a controlled research protocol.';

comment on column public.golden_cycle_records.value_cycle is
'Value-cycle evidence: Information -> Time-to-Value -> Value -> Price -> Money/Settlement -> subsequent Information/Evidence.';

comment on column public.golden_cycle_records.risk_cycle is
'Countervailing risk-cycle evidence, including Risk of Repair, reversibility, burden bearer, downside and repair externalization.';
