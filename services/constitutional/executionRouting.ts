/**
 * Execution routing — maps an Implementation Pack's own risk/uncertainty
 * signals to an `ExecutionProfile`, which in turn selects an
 * `ExecutionRoute` (provider + model + budget) for the implementation actor
 * that will execute it (Phase F bounded-execution repair, operator-directed
 * 2026-08-16).
 *
 * Deliberately takes a minimal, DUCK-TYPED input (`RoutingInput`) rather than
 * importing `ImplementationPack` from `implementationPack.ts` — that module
 * imports FROM this one (to populate `executionProfile`/`executionBudget`/
 * `forbiddenFiles` on the pack it generates), so importing the other
 * direction would be circular. The shape below is the exact subset of
 * `ImplementationPack` this module needs; it is kept in sync by convention,
 * not by a shared type import, because there is no third module both could
 * import it from without over-engineering a two-file relationship.
 *
 * "Provider/model mapping must be configuration, not constitutional logic"
 * (operator instruction): `PROFILE_ROUTES` below is a plain, editable table —
 * the ONLY thing that changes if a model id is renamed or a new provider
 * becomes available. Nothing about WHICH profile a pack resolves to depends
 * on that table; profile selection is pure risk/uncertainty reasoning over
 * the pack's own already-computed evidence (CFS-006a preflight, capability
 * evidence, forbidden-file overlap) — reusing `PackPreflight.disposition` as
 * the escalation signal it already is, never a second classification.
 */

import {
  DEFAULT_EXECUTION_BUDGETS,
  EXECUTION_PROFILES,
  type ExecutionBudget,
  type ExecutionProfile,
} from '@/services/constitutional/executionBudget';
import { isProtectedFile } from '@/services/constitutional/protectedFiles';

export type { ExecutionProfile };
export { EXECUTION_PROFILES };

/**
 * The provider-neutral identifier for an implementation-actor transport.
 * Defined HERE (not in the adapter module) so both `executionRouting.ts`
 * (which selects a provider) and `actors/implementationActorAdapter.ts`
 * (which implements one) import it from ONE place without a circular
 * dependency between the two. Only `'anthropic-claude-code'` has a live
 * adapter today (`actors/anthropicClaudeCodeAdapter.ts`); the others are
 * named so the routing table and the adapter registry share one vocabulary
 * from the start, never a string retyped in two places.
 */
export const IMPLEMENTATION_ACTOR_PROVIDERS = [
  'anthropic-claude-code',
  'openai-codex',
  'google-jules',
] as const;
export type ImplementationActorProvider = (typeof IMPLEMENTATION_ACTOR_PROVIDERS)[number];

/** The exact subset of `ImplementationPack` execution routing needs. */
export interface RoutingInput {
  /** The pack's FINAL surface — after implementationPack.ts has already
   *  excluded any unauthorized protected file. Profile selection trusts this
   *  is final; it does not re-derive or re-filter it. */
  areasToTouch: string[];
  /** Carried for context/telemetry parity with the pack — protected-surface
   *  escalation itself checks `areasToTouch` against the full protected-file
   *  manifest (`isProtectedFile`), not this narrowed list (2026-08-18
   *  correction; see `selectExecutionProfile`). */
  forbiddenFiles: string[];
  preflight: { disposition: 'proceed' | 'escalate'; risk: { score: number } } | null;
}

export interface ExecutionRoute {
  profile: ExecutionProfile;
  provider: ImplementationActorProvider;
  model: string;
  budget: ExecutionBudget;
  /** Human-readable reason THIS profile was selected — carried into
   *  execution telemetry so a routing decision is auditable, never a black
   *  box (mirrors the transparency `PackPreflight.rationale` already gives
   *  the consequence-preflight step). */
  reason: string;
}

/** A high risk-preflight score is treated the same as an explicit escalate
 *  disposition — the SAME heuristic risk scale `assessRiskHeuristic` already
 *  produces for `PackPreflight.risk.score` (0-100), not a new scale. */
const HIGH_RISK_SCORE_THRESHOLD = 60;

