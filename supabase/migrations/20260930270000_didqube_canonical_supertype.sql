-- DiDQube canonical supertype (Phase 1) — operator-approved 2026-09-07.
--
-- Adds ONLY three tables: didqubes, human_didqubes, agent_didqubes. Nothing
-- existing changes shape or meaning — kybe_identity, root_identity,
-- did_persona, agent_root_identity, agent_persona, polity_passport_records
-- and polity_passport_applications remain the authoritative anchor tables;
-- this migration adds a thin, additive supertype binding on top of them.
--
-- Non-negotiable invariants (operator ruling, 2026-09-07):
--   - one anchor per DiDQube, one DiDQube per anchor (UNIQUE on the anchor FK);
--   - a human binding's didqube_id must reference subject_class='natural_person',
--     an agent binding's must reference subject_class='agent' (trigger-enforced —
--     Postgres CHECK constraints cannot reference another table's column);
--   - one DiDQube may never hold both a human_didqubes AND an agent_didqubes
--     row (trigger-enforced, checked on every insert to either table);
--   - server-side only: RLS enabled, ZERO policies, on all three tables —
--     the same pattern kybe_identity already uses in this project (verified
--     empirically, Phase 0: RLS enabled + 0 policies + service_role has
--     rolbypassrls=true in this project, so service_role reads/writes
--     normally while anon/authenticated get zero access with no policy to
--     grant it); anon/authenticated table privileges explicitly REVOKEd as
--     defense in depth against Supabase's public-schema default grants
--     (verified empirically, Phase 0: kybe_identity itself carries full
--     anon/authenticated table GRANTs by platform default, with RLS as the
--     only actual protection — this migration does not rely on RLS alone);
--   - robot_didqubes/organization_didqubes are NOT created here — no
--     canonical robot/organization root table exists yet (verified, Phase 0).
--
-- Backfill, idempotency and reporting are performed by a separate script
-- (scripts/didqube-phase1-backfill.mjs), never inline in this migration —
-- DDL and data backfill are kept as distinct, independently-reviewable acts.

begin;

create table if not exists public.didqubes (
  didqube_id uuid primary key default gen_random_uuid(),
  subject_class text not null check (subject_class in ('natural_person', 'agent')),
  lifecycle_state text not null default 'active' check (lifecycle_state in ('active', 'superseded')),
  created_at timestamptz not null default now(),
  superseded_by uuid references public.didqubes(didqube_id)
);

comment on table public.didqubes is
  'DiDQube canonical supertype (Phase 1, 2026-09-07). The constitutional identity container — '
  'kybe_identity/agent_root_identity remain the authoritative anchors this binds to; DiDQube is '
  'the stable connective container across them, never a rival identity root. subject_class is '
  'fixed at natural_person|agent only in this phase (robot/organization deferred — no canonical '
  'root table exists for either yet).';

create table if not exists public.human_didqubes (
  didqube_id uuid not null unique references public.didqubes(didqube_id),
  kybe_identity_id uuid not null unique references public.kybe_identity(id),
  subject_class text not null default 'natural_person' check (subject_class = 'natural_person'),
  created_at timestamptz not null default now()
);

comment on table public.human_didqubes is
  'Binds a DiDQube to its human anchor. Established by kybe_identity ALONE — never conditioned on '
  'an active/resolvable root_identity (operator ruling: a RootDID is a reissuable instrument '
  'beneath personhood, not a precondition for the DiDQube itself). UNIQUE on kybe_identity_id '
  'enforces one DiDQube per human anchor; UNIQUE on didqube_id enforces one anchor per DiDQube.';

create table if not exists public.agent_didqubes (
  didqube_id uuid not null unique references public.didqubes(didqube_id),
  agent_root_identity_id uuid not null unique references public.agent_root_identity(id),
  subject_class text not null default 'agent' check (subject_class = 'agent'),
  created_at timestamptz not null default now()
);

