/**
 * Intent chain advancer — drives the chain from one step to the next on
 * observation of an outcome event. Hooked into the orchestration event
 * emitter so any DVN-eligible event that matches a chain's current step
 * advances it synchronously after insert.
 *
 * The advancer is the single source of truth for chain state transitions
 * beyond dispatch. Dispatcher hands off; advancer drives.
 *
 * Authority alignment:
 *   - Every transition is a DVN-receipt-eligible event (sanitized)
 *   - User-facing transitions emit intent_chain_step_user_pending so the
 *     workspace surface can materialize a pill
 *   - Cron-driven scheduled advancement reuses this same advancer (called
 *     by /api/ops/sync/cron-tick for chains whose scheduled_advance_at
 *     has elapsed)
 */

import { randomUUID } from 'crypto';
import type {
  ChainTemplate,
  ChainStep,
  IntentChainRow,
  IntentChainStatus,
} from '@/types/intentChains';
import type { OrchestrationEvent, OrchestrationEventType } from '@/types/orchestration';
import { getTemplate } from '@/services/intentChains/registry';
import { evaluateBranch, resolveRefsInObject } from '@/services/intentChains/refs';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';
import { buildChainReceiptMetadata } from '@/services/orchestration/sanitizeReceiptMetadata';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

const CHAIN_INTERNAL_EVENTS = new Set<OrchestrationEventType>([
  'intent_chain_started',
  'intent_chain_step_dispatched',
  'intent_chain_step_completed',
  'intent_chain_step_failed',
  'intent_chain_step_rerouted',
  'intent_chain_step_user_pending',
  'intent_chain_completed',
  'intent_chain_failed',
  'intent_chain_cancelled',
  'intent_chain_timeout',
  'intent_chain_charge_committed',
  'intent_chain_charge_refunded',
  'intent_chain_feedback_recorded',
]);

/**
 * Inline hook called from emitOrchestrationEvent after every insert.
 * Returns silently when the event isn't chain-relevant. Never throws —
 * advancement failures are logged + the chain enters 'failed' status,
 * but they don't break the originating emit caller.
 */
export async function advanceChainIfNeeded(event: OrchestrationEvent): Promise<void> {
  try {
    // Internal chain events never trigger advancement — they ARE chain transitions
    if (CHAIN_INTERNAL_EVENTS.has(event.event_type)) return;
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const chainId = typeof meta.chain_id === 'string' ? (meta.chain_id as string) : null;
    if (!chainId) return;
    const chain = await loadChain(chainId);
    if (!chain) return;
    if (chain.status !== 'active' && chain.status !== 'waiting') return;
    const template = getTemplate(chain.template_id);
    if (!template) return; // template gone (deleted/renamed) — chain stalls
    const currentStep = template.steps.find((s) => s.id === chain.current_step_id);
    if (!currentStep) return;
    const expected = stepExpectedOutcome(currentStep);
    if (!expected || event.event_type !== expected) return;
    await onStepOutcomeObserved(chain, template, currentStep, event);
  } catch (err) {
    // Best-effort — never throw out of the listener.
    console.error('[advanceChainIfNeeded] error:', (err as Error).message);
  }
}

/**
 * RPC step dispatch. Called from the dispatcher (first step) and from
 * onStepOutcomeObserved (subsequent rpc steps).
 *
 * Server-to-server auth: includes X-Chain-Orchestrator-Token from env.
 * Endpoint MUST emit the expected_outcome_event_type during processing
 * with metadata.chain_id matching, so the listener correlates it back.
 */
