/**
 * MoneyPenny Runtime — shared capability/agent refs (2026-08-23 extraction).
 *
 * Extracted verbatim from `app/api/moneypenny/runtime/route.ts` (PRD-MPY-001
 * Phase 4, Runtime mode — zero behaviour change) so a SECOND caller —
 * `services/financialServices/serviceRequestOrchestrator.ts`'s Constitutional
 * Runtime dispatch (Phase 3 Financial Services Runtime, 2026-08-23) — can
 * invoke the exact same, already-live `runConstitutionalServicePattern()`
 * pipeline without hand-copying these literal ref strings a second time.
 *
 * P4-6: `capabilityRef` is domain-scoped — Domain 3 (Financial Intelligence)
 * keeps the original, already-live ref; Investment/Market use the
 * settlement-tier ref, whose agreement can only reach its authorized state
 * under the World-ID grade (`constitutionalAgreement.ts`). See the route's
 * own header for the full history of why these must stay two distinct refs.
 */

import type { FinancialDomain } from '@/services/resolution/executionTaxonomy';

export const MONEYPENNY_RUNTIME_CAPABILITY_REF = 'cap-moneypenny-financial-services';
export const MONEYPENNY_RUNTIME_SETTLEMENT_CAPABILITY_REF = 'cap-moneypenny-financial-services-settlement';
export const MONEYPENNY_RUNTIME_AGENT_REF = 'agent-moneypenny';

export function resolveMoneyPennyRuntimeCapabilityRef(domain: FinancialDomain): string {
  return domain === 'intelligence' ? MONEYPENNY_RUNTIME_CAPABILITY_REF : MONEYPENNY_RUNTIME_SETTLEMENT_CAPABILITY_REF;
}
