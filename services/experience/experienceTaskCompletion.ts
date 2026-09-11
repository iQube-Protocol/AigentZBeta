/**
 * experienceTaskCompletion — Workstream C-b live grant wiring.
 *
 * Records a consumer-task-runner completion (all nextActions checked) and
 * routes the configured reward into the wallet via the cartridge's existing
 * credit pipeline. KNYT is the blueprint; the tenant is resolved from the
 * cartridge slug so Qriptopian + metaMe extend it once their templates +
 * treasury rows are seeded.
 *
 * Asset routing (the two native wallet ledgers are SEPARATE):
 *   - KNYT  → rewardService.grantRewardForTask() → reward_grants →
 *             crm_rewards bridge → wallet Rewards tab.
 *   - Q¢ (QCT) → creditQc() → qc_balances + qc_transactions.
 *
 * Idempotency: one row per (persona, experience) via the UNIQUE constraint
 * on experience_task_completions. A placeholder row is inserted up-front to
 * claim the slot; a unique violation short-circuits to "already completed".
 *
 * Reputation (both models per the C1 decision):
 *   - cartridge-level policy (default) — crm_task_templates.rep_weight_*
 *   - per-experience override (exception) — wallet_rewards.reputation_bump
 *   The override stacks ADDITIVELY on the template weights.
 *
 * DVN provenance: every completion writes an activity receipt with
 * actionType 'experience_task_completed', which the activity-receipt
 * pipeline auto-enqueues for on-chain anchoring.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { composerService } from '@/services/composer/composerService';
import { getRewardService, RewardTaskType } from '@/services/rewards/rewardService';
import { creditQc } from '@/app/api/community-content/_lib/generate';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { createReputationEvent, updatePersonaReputation } from '@/services/crm/taskService';
import type { TenantId } from '@/types/crm';

function sb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** Strip the codex/cartridge suffix to get the CRM tenant id. */
function resolveTenant(cartridgeSlug: string): string {
  const s = (cartridgeSlug || '').trim().toLowerCase();
  if (!s) return 'knyt';
  return s.replace(/-codex$/, '').replace(/-cartridge$/, '');
}

/** Normalise the configured reward asset to a canonical wallet asset code. */
function normaliseAsset(asset: string | undefined): 'KNYT' | 'QCT' {
  const n = (asset ?? 'Q¢').replace(/\s|\$/g, '').toUpperCase();
  if (n === 'KNYT') return 'KNYT';
  return 'QCT'; // Q¢ / QC / QCENT / QRIPTOCENT all settle to the Q¢ (QCT) ledger
}

type RepDimension = 'technical' | 'creative' | 'entrepreneurial' | 'dataArch' | 'community';

interface TaskTemplateRow {
  id: string;
  schema_json: Record<string, unknown> | null;
  reward_qct: number | null;
  rep_weight_technical: number | null;
  rep_weight_creative: number | null;
  rep_weight_entrepreneurial: number | null;
  rep_weight_data_arch: number | null;
  rep_weight_community: number | null;
}

export interface RecordExperienceTaskCompletionInput {
  /** Spine personaId (T0). Resolved at the route boundary via getActivePersona. */
  personaId: string;
  experienceId: string;
  completedTasks: string[];
  totalTasks: number;
  cartridgeSlug: string;
}

export interface RecordExperienceTaskCompletionResult {
  completionId: string | null;
  alreadyCompleted: boolean;
  grant: { asset: 'KNYT' | 'QCT'; amount: number; rewardGrantId: string | null } | null;
  reputation: Record<RepDimension, number> | null;
  receiptId: string | null;
  error?: string;
  status: number;
}