export async function advanceRpcStep(
  chain_id: string,
  template: ChainTemplate,
  step: ChainStep,
  actor_alias_commitment: string | undefined,
  cartridge: string | null,
): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;
  const chain = await loadChain(chain_id);
  if (!chain) return;

  const cfg = step.rpc!;
  const body: Record<string, unknown> = { ...(cfg.body_static ?? {}) };
  if (cfg.body_from === 'prev_artifact') {
    const prev = (chain.context.__prev ?? {}) as Record<string, unknown>;
    if (prev.artifact_id) body.brief_artifact_id = prev.artifact_id;
    if (prev.proposal_artifact_id) body.proposal_artifact_id = prev.proposal_artifact_id;
  } else if (cfg.body_from === 'chain_context') {
    // Spread chain context but skip internal __slots
    for (const [k, v] of Object.entries(chain.context)) {
      if (k.startsWith('__')) continue;
      body[k] = v;
    }
  }
  body.chain_id = chain_id;
  body.step_id = step.id;
  if (chain.initiated_by_alias_commitment) {
    body.initiated_by_alias_commitment = chain.initiated_by_alias_commitment;
  }

  const now = new Date().toISOString();

  // Emit step_dispatched receipt before the call (audit-first)
  void emitOrchestrationEvent({
    event_id: randomUUID(),
    event_type: 'intent_chain_step_dispatched',
    from_role: 'aigent-z',
    to_role: actorToRole(step.actor),
    reason: 'chain_step_dispatch',
    journey_stage: 'prospect',
    active_cartridge: cartridge,
    active_codex: null,
    receipt_eligible: template.receipt_eligible ?? true,
    timestamp: now,
    metadata: buildChainReceiptMetadata({
      chain_id,
      template_id: template.id,
      template_version: template.version,
      step_id: step.id,
      step_kind: step.kind,
      actor: step.actor,
      actor_alias_commitment,
      extra: { dispatch_target: cfg.endpoint, expected_outcome_event_type: cfg.expected_outcome_event_type },
    }),
  });

  // Fire the RPC — fire-and-forget (the endpoint emits the outcome event
  // during its processing; the listener advances when that lands).
  // Errors here mark the step failed; we DON'T await chain transition.
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.AMPLIFY_APP_URL || 'http://localhost:3000';
    const orchestratorToken = process.env.ORCHESTRATOR_SERVICE_TOKEN || '';
    const url = cfg.endpoint.startsWith('http') ? cfg.endpoint : `${base}${cfg.endpoint}`;
    const controller = new AbortController();
    const timeoutMs = (cfg.timeout_minutes ?? 30) * 60_000;
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: cfg.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(orchestratorToken ? { 'X-Chain-Orchestrator-Token': orchestratorToken } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      await markStepFailed(chain, template, step, `rpc_${res.status}: ${detail.slice(0, 120)}`);
    }
    // Success or async — endpoint may have already emitted its outcome event,
    // which advanceChainIfNeeded will pick up.
  } catch (err) {
    const msg = (err as Error).message ?? 'rpc_failed';
    await markStepFailed(chain, template, step, msg);
  }
}

/**
 * Emit intent_chain_step_user_pending so the workspace + pill surface
 * can render. The advancer doesn't materialize a UI pill — the
 * AigentMeWelcomeSplitTab listens for this event class and queues the
 * pill on the user's metaMe.
 */
export async function materializeUserPending(
  chain_id: string,
  template: ChainTemplate,
  step: ChainStep,
  actor_alias_commitment: string | undefined,
): Promise<void> {
  void emitOrchestrationEvent({
    event_id: randomUUID(),
    event_type: 'intent_chain_step_user_pending',
    from_role: 'aigent-z',
    to_role: 'aigent-c',
    reason: 'chain_step_user_pending',
    journey_stage: 'prospect',
    active_cartridge: null,
    active_codex: null,
    receipt_eligible: template.receipt_eligible ?? true,
    timestamp: new Date().toISOString(),
    metadata: buildChainReceiptMetadata({
      chain_id,
      template_id: template.id,
      template_version: template.version,
      step_id: step.id,
      step_kind: step.kind,
      actor: step.actor,
      actor_alias_commitment,
      extra: { step_label: step.label, confirm_label: step.approve?.confirm_label, reject_label: step.approve?.reject_label },
    }),
  });
}

/**
 * User-driven step completion — called from the API when the user
 * confirms an approve step, completes a compose step (via the
 * AigentMeWelcomeSplitTab seam), etc. The advancer treats it like any
 * other outcome event and routes through onStepOutcomeObserved.
 */
