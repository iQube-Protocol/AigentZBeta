/**
 * V-1 — the preparation-cost instrument.
 *
 * This is not analysis performed on results. It is the instrument that must
 * exist BEFORE scenarios can be scored: with nothing measuring preparation
 * cost, H2's "preparation-cost recovery" claim is unmeasurable and H3 cannot be
 * posed at all.
 *
 * Two design commitments, both from the charter and both easy to lose:
 *
 *  1. **The opportunity is the accounting unit, never the trade** (R-3).
 *     Executed, correctly-refused, abandoned and failed opportunities are all
 *     fully measurable populations. A refusal is not a zero and not a missing
 *     record — refusal is a SERVICE TYPE with its own cost events. Any
 *     trade-keyed or day-aggregated unit hides the cost of rejected
 *     opportunities inside executed-trade totals, and the failure is silent:
 *     every figure computes, on the wrong denominator.
 *
 *  2. **Never collapse to one monetary figure.** Elapsed time, model tokens,
 *     compute units, external cost, human time and evidence count are carried
 *     through aggregation as SEPARATE dimensions. A pricing model that turns
 *     them into money can be revised; evidence discarded at capture time
 *     cannot be recovered. `PreparationCostAggregate` therefore has no
 *     `totalCostMinorUnits` scalar, and adding one would be a regression.
 *
 * Everything here is pure: no clock, no randomness, no I/O. Aggregations are
 * views computed on demand, never stored — a stored total would be a second
 * source of truth that drifts from the events (inv.engineering.036).
 */

import type {
  ConstitutionalCompletionVerdict,
  PreparationCostEvent,
  VentureOpportunity,
  VentureOpportunityStatus,
  VentureServiceType,
} from './types';

/**
 * The six preserved cost dimensions plus the evidence count. Deliberately NOT
 * reduced to a single figure — see the module header.
 */
export interface PreparationCostAggregate {
  /** How many measured work events this aggregate spans. */
  events: number;
  /** Distinct opportunities covered — the denominator for per-opportunity means. */
  opportunities: number;
  elapsedMs: number;
  modelTokens: number;
  computeUnits: number;
  humanTimeMs: number;
  /** Minor units, decimal string — summed exactly, never through a float. */
  externalCostMinorUnits: string;
  evidenceCount: number;
}

const ZERO_AGGREGATE: PreparationCostAggregate = {
  events: 0,
  opportunities: 0,
  elapsedMs: 0,
  modelTokens: 0,
  computeUnits: 0,
  humanTimeMs: 0,
  externalCostMinorUnits: '0',
  evidenceCount: 0,
};

/** Exact minor-unit addition. Money never goes through a float here. */
function addMinorUnits(a: string, b: string | undefined): string {
  return (BigInt(a) + BigInt(b ?? '0')).toString();
}

/** Aggregate a set of cost events across all six dimensions. */
export function aggregatePreparationCost(
  events: readonly PreparationCostEvent[],
): PreparationCostAggregate {
  const opportunities = new Set<string>();
  let out: PreparationCostAggregate = { ...ZERO_AGGREGATE };
  for (const e of events) {
    opportunities.add(e.opportunityId);
    out = {
      events: out.events + 1,
      opportunities: 0, // filled once, below
      elapsedMs: out.elapsedMs + e.elapsedMs,
      modelTokens: out.modelTokens + (e.modelTokens ?? 0),
      computeUnits: out.computeUnits + (e.computeUnits ?? 0),
      humanTimeMs: out.humanTimeMs + (e.humanTimeMs ?? 0),
      externalCostMinorUnits: addMinorUnits(out.externalCostMinorUnits, e.externalCostMinorUnits),
      evidenceCount: out.evidenceCount + e.evidenceRefs.length,
    };
  }
  return { ...out, opportunities: opportunities.size };
}

function groupBy<K>(
  events: readonly PreparationCostEvent[],
  key: (e: PreparationCostEvent) => K,
): Map<K, PreparationCostEvent[]> {
  const map = new Map<K, PreparationCostEvent[]>();
  for (const e of events) {
    const k = key(e);
    const bucket = map.get(k);
    if (bucket) bucket.push(e);
    else map.set(k, [e]);
  }
  return map;
}

