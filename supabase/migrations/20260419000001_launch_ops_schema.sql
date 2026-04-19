-- Launch Ops schema: programs, sprint, proof, reporting
-- Tables for metaKnyt investor-first activation → Kickstarter relaunch

-- ── Enums ─────────────────────────────────────────────────────────────────────

do $$ begin
  create type lo_program_status as enum ('draft','active','paused','done','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_status_color as enum ('gray','blue','yellow','green','red');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_priority as enum ('low','medium','high','critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_owner_role as enum ('Marketa','Founder','Ops','Design','Dev','Community');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_objective_type as enum (
    'direct_sales','message_fit','proof_build','halo_growth','launch_readiness'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_metric_type as enum (
    'orders','revenue','aov','conversion_rate','proof_assets',
    'engaged_followers','kickstarter_follows','readiness_score'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_target_type as enum ('increase','optimize','stabilize','reach_threshold');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_audience_type as enum (
    'investor_top','investor_warm','investor_dormant','community_warm','public_cold'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_offer_type as enum ('digital','bundle','exclusive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_offer_tier as enum ('entry','premium','founding');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_offer_goal as enum ('fast_conversion','high_value_conversion','investor_activation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_channel_name as enum (
    'email','sms','x','instagram','linkedin','kickstarter_prelaunch'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_channel_role as enum (
    'convert','nudge','signal','visual_halo','legitimacy','follow_capture'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_task_type as enum (
    'strategy','copy','offer_design','ops_copy','crm','analytics','content_ops',
    'faq','creative','email','direct_outreach','sms','research','community',
    'social','product','growth','decision','memo','proof_build'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_task_status as enum ('todo','doing','blocked','done','canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_proof_asset_type as enum (
    'testimonial','quote','screenshot','comment',
    'buyer_reaction','supporter_post','referral_event'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_readiness_bucket as enum ('offer','audience','proof','ops','story');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_readiness_score as enum ('red','yellow','green');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_recommendation as enum (
    'continue_validation','move_to_prelaunch_concentration','prepare_relaunch'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lo_decision_rule as enum ('relaunch_on_evidence','mostly_green_rule');
exception when duplicate_object then null; end $$;

-- ── Timestamp trigger ──────────────────────────────────────────────────────────

create or replace function lo_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── Tables ────────────────────────────────────────────────────────────────────

create table if not exists launch_programs (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  status        lo_program_status not null default 'draft',
  status_color  lo_status_color not null default 'gray',
  priority      lo_priority not null default 'medium',
  owner         lo_owner_role not null default 'Marketa',
  decision_rule lo_decision_rule not null default 'relaunch_on_evidence',
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace trigger trg_launch_programs_updated
before update on launch_programs
for each row execute function lo_set_updated_at();

create table if not exists launch_objectives (
  id             uuid primary key default gen_random_uuid(),
  program_id     uuid not null references launch_programs(id) on delete cascade,
  code           text not null,
  objective_type lo_objective_type not null,
  metric_type    lo_metric_type not null,
  target_type    lo_target_type not null,
  sort_order     int not null default 0,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique(program_id, code)
);

create or replace trigger trg_launch_objectives_updated
before update on launch_objectives
for each row execute function lo_set_updated_at();

create table if not exists launch_audience_segments (
  id             uuid primary key default gen_random_uuid(),
  program_id     uuid not null references launch_programs(id) on delete cascade,
  code           text not null,
  audience_type  lo_audience_type not null,
  name           text not null,
  size_estimate  int,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique(program_id, code)
);

create or replace trigger trg_launch_audience_updated
before update on launch_audience_segments
for each row execute function lo_set_updated_at();

create table if not exists launch_offers (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references launch_programs(id) on delete cascade,
  code        text not null,
  name        text not null,
  offer_type  lo_offer_type not null,
  tier        lo_offer_tier not null,
  goal        lo_offer_goal not null,
  price_cents int,
  is_active   boolean not null default true,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(program_id, code)
);

create or replace trigger trg_launch_offers_updated
before update on launch_offers
for each row execute function lo_set_updated_at();

create table if not exists launch_channels (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references launch_programs(id) on delete cascade,
  channel_name lo_channel_name not null,
  channel_role lo_channel_role not null,
  is_active    boolean not null default true,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(program_id, channel_name)
);

create or replace trigger trg_launch_channels_updated
before update on launch_channels
for each row execute function lo_set_updated_at();

create table if not exists launch_sprint_weeks (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references launch_programs(id) on delete cascade,
  week_number int not null check (week_number between 1 and 4),
  label       text not null,
  status      lo_task_status not null default 'todo',
  status_color lo_status_color not null default 'yellow',
  goal        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(program_id, week_number)
);

create or replace trigger trg_launch_weeks_updated
before update on launch_sprint_weeks
for each row execute function lo_set_updated_at();

create table if not exists launch_sprint_tasks (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references launch_programs(id) on delete cascade,
  week_id      uuid references launch_sprint_weeks(id) on delete set null,
  code         text not null,
  title        text not null,
  task_type    lo_task_type not null,
  owner        lo_owner_role not null,
  priority     lo_priority not null default 'medium',
  status       lo_task_status not null default 'todo',
  status_color lo_status_color not null default 'yellow',
  due_date     date,
  sort_order   int not null default 0,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(program_id, code)
);

create or replace trigger trg_launch_tasks_updated
before update on launch_sprint_tasks
for each row execute function lo_set_updated_at();

create table if not exists launch_proof_assets (
  id                uuid primary key default gen_random_uuid(),
  program_id        uuid not null references launch_programs(id) on delete cascade,
  asset_type        lo_proof_asset_type not null,
  source_channel    lo_channel_name,
  source_segment_id uuid references launch_audience_segments(id) on delete set null,
  source_offer_id   uuid references launch_offers(id) on delete set null,
  title             text,
  body              text,
  asset_url         text,
  is_approved       boolean not null default false,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create or replace trigger trg_launch_proof_updated
before update on launch_proof_assets
for each row execute function lo_set_updated_at();

create table if not exists launch_weekly_reports (
  id                    uuid primary key default gen_random_uuid(),
  program_id            uuid not null references launch_programs(id) on delete cascade,
  week_number           int not null check (week_number between 1 and 52),
  status                lo_task_status not null default 'todo',
  status_color          lo_status_color not null default 'yellow',
  summary               text,
  top_wins              jsonb not null default '[]'::jsonb,
  top_losses            jsonb not null default '[]'::jsonb,
  best_messages         jsonb not null default '[]'::jsonb,
  top_objections        jsonb not null default '[]'::jsonb,
  next_week_priorities  jsonb not null default '[]'::jsonb,
  recommendation        lo_recommendation not null default 'continue_validation',
  recommendation_reason text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(program_id, week_number)
);

create or replace trigger trg_launch_reports_updated
before update on launch_weekly_reports
for each row execute function lo_set_updated_at();

create table if not exists launch_readiness_scores (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references launch_programs(id) on delete cascade,
  report_id  uuid references launch_weekly_reports(id) on delete cascade,
  bucket     lo_readiness_bucket not null,
  score      lo_readiness_score not null default 'red',
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_id, report_id, bucket)
);

create or replace trigger trg_launch_readiness_updated
before update on launch_readiness_scores
for each row execute function lo_set_updated_at();

create table if not exists launch_channel_metrics (
  id                    uuid primary key default gen_random_uuid(),
  program_id            uuid not null references launch_programs(id) on delete cascade,
  report_id             uuid references launch_weekly_reports(id) on delete cascade,
  channel_name          lo_channel_name not null,
  sent_count            int not null default 0,
  open_rate             numeric(6,3),
  click_rate            numeric(6,3),
  reply_rate            numeric(6,3),
  post_count            int not null default 0,
  share_count           int not null default 0,
  save_count            int not null default 0,
  engaged_comment_count int not null default 0,
  follow_count          int not null default 0,
  growth_rate           numeric(6,3),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create or replace trigger trg_launch_channel_metrics_updated
before update on launch_channel_metrics
for each row execute function lo_set_updated_at();

create table if not exists launch_commercial_metrics (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references launch_programs(id) on delete cascade,
  report_id       uuid references launch_weekly_reports(id) on delete cascade,
  offer_id        uuid references launch_offers(id) on delete set null,
  segment_id      uuid references launch_audience_segments(id) on delete set null,
  orders          int not null default 0,
  revenue_cents   bigint not null default 0,
  aov_cents       bigint,
  conversion_rate numeric(6,3),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace trigger trg_launch_commercial_updated
before update on launch_commercial_metrics
for each row execute function lo_set_updated_at();

create table if not exists launch_program_members (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references launch_programs(id) on delete cascade,
  user_id    uuid not null,
  role       text not null check (role in ('owner','editor','viewer')),
  can_write  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_id, user_id)
);

create or replace trigger trg_launch_members_updated
before update on launch_program_members
for each row execute function lo_set_updated_at();

-- ── Indexes ────────────────────────────────────────────────────────────────────

create index if not exists idx_lo_objectives_program on launch_objectives(program_id);
create index if not exists idx_lo_segments_program   on launch_audience_segments(program_id);
create index if not exists idx_lo_offers_program     on launch_offers(program_id);
create index if not exists idx_lo_channels_program   on launch_channels(program_id);
create index if not exists idx_lo_weeks_program      on launch_sprint_weeks(program_id);
create index if not exists idx_lo_tasks_program      on launch_sprint_tasks(program_id);
create index if not exists idx_lo_tasks_week         on launch_sprint_tasks(week_id);
create index if not exists idx_lo_proof_program      on launch_proof_assets(program_id);
create index if not exists idx_lo_reports_program    on launch_weekly_reports(program_id);
create index if not exists idx_lo_readiness_report   on launch_readiness_scores(report_id);
create index if not exists idx_lo_members_program    on launch_program_members(program_id);
create index if not exists idx_lo_members_user       on launch_program_members(user_id);