comment on table public.agent_didqubes is
  'Binds a DiDQube to its agent anchor (agent_root_identity — agents carry no KybeDID, by design). '
  'UNIQUE on agent_root_identity_id enforces one DiDQube per agent anchor; UNIQUE on didqube_id '
  'enforces one anchor per DiDQube.';

-- ── Trigger: didqube_id's subject_class must match the subtype table it's bound into ──────────
-- A CHECK constraint cannot reference another table's column, so this is enforced in a trigger.
-- Each subtype table's own `subject_class` column (fixed by its own CHECK above) is compared
-- against the SAME-NAMED column on the referenced didqubes row.

create or replace function public.didqube_enforce_subject_class()
returns trigger
language plpgsql
as $$
declare
  v_actual_class text;
begin
  select subject_class into v_actual_class from public.didqubes where didqube_id = new.didqube_id;
  if v_actual_class is null then
    raise exception 'didqube_id % does not exist in public.didqubes', new.didqube_id;
  end if;
  if v_actual_class <> new.subject_class then
    raise exception 'didqube_id % has subject_class=% but % requires subject_class=%',
      new.didqube_id, v_actual_class, TG_TABLE_NAME, new.subject_class;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_human_didqubes_subject_class on public.human_didqubes;
create trigger trg_human_didqubes_subject_class
  before insert or update on public.human_didqubes
  for each row execute function public.didqube_enforce_subject_class();

drop trigger if exists trg_agent_didqubes_subject_class on public.agent_didqubes;
create trigger trg_agent_didqubes_subject_class
  before insert or update on public.agent_didqubes
  for each row execute function public.didqube_enforce_subject_class();

-- ── Trigger: one DiDQube may never hold both a human_didqubes AND an agent_didqubes row ────────
-- UNIQUE on didqube_id within each table already prevents duplicate rows WITHIN the same table;
-- this trigger is what prevents the SAME didqube_id from acquiring a row in the OTHER table too.

create or replace function public.didqube_enforce_single_subtype()
returns trigger
language plpgsql
as $$
begin
  if TG_TABLE_NAME = 'human_didqubes' then
    if exists (select 1 from public.agent_didqubes where didqube_id = new.didqube_id) then
      raise exception 'didqube_id % already has an agent_didqubes binding — a DiDQube may never hold both subtypes', new.didqube_id;
    end if;
  elsif TG_TABLE_NAME = 'agent_didqubes' then
    if exists (select 1 from public.human_didqubes where didqube_id = new.didqube_id) then
      raise exception 'didqube_id % already has a human_didqubes binding — a DiDQube may never hold both subtypes', new.didqube_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_human_didqubes_single_subtype on public.human_didqubes;
create trigger trg_human_didqubes_single_subtype
  before insert on public.human_didqubes
  for each row execute function public.didqube_enforce_single_subtype();

drop trigger if exists trg_agent_didqubes_single_subtype on public.agent_didqubes;
create trigger trg_agent_didqubes_single_subtype
  before insert on public.agent_didqubes
  for each row execute function public.didqube_enforce_single_subtype();

-- ── Server-side only: RLS enabled, zero policies (same pattern kybe_identity already uses) ─────
-- service_role has rolbypassrls=true in this project (verified, Phase 0) so server-side code via
-- getSupabaseServer() reads/writes normally; anon/authenticated get zero rows with no policy to
-- grant them any. Table-level grants are additionally revoked below as defense in depth, since
-- Supabase's public-schema default privileges grant new tables full anon/authenticated table
-- access regardless of RLS (verified empirically against kybe_identity's own grants, Phase 0) —
-- RLS must not be the only thing standing between these tables and the browser.

alter table public.didqubes enable row level security;
alter table public.human_didqubes enable row level security;
alter table public.agent_didqubes enable row level security;

revoke all on public.didqubes from anon, authenticated;
revoke all on public.human_didqubes from anon, authenticated;
revoke all on public.agent_didqubes from anon, authenticated;

commit;
