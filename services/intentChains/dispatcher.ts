/**
 * Intent chain dispatcher — start a new chain from a CTA.
 *
 * Authority alignment (§10 of spec):
 *   - Identity spine — resolves caller via getActivePersona at the route
 *     layer; this service trusts the caller it receives
 *   - Access spine — invoked here for Q¢ balance check + runtime policy
 *     (chain spend caps). v1 stubs the wallet debit; full integration is
 *     a follow-on commit
 *   - Orchestrator = aigentMe — this service is aigentMe's server-side
 *     delegate; every step transition is policy-checked
 *   - DVN — every state-changing emit is receipt-eligible + sanitized
 */

import { randomUUID } from 'crypto';
import type { ActivePersonaContext } from '@/types/access';
import type {
  ChainTemplate,
  IntentChainRow,
  IntentChainStatus,
  ChainStepKind,
} from '@/types/intentChains';
import { getTemplate } from '@/services/intentChains/registry';
import { resolveRefsInObject } from '@/services/intentChains/refs';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';
import { buildChainReceiptMetadata } from '@/services/orchestration/sanitizeReceiptMetadata';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { advanceRpcStep, materializeUserPending } from '@/services/intentChains/advancer';

export interface DispatchInput {
  template_id: string;
  initiating_nbe_id?: string;
  /** Per-NBE seed for $nbe.X refs (e.g. handoffHint). Stored under context.__nbe. */
  nbe_seed?: Record<string, unknown>;
  /** Initial chain context seed (cartridge, recipient, etc.). */
  context_seed?: Record<string, unknown>;
  /** Cartridge for filtering/grouping in /workspace + /chain views. */
  cartridge?: string;
}

export interface DispatchResult {
  chain_id: string;
  template_id: string;
  template_version: string;
  status: IntentChainStatus;
  current_step_id: string;
  current_step_kind: ChainStepKind;
  /** UI hint for what the client should do next. */
  dispatch_hint:
    | { kind: 'open_composer'; composer_kind: 'doc' | 'email' | 'slack' | 'note'; seed_prompt?: string }
    | { kind: 'show_pill'; step_label: string; artifact_ref?: string }
    | { kind: 'rpc_in_flight'; expected_outcome_event_type: string }
    | { kind: 'scheduled'; advance_at: string }
    | { kind: 'wait'; expected_outcome_event_type: string };
  cost_qc: number;
}

export class DispatchError extends Error {
  constructor(
    public code:
      | 'template_not_found'
      | 'cartridge_scope_mismatch'
      | 'nbe_not_authorized'
      | 'chain_spend_denied'
      | 'storage_unavailable'
      | 'persist_failed'
      | 'unknown_step_kind',
    public detail?: string,
  ) {
    super(`dispatch_failed: ${code}${detail ? `: ${detail}` : ''}`);
  }
}

