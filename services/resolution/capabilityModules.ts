/**
 * capabilityModules — SPEC-CDR-001 P4 (D-2, D-3, D-4, D-11 — RATIFIED).
 *
 * The composition model's second term (§7.1):
 *
 *     Rendered card = base constitutional shape
 *                   + overlay context
 *                   + capability modules (named by the resolved profile)
 *
 * Modules exist so a sub-domain does not need its own card shape. Adding a
 * shape per sub-domain would multiply monolithic cards and re-create exactly
 * the rigidity `banking` demonstrated.
 *
 * ── HOW A MODULE IS SELECTED (operator, P4-1, 2026-07-25) ─────────────────
 * A Domain Profile **explicitly names** its applicable modules, as a typed
 * `CapabilityModuleId[]`. Modules are assertions governed by the profile's
 * existing provenance, confidence and verification lifecycle.
 *
 * **They do NOT imply execution-domain membership or executability**, and a
 * profile does NOT acquire `executionDomains` merely to support presentation.
 * That is the D-11 firewall: widening the execution contract for a rendering
 * reason is the §0.3 hazard this SPEC exists to prevent.
 *
 * The id is a closed union rather than `string[]` (operator refinement) so an
 * unknown module is a compile error, not a silently-dropped row.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * POSTURE IS DERIVED, NEVER RESTATED. An executable module's posture comes
 * from `EXECUTION_DOMAINS` (P1), which derives from the shipped
 * `FinancialDomain` union. A module cannot claim to be authoritative while its
 * execution domain is shadow-only, because it does not carry its own copy of
 * that fact. Governance modules are `non-executable` by construction —
 * D-2/D-3 ratified them as a separate, non-executable class (§4.2).
 */

import {
  EXECUTION_DOMAINS,
  type ExecutionPosture,
  type FinancialDomain,
} from '@/services/resolution/executionTaxonomy';

/** Closed union — §7.1's table, and the only modules that may be named. */
export type CapabilityModuleId =
  | 'financial-intelligence'
  | 'investment-operations'
  | 'market-operations'
  | 'constitutional-financial-integrity'
  | 'constitutional-commerce';

/**
 * `authoritative` / `shadow-only` mirror the shipped execution posture;
 * `non-executable` is the governance class, which has no execution surface at
 * all (not "an execution surface that is switched off").
 */
export type ModulePosture = ExecutionPosture | 'non-executable';

export interface CapabilityModuleDefinition {
  readonly id: CapabilityModuleId;
  readonly label: string;
  /** One line of context. Never an action prompt. */
  readonly summary: string;
  /** The execution domain this module presents, when it presents one.
   *  Absent for governance modules — they present no execution domain. */
  readonly executionDomain?: FinancialDomain;
  /** The governance domain this module presents, when non-executable. */
  readonly governanceDomain?: string;
  /**
   * Constitutional Capability Registry ids surfaced inside this module.
   * `financial-intelligence` carries the two ids the financial-context card
   * has rendered since 2026-07-24 — **reframed as this module, not
   * duplicated alongside it** (operator, P4-3: one rendering model, never
   * parallel "legacy rows" and "new modules").
   *
   * The other modules declare none today. Declared-and-empty rather than
   * omitted, so the table stays exhaustive and a future addition is a
   * deliberate edit rather than a silent gap.
   */
  readonly capabilityIds: readonly string[];
}

/** Posture for an execution-backed module, derived from P1's taxonomy. */
function postureFor(domain: FinancialDomain): ExecutionPosture {
  // Total by construction — EXECUTION_DOMAINS covers the whole union.
  return EXECUTION_DOMAINS.find((d) => d.id === domain)!.posture;
}

const DEFINITIONS: Record<CapabilityModuleId, CapabilityModuleDefinition> = {
  'financial-intelligence': {
    id: 'financial-intelligence',
    label: 'Financial Intelligence',
    summary: 'Constitutional capabilities governing money-shaped work on this page.',
    executionDomain: 'intelligence',
    capabilityIds: [
      'cap-moneypenny-financial-services',
      'financial-services-capability-suite',
    ],
  },
  'investment-operations': {
    id: 'investment-operations',
    label: 'Investment Operations',
    summary: 'Investment context. Recommendation-only; nothing executes from this surface.',
    executionDomain: 'investment',
    capabilityIds: [],
  },
  'market-operations': {
    id: 'market-operations',
    label: 'Market Operations',
    summary: 'Market context. Advice and orchestration only; never fund movement.',
    executionDomain: 'market',
    capabilityIds: [],
  },
  'constitutional-financial-integrity': {
    id: 'constitutional-financial-integrity',
    label: 'Constitutional Financial Integrity',
    summary: 'Governance context. Not an executable domain.',
    governanceDomain: 'constitutional-financial-integrity',
    capabilityIds: [],
  },
  'constitutional-commerce': {
    id: 'constitutional-commerce',
    label: 'Constitutional Commerce',
    summary: 'Governance context. Not an executable domain.',
    governanceDomain: 'constitutional-commerce',
    capabilityIds: [],
  },
};

export const CAPABILITY_MODULE_IDS = Object.keys(DEFINITIONS) as CapabilityModuleId[];

/** PURE — a module's definition. */
export function capabilityModule(id: CapabilityModuleId): CapabilityModuleDefinition {
  return DEFINITIONS[id];
}

/**
 * PURE — the posture a module presents.
 *
 * Executable modules derive it from the shipped execution taxonomy; a
 * governance module is `non-executable` because D-2/D-3 ratified those domains
 * as a class that cannot execute, not as one awaiting a flip.
 */
export function modulePosture(id: CapabilityModuleId): ModulePosture {
  const def = DEFINITIONS[id];
  return def.executionDomain ? postureFor(def.executionDomain) : 'non-executable';
}

/**
 * PURE — TRUE when a module may present an action affordance at all.
 *
 * D-11, the behavioural half of the firewall: only an authoritative module
 * may. A shadow-only or governance module renders **no action affordance** —
 * not a disabled one (operator, P4-4: a disabled button still implies the
 * action exists).
 */
export function moduleAllowsAction(id: CapabilityModuleId): boolean {
  return modulePosture(id) === 'authoritative';
}

/** PURE — the registry capability ids a set of modules surfaces, deduplicated
 *  and in module order. Replaces the old shape→ids table: ids now hang off
 *  the module a profile named, so there is one mapping rather than two. */
export function capabilityIdsForModules(
  modules: readonly CapabilityModuleId[],
): readonly string[] {
  const seen = new Set<string>();
  for (const id of modules) {
    for (const capabilityId of DEFINITIONS[id].capabilityIds) seen.add(capabilityId);
  }
  return [...seen];
}