function aggregateGroups<K>(groups: Map<K, PreparationCostEvent[]>): Map<K, PreparationCostAggregate> {
  const out = new Map<K, PreparationCostAggregate>();
  for (const [k, list] of groups) out.set(k, aggregatePreparationCost(list));
  return out;
}

/** Cost per opportunity — the canonical accounting interval (R-3). */
export function costPerOpportunity(
  events: readonly PreparationCostEvent[],
): Map<string, PreparationCostAggregate> {
  return aggregateGroups(groupBy(events, (e) => e.opportunityId));
}

/** Cost per agent — who bore the preparation burden. */
export function costPerAgent(
  events: readonly PreparationCostEvent[],
): Map<string, PreparationCostAggregate> {
  return aggregateGroups(groupBy(events, (e) => e.agentRef));
}

/** Cost by service type — where the constitutional effort actually went. */
export function costByServiceType(
  events: readonly PreparationCostEvent[],
): Map<VentureServiceType, PreparationCostAggregate> {
  return aggregateGroups(groupBy(events, (e) => e.serviceType));
}

/**
 * Cost of the opportunities in a given status population. The point of taking
 * statuses as a parameter rather than hard-coding "executed" is that refused,
 * abandoned and failed opportunities are equally first-class populations — a
 * helper that could only answer "what did executed opportunities cost" would
 * rebuild the exact blind spot R-3 rules against.
 */
export function costOfOpportunitiesWithStatus(
  events: readonly PreparationCostEvent[],
  opportunities: readonly VentureOpportunity[],
  statuses: readonly VentureOpportunityStatus[],
): PreparationCostAggregate {
  const wanted = new Set(statuses);
  const ids = new Set(opportunities.filter((o) => wanted.has(o.status)).map((o) => o.opportunityId));
  return aggregatePreparationCost(events.filter((e) => ids.has(e.opportunityId)));
}

/** Cost of executed opportunities. */
export function costOfExecutedOpportunities(
  events: readonly PreparationCostEvent[],
  opportunities: readonly VentureOpportunity[],
): PreparationCostAggregate {
  return costOfOpportunitiesWithStatus(events, opportunities, ['executed']);
}

/**
 * Cost of CORRECTLY-REFUSED opportunities. This figure is the reason the
 * instrument exists: it is invisible to any trade-keyed cost model, and H3
 * cannot be scored without it.
 */
export function costOfCorrectlyRefusedOpportunities(
  events: readonly PreparationCostEvent[],
  opportunities: readonly VentureOpportunity[],
): PreparationCostAggregate {
  return costOfOpportunitiesWithStatus(events, opportunities, ['correctly-refused']);
}

/**
 * Cost per constitutionally-completed service — the denominator is opportunities
 * whose verdict is COMPLETE, whether they executed or were correctly refused.
 * Returns null when nothing completed, rather than a divide-by-zero zero that
 * would read as "free".
 */
export function costPerConstitutionallyCompletedService(
  events: readonly PreparationCostEvent[],
  verdicts: readonly ConstitutionalCompletionVerdict[],
): { completed: number; perCompleted: PreparationCostAggregate } | null {
  const completedIds = new Set(verdicts.filter((v) => v.complete).map((v) => v.opportunityId));
  if (completedIds.size === 0) return null;
  const total = aggregatePreparationCost(events.filter((e) => completedIds.has(e.opportunityId)));
  const n = completedIds.size;
  return {
    completed: n,
    perCompleted: {
      events: total.events / n,
      opportunities: total.opportunities / n,
      elapsedMs: total.elapsedMs / n,
      modelTokens: total.modelTokens / n,
      computeUnits: total.computeUnits / n,
      humanTimeMs: total.humanTimeMs / n,
      // Integer division in minor units — a fractional cent is not a thing.
      externalCostMinorUnits: (BigInt(total.externalCostMinorUnits) / BigInt(n)).toString(),
      evidenceCount: total.evidenceCount / n,
    },
  };
}