/**
 * routine    — no protected-surface contact, no escalation signal, no prior
 *              failure. The common case; the cheapest capable model.
 * complex    — no protected-surface contact, but the preflight risk score is
 *              elevated (still `disposition: 'proceed'`, just not trivial).
 * protected  — the pack's FINAL, post-coherence-filter `areasToTouch`
 *              (see `implementationPack.ts` — a protected file that was
 *              proposed by retrieval/evidence but excluded as unauthorized
 *              is, by the time it reaches here, simply absent from
 *              `areasToTouch`) still names a genuinely protected file —
 *              either it was explicitly authorized (`authorizedProtectedFiles`)
 *              or the preflight forced `disposition: 'escalate'`. Either way:
 *              highest-stakes territory, strongest model, regardless of
 *              surface size.
 * remediation — a prior attempt on this exact branch already failed. The
 *              failure itself is evidence the task is harder than first
 *              estimated; treated as an escalation, not a discount.
 */
export function selectExecutionProfile(pack: RoutingInput, priorAttemptFailed: boolean): ExecutionProfile {
  if (priorAttemptFailed) return 'remediation';
  // Pack-coherence correction (2026-08-18, operator-directed): checked
  // against the FULL protected-file manifest (`isProtectedFile`), never the
  // possibly-narrowed `forbiddenFiles` — an authorized protected file is NOT
  // in forbiddenFiles (that is what authorization means) but MUST still
  // escalate, because approved implementation genuinely touches it. Checked
  // over the CALLER-SUPPLIED areasToTouch, which by contract is the pack's
  // FINAL surface (implementationPack.ts filters unauthorized protected
  // files out before calling this) — so a file merely surfaced as
  // reference/evidence and then excluded is already gone from areasToTouch
  // and cannot, by itself, force this escalation. Retrieval surfacing a
  // protected reference is not the same fact as the approved implementation
  // requiring a protected-surface MODIFICATION; only the latter escalates.
  const touchesProtectedSurface = pack.areasToTouch.some((a) => isProtectedFile(a));
  const forcesEscalation = pack.preflight?.disposition === 'escalate';
  if (touchesProtectedSurface || forcesEscalation) return 'protected';
  if ((pack.preflight?.risk.score ?? 0) > HIGH_RISK_SCORE_THRESHOLD) return 'complex';
  return 'routine';
}

/**
 * Provider/model mapping — CONFIGURATION, not constitutional logic. Model
 * ids are the SAME allowlisted identifiers `services/experiments/llm.ts::
 * EXPERIMENT_MODEL_OPTIONS` already governs for every other constitutional
 * inference call in this codebase (`claude-sonnet-4-6`, `claude-opus-4-6`) —
 * reused for consistency, not re-derived. This is the one place the
 * forensic audit's "unpinned Opus default" finding is closed: every profile
 * now names an EXPLICIT model, recorded in execution telemetry, never left
 * to whatever the action/CLI defaults to that day.
 */
const PROFILE_ROUTES: Record<ExecutionProfile, { provider: ImplementationActorProvider; model: string }> = {
  routine: { provider: 'anthropic-claude-code', model: 'claude-sonnet-4-6' },
  complex: { provider: 'anthropic-claude-code', model: 'claude-sonnet-4-6' },
  protected: { provider: 'anthropic-claude-code', model: 'claude-opus-4-6' },
  remediation: { provider: 'anthropic-claude-code', model: 'claude-opus-4-6' },
};

const PROFILE_REASON: Record<ExecutionProfile, string> = {
  routine: 'no protected-surface contact, no escalation signal, no prior failure — cheapest capable model',
  complex: 'preflight risk score elevated (still proceed) — a stronger model without full escalation',
  protected: 'protected-surface contact or preflight forced escalation — highest-stakes tier',
  remediation: 'a prior attempt on this branch already failed — treated as escalation, not discount',
};

/** The one entry point callers use: pack → route. Never invents a provider
 *  or model outside `PROFILE_ROUTES` — that table is the only thing an
 *  operator needs to edit to change routing behavior. */
export function routeExecution(pack: RoutingInput, priorAttemptFailed = false): ExecutionRoute {
  const profile = selectExecutionProfile(pack, priorAttemptFailed);
  const { provider, model } = PROFILE_ROUTES[profile];
  return {
    profile,
    provider,
    model,
    budget: DEFAULT_EXECUTION_BUDGETS[profile],
    reason: PROFILE_REASON[profile],
  };
}
