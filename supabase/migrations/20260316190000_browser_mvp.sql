create extension if not exists pgcrypto;

create table if not exists public.browser_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  persona_id text,
  aigent_id text not null,
  model_id text,
  cartridge_id text,
  codex_id text,
  provider text not null check (provider in ('browserbase', 'browserless', 'self_hosted', 'mock')),
  provider_session_id text not null,
  provider_context_id text,
  execution_mode text not null check (execution_mode in ('playwright', 'stagehand', 'browser_use')),
  trust_mode text not null check (trust_mode in ('managed', 'private-managed', 'self-hosted')),
  privacy_mode text not null check (privacy_mode in ('standard', 'sensitive', 'sealed')),
  status text not null check (status in ('active', 'suspended', 'closed', 'error')),
  current_url text,
  current_title text,
  current_domain text,
  recording_policy jsonb not null default '{}'::jsonb,
  confirmation_policy jsonb not null default '{}'::jsonb,
  provider_metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists browser_sessions_user_idx on public.browser_sessions(user_id);
create index if not exists browser_sessions_status_idx on public.browser_sessions(status);
create index if not exists browser_sessions_provider_idx on public.browser_sessions(provider);
create index if not exists browser_sessions_started_at_idx on public.browser_sessions(started_at desc);

create table if not exists public.browser_surface_state (
  session_id uuid primary key references public.browser_sessions(id) on delete cascade,
  mounted boolean not null default false,
  mount_mode text not null default 'overlay' check (mount_mode in ('overlay', 'docked', 'panel')),
  shell_surface_state text not null default 'expanded' check (shell_surface_state in ('expanded', 'minimized', 'hidden', 'docked')),
  focused boolean not null default false,
  takeover_active boolean not null default false,
  visible boolean not null default false,
  bounds jsonb not null default '{}'::jsonb,
  live_view_ref jsonb not null default '{}'::jsonb,
  last_mounted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.browser_history_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.browser_sessions(id) on delete cascade,
  seq bigint generated always as identity,
  occurred_at timestamptz not null default now(),
  action_type text not null check (
    action_type in (
      'session_created',
      'session_mounted',
      'navigate',
      'back',
      'forward',
      'refresh',
      'extract',
      'act',
      'submit',
      'download',
      'takeover_start',
      'takeover_end',
      'resume',
      'save',
      'close',
      'error'
    )
  ),
  actor_type text not null check (actor_type in ('user', 'agent', 'system')),
  actor_id text,
  execution_mode text check (execution_mode in ('playwright', 'stagehand', 'browser_use')),
  url text,
  title text,
  domain text,
  intent text,
  step_label text,
  details jsonb not null default '{}'::jsonb,
  receipt_ref text
);

create index if not exists browser_history_session_idx on public.browser_history_events(session_id, occurred_at desc);
create index if not exists browser_history_action_idx on public.browser_history_events(action_type);

create table if not exists public.browser_artifacts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.browser_sessions(id) on delete cascade,
  user_id text not null,
  artifact_type text not null check (
    artifact_type in (
      'extract',
      'screenshot',
      'download',
      'trace',
      'har',
      'pdf',
      'summary',
      'dom_snapshot'
    )
  ),
  source_url text,
  source_title text,
  mime_type text,
  storage_bucket text,
  storage_path text,
  content_hash text,
  created_by_actor_type text not null check (created_by_actor_type in ('user', 'agent', 'system')),
  created_by_actor_id text,
  execution_mode text check (execution_mode in ('playwright', 'stagehand', 'browser_use')),
  metadata jsonb not null default '{}'::jsonb,
  receipt_ref text,
  created_at timestamptz not null default now()
);

create index if not exists browser_artifacts_session_idx on public.browser_artifacts(session_id, created_at desc);
create index if not exists browser_artifacts_user_idx on public.browser_artifacts(user_id, created_at desc);
create index if not exists browser_artifacts_type_idx on public.browser_artifacts(artifact_type);

create table if not exists public.browser_auth_refs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.browser_sessions(id) on delete set null,
  user_id text not null,
  provider text not null,
  provider_context_id text not null,
  encrypted_reference text not null,
  scope jsonb not null default '[]'::jsonb,
  rotation_policy text not null default 'on-demand',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists browser_auth_refs_user_idx on public.browser_auth_refs(user_id, active);

create table if not exists public.browser_receipts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.browser_sessions(id) on delete cascade,
  history_event_id uuid references public.browser_history_events(id) on delete set null,
  receipt_type text not null,
  receipt_hash text not null,
  receipt_uri text,
  dvn_network text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists browser_receipts_session_idx on public.browser_receipts(session_id, created_at desc);

create table if not exists public.browser_saves (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.browser_sessions(id) on delete cascade,
  artifact_id uuid references public.browser_artifacts(id) on delete set null,
  history_event_id uuid references public.browser_history_events(id) on delete set null,
  destination_type text not null check (destination_type in ('estate', 'codex', 'cartridge')),
  destination_id text,
  saved_by text not null,
  metadata jsonb not null default '{}'::jsonb,
  receipt_ref text,
  created_at timestamptz not null default now()
);

create index if not exists browser_saves_session_idx on public.browser_saves(session_id, created_at desc);

alter table public.browser_sessions enable row level security;
alter table public.browser_surface_state enable row level security;
alter table public.browser_history_events enable row level security;
alter table public.browser_artifacts enable row level security;
alter table public.browser_auth_refs enable row level security;
alter table public.browser_receipts enable row level security;
alter table public.browser_saves enable row level security;