export async function recordExperienceTaskCompletion(
  input: RecordExperienceTaskCompletionInput,
): Promise<RecordExperienceTaskCompletionResult> {
  const { personaId, experienceId, completedTasks, totalTasks, cartridgeSlug } = input;

  if (!personaId) {
    return { completionId: null, alreadyCompleted: false, grant: null, reputation: null, receiptId: null, error: 'personaId required', status: 401 };
  }
  if (!experienceId) {
    return { completionId: null, alreadyCompleted: false, grant: null, reputation: null, receiptId: null, error: 'experienceId required', status: 400 };
  }

  const db = sb();
  const tenant = resolveTenant(cartridgeSlug);

  // 1. Load the experience to read its reward config (server-authoritative).
  const experience = await composerService.getExperienceQube(experienceId);
  if (!experience) {
    return { completionId: null, alreadyCompleted: false, grant: null, reputation: null, receiptId: null, error: 'experience not found', status: 404 };
  }
  const walletRewards = (experience.configuration?.wallet_rewards ?? {}) as Record<string, any>;
  const rewardAmount = Number(walletRewards.reward_amount || 0);
  const rewardAsset = normaliseAsset(typeof walletRewards.reward_asset === 'string' ? walletRewards.reward_asset : undefined);
  const templateSlug = typeof walletRewards.task_template_slug === 'string' ? walletRewards.task_template_slug.trim() : '';
  const reputationBump =
    walletRewards.reputation_bump && typeof walletRewards.reputation_bump === 'object'
      ? (walletRewards.reputation_bump as { dimension?: string; weight?: number })
      : null;

  // 2. Claim the idempotency slot. A unique violation means this persona
  //    already completed this experience — short-circuit and return the
  //    existing record so the client clears localStorage either way.
  const { data: claimed, error: claimErr } = await db
    .from('experience_task_completions')
    .insert({
      persona_id: personaId,
      experience_id: experienceId,
      tenant_id: tenant,
      tasks_completed: completedTasks ?? [],
      total_tasks: totalTasks || (completedTasks?.length ?? 0),
      reward_asset: rewardAmount > 0 ? rewardAsset : null,
      reward_amount: rewardAmount,
    })
    .select('id')
    .single();

  if (claimErr) {
    // 23505 = unique_violation → already completed.
    if ((claimErr as { code?: string }).code === '23505') {
      const { data: existing } = await db
        .from('experience_task_completions')
        .select('id, reward_asset, reward_amount, reward_grant_id, source_event_id')
        .eq('persona_id', personaId)
        .eq('experience_id', experienceId)
        .maybeSingle();
      return {
        completionId: existing?.id ?? null,
        alreadyCompleted: true,
        grant: existing && Number(existing.reward_amount) > 0
          ? { asset: (existing.reward_asset as 'KNYT' | 'QCT') ?? 'QCT', amount: Number(existing.reward_amount), rewardGrantId: existing.reward_grant_id ?? null }
          : null,
        reputation: null,
        receiptId: existing?.source_event_id ?? null,
        status: 409,
      };
    }
    console.error('[experienceTaskCompletion] claim insert failed:', claimErr);
    return { completionId: null, alreadyCompleted: false, grant: null, reputation: null, receiptId: null, error: 'completion record failed', status: 500 };
  }

  const completionId = claimed!.id as string;

  // 3. Resolve the mapped task template (optional). Drives the KNYT taskType,
  //    the Q¢ amount fallback (reward_qct), and the reputation weights.
  let template: TaskTemplateRow | null = null;
  if (templateSlug) {
    const { data: t } = await db
      .from('crm_task_templates')
      .select('id, schema_json, reward_qct, rep_weight_technical, rep_weight_creative, rep_weight_entrepreneurial, rep_weight_data_arch, rep_weight_community')
      .eq('tenant_id', tenant)
      .eq('slug', templateSlug)
      .eq('is_active', true)
      .maybeSingle();
    template = (t as TaskTemplateRow) ?? null;
    if (!template) {
      console.warn(`[experienceTaskCompletion] no active template '${templateSlug}' for tenant '${tenant}' — recording completion without grant`);
    }
  }

  // 4. Issue the reward — branch on the configured asset.
  let grant: RecordExperienceTaskCompletionResult['grant'] = null;
  let grantFailed = false;
  if (rewardAmount > 0) {
    if (rewardAsset === 'KNYT') {
      const rewardTaskType =
        template && typeof template.schema_json?.['reward_task_type'] === 'string'
          ? (template.schema_json['reward_task_type'] as string)
          : null;
      if (rewardTaskType && (Object.values(RewardTaskType) as string[]).includes(rewardTaskType)) {
        const result = await getRewardService().grantRewardForTask({
          personaId,
          taskType: rewardTaskType as RewardTaskType,
          customBaseAmount: rewardAmount,
          metadata: { experienceId, completionId, completionSource: 'consumer-task-runner', cartridgeId: tenant },
        });
        if (result.success) {
          grant = { asset: 'KNYT', amount: result.finalAmount, rewardGrantId: result.rewardGrantId ?? null };
        } else {
          grantFailed = true;
          console.error('[experienceTaskCompletion] KNYT grant failed:', result.error);
        }
      } else {
        grantFailed = true;
        console.warn('[experienceTaskCompletion] KNYT reward configured but no valid reward_task_type on the mapped template');
      }
    } else {
      // Q¢ (QCT) — credit the qc_balances ledger. Amount is a Q¢ count.
      const qcAmount = Number(template?.reward_qct || rewardAmount);
      try {
        await creditQc(db, personaId, qcAmount, `experience-completion:${experienceId}`, completionId);
        grant = { asset: 'QCT', amount: qcAmount, rewardGrantId: null };
      } catch (err) {
        grantFailed = true;
        console.error('[experienceTaskCompletion] Q¢ credit failed:', (err as Error).message);
      }
    }
  }

  // 5. Reputation — both models. Template weights (default) + per-experience
  //    bump (additive). Only applied when the crm_personas row exists.
  let reputation: Record<RepDimension, number> | null = null;
  const deltas: Record<RepDimension, number> = {
    technical: Number(template?.rep_weight_technical || 0),
    creative: Number(template?.rep_weight_creative || 0),
    entrepreneurial: Number(template?.rep_weight_entrepreneurial || 0),
    dataArch: Number(template?.rep_weight_data_arch || 0),
    community: Number(template?.rep_weight_community || 0),
  };
  if (reputationBump && typeof reputationBump.dimension === 'string' && Number(reputationBump.weight) > 0) {
    const dim = reputationBump.dimension as RepDimension;
    if (dim in deltas) deltas[dim] += Number(reputationBump.weight);
  }
  const deltaOverall = deltas.technical + deltas.creative + deltas.entrepreneurial + deltas.dataArch + deltas.community;
  if (deltaOverall > 0) {
    const { data: crmPersona } = await db.from('crm_personas').select('id').eq('id', personaId).maybeSingle();
    if (crmPersona?.id) {
      try {
        await createReputationEvent({
          tenantId: tenant as TenantId,
          personaId,
          sourceType: 'task_completion',
          sourceId: completionId,
          deltaTechnical: deltas.technical,
          deltaCreative: deltas.creative,
          deltaEntrepreneurial: deltas.entrepreneurial,
          deltaDataArch: deltas.dataArch,
          deltaCommunity: deltas.community,
          deltaOverall,
          cvs: deltaOverall,
          taskTemplateId: template?.id,
          reason: `Experience completion: ${experience.name ?? experienceId}`,
        });
        await updatePersonaReputation(
          personaId,
          {
            deltaTechnical: deltas.technical,
            deltaCreative: deltas.creative,
            deltaEntrepreneurial: deltas.entrepreneurial,
            deltaDataArch: deltas.dataArch,
            deltaCommunity: deltas.community,
            deltaOverall,
          },
          deltaOverall,
        );
        reputation = deltas;
      } catch (err) {
        console.error('[experienceTaskCompletion] reputation update failed:', (err as Error).message);
      }
    }
  }

  // 6. DVN-anchored activity receipt. createActivityReceipt auto-enqueues the
  //    on-chain anchor for the 'experience_task_completed' action type.
  let receiptId: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId,
      activeCartridge: tenant,
      actionType: 'experience_task_completed',
      summary: `Completed ${totalTasks || (completedTasks?.length ?? 0)} tasks in experience "${experience.name ?? experienceId}"`,
      iqubesUsed: [experienceId],
    });
    receiptId = receipt?.id ?? null;
  } catch (err) {
    console.error('[experienceTaskCompletion] receipt write failed:', (err as Error).message);
  }

  // 7. Finalise the completion row with grant + receipt linkage.
  await db
    .from('experience_task_completions')
    .update({
      task_template_id: template?.id ?? null,
      reward_grant_id: grant?.rewardGrantId ?? null,
      grant_failed: grantFailed,
      source_event_id: receiptId,
    })
    .eq('id', completionId);

  return {
    completionId,
    alreadyCompleted: false,
    grant,
    reputation,
    receiptId,
    status: 200,
  };
}
