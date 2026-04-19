-- Launch Ops: Stored Procedures / RPCs

-- ── rpc_mark_task_status ──────────────────────────────────────────────────────
-- Update a single task's status and optionally its status_color.

create or replace function rpc_mark_task_status(
  p_task_id     uuid,
  p_status      lo_task_status,
  p_color       lo_status_color default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_color lo_status_color;
begin
  -- Derive sensible default color from status when not provided
  v_color := coalesce(p_color,
    case p_status
      when 'done'    then 'green'::lo_status_color
      when 'doing'   then 'blue'::lo_status_color
      when 'blocked' then 'red'::lo_status_color
      when 'todo'    then 'yellow'::lo_status_color
      else 'gray'::lo_status_color
    end
  );

  update launch_sprint_tasks
  set status       = p_status,
      status_color = v_color,
      updated_at   = now()
  where id = p_task_id;
end;
$$;

-- ── rpc_upsert_readiness_for_week ─────────────────────────────────────────────
-- Upsert a single readiness bucket score for a given report.

create or replace function rpc_upsert_readiness_for_week(
  p_program_id uuid,
  p_report_id  uuid,
  p_bucket     lo_readiness_bucket,
  p_score      lo_readiness_score,
  p_notes      text default null
)
returns void
language plpgsql
security definer
as $$
begin
  insert into launch_readiness_scores (program_id, report_id, bucket, score, notes)
  values (p_program_id, p_report_id, p_bucket, p_score, p_notes)
  on conflict (program_id, report_id, bucket)
  do update set
    score      = excluded.score,
    notes      = excluded.notes,
    updated_at = now();
end;
$$;

-- ── rpc_upsert_weekly_report ──────────────────────────────────────────────────
-- Create or update a weekly report record.

create or replace function rpc_upsert_weekly_report(
  p_program_id           uuid,
  p_week_number          int,
  p_status               lo_task_status default 'todo',
  p_summary              text default null,
  p_top_wins             jsonb default '[]',
  p_top_losses           jsonb default '[]',
  p_best_messages        jsonb default '[]',
  p_top_objections       jsonb default '[]',
  p_next_week_priorities jsonb default '[]',
  p_recommendation       lo_recommendation default 'continue_validation',
  p_recommendation_reason text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
  v_color lo_status_color;
begin
  v_color := case p_status
    when 'done'    then 'green'::lo_status_color
    when 'doing'   then 'blue'::lo_status_color
    when 'blocked' then 'red'::lo_status_color
    else 'yellow'::lo_status_color
  end;

  insert into launch_weekly_reports (
    program_id, week_number, status, status_color,
    summary, top_wins, top_losses, best_messages,
    top_objections, next_week_priorities,
    recommendation, recommendation_reason
  ) values (
    p_program_id, p_week_number, p_status, v_color,
    p_summary, p_top_wins, p_top_losses, p_best_messages,
    p_top_objections, p_next_week_priorities,
    p_recommendation, p_recommendation_reason
  )
  on conflict (program_id, week_number)
  do update set
    status                = excluded.status,
    status_color          = excluded.status_color,
    summary               = excluded.summary,
    top_wins              = excluded.top_wins,
    top_losses            = excluded.top_losses,
    best_messages         = excluded.best_messages,
    top_objections        = excluded.top_objections,
    next_week_priorities  = excluded.next_week_priorities,
    recommendation        = excluded.recommendation,
    recommendation_reason = excluded.recommendation_reason,
    updated_at            = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ── rpc_capture_proof_asset ───────────────────────────────────────────────────
-- Insert a new proof asset (testimonial, quote, screenshot, etc.).

create or replace function rpc_capture_proof_asset(
  p_program_id        uuid,
  p_asset_type        lo_proof_asset_type,
  p_title             text default null,
  p_body              text default null,
  p_asset_url         text default null,
  p_source_channel    lo_channel_name default null,
  p_source_segment_id uuid default null,
  p_source_offer_id   uuid default null,
  p_is_approved       boolean default false,
  p_metadata          jsonb default '{}'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into launch_proof_assets (
    program_id, asset_type, title, body, asset_url,
    source_channel, source_segment_id, source_offer_id,
    is_approved, metadata
  ) values (
    p_program_id, p_asset_type, p_title, p_body, p_asset_url,
    p_source_channel, p_source_segment_id, p_source_offer_id,
    p_is_approved, p_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ── rpc_roll_week_forward ─────────────────────────────────────────────────────
-- Mark the given week as done, activate the next week (if not already active).

create or replace function rpc_roll_week_forward(
  p_program_id   uuid,
  p_from_week_no int
)
returns void
language plpgsql
security definer
as $$
begin
  -- Close the current week
  update launch_sprint_weeks
  set status       = 'done',
      status_color = 'green',
      updated_at   = now()
  where program_id  = p_program_id
    and week_number = p_from_week_no;

  -- Open the next week if it exists and is still in 'todo'
  update launch_sprint_weeks
  set status       = 'doing',
      status_color = 'blue',
      updated_at   = now()
  where program_id  = p_program_id
    and week_number = p_from_week_no + 1
    and status      = 'todo';
end;
$$;

-- ── rpc_program_readiness_verdict ─────────────────────────────────────────────
-- Returns true when the "mostly green, no critical reds" rule is satisfied
-- for a given report (all 5 buckets scored, fewer than 2 reds, at least 3 greens).

create or replace function rpc_program_readiness_verdict(
  p_report_id uuid
)
returns boolean
language sql
security definer
stable
as $$
  select
    count(*) = 5                                                     -- all buckets scored
    and count(*) filter (where score = 'red'::lo_readiness_score) < 2
    and count(*) filter (where score = 'green'::lo_readiness_score) >= 3
  from launch_readiness_scores
  where report_id = p_report_id;
$$;
