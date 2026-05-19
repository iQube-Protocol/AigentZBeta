/**
 * Stage progression — Aigent Me Phase 3.b.
 *
 * Reads the persona's ExperienceQube + recent activity_receipts and decides
 * whether the venture-level ExperienceStage should advance.
 *
 * Stages (per ExperienceQube): setup → alpha_activation → launch → growth → scale.
 *
 * Deterministic, criterion-based — every threshold is a number the operator
 * can read in this file. No LLM in the loop for stage advancement; this is
 * a control plane decision the user needs to be able to predict and override.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  getExperienceQube,
  upsertExperienceQube,
  type ExperienceStage,
} from '@/services/iqube/experienceQube';
import {
  createActivityReceipt,
  type ActivityActionType,
} from '@/services/receipts/activityReceiptService';

// ─────────────────────────────────────────────────────────────────────────
// Types.
// ─────────────────────────────────────────────────────────────────────────

export interface StageCriterion {
  /** Stable id — used for receipts and UI keys. */
  id: string;
  /** User-facing label, short imperative form. */
  label: string;
  /** Whether the criterion is currently met. */
  met: boolean;
  /** Current observed value (count, days, etc.). */
  observed: number;
  /** Required value to satisfy. */
  required: number;
}

export interface StageEvaluation {
  currentStage: ExperienceStage;
  /** Stage we recommend the user advance to. Equal to current when nothing to do. */
  recommendedStage: ExperienceStage;
  /** Criteria for the next-stage transition. Empty when at the final stage. */
  criteria: StageCriterion[];
  /** All criteria met → can advance now. */
  eligible: boolean;
  /** Counts surfaced for context in the UI. */
  progress: {
    receiptsTotal: number;
    receiptsLast14d: number;
    receiptsLast30d: number;
    artifactsSent: number;
    approvalsGranted: number;
    earliestReceiptDays: number;
  };
  evaluatedAt: string;
}

const STAGE_ORDER: ExperienceStage[] = ['setup', 'alpha_activation', 'launch', 'growth', 'scale'];

