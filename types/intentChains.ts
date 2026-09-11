/**
 * Intent Chain Orchestrator — type contracts.
 *
 * Spec: codexes/packs/agentiq/items/AGENTIQ_INTENT_CHAINS_SPEC.md
 *
 * Naming convention: the orchestrator authority is **aigentMe** (the user's
 * personal agent). Server-side dispatcher + advancer act as aigentMe's
 * delegate. Every state transition is policy-checked against the user's
 * runtime policy. metaMe guardian retains final override.
 */

import type { OrchestrationEventType } from './orchestration';

// ── Step kinds ───────────────────────────────────────────────────────────

export type ChainStepKind =
  | 'compose'    // user-facing — opens composer overlay
  | 'rpc'        // server dispatches to an actor agent endpoint
  | 'approve'    // user-facing — surfaces an NBA pill with an artifact for review
  | 'scheduled'  // passive — cron advances when delay elapses
  | 'wait';      // passive — listener fires advance when matching event lands

export type ChainActor =
  | 'user'
  | 'marketa'
  | 'aigent-c'
  | 'aigent-z'
  | 'moneypenny'
  | 'aigentme'
  | 'system';

// ── Per-step shapes ──────────────────────────────────────────────────────

export interface ComposeStepConfig {
  kind: 'doc' | 'email' | 'slack' | 'note';
  seed_prompt_ref?: string;          // e.g. '$nbe.handoffHint'
}

export interface RpcStepConfig {
  endpoint: string;                  // e.g. '/api/marketa/propose'
  method?: 'POST' | 'PUT' | 'PATCH'; // default POST
  body_from?: 'prev_artifact' | 'chain_context' | 'static';
  body_static?: Record<string, unknown>;
  /** Orchestration event type the listener watches for to advance the chain. */
  expected_outcome_event_type: OrchestrationEventType;
  timeout_minutes?: number;          // default 30 (locked §11 #3)
}

export interface ApproveStepConfig {
  artifact_ref: string;              // e.g. '$prev.proposal_artifact_id' or '$chain.proposal_artifact_id'
  confirm_label: string;
  reject_label: string;
  on_reject_next?: string;           // step_id to re-route to on reject
}

export type DelayUnit = 'minutes' | 'hours' | 'days';

export interface ScheduledStepConfig {
  delay: { value: number; unit: DelayUnit };
  materialize_as: 'nba' | 'silent';  // 'nba' surfaces a pill at advance; 'silent' just advances
}

export interface WaitStepConfig {
  expected_outcome_event_type: OrchestrationEventType;
  timeout?: { value: number; unit: 'hours' | 'days' };
  on_timeout_next?: string;
}

// ── Branching ────────────────────────────────────────────────────────────

export interface ChainBranch {
  /**
   * Predicate evaluated against the step's outcome payload + chain context.
   * Syntax (v1): simple equality / existence checks.
   *   - "outcome.partner_replied"           — truthy field check
   *   - "decision == 'confirm'"             — equality check
   *   - "$chain.skip_flag == true"          — chain context check
   * Full expression language deferred to v1.5+.
   */
  if: string;
  next?: string;                     // step_id to route to
  terminate?: boolean;               // alternative to `next` — ends chain with 'completed'
}

// ── Step ────────────────────────────────────────────────────────────────

export interface ChainStep {
  id: string;                        // unique within template; slug
  label: string;                     // surfaced as pill breadcrumb
  actor: ChainActor;
  kind: ChainStepKind;

  compose?: ComposeStepConfig;
  rpc?: RpcStepConfig;
  approve?: ApproveStepConfig;
  scheduled?: ScheduledStepConfig;
  wait?: WaitStepConfig;

  next: string | null;               // default next step_id; null = terminal
  branches?: ChainBranch[];          // optional; evaluated in order, first match wins

  /**
   * Keys to copy from chain context into the DVN receipt metadata for this
   * step's completion event. Subject to sanitizeReceiptMetadata (no T0).
   */
  receipt_metadata_keys?: string[];
}

// ── Cost ────────────────────────────────────────────────────────────────

export interface ChainCostMetadata {
  /** T0 — never in receipts. Defaults to system treasury when omitted. */
  payee_persona_id?: string;
  /** Optional split for multi-party workflows. Percent integers summing to ≤100. v1.5+. */
  revenue_share?: Record<string, number>;
  refund_policy?: 'before_step_0_outcome' | 'never' | 'pro_rata_on_step_failure';
}

// ── Template ────────────────────────────────────────────────────────────

export interface ChainTemplate {
  id: string;                        // e.g. 'marketa.ask-partner-proposal'
  version: string;                   // e.g. 'v1' — snapshot on dispatch
  label: string;
  description?: string;

  /** Restrict template to specific cartridges. */
  cartridge_scope?: string[];

  /** nbeIds that can dispatch this chain. */
  triggered_by_nbe?: string[];

  /** All steps. Step IDs must be unique; `next` and branch `next` refs must resolve. */
  steps: ChainStep[];

  /** Failure behaviour. Default 'halt' — chain enters 'failed' status on first step failure. */
  on_failure?: 'halt' | 'continue';

  /** Whether each state transition emits a DVN-eligible receipt. Default true. */
  receipt_eligible?: boolean;

  /** Q¢ cost per end-to-end run (integer Q¢ per CLAUDE.md). 0 or omitted = free. */
  cost_qc?: number;
  cost_metadata?: ChainCostMetadata;
}

// ── Chain instance (DB row) ─────────────────────────────────────────────

export type IntentChainStatus = 'active' | 'waiting' | 'completed' | 'failed' | 'cancelled';

export type ChargeStatus = 'none' | 'committed' | 'refunded';

export interface IntentChainRow {
  chain_id: string;
  template_id: string;
  template_version: string;

  initiating_nbe_id: string | null;
  initiated_by_persona_id: string;             // T0 — never in JSON projections
  initiated_by_alias_commitment: string | null;
  cartridge: string | null;

  status: IntentChainStatus;
  current_step_id: string | null;
  current_step_kind: ChainStepKind | null;
  current_step_started_at: string | null;
  scheduled_advance_at: string | null;
  wait_timeout_at: string | null;

  context: Record<string, unknown>;

  cost_qc: number;
  charge_status: ChargeStatus;
  charge_committed_at: string | null;
  charge_refunded_at: string | null;

  last_event_id: string | null;
  started_at: string;
  terminated_at: string | null;
  termination_outcome: 'completed' | 'failed' | 'cancelled' | 'timeout' | null;

  updated_at: string;
}

/**
 * T1-safe projection of an IntentChainRow — strips `initiated_by_persona_id`.
 * Use everywhere the chain is returned to the browser or used in receipts.
 */
export type IntentChainView = Omit<IntentChainRow, 'initiated_by_persona_id'>;

// ── Step reference resolution ───────────────────────────────────────────

/**
 * Reference syntax supported in step body_from='static' bodies and
 * approve.artifact_ref / compose.seed_prompt_ref:
 *
 *   $nbe.X        — read from the originating NBE's metadata
 *   $prev.X       — read from the previous step's outcome event metadata
 *   $chain.X      — read from the chain's context map (any prior write)
 *
 * Resolution helper lives in services/intentChains/refs.ts.
 */
export type ChainRefScope = 'nbe' | 'prev' | 'chain';