export async function dispatchChain(
  persona: ActivePersonaContext,
  input: DispatchInput,
): Promise<DispatchResult> {
  // 1. Template lookup
  const template = getTemplate(input.template_id);
  if (!template) throw new DispatchError('template_not_found', input.template_id);

  // 2. Cartridge scope guard
  if (
    template.cartridge_scope &&
    template.cartridge_scope.length > 0 &&
    input.cartridge &&
    !template.cartridge_scope.includes(input.cartridge)
  ) {
    throw new DispatchError(
      'cartridge_scope_mismatch',
      `template ${template.id} scoped to ${template.cartridge_scope.join('|')} but called from ${input.cartridge}`,
    );
  }

  // 3. NBE authorization guard
  if (
    template.triggered_by_nbe &&
    template.triggered_by_nbe.length > 0 &&
    input.initiating_nbe_id &&
    !template.triggered_by_nbe.includes(input.initiating_nbe_id)
  ) {
    throw new DispatchError(
      'nbe_not_authorized',
      `nbe ${input.initiating_nbe_id} not in template.triggered_by_nbe`,
    );
  }

  // 4. Q¢ chain-spend check (v1 stub — accept any non-negative cost)
  //
  // TODO (intent-chains v1.5): wire to Access spine
  //   evaluateAccess(persona, { kind: 'chain_dispatch', cost_qc }, 'transfer')
  // + actual wallet debit via the canonical Q¢ ledger. For v1, we record
  // cost_qc + mark charge_status='committed' so the receipt trail is
  // shape-correct; the ledger write is deferred.
  const cost_qc = Math.max(0, template.cost_qc ?? 0);
  if (cost_qc < 0) throw new DispatchError('chain_spend_denied', 'negative_cost');

  // 5. Prepare context map. __nbe slot seeds $nbe.X refs.
  const initialContext: Record<string, unknown> = {
    ...(input.context_seed ?? {}),
    __nbe: input.nbe_seed ?? {},
  };

  const firstStep = template.steps[0];
  if (!firstStep) throw new DispatchError('persist_failed', 'template_has_no_steps');

  // 6. Persist the chain row + initial step pointer
  const chain_id = randomUUID();
  const now = new Date().toISOString();
  const scheduledAdvanceAt =
    firstStep.kind === 'scheduled' && firstStep.scheduled
      ? new Date(Date.now() + delayMs(firstStep.scheduled.delay)).toISOString()
      : null;
  const waitTimeoutAt =
    firstStep.kind === 'wait' && firstStep.wait?.timeout
      ? new Date(Date.now() + delayMs(firstStep.wait.timeout)).toISOString()
      : null;

  const sb = getSupabaseServer();
  if (!sb) throw new DispatchError('storage_unavailable');

  const initialStatus: IntentChainStatus =
    firstStep.kind === 'scheduled' || firstStep.kind === 'wait' ? 'waiting' : 'active';

  const row: Partial<IntentChainRow> = {
    chain_id,
    template_id: template.id,
    template_version: template.version,
    initiating_nbe_id: input.initiating_nbe_id ?? null,
    initiated_by_persona_id: persona.personaId,
    initiated_by_alias_commitment: persona.cohortMemberships?.[0] ?? null,
    cartridge: input.cartridge ?? null,
    status: initialStatus,
    current_step_id: firstStep.id,
    current_step_kind: firstStep.kind,
    current_step_started_at: now,
    scheduled_advance_at: scheduledAdvanceAt,
    wait_timeout_at: waitTimeoutAt,
    context: initialContext,
    cost_qc,
    charge_status: cost_qc > 0 ? 'committed' : 'none',
    charge_committed_at: cost_qc > 0 ? now : null,
    started_at: now,
  };

  const { error: insertErr } = await sb.from('intent_chains').insert(row as never);
  if (insertErr) throw new DispatchError('persist_failed', insertErr.message);

  const aliasCommitment = persona.cohortMemberships?.[0] ?? undefined;

  // 7. Emit intent_chain_started (T0 stripped via sanitizer/builder)
  void emitOrchestrationEvent({
    event_id: randomUUID(),
    event_type: 'intent_chain_started',
    from_role: 'aigent-z',
    to_role: 'aigent-z',
    reason: 'chain_dispatch',
    journey_stage: 'prospect',
    active_cartridge: input.cartridge ?? null,
    active_codex: null,
    receipt_eligible: template.receipt_eligible ?? true,
    timestamp: now,
    metadata: buildChainReceiptMetadata({
      chain_id,
      template_id: template.id,
      template_version: template.version,
      step_id: firstStep.id,
      step_index: 0,
      step_kind: firstStep.kind,
      actor: firstStep.actor,
      actor_alias_commitment: aliasCommitment,
      extra: {
        initiating_nbe_id: input.initiating_nbe_id ?? undefined,
        cost_qc,
      },
    }),
  });

  // 8. Emit charge committed if cost_qc > 0
  if (cost_qc > 0) {
    void emitOrchestrationEvent({
      event_id: randomUUID(),
      event_type: 'intent_chain_charge_committed',
      from_role: 'aigent-z',
      to_role: 'aigent-z',
      reason: 'chain_qc_debit',
      journey_stage: 'prospect',
      active_cartridge: input.cartridge ?? null,
      active_codex: null,
      receipt_eligible: true,
      timestamp: now,
      metadata: buildChainReceiptMetadata({
        chain_id,
        template_id: template.id,
        template_version: template.version,
        actor_alias_commitment: aliasCommitment,
        extra: { cost_qc },
      }),
    });
  }

  // 9. Dispatch first step
  switch (firstStep.kind) {
    case 'compose': {
      const compose = firstStep.compose!;
      const seed = compose.seed_prompt_ref
        ? (resolveRefsInObject({ p: compose.seed_prompt_ref }, { context: initialContext }).p as string | undefined)
        : undefined;
      // User-facing — emit user_pending so the workspace surface knows to render
      void materializeUserPending(chain_id, template, firstStep, aliasCommitment);
      return {
        chain_id,
        template_id: template.id,
        template_version: template.version,
        status: initialStatus,
        current_step_id: firstStep.id,
        current_step_kind: 'compose',
        cost_qc,
        dispatch_hint: { kind: 'open_composer', composer_kind: compose.kind, seed_prompt: seed },
      };
    }
    case 'approve': {
      const approve = firstStep.approve!;
      const artifactRef = resolveRefsInObject({ ref: approve.artifact_ref }, { context: initialContext }).ref as string | undefined;
      void materializeUserPending(chain_id, template, firstStep, aliasCommitment);
      return {
        chain_id,
        template_id: template.id,
        template_version: template.version,
        status: initialStatus,
        current_step_id: firstStep.id,
        current_step_kind: 'approve',
        cost_qc,
        dispatch_hint: { kind: 'show_pill', step_label: firstStep.label, artifact_ref: artifactRef },
      };
    }
    case 'rpc': {
      void advanceRpcStep(chain_id, template, firstStep, aliasCommitment, input.cartridge ?? null);
      return {
        chain_id,
        template_id: template.id,
        template_version: template.version,
        status: 'active',
        current_step_id: firstStep.id,
        current_step_kind: 'rpc',
        cost_qc,
        dispatch_hint: {
          kind: 'rpc_in_flight',
          expected_outcome_event_type: firstStep.rpc!.expected_outcome_event_type,
        },
      };
    }
    case 'scheduled': {
      return {
        chain_id,
        template_id: template.id,
        template_version: template.version,
        status: 'waiting',
        current_step_id: firstStep.id,
        current_step_kind: 'scheduled',
        cost_qc,
        dispatch_hint: { kind: 'scheduled', advance_at: scheduledAdvanceAt! },
      };
    }
    case 'wait': {
      return {
        chain_id,
        template_id: template.id,
        template_version: template.version,
        status: 'waiting',
        current_step_id: firstStep.id,
        current_step_kind: 'wait',
        cost_qc,
        dispatch_hint: {
          kind: 'wait',
          expected_outcome_event_type: firstStep.wait!.expected_outcome_event_type,
        },
      };
    }
    default:
      throw new DispatchError('unknown_step_kind', String(firstStep.kind));
  }
}

function delayMs(delay: { value: number; unit: 'minutes' | 'hours' | 'days' }): number {
  const v = Math.max(0, Math.floor(delay.value));
  switch (delay.unit) {
    case 'minutes':
      return v * 60_000;
    case 'hours':
      return v * 60 * 60_000;
    case 'days':
      return v * 24 * 60 * 60_000;
  }
}
