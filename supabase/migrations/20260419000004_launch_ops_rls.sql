-- Launch Ops: Row Level Security policies

-- Enable RLS on all launch_* tables
alter table launch_programs          enable row level security;
alter table launch_objectives        enable row level security;
alter table launch_audience_segments enable row level security;
alter table launch_offers            enable row level security;
alter table launch_channels          enable row level security;
alter table launch_sprint_weeks      enable row level security;
alter table launch_sprint_tasks      enable row level security;
alter table launch_proof_assets      enable row level security;
alter table launch_weekly_reports    enable row level security;
alter table launch_readiness_scores  enable row level security;
alter table launch_channel_metrics   enable row level security;
alter table launch_commercial_metrics enable row level security;
alter table launch_program_members   enable row level security;

-- ── Helper: is_program_member ─────────────────────────────────────────────────
-- Returns true if the current user is a member of the given program.
create or replace function lo_is_program_member(p_program_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from launch_program_members
    where program_id = p_program_id
      and user_id = auth.uid()
  );
$$;

-- Returns the role of the current user in a program (null if not a member).
create or replace function lo_program_role(p_program_id uuid)
returns text
language sql
security definer
stable
as $$
  select role from launch_program_members
  where program_id = p_program_id
    and user_id = auth.uid()
  limit 1;
$$;

-- ── launch_programs ───────────────────────────────────────────────────────────

create policy lo_programs_select on launch_programs
  for select using (lo_is_program_member(id));

create policy lo_programs_insert on launch_programs
  for insert with check (true);  -- service role only via API

create policy lo_programs_update on launch_programs
  for update using (lo_program_role(id) in ('owner','editor'));

create policy lo_programs_delete on launch_programs
  for delete using (lo_program_role(id) = 'owner');

-- ── Generic helper macro for child tables ─────────────────────────────────────
-- All child tables share the same pattern: member can select, owner/editor can write.

-- launch_objectives
create policy lo_objectives_select on launch_objectives
  for select using (lo_is_program_member(program_id));

create policy lo_objectives_write on launch_objectives
  for all using (lo_program_role(program_id) in ('owner','editor'));

-- launch_audience_segments
create policy lo_segments_select on launch_audience_segments
  for select using (lo_is_program_member(program_id));

create policy lo_segments_write on launch_audience_segments
  for all using (lo_program_role(program_id) in ('owner','editor'));

-- launch_offers
create policy lo_offers_select on launch_offers
  for select using (lo_is_program_member(program_id));

create policy lo_offers_write on launch_offers
  for all using (lo_program_role(program_id) in ('owner','editor'));

-- launch_channels
create policy lo_channels_select on launch_channels
  for select using (lo_is_program_member(program_id));

create policy lo_channels_write on launch_channels
  for all using (lo_program_role(program_id) in ('owner','editor'));

-- launch_sprint_weeks
create policy lo_weeks_select on launch_sprint_weeks
  for select using (lo_is_program_member(program_id));

create policy lo_weeks_write on launch_sprint_weeks
  for all using (lo_program_role(program_id) in ('owner','editor'));

-- launch_sprint_tasks
create policy lo_tasks_select on launch_sprint_tasks
  for select using (lo_is_program_member(program_id));

create policy lo_tasks_write on launch_sprint_tasks
  for all using (lo_program_role(program_id) in ('owner','editor'));

-- launch_proof_assets
create policy lo_proof_select on launch_proof_assets
  for select using (lo_is_program_member(program_id));

create policy lo_proof_write on launch_proof_assets
  for all using (lo_program_role(program_id) in ('owner','editor'));

-- launch_weekly_reports
create policy lo_reports_select on launch_weekly_reports
  for select using (lo_is_program_member(program_id));

create policy lo_reports_write on launch_weekly_reports
  for all using (lo_program_role(program_id) in ('owner','editor'));

-- launch_readiness_scores
create policy lo_readiness_select on launch_readiness_scores
  for select using (lo_is_program_member(program_id));

create policy lo_readiness_write on launch_readiness_scores
  for all using (lo_program_role(program_id) in ('owner','editor'));

-- launch_channel_metrics
create policy lo_ch_metrics_select on launch_channel_metrics
  for select using (lo_is_program_member(program_id));

create policy lo_ch_metrics_write on launch_channel_metrics
  for all using (lo_program_role(program_id) in ('owner','editor'));

-- launch_commercial_metrics
create policy lo_comm_metrics_select on launch_commercial_metrics
  for select using (lo_is_program_member(program_id));

create policy lo_comm_metrics_write on launch_commercial_metrics
  for all using (lo_program_role(program_id) in ('owner','editor'));

-- launch_program_members
-- Any member can see the member list; only owner can manage membership.
create policy lo_members_select on launch_program_members
  for select using (lo_is_program_member(program_id));

create policy lo_members_write on launch_program_members
  for all using (lo_program_role(program_id) = 'owner');
