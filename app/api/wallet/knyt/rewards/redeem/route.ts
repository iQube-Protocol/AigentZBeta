/**
 * POST /api/wallet/knyt/rewards/redeem
 *
 * Phase D of the KNYT rep/rewards/tasks workstream — redeem a deferred
 * reward (crm_rewards row in 'approved' or 'pending_redemption' state)
 * into the persona's DVN KNYT balance.
 *
 * Per the decisions doc §5 Phase C:
 *   1. Resolve the active persona via the spine (getActivePersona).
 *   2. Look up the reward by id; verify persona ownership; verify status.
 *   3. Build a synthetic ContentAccessDescriptor for the reward
 *      (gating.kind='free' — the persona earned it via task completion).
 *   4. Call evaluateAccess(persona, descriptor, 'mint'). 'mint' is in
 *      TX_CLASS_ACTIONS so the spine emits a sync receipt with T2 alias
 *      commitment + cohort_id. The TX_CLASS guard also enforces
 *      fio-handle-required, so an unregistered persona is denied with
 *      a clean reason for the UI.
 *   5. If allow, credit DVN KNYT via creditKnyt and flip the reward
 *      status to 'redeemed'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { evaluateAccess } from '@/services/access/evaluateAccess';
import { creditKnyt } from '@/services/wallet/knyt/knytLedgerService';
import type { ContentAccessDescriptor } from '@/types/access';

export const runtime = 'nodejs';

function supabaseSr() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(request: NextRequest) {
  try {
    // 1. Spine identity. Returns 401 for unauthenticated callers.
    const persona = await getActivePersona(request);
    if (!persona) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rewardId: string | undefined = body?.rewardId;
    if (!rewardId) {
      return NextResponse.json({ error: 'rewardId required' }, { status: 400 });
    }

    const sb = supabaseSr();

    // Resolve crm_personas.id from the spine's T0 personaId.
    const { data: crmPersona } = await sb
      .from('crm_personas')
      .select('id')
      .eq('identity_persona_id', persona.personaId)
      .maybeSingle();
    if (!crmPersona?.id) {
      return NextResponse.json({ error: 'No CRM persona for active identity' }, { status: 404 });
    }

    // 2. Load + ownership-verify the reward.
    const { data: reward } = await sb
      .from('crm_rewards')
      .select('id, persona_id, amount, token_type, status, task_template_id, claim_id')
      .eq('id', rewardId)
      .maybeSingle();
    if (!reward) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
    }
    if (reward.persona_id !== crmPersona.id) {
      return NextResponse.json({ error: 'Reward does not belong to active persona' }, { status: 403 });
    }
    if (reward.token_type !== 'KNYT') {
      return NextResponse.json(
        { error: `Token type ${reward.token_type} not redeemable via this endpoint` },
        { status: 400 },
      );
    }
    if (!['approved', 'pending_redemption'].includes(String(reward.status))) {
      return NextResponse.json(
        { error: `Reward not redeemable in status ${reward.status}` },
        { status: 409 },
      );
    }

    // 3. Synthetic descriptor — a reward is conceptually 'free' for the
    //    persona who earned it. The spine still gates on fio-handle
    //    (TX_CLASS_ACTIONS) before allowing the mint.
    const descriptor: ContentAccessDescriptor = {
      assetId: `reward:${reward.id}`,
      contentClass: 'other',
      state: 'A_open_unqubed',
      gating: { kind: 'free' },
      receiptEligible: true,
    };

    // 4. Spine decision. Sync receipt fires with T2 alias commitment.
    const decision = await evaluateAccess(persona, descriptor, 'mint');
    if (!decision.allow) {
      return NextResponse.json(
        { error: 'denied', reason: decision.reason },
        { status: 403 },
      );
    }

    // 5. Credit DVN KNYT + flip status. creditKnyt resolves persona
    //    by fio_handle if needed; passing personaId is canonical.
    const amountKnyt = Number(reward.amount);
    if (!Number.isFinite(amountKnyt) || amountKnyt <= 0) {
      return NextResponse.json({ error: 'Invalid reward amount' }, { status: 500 });
    }

    const credit = await creditKnyt(persona.personaId, amountKnyt, 'reward', {
      reward_id: reward.id,
      task_template_id: reward.task_template_id ?? null,
      // T2 attribution snapshotted from the spine decision so the
      // wallet_transactions row pairs with the receipt without a join.
      actor_alias_commitment: decision.receipt.aliasCommitment,
      cohort_id: decision.receipt.cohortId,
    });
    if (!credit.success) {
      return NextResponse.json({ error: credit.error || 'creditKnyt failed' }, { status: 500 });
    }

    const { error: updateErr } = await sb
      .from('crm_rewards')
      .update({ status: 'redeemed', updated_at: new Date().toISOString() })
      .eq('id', reward.id);
    if (updateErr) {
      // Credit already committed — this is a soft inconsistency the
      // operator can repair via the diagnose-entitlements playbook.
      console.error('[rewards/redeem] reward status update failed (non-fatal):', updateErr);
    }

    return NextResponse.json({
      success: true,
      rewardId: reward.id,
      amountKnyt,
      newBalance: credit.newBalance,
      transactionId: credit.transaction?.id,
      aliasCommitment: decision.receipt.aliasCommitment,
      cohortId: decision.receipt.cohortId,
    });
  } catch (err) {
    console.error('[rewards/redeem] error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null);
}
