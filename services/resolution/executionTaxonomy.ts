/**
 * executionTaxonomy — SPEC-CDR-001 P1 (Constitutional Domain & Context
 * Resolution, RATIFIED 2026-07-25). The canonical, DERIVED enumeration of
 * Financial Services **execution** domains.
 *
 * Why this file exists at `services/resolution/` and not under
 * `services/companion/`: D-16 (RATIFIED). Resolution is a platform service with
 * many consumers (Overlay, MoneyPenny, the FS Capability Suite, future Human
 * Mobility) — not an Overlay concern.
 *
 * THE LOAD-BEARING RULE (D-1, RATIFIED — SPEC-CDR-001 §0.2, §3):
 *   The execution taxonomy is EXACTLY the shipped `FinancialDomain` union. It
 *   is derived from `FINANCIAL_DOMAINS`/`FINANCIAL_DOMAIN_LABEL` in
 *   `services/constitutional/financialIntelligenceExecutor.ts`, never restated.
 *   Hand-authoring a parallel five-item list was the exact
 *   `inv.engineering.036`/`037` parity defect this SPEC was written to prevent
 *   (four instances of that defect class shipped in the 2026-07-25 session
 *   alone). Where derivation is impossible — the docs mirror in SPEC-CDR-001 §3
 *   — a parity canary fails the build on drift
 *   (`tests/source-of-truth-parity.test.ts`).
 *
 * WHAT THIS FILE DOES NOT DO:
 *   - It does not widen `FinancialDomain` (§10.1 — explicitly unauthorised).
 *   - It does not enumerate governance domains. Those are a separate,
 *     NON-EXECUTABLE class (§4.2, D-2/D-3) and land in P4, not P1.
 *   - It does not change execution behaviour, or the shadow/authoritative
 *     posture of any domain. `posture` below RECORDS the shipped posture for
 *     presentation; it never sets it. The Domain 1/2 money-moving pause point
 *     is untouched.
 *   - It grants no authority. Presence of a domain here says nothing about
 *     whether a caller may execute in it — that is the Identity & Access
 *     Spine's decision, evaluated at the point of action (§13a, D-22).
 */

import {
  FINANCIAL_DOMAINS,
  FINANCIAL_DOMAIN_LABEL,
  type FinancialDomain,
} from '@/services/constitutional/financialIntelligenceExecutor';

/**
 * Execution posture as shipped under CRP-003a. `authoritative` = the domain
 * executes for real; `shadow-only` = it produces advice/recommendations that
 * are recorded but never acted on as fund movement.
 *
 * This is a RECORD of the shipped posture, not a control over it. Nothing in
 * SPEC-CDR-001 authorises a flip; the flip ceremony lives in CRP-003a.
 */
export type ExecutionPosture = 'authoritative' | 'shadow-only';

/**
 * Keyed by `FinancialDomain`, so adding a domain to the tuple without stating
 * its posture is a COMPILE ERROR rather than a silent default.
 */
const EXECUTION_POSTURE: Record<FinancialDomain, ExecutionPosture> = {
  intelligence: 'authoritative',
  // Domains 1 and 2 are the money-moving pause point — shadow-only by
  // ratified decision. Presentation of these must never imply executability
  // (§7.2 presentation/execution firewall, D-11).
  investment: 'shadow-only',
  market: 'shadow-only',
};

export interface ExecutionDomainDescriptor {
  /** Canonical id — identical to the `FinancialDomain` member. */
  id: FinancialDomain;
  /** Shipped label, derived from FINANCIAL_DOMAIN_LABEL. Never re-authored. */
  label: string;
  /** Shipped posture under CRP-003a. Recorded, not controlled, here. */
  posture: ExecutionPosture;
}

/**
 * The canonical execution taxonomy. Consumers MUST read this (or
 * `FINANCIAL_DOMAINS`) rather than declaring their own array.
 */
export const EXECUTION_DOMAINS: readonly ExecutionDomainDescriptor[] = FINANCIAL_DOMAINS.map(
  (id) => ({ id, label: FINANCIAL_DOMAIN_LABEL[id], posture: EXECUTION_POSTURE[id] }),
);

/** Runtime guard for untrusted input (request bodies, resolver candidates). */
export function isExecutionDomain(value: unknown): value is FinancialDomain {
  return typeof value === 'string' && (FINANCIAL_DOMAINS as readonly string[]).includes(value);
}

export function executionDomain(id: FinancialDomain): ExecutionDomainDescriptor {
  // Total by construction — EXECUTION_DOMAINS covers every union member.
  return EXECUTION_DOMAINS.find((d) => d.id === id)!;
}

export type { FinancialDomain };