export async function completeUserStep(
  chain_id: string,
  outcomeMetadata: Record<string, unknown>,
): Promise<void> {
  const chain = await loadChain(chain_id);
  if (!chain) return;
  const template = getTemplate(chain.template_id);
  if (!template) return;
  const currentStep = template.steps.find((s) => s.id === chain.current_step_id);
  if (!currentStep) return;
  if (currentStep.kind !== 'compose' && currentStep.kind !== 'approve') return;

  // Synthesise an outcome event payload — fed into the advancer as if
  // a real OrchestrationEvent had arrived.
  const synthEvent: OrchestrationEvent = {
    event_id: randomUUID(),
    event_type: 'intent_chain_step_completed', // synthetic — internal — won't re-trigger advancer
    from_role: 'aigent-c',
    to_role: 'aigent-z',
    reason: 'user_completed_step',
    journey_stage: 'prospect',
    active_cartridge: chain.cartridge,
    active_codex: null,
    receipt_eligible: true,
    timestamp: new Date().toISOString(),
    metadata: { chain_id, step_id: currentStep.id, ...outcomeMetadata },
  };
  await onStepOutcomeObserved(chain, template, currentStep, synthEvent);
}

// ── Internal: step outcome → advance ─────────────────────────────────────

async function onStepOutcomeObserved(
  chain: IntentChainRow,
  template: ChainTemplate,
  currentStep: ChainStep,
  event: OrchestrationEvent,
): Promise<void> {
  const outcomeMeta = (event.metadata ?? {}) as Record<string, unknown>;

  // 1. Merge outcome into chain context (__prev slot + selective top-level)
  const newContext: Record<string, unknown> = { ...chain.context, __prev: outcomeMeta };
  // Surface known artifact references at the top level so subsequent steps
  // can reference $chain.proposal_artifact_id etc.
  for (const k of ['artifact_id', 'proposal_artifact_id', 'brief_artifact_id', 'message_id', 'recipient']) {
    if (outcomeMeta[k] !== undefined && k !== 'recipient') newContext[k] = outcomeMeta[k];
    // 'recipient' is T0 PII — never written to chain context; passed only through body for the rpc step that uses it
  }

  // 2. Emit step_completed receipt
  void emitOrchestrationEvent({
    event_id: randomUUID(),
    event_type: 'intent_chain_step_completed',
    from_role: actorToRole(currentStep.actor),
    to_role: 'aigent-z',
    reason: 'chain_step_outcome',
    journey_stage: 'prospect',
    active_cartridge: chain.cartridge,
    active_codex: null,
    receipt_eligible: template.receipt_eligible ?? true,
    timestamp: event.timestamp,
    metadata: buildChainReceiptMetadata({
      chain_id: chain.chain_id,
      template_id: template.id,
      template_version: chain.template_version,
      step_id: currentStep.id,
      step_kind: currentStep.kind,
      actor: currentStep.actor,
      actor_alias_commitment: chain.initiated_by_alias_commitment ?? undefined,
      extra: pickReceiptExtras(currentStep, outcomeMeta),
      receipt_metadata_keys: currentStep.receipt_metadata_keys,
    }),
  });

  // 3. Resolve next step
  const ctx = { context: newContext };
  let nextStepId: string | null | undefined = currentStep.next;
  let terminate = false;
  let rerouted = false;
  for (const branch of currentStep.branches ?? []) {
    if (evaluateBranch(branch.if, outcomeMeta, ctx)) {
      if (branch.terminate) {
        terminate = true;
      } else if (branch.next) {
        nextStepId = branch.next;
        rerouted = nextStepId !== currentStep.next;
      }
      break;
    }
  }

  // 4. Emit reroute receipt if branch took a non-default path
  if (rerouted && nextStepId) {
    void emitOrchestrationEvent({
      event_id: randomUUID(),
      event_type: 'intent_chain_step_rerouted',
      from_role: 'aigent-z',
      to_role: 'aigent-z',
      reason: 'chain_branch_taken',
      journey_stage: 'prospect',
      active_cartridge: chain.cartridge,
      active_codex: null,
      receipt_eligible: template.receipt_eligible ?? true,
      timestamp: new Date().toISOString(),
      metadata: buildChainReceiptMetadata({
        chain_id: chain.chain_id,
        template_id: template.id,
        template_version: chain.template_version,
        actor_alias_commitment: chain.initiated_by_alias_commitment ?? undefined,
        extra: { from_step_id: currentStep.id, to_step_id: nextStepId },
      }),
    });
  }

  // 5. Terminal step → mark chain completed
  if (terminate || !nextStepId) {
    await completeChain(chain, template, newContext);
    return;
  }

  // 6. Advance to next step
  const nextStep = template.steps.find((s) => s.id === nextStepId);
  if (!nextStep) {
    await markStepFailed(chain, template, currentStep, `next_step_unresolved: ${nextStepId}`);
    return;
  }
  await transitionToStep(chain, template, nextStep, newContext);
}

