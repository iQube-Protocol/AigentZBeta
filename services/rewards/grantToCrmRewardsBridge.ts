/**
 * grantToCrmRewardsBridge — server-internal bridge from the legacy
 * `reward_grants` table to the spine-conformant `crm_rewards` table the
 * wallet UI + redeem endpoint read.
 *
 * Why this exists
 * ---------------
 * Three of four KNYT task families (Bring-a-Knight, Knight-of-Attention,
 * Herald-of-the-Order) grant rewards via `rewardService.grantRewardForTask`
 * which writes to `reward_grants`. The wallet UI (`/api/wallet/tasks`) and
 * the spine-mediated redeem endpoint (`/api/wallet/knyt/rewards/redeem`)
 * both read from `crm_rewards`. Without this bridge the grants are
 * invisible to the user and can't be claimed.
 *
 * Living Canon is unaffected (it goes through `services/crm/taskService.
 * approveContribution` which already writes `crm_rewards` directly).
 *
 * What it does
 * ------------
 * 1. Looks up the task template by reward_task_type (in schema_json) to
 *    get the canonical `task_template_id` and `cohort_id` for the spine
 *    RQH partition convention `<cohortId>:<personaId>` (decisions doc §4).
 * 2. Computes the T2 cohort alias commitment for the orchestration
 *    receipt (privacy contract — no T0 in receipts).
 * 3. Inserts an `orchestration_events` row with `event_type='reward.grant'`,
 *    the T2 alias commitment, and the cohort id — this is the audit-trail
 *    receipt the security review will verify.
 * 4. Inserts a `crm_rewards` row with `status='approved'`,
 *    `source_event_id` linking to the receipt, the cohort id, the
 *    template id, and the granted amount.
 *
 * Privacy
 * -------
 * The orchestration_events row stores `actor_alias_commitment` (T2) and
 * `cohort_id` (T2) — NEVER `personaId` (T0). The `crm_rewards` row
 * stores `persona_id` (T0) BUT this table is server-side only —
 * `/api/wallet/tasks` and the redeem endpoint strip T0 before serialising
 * to the browser per the existing privacy guard tests.
 *
 * Failure mode
 * ------------
 * Fail-open with diagnostic logging. The reward_grants row is
 * authoritative for the on-chain credit/claim flow; this bridge is the
 * UI-visibility + audit-trail layer. If bridging fails, the operator
 * sees the grant in reward_grants and the receipt batcher can backfill
 * later. No double-grant risk: idempotency keyed on rewardGrantId.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  computeAliasCommitment,
  isAliasServiceConfigured,
} from '@/services/identity/cohortAliasService';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';

const KNYT_TENANT_ID = 'knyt';

function sb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

interface TaskTemplateLookup {
  taskTemplateId: string;
  cohortId: string;
  taskSlug: string;
}

/**
 * Resolve task template by the `reward_task_type` value carried in
 * `crm_task_templates.schema_json`. The seeds map each RewardTaskType
 * enum value to one task template via that field; multi-type templates
 * (e.g. Knight-of-Attention with episode/streak/bonus variants) use the
 * primary `reward_task_type` for the lookup — the variants share the
 * same template_id which is fine for UI grouping.
 */
async function resolveTaskTemplate(
  db: SupabaseClient,
  rewardTaskType: string,
): Promise<TaskTemplateLookup | null> {
  // Try primary reward_task_type first
  const { data: primary } = await db
    .from('crm_task_templates')
    .select('id, slug, cohort_id, schema_json')
    .eq('tenant_id', KNYT_TENANT_ID)
    .filter('schema_json->>reward_task_type', 'eq', rewardTaskType)
    .maybeSingle();
  if (primary) {
    return {
      taskTemplateId: primary.id,
      cohortId: primary.cohort_id || 'knyt:backers',
      taskSlug: primary.slug,
    };
  }

  // Try secondary fields used by KoA + Herald (streak/signup/conversion variants)
  const secondaryFields = [
    'streak_reward_task_type',
    'streak_bonus_reward_task_type',
    'signup_reward_task_type',
    'conversion_reward_task_type',
  ];
  for (const field of secondaryFields) {
    const { data } = await db
      .from('crm_task_templates')
      .select('id, slug, cohort_id')
      .eq('tenant_id', KNYT_TENANT_ID)
      .filter(`schema_json->>${field}`, 'eq', rewardTaskType)
      .maybeSingle();
    if (data) {
      return {
        taskTemplateId: data.id,
        cohortId: data.cohort_id || 'knyt:backers',
        taskSlug: data.slug,
      };
    }
  }
  return null;
}

/**
 * Map an auth-side personaId to the matching crm_personas.id. The CRM
 * persona table mirrors the auth persona table 1:1 via a sync trigger;
 * we look up by the canonical persona uuid which is the same key on
 * both sides.
 */
async function resolveCrmPersonaId(
  db: SupabaseClient,
  authPersonaId: string,
): Promise<string | null> {
  const { data } = await db
    .from('crm_personas')
    .select('id')
    .eq('id', authPersonaId)
    .maybeSingle();
  return data?.id ?? null;
}