function nextStage(s: ExperienceStage): ExperienceStage | null {
  const i = STAGE_ORDER.indexOf(s);
  if (i < 0 || i >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[i + 1];
}

// ─────────────────────────────────────────────────────────────────────────
// Receipt aggregation.
// ─────────────────────────────────────────────────────────────────────────

interface ReceiptRow {
  action_type: ActivityActionType;
  created_at: string;
  receipt_status: string;
}

async function readReceipts(personaId: string): Promise<ReceiptRow[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  try {
    const { data } = await admin
      .from('activity_receipts')
      .select('action_type, created_at, receipt_status')
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (!Array.isArray(data)) return [];
    return data as ReceiptRow[];
  } catch {
    return [];
  }
}

function summariseReceipts(rows: ReceiptRow[]): StageEvaluation['progress'] {
  const now = Date.now();
  const ms14 = 14 * 24 * 60 * 60 * 1000;
  const ms30 = 30 * 24 * 60 * 60 * 1000;
  let receiptsLast14d = 0;
  let receiptsLast30d = 0;
  let artifactsSent = 0;
  let approvalsGranted = 0;
  let earliestMs = now;
  for (const r of rows) {
    const ts = Date.parse(r.created_at);
    if (!Number.isFinite(ts)) continue;
    const age = now - ts;
    if (age < ms14) receiptsLast14d++;
    if (age < ms30) receiptsLast30d++;
    if (r.action_type === 'artifact_sent') artifactsSent++;
    if (r.action_type === 'approval_granted') approvalsGranted++;
    if (ts < earliestMs) earliestMs = ts;
  }
  const earliestReceiptDays = rows.length === 0 ? 0 : Math.floor((now - earliestMs) / (24 * 60 * 60 * 1000));
  return {
    receiptsTotal: rows.length,
    receiptsLast14d,
    receiptsLast30d,
    artifactsSent,
    approvalsGranted,
    earliestReceiptDays,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Per-transition criteria.
// ─────────────────────────────────────────────────────────────────────────

function criteriaForTransition(
  from: ExperienceStage,
  qubeGoalsCount: number,
  activeCartridgesCount: number,
  progress: StageEvaluation['progress'],
): StageCriterion[] {
  const next = nextStage(from);
  if (!next) return [];
  if (from === 'setup') {
    return [
      {
        id: 'goals-declared',
        label: 'At least one ExperienceGoal declared',
        met: qubeGoalsCount >= 1,
        observed: qubeGoalsCount,
        required: 1,
      },
      {
        id: 'cartridge-active',
        label: 'At least one active cartridge',
        met: activeCartridgesCount >= 1,
        observed: activeCartridgesCount,
        required: 1,
      },
      {
        id: 'first-activity',
        label: 'First receipt logged',
        met: progress.receiptsTotal >= 1,
        observed: progress.receiptsTotal,
        required: 1,
      },
    ];
  }
  if (from === 'alpha_activation') {
    return [
      {
        id: 'recent-activity-14d',
        label: '≥ 5 receipts in last 14 days',
        met: progress.receiptsLast14d >= 5,
        observed: progress.receiptsLast14d,
        required: 5,
      },
      {
        id: 'artifact-sent',
        label: '≥ 1 artifact sent or approval granted',
        met: progress.artifactsSent + progress.approvalsGranted >= 1,
        observed: progress.artifactsSent + progress.approvalsGranted,
        required: 1,
      },
    ];
  }
  if (from === 'launch') {
    return [
      {
        id: 'sustained-30d',
        label: '≥ 20 receipts in last 30 days',
        met: progress.receiptsLast30d >= 20,
        observed: progress.receiptsLast30d,
        required: 20,
      },
      {
        id: 'artifacts-3',
        label: '≥ 3 artifacts sent',
        met: progress.artifactsSent >= 3,
        observed: progress.artifactsSent,
        required: 3,
      },
      {
        id: 'sustained-14d-tenure',
        label: 'First receipt ≥ 14 days ago',
        met: progress.earliestReceiptDays >= 14,
        observed: progress.earliestReceiptDays,
        required: 14,
      },
    ];
  }
  if (from === 'growth') {
    return [
      {
        id: 'volume-30d',
        label: '≥ 60 receipts in last 30 days',
        met: progress.receiptsLast30d >= 60,
        observed: progress.receiptsLast30d,
        required: 60,
      },
      {
        id: 'artifacts-10',
        label: '≥ 10 artifacts sent',
        met: progress.artifactsSent >= 10,
        observed: progress.artifactsSent,
        required: 10,
      },
    ];
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────
// Public API.
// ─────────────────────────────────────────────────────────────────────────

export async function evaluateStageProgression(
  personaId: string,
): Promise<StageEvaluation | null> {
  const qube = await getExperienceQube(personaId);
  if (!qube) return null;
  const currentStage = qube.meta.currentStage;
  const goalsCount = qube.blak.experienceGoals?.length ?? 0;
  const cartridgesCount = qube.meta.activeCartridges.length;
  const rows = await readReceipts(personaId);
  const progress = summariseReceipts(rows);
  const criteria = criteriaForTransition(currentStage, goalsCount, cartridgesCount, progress);
  const eligible = criteria.length > 0 && criteria.every((c) => c.met);
  const recommendedStage = eligible ? nextStage(currentStage) ?? currentStage : currentStage;
  return {
    currentStage,
    recommendedStage,
    criteria,
    eligible,
    progress,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Advance the persona's ExperienceStage one step forward when eligible.
 *
 * - Re-evaluates server-side to prevent stale-UI tampering.
 * - Writes the new currentStage via the canonical upsert (so the qube's
 *   `updated_at` flips, which in turn invalidates the inferred-strategy cache).
 * - Emits an experience_model_updated receipt referencing the transition.
 */
export async function advanceStage(
  personaId: string,
): Promise<{ advanced: boolean; from: ExperienceStage; to: ExperienceStage; reason?: string }> {
  const evalNow = await evaluateStageProgression(personaId);
  if (!evalNow) {
    return { advanced: false, from: 'setup', to: 'setup', reason: 'no-experience-qube' };
  }
  if (!evalNow.eligible || evalNow.recommendedStage === evalNow.currentStage) {
    return {
      advanced: false,
      from: evalNow.currentStage,
      to: evalNow.currentStage,
      reason: 'not-eligible',
    };
  }
  const target = evalNow.recommendedStage;
  await upsertExperienceQube(personaId, { currentStage: target });

  // Best-effort receipt — failure does not roll back the stage change.
  await createActivityReceipt({
    personaId,
    activeCartridge: 'metame',
    actionType: 'experience_model_updated',
    summary: `Stage advanced: ${evalNow.currentStage} → ${target}`,
    iqubesUsed: ['ExperienceQube'],
  }).catch(() => undefined);

  return { advanced: true, from: evalNow.currentStage, to: target };
}