async function transitionToStep(
  chain: IntentChainRow,
  template: ChainTemplate,
  nextStep: ChainStep,
  newContext: Record<string, unknown>,
): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;

  const now = new Date().toISOString();
  const newStatus: IntentChainStatus =
    nextStep.kind === 'scheduled' || nextStep.kind === 'wait' ? 'waiting' : 'active';
  const scheduledAdvanceAt =
    nextStep.kind === 'scheduled' && nextStep.scheduled
      ? new Date(Date.now() + delayMs(nextStep.scheduled.delay)).toISOString()
      : null;
  const waitTimeoutAt =
    nextStep.kind === 'wait' && nextStep.wait?.timeout
      ? new Date(Date.now() + delayMs(nextStep.wait.timeout)).toISOString()
      : null;

  const { error } = await sb
    .from('intent_chains')
    .update({
      status: newStatus,
      current_step_id: nextStep.id,
      current_step_kind: nextStep.kind,
      current_step_started_at: now,
      scheduled_advance_at: scheduledAdvanceAt,
      wait_timeout_at: waitTimeoutAt,
      context: newContext,
    })
    .eq('chain_id', chain.chain_id);
  if (error) {
    console.error('[transitionToStep] update failed:', error.message);
    return;
  }

  const aliasCommitment = chain.initiated_by_alias_commitment ?? undefined;

  // Dispatch the new step's work
  switch (nextStep.kind) {
    case 'rpc':
      void advanceRpcStep(chain.chain_id, template, nextStep, aliasCommitment, chain.cartridge);
      break;
    case 'compose':
    case 'approve':
      void materializeUserPending(chain.chain_id, template, nextStep, aliasCommitment);
      break;
    case 'scheduled':
      // Cron will advance when scheduled_advance_at <= now()
      // Emit a dispatched receipt so audit trail shows the scheduled wait was set up
      void emitOrchestrationEvent({
        event_id: randomUUID(),
        event_type: 'intent_chain_step_dispatched',
        from_role: 'aigent-z',
        to_role: 'system',
        reason: 'chain_step_scheduled',
        journey_stage: 'prospect',
        active_cartridge: chain.cartridge,
        active_codex: null,
        receipt_eligible: template.receipt_eligible ?? true,
        timestamp: now,
        metadata: buildChainReceiptMetadata({
          chain_id: chain.chain_id,
          template_id: template.id,
          template_version: chain.template_version,
          step_id: nextStep.id,
          step_kind: 'scheduled',
          actor: 'system',
          actor_alias_commitment: aliasCommitment,
          extra: { advance_at: scheduledAdvanceAt ?? '' },
        }),
      });
      break;
    case 'wait':
      // Listener will advance when matching event lands. No dispatch needed.
      break;
  }
}

async function completeChain(
  chain: IntentChainRow,
  template: ChainTemplate,
  finalContext: Record<string, unknown>,
): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;
  const now = new Date().toISOString();
  await sb
    .from('intent_chains')
    .update({
      status: 'completed',
      current_step_id: null,
      current_step_kind: null,
      terminated_at: now,
      termination_outcome: 'completed',
      context: finalContext,
    })
    .eq('chain_id', chain.chain_id);

  const totalSteps = template.steps.length;
  const startedMs = Date.parse(chain.started_at);
  const durationMs = Number.isFinite(startedMs) ? Date.now() - startedMs : null;

  void emitOrchestrationEvent({
    event_id: randomUUID(),
    event_type: 'intent_chain_completed',
    from_role: 'aigent-z',
    to_role: 'aigent-z',
    reason: 'chain_terminal_step',
    journey_stage: 'prospect',
    active_cartridge: chain.cartridge,
    active_codex: null,
    receipt_eligible: template.receipt_eligible ?? true,
    timestamp: now,
    metadata: buildChainReceiptMetadata({
      chain_id: chain.chain_id,
      template_id: template.id,
      template_version: chain.template_version,
      actor_alias_commitment: chain.initiated_by_alias_commitment ?? undefined,
      extra: { total_steps: totalSteps, duration_ms: durationMs ?? undefined },
    }),
  });
}