export interface BridgeGrantInput {
  personaId: string;         // auth persona id (T0)
  rewardTaskType: string;    // enum value from RewardTaskType
  amountKnyt: number;
  rewardGrantId: string;     // reward_grants.id — used as idempotency key
  sourceEventId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface BridgeGrantResult {
  bridged: boolean;
  crmRewardId?: string;
  orchestrationEventId?: string;
  cohortId?: string;
  taskSlug?: string;
  reason?: string;
}

/**
 * Bridge a reward_grants row to a crm_rewards row + emit the
 * spine-conformant OrchestrationEvent receipt. Idempotent on
 * rewardGrantId.
 */
export async function bridgeGrantToCrmRewards(
  input: BridgeGrantInput,
): Promise<BridgeGrantResult> {
  const db = sb();

  // 0. Idempotency — if a crm_rewards row already exists for this
  //    rewardGrantId we're done. Operators retrying the grant path
  //    (e.g. after a transient evaluateAccess failure) won't double-credit.
  try {
    const { data: existing } = await db
      .from('crm_rewards')
      .select('id')
      .filter('metadata->>reward_grant_id', 'eq', input.rewardGrantId)
      .maybeSingle();
    if (existing?.id) {
      return { bridged: true, crmRewardId: existing.id, reason: 'idempotent-hit' };
    }
  } catch {
    // Non-fatal — proceed to insert; if there's a unique-constraint
    // collision the insert will fail and we'll log it.
  }

  // 1. Resolve template + cohort.
  const template = await resolveTaskTemplate(db, input.rewardTaskType);
  if (!template) {
    return {
      bridged: false,
      reason: `no crm_task_templates row matches reward_task_type=${input.rewardTaskType}`,
    };
  }

  // 2. Resolve crm_persona_id.
  const crmPersonaId = await resolveCrmPersonaId(db, input.personaId);
  if (!crmPersonaId) {
    return {
      bridged: false,
      reason: `no crm_personas row for personaId=${input.personaId}`,
    };
  }

  // 3. Compute T2 alias commitment for the receipt. If the alias
  //    service isn't configured (missing escrow secret), proceed
  //    without it — the receipt still anchors via cohort_id.
  let aliasCommitment: string | null = null;
  if (isAliasServiceConfigured()) {
    try {
      aliasCommitment = computeAliasCommitment(input.personaId, template.cohortId);
    } catch (err) {
      console.warn('[bridgeGrant] alias commit failed:', (err as Error).message);
    }
  }

  // 4. Emit orchestration_event — this is the audit trail receipt.
  //    event_id = `grant:<rewardGrantId>` so the receipt batcher can
  //    pair it with the reward grant deterministically. metadata
  //    carries T2 attribution (alias_commitment + cohort_id) which
  //    the orchestrationEvents emitter projects into top-level columns.
  const eventId = `grant:${input.rewardGrantId}`;
  await emitOrchestrationEvent({
    event_id: eventId,
    event_type: 'reward.grant',
    from_role: 'system',
    to_role: 'persona',
    reason: `task-completion:${template.taskSlug}`,
    journey_stage: 'engaged',
    active_cartridge: 'knyt',
    active_codex: 'knyt-codex',
    receipt_eligible: true,
    timestamp: new Date().toISOString(),
    metadata: {
      reward_task_type: input.rewardTaskType,
      task_slug: template.taskSlug,
      task_template_id: template.taskTemplateId,
      amount_knyt: input.amountKnyt,
      reward_grant_id: input.rewardGrantId,
      source_event_id: input.sourceEventId ?? null,
      receipt_mode: 'async-batched',
      ...(aliasCommitment ? { actor_alias_commitment: aliasCommitment } : {}),
      cohort_id: template.cohortId,
      ...(input.metadata ?? {}),
    },
  });

  // 5. Insert crm_rewards row — status='approved' so the wallet UI
  //    surfaces it as claimable. source_event_id links to the
  //    orchestration_event receipt.
  const { data: rewardRow, error: rewardErr } = await db
    .from('crm_rewards')
    .insert({
      tenant_id: KNYT_TENANT_ID,
      persona_id: crmPersonaId,
      task_template_id: template.taskTemplateId,
      token_type: 'KNYT',
      amount: input.amountKnyt,
      status: 'approved',
      cohort_id: template.cohortId,
      source_event_id: eventId,
      metadata: {
        reward_grant_id: input.rewardGrantId,
        reward_task_type: input.rewardTaskType,
        source_event_id: input.sourceEventId ?? null,
        ...(input.metadata ?? {}),
      },
    })
    .select('id')
    .single();

  if (rewardErr || !rewardRow) {
    console.error('[bridgeGrant] crm_rewards insert failed:', rewardErr);
    return {
      bridged: false,
      orchestrationEventId: eventId,
      cohortId: template.cohortId,
      taskSlug: template.taskSlug,
      reason: rewardErr?.message || 'insert failed',
    };
  }

  return {
    bridged: true,
    crmRewardId: rewardRow.id,
    orchestrationEventId: eventId,
    cohortId: template.cohortId,
    taskSlug: template.taskSlug,
  };
}
