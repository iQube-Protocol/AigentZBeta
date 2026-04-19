import { createClient } from '@supabase/supabase-js';
import type {
  LaunchProgram,
  LaunchSprintWeek,
  LaunchSprintTask,
  LaunchProofAsset,
  LaunchWeeklyReport,
  LaunchReadinessScore,
  LaunchChannelMetrics,
  LaunchCommercialMetrics,
  VProgramHealth,
  VWeekProgressSummary,
  VReadinessDashboard,
  VMarketaToday,
  LaunchOpsProgramData,
  LoTaskStatus,
  LoStatusColor,
  LoReadinessBucket,
  LoReadinessScore,
  LoRecommendation,
  LoProofAssetType,
  LoChannelName,
} from '@/types/launchOps';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ── Program ────────────────────────────────────────────────────────────────────

export async function getProgram(slug: string): Promise<LaunchProgram | null> {
  const { data, error } = await getSupabase()
    .from('launch_programs')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) return null;
  return data as LaunchProgram;
}

export async function getProgramHealth(slug: string): Promise<VProgramHealth | null> {
  const { data, error } = await getSupabase()
    .from('v_program_health')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) return null;
  return data as VProgramHealth;
}

export async function getMarketaToday(): Promise<VMarketaToday[]> {
  const { data, error } = await getSupabase()
    .from('v_marketa_today')
    .select('*');
  if (error) return [];
  return (data ?? []) as VMarketaToday[];
}

// ── Weeks + Tasks ──────────────────────────────────────────────────────────────

export async function getWeeksWithTasks(programId: string): Promise<LaunchOpsProgramData['weeks']> {
  const supabase = getSupabase();

  const [weeksResult, tasksResult, weekSummaryResult] = await Promise.all([
    supabase.from('launch_sprint_weeks').select('*').eq('program_id', programId).order('week_number'),
    supabase.from('launch_sprint_tasks').select('*').eq('program_id', programId).order('sort_order'),
    supabase.from('v_week_progress_summary').select('*').eq('program_id', programId),
  ]);

  const weeks = (weeksResult.data ?? []) as LaunchSprintWeek[];
  const tasks = (tasksResult.data ?? []) as LaunchSprintTask[];
  const summaries = (weekSummaryResult.data ?? []) as VWeekProgressSummary[];

  return weeks.map((w) => {
    const summary = summaries.find((s) => s.week_id === w.id);
    return {
      ...w,
      tasks: tasks.filter((t) => t.week_id === w.id),
      completion_pct: summary?.completion_pct ?? null,
    };
  });
}

export async function updateTaskStatus(
  taskId: string,
  status: LoTaskStatus,
  color?: LoStatusColor,
): Promise<void> {
  await getSupabase().rpc('rpc_mark_task_status', {
    p_task_id: taskId,
    p_status: status,
    p_color: color ?? null,
  });
}

// ── Readiness ──────────────────────────────────────────────────────────────────

