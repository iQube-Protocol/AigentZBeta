-- ============================================================================
-- Composer v0 Persistence (Bridge to iQube Registry)
-- Stores ExperienceQube data in Supabase while preserving iQube-shaped payloads
-- ============================================================================

create table if not exists composer_experience_qubes (
  id text primary key,
  tenant_id text not null,
  creator_id text not null,
  template_id text not null,
  status text not null default 'draft' check (status in ('draft', 'building', 'testing', 'published', 'archived')),
  meta_qube jsonb not null default '{}'::jsonb,
  blak_qube jsonb not null default '{}'::jsonb,
  token_qube jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_composer_experience_tenant on composer_experience_qubes(tenant_id);
create index if not exists idx_composer_experience_creator on composer_experience_qubes(creator_id);
create index if not exists idx_composer_experience_status on composer_experience_qubes(status);
create index if not exists idx_composer_experience_template on composer_experience_qubes(template_id);

create table if not exists composer_sessions (
  id text primary key,
  tenant_id text not null,
  user_id text not null,
  template_id text not null,
  current_step integer not null default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  expires_at timestamptz
);

create index if not exists idx_composer_sessions_tenant on composer_sessions(tenant_id);
create index if not exists idx_composer_sessions_user on composer_sessions(user_id);
create index if not exists idx_composer_sessions_status on composer_sessions(status);
create index if not exists idx_composer_sessions_template on composer_sessions(template_id);