async function markStepFailed(
  chain: IntentChainRow,
  template: ChainTemplate,
  step: ChainStep,
  errorMessage: string,
): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;
  const now = new Date().toISOString();
  const shouldHalt = (template.on_failure ?? 'halt') === 'halt';

  void emitOrchestrationEvent({
    event_id: randomUUID(),
    event_type: 'intent_chain_step_failed',
    from_role: actorToRole(step.actor),
    to_role: 'aigent-z',
    reason: 'chain_step_failure',
    journey_stage: 'prospect',
    active_cartridge: chain.cartridge,
    active_codex: null,
    receipt_eligible: template.receipt_eligible ?? true,
    timestamp: now,
    metadata: buildChainReceiptMetadata({
      chain_id: chain.chain_id,
      template_id: template.id,
      template_version: chain.template_version,
      step_id: step.id,
      step_kind: step.kind,
      actor: step.actor,
      actor_alias_commitment: chain.initiated_by_alias_commitment ?? undefined,
      extra: { error_message: errorMessage, error_class: classifyError(errorMessage) },
    }),
  });

  if (!shouldHalt) return;

  await sb
    .from('intent_chains')
    .update({
      status: 'failed',
      terminated_at: now,
      termination_outcome: 'failed',
    })
    .eq('chain_id', chain.chain_id);

  void emitOrchestrationEvent({
    event_id: randomUUID(),
    event_type: 'intent_chain_failed',
    from_role: 'aigent-z',
    to_role: 'aigent-z',
    reason: 'chain_halt_on_failure',
    journey_stage: 'prospect',
    active_cartridge: chain.cartridge,
    active_codex: null,
    receipt_eligible: template.receipt_eligible ?? true,
    timestamp: now,
    metadata: buildChainReceiptMetadata({
      chain_id: chain.chain_id,
      template_id: template.id,
      template_version: chain.template_version,
      actor_alias_commitment: chain.initiated_by_alias_commitment ?? undefined,
      extra: { failed_step_id: step.id, error_class: classifyError(errorMessage) },
    }),
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function loadChain(chain_id: string): Promise<IntentChainRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data } = await sb.from('intent_chains').select('*').eq('chain_id', chain_id).maybeSingle();
  return (data as IntentChainRow | null) ?? null;
}

function stepExpectedOutcome(step: ChainStep): OrchestrationEventType | null {
  if (step.kind === 'rpc') return step.rpc?.expected_outcome_event_type ?? null;
  if (step.kind === 'wait') return step.wait?.expected_outcome_event_type ?? null;
  // compose + approve advance via completeUserStep (synthetic event path);
  // scheduled advances via cron-tick. None of these trigger external matching.
  return null;
}

function pickReceiptExtras(step: ChainStep, outcomeMeta: Record<string, unknown>): Record<string, unknown> {
  // Pass through outcome metadata; sanitizer + receipt_metadata_keys filter T0/non-allowlisted.
  return { ...outcomeMeta };
}

function actorToRole(actor: ChainStep['actor']): 'metame-guardian' | 'aigent-z' | 'aigent-c' | 'cartridge-lead' | 'specialist' | 'guide-agent' {
  switch (actor) {
    case 'user':
      return 'aigent-c';
    case 'marketa':
    case 'moneypenny':
      return 'guide-agent';
    case 'aigent-c':
      return 'aigent-c';
    case 'aigent-z':
      return 'aigent-z';
    case 'aigentme':
      return 'metame-guardian';
    case 'system':
      return 'aigent-z';
    default:
      return 'aigent-z';
  }
}

function classifyError(msg: string): 'timeout' | 'http_4xx' | 'http_5xx' | 'network' | 'config' | 'unknown' {
  if (/abort|timeout/i.test(msg)) return 'timeout';
  if (/^rpc_4\d\d/.test(msg)) return 'http_4xx';
  if (/^rpc_5\d\d/.test(msg)) return 'http_5xx';
  if (/fetch|network|ECONN|ENOTFOUND/i.test(msg)) return 'network';
  if (/_not_configured|env|missing/i.test(msg)) return 'config';
  return 'unknown';
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
