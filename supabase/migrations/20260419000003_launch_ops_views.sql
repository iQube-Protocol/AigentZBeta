-- Launch Ops views for dashboards and reporting

-- ── v_program_health ──────────────────────────────────────────────────────────
-- One row per program with task completion rates and overall health

create or replace view v_program_health as
select
  p.id                                                        as program_id,
  p.slug,
  p.name,
  p.status,
  p.status_color,
  p.priority,
  p.owner,
  count(t.id)                                                 as total_tasks,
  count(t.id) filter (where t.status = 'done')               as done_tasks,
  count(t.id) filter (where t.status = 'doing')              as doing_tasks,
  count(t.id) filter (where t.status = 'blocked')            as blocked_tasks,
  count(t.id) filter (where t.status = 'todo')               as todo_tasks,
  round(
    count(t.id) filter (where t.status = 'done')::numeric
    / nullif(count(t.id), 0) * 100,
    1
  )                                                           as completion_pct,
  count(pa.id)                                                as total_proof_assets,
  count(pa.id) filter (where pa.is_approved)                  as approved_proof_assets,
  p.created_at,
  p.updated_at
from launch_programs p
left join launch_sprint_tasks t  on t.program_id = p.id
left join launch_proof_assets pa on pa.program_id = p.id
group by p.id, p.slug, p.name, p.status, p.status_color,
         p.priority, p.owner, p.created_at, p.updated_at;

-- ── v_week_progress_summary ───────────────────────────────────────────────────
-- Per-week task summary with counts

create or replace view v_week_progress_summary as
select
  w.id                                                        as week_id,
  w.program_id,
  w.week_number,
  w.label,
  w.status,
  w.status_color,
  w.goal,
  count(t.id)                                                 as total_tasks,
  count(t.id) filter (where t.status = 'done')               as done_tasks,
  count(t.id) filter (where t.status = 'doing')              as doing_tasks,
  count(t.id) filter (where t.status = 'blocked')            as blocked_tasks,
  count(t.id) filter (where t.status = 'todo')               as todo_tasks,
  count(t.id) filter (where t.priority = 'critical')         as critical_tasks,
  round(
    count(t.id) filter (where t.status = 'done')::numeric
    / nullif(count(t.id), 0) * 100,
    1
  )                                                           as completion_pct
from launch_sprint_weeks w
left join launch_sprint_tasks t on t.week_id = w.id
group by w.id, w.program_id, w.week_number, w.label,
         w.status, w.status_color, w.goal;

-- ── v_readiness_dashboard ─────────────────────────────────────────────────────
-- Latest readiness score per bucket per program (pivoted for dashboard display)

create or replace view v_readiness_dashboard as
select
  r.program_id,
  r.report_id,
  wr.week_number,
  max(case when r.bucket = 'offer'    then r.score::text end) as offer_score,
  max(case when r.bucket = 'audience' then r.score::text end) as audience_score,
  max(case when r.bucket = 'proof'    then r.score::text end) as proof_score,
  max(case when r.bucket = 'ops'      then r.score::text end) as ops_score,
  max(case when r.bucket = 'story'    then r.score::text end) as story_score,
  count(*) filter (where r.score = 'green')                   as green_count,
  count(*) filter (where r.score = 'yellow')                  as yellow_count,
  count(*) filter (where r.score = 'red')                     as red_count
from launch_readiness_scores r
left join launch_weekly_reports wr on wr.id = r.report_id
group by r.program_id, r.report_id, wr.week_number;

-- ── v_proof_library ───────────────────────────────────────────────────────────
-- Approved proof assets enriched with segment and offer labels

create or replace view v_proof_library as
select
  pa.id,
  pa.program_id,
  pa.asset_type,
  pa.source_channel,
  pa.title,
  pa.body,
  pa.asset_url,
  pa.is_approved,
  pa.metadata,
  pa.created_at,
  seg.name  as segment_name,
  seg.audience_type,
  o.name    as offer_name,
  o.tier    as offer_tier
from launch_proof_assets pa
left join launch_audience_segments seg on seg.id = pa.source_segment_id
left join launch_offers             o  on o.id   = pa.source_offer_id;

-- ── v_marketa_today ───────────────────────────────────────────────────────────
-- Operator daily summary: active programs, current week, today's tasks

create or replace view v_marketa_today as
select
  p.id                                                        as program_id,
  p.slug,
  p.name,
  p.status,
  p.status_color,
  -- current week
  w.week_number                                               as current_week_number,
  w.label                                                     as current_week_label,
  w.goal                                                      as current_week_goal,
  w.status                                                    as week_status,
  -- today's task counts
  count(t.id) filter (
    where t.status in ('todo','doing')
    and (t.due_date = current_date or t.due_date is null)
  )                                                           as todays_open_tasks,
  count(t.id) filter (where t.status = 'blocked')            as blocked_tasks,
  count(t.id) filter (where t.priority = 'critical'
    and t.status not in ('done','canceled'))                  as critical_open_tasks,
  -- program totals
  count(t.id) filter (where t.status = 'done')               as done_tasks_total,
  count(t.id)                                                 as all_tasks_total
from launch_programs p
join launch_sprint_weeks w
  on  w.program_id = p.id
  and w.status in ('todo','doing')   -- most recent active week
left join launch_sprint_tasks t on t.program_id = p.id
where p.status = 'active'
group by p.id, p.slug, p.name, p.status, p.status_color,
         w.week_number, w.label, w.goal, w.status
order by w.week_number;

-- ── v_commercial_summary ─────────────────────────────────────────────────────
-- Aggregate commercial metrics per program across all reports

create or replace view v_commercial_summary as
select
  cm.program_id,
  p.slug        as program_slug,
  p.name        as program_name,
  sum(cm.orders)                              as total_orders,
  sum(cm.revenue_cents)                       as total_revenue_cents,
  round(sum(cm.revenue_cents)::numeric
    / nullif(sum(cm.orders), 0), 0)           as blended_aov_cents,
  round(avg(cm.conversion_rate), 3)           as avg_conversion_rate,
  count(distinct cm.report_id)                as weeks_reported
from launch_commercial_metrics cm
join launch_programs p on p.id = cm.program_id
group by cm.program_id, p.slug, p.name;

-- ── v_channel_summary ────────────────────────────────────────────────────────
-- Aggregate channel metrics per program per channel across all reports

create or replace view v_channel_summary as
select
  cm.program_id,
  cm.channel_name,
  sum(cm.sent_count)                          as total_sent,
  round(avg(cm.open_rate), 3)                 as avg_open_rate,
  round(avg(cm.click_rate), 3)                as avg_click_rate,
  round(avg(cm.reply_rate), 3)                as avg_reply_rate,
  sum(cm.post_count)                          as total_posts,
  sum(cm.share_count)                         as total_shares,
  sum(cm.engaged_comment_count)               as total_engaged_comments,
  sum(cm.follow_count)                        as total_follows,
  round(avg(cm.growth_rate), 3)               as avg_growth_rate,
  count(distinct cm.report_id)                as weeks_reported
from launch_channel_metrics cm
group by cm.program_id, cm.channel_name;