export async function getLatestReadiness(programId: string): Promise<VReadinessDashboard | null> {
  const { data, error } = await getSupabase()
    .from('v_readiness_dashboard')
    .select('*')
    .eq('program_id', programId)
    .order('week_number', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data as VReadinessDashboard;
}

export async function upsertReadinessBucket(
  programId: string,
  reportId: string,
  bucket: LoReadinessBucket,
  score: LoReadinessScore,
  notes?: string,
): Promise<void> {
  await getSupabase().rpc('rpc_upsert_readiness_for_week', {
    p_program_id: programId,
    p_report_id: reportId,
    p_bucket: bucket,
    p_score: score,
    p_notes: notes ?? null,
  });
}

// ── Weekly Reports ─────────────────────────────────────────────────────────────

export async function upsertWeeklyReport(params: {
  programId: string;
  weekNumber: number;
  status?: LoTaskStatus;
  summary?: string;
  topWins?: string[];
  topLosses?: string[];
  bestMessages?: string[];
  topObjections?: string[];
  nextWeekPriorities?: string[];
  recommendation?: LoRecommendation;
  recommendationReason?: string;
}): Promise<string | null> {
  const { data, error } = await getSupabase().rpc('rpc_upsert_weekly_report', {
    p_program_id:            params.programId,
    p_week_number:           params.weekNumber,
    p_status:                params.status ?? 'todo',
    p_summary:               params.summary ?? null,
    p_top_wins:              JSON.stringify(params.topWins ?? []),
    p_top_losses:            JSON.stringify(params.topLosses ?? []),
    p_best_messages:         JSON.stringify(params.bestMessages ?? []),
    p_top_objections:        JSON.stringify(params.topObjections ?? []),
    p_next_week_priorities:  JSON.stringify(params.nextWeekPriorities ?? []),
    p_recommendation:        params.recommendation ?? 'continue_validation',
    p_recommendation_reason: params.recommendationReason ?? null,
  });
  if (error) return null;
  return data as string;
}

export async function getWeeklyReports(programId: string): Promise<LaunchWeeklyReport[]> {
  const { data, error } = await getSupabase()
    .from('launch_weekly_reports')
    .select('*')
    .eq('program_id', programId)
    .order('week_number');
  if (error) return [];
  return (data ?? []) as LaunchWeeklyReport[];
}

// ── Proof Assets ───────────────────────────────────────────────────────────────

export async function captureProofAsset(params: {
  programId: string;
  assetType: LoProofAssetType;
  title?: string;
  body?: string;
  assetUrl?: string;
  sourceChannel?: LoChannelName;
  sourceSegmentId?: string;
  sourceOfferId?: string;
  isApproved?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const { data, error } = await getSupabase().rpc('rpc_capture_proof_asset', {
    p_program_id:        params.programId,
    p_asset_type:        params.assetType,
    p_title:             params.title ?? null,
    p_body:              params.body ?? null,
    p_asset_url:         params.assetUrl ?? null,
    p_source_channel:    params.sourceChannel ?? null,
    p_source_segment_id: params.sourceSegmentId ?? null,
    p_source_offer_id:   params.sourceOfferId ?? null,
    p_is_approved:       params.isApproved ?? false,
    p_metadata:          JSON.stringify(params.metadata ?? {}),
  });
  if (error) return null;
  return data as string;
}

export async function getProofAssets(programId: string, approvedOnly = false): Promise<LaunchProofAsset[]> {
  let query = getSupabase()
    .from('launch_proof_assets')
    .select('*')
    .eq('program_id', programId)
    .order('created_at', { ascending: false });
  if (approvedOnly) query = query.eq('is_approved', true);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as LaunchProofAsset[];
}

export async function approveProofAsset(id: string): Promise<void> {
  await getSupabase()
    .from('launch_proof_assets')
    .update({ is_approved: true })
    .eq('id', id);
}

// ── Channel + Commercial Metrics ───────────────────────────────────────────────

export async function getChannelMetrics(programId: string, reportId?: string): Promise<LaunchChannelMetrics[]> {
  let query = getSupabase()
    .from('launch_channel_metrics')
    .select('*')
    .eq('program_id', programId);
  if (reportId) query = query.eq('report_id', reportId);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as LaunchChannelMetrics[];
}

export async function getCommercialMetrics(programId: string, reportId?: string): Promise<LaunchCommercialMetrics[]> {
  let query = getSupabase()
    .from('launch_commercial_metrics')
    .select('*')
    .eq('program_id', programId);
  if (reportId) query = query.eq('report_id', reportId);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as LaunchCommercialMetrics[];
}

// ── Roll week forward ──────────────────────────────────────────────────────────

export async function rollWeekForward(programId: string, fromWeekNumber: number): Promise<void> {
  await getSupabase().rpc('rpc_roll_week_forward', {
    p_program_id:   programId,
    p_from_week_no: fromWeekNumber,
  });
}

// ── Full program data load (for LaunchOpsTab) ─────────────────────────────────

export async function loadProgramData(slug: string): Promise<LaunchOpsProgramData | null> {
  const program = await getProgram(slug);
  if (!program) return null;

  const [health, weeks, readiness, proofAssets] = await Promise.all([
    getProgramHealth(slug),
    getWeeksWithTasks(program.id),
    getLatestReadiness(program.id),
    getProofAssets(program.id),
  ]);

  if (!health) return null;

  return {
    program,
    health,
    weeks,
    readiness,
    proofCount: proofAssets.length,
    approvedProofCount: proofAssets.filter((a) => a.is_approved).length,
  };
}
