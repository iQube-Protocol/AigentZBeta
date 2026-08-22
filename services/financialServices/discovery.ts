/**
 * MoneyPenny Financial Services Runtime — consumer-scoped service discovery
 * (Phase 3, Stage 3.2).
 *
 * "Standing and admission status should drive service discovery/eligibility"
 * (operator ruling). This is the discovery-time counterpart to
 * `eligibility.ts`'s per-request check — it runs the SAME
 * `evaluateFinancialServiceEligibility()` against every catalog entry, once
 * per consumer, so what a consumer is OFFERED already reflects what it could
 * actually request. No second eligibility rule exists here.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { listFinancialServiceDefinitions } from './serviceCatalog';
import { evaluateFinancialServiceEligibility, type FinancialServiceEligibilityResult } from './eligibility';
import type { FinancialServiceDefinition } from '@/types/financialServices';

export interface DiscoveredFinancialService {
  definition: FinancialServiceDefinition;
  eligibility: FinancialServiceEligibilityResult;
}

/** Every catalog service, annotated with this consumer's current eligibility. */
export async function discoverFinancialServicesForConsumer(
  consumerAgentId: string,
  standingPersonaId: string | null | undefined,
  admin: SupabaseClient,
): Promise<DiscoveredFinancialService[]> {
  const results: DiscoveredFinancialService[] = [];
  for (const definition of listFinancialServiceDefinitions()) {
    const eligibility = await evaluateFinancialServiceEligibility(
      definition,
      { requestingAgentId: consumerAgentId, standingPersonaId },
      admin,
    );
    results.push({ definition, eligibility });
  }
  return results;
}

/** Convenience filter over `discoverFinancialServicesForConsumer` — only what this consumer may currently request. */
export async function discoverEligibleFinancialServices(
  consumerAgentId: string,
  standingPersonaId: string | null | undefined,
  admin: SupabaseClient,
): Promise<FinancialServiceDefinition[]> {
  const discovered = await discoverFinancialServicesForConsumer(consumerAgentId, standingPersonaId, admin);
  return discovered.filter((d) => d.eligibility.eligible === true).map((d) => d.definition);
}
