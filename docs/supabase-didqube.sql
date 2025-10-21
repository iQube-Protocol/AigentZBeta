-- DiDQube: Additive Supabase migration (Phase 1)
-- Run in Supabase SQL editor. Non-breaking, additive only.

create extension if not exists pgcrypto;

create table if not exists public.kybe_identity (
  id uuid primary key default gen_random_uuid(),
  kybe_did text unique not null,
  encrypted_soul_key text,
  state text check (state in ('active','revoked','deceased')) default 'active',
  issued_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.root_identity (
  id uuid primary key default gen_random_uuid(),
  kybe_id uuid references public.kybe_identity(id) on delete set null,
  kybe_hash text,
  did_uri text unique not null,
  kyc_status text check (kyc_status in ('unverified','kycd','revoked')) default 'unverified',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.persona (
  id uuid primary key default gen_random_uuid(),
  root_id uuid references public.root_identity(id) on delete set null,
  fio_handle text,
  default_identity_state text check (default_identity_state in ('anonymous','semi_anonymous','semi_identifiable','identifiable')) not null default 'semi_anonymous',
  app_origin text,
  world_id_status text check (world_id_status in ('unverified','verified_human','agent_declared')) default 'unverified',
  created_at timestamptz default now()
);

create table if not exists public.persona_agent_binding (
  persona_id uuid references public.persona(id) on delete cascade,
  agent_id text not null,
  is_primary boolean default false,
  created_at timestamptz default now(),
  primary key (persona_id, agent_id)
);

create table if not exists public.hcp_profile (
  persona_id uuid primary key references public.persona(id) on delete cascade,
  preference_ptr text,
  scopes jsonb,
  revocation jsonb,
  updated_at timestamptz default now()
);

-- RLS enablement (adjust policies later as needed)
alter table public.kybe_identity enable row level security;
alter table public.root_identity enable row level security;
alter table public.persona enable row level security;
alter table public.persona_agent_binding enable row level security;
alter table public.hcp_profile enable row level security;

-- Basic permissive policies (tighten in later sprints)
create policy if not exists "persona read own or public app" on public.persona
  for select using (true);
create policy if not exists "persona insert by authenticated" on public.persona
  for insert with check (auth.role() = 'authenticated');

create policy if not exists "bindings read" on public.persona_agent_binding
  for select using (true);
create policy if not exists "bindings write by authenticated" on public.persona_agent_binding
  for insert with check (auth.role() = 'authenticated');
