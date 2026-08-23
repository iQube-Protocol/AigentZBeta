/**
 * MoneyPenny Financial Services Runtime — consumer-scoped service discovery
 * (Phase 3, Stage 3.2; rewritten in the 2026-08-23 repair pass, Repair F).
 *
 * "Standing and admission status should drive service discovery/eligibility"
 * (operator ruling). Resolves the consumer's `FinancialServiceAgentContext`
 * ONCE (`services/financialServices/agentEligibilityContext.ts`) and runs the
 * SAME pure `evaluateFinancialServiceEligibility()` against every catalog
 * entry from that one context — no second eligibility rule, and no repeated
 * admission/delegation/verification/Standing reads per catalog item.
 *
 * The resolved context is returned alongside the annotated catalog so a
 * caller needing a raw admission diagnostic (the operator console) reads it
 * from THIS SAME resolution rather than triggering a second
 * `resolveAgentAdmissionState()` call.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { listFinancialServiceDefinitions } from './serviceCatalog';
import { evaluateFinancialServiceEligibility, type FinancialServiceEligibilityResult } from './eligibility';
import { resolveAgentEligibilityContext, type FinancialServiceAgentContext } from './agentEligibilityContext';
import { resolveRegistrableAgentByRuntimeId } from '@/services/horizen/registrableAgents';
import type { FinancialServiceDefinition } from '@/types/financialServices';

export interface DiscoveredFinancialService {
  definition: FinancialServiceDefinition;
  eligibility: FinancialServiceEligibilityResult;
}

export interface DiscoveryCallerContext {
  /** The AUTHENTICATED caller's own identity — the human directing this agent. */
  callerAuthProfileId?: string | null;
  actorPersonaId?: string | null;
}

export type FinancialServiceDiscoveryResult =
  | { ok: true; context: FinancialServiceAgentContext; services: DiscoveredFinancialService[] }
  | { ok: false; error: string };

/** Resolve the consumer's context once, then annotate every catalog service against it. */
export async function discoverFinancialServicesForConsumer(
  consumerAgentId: string,
  admin: SupabaseClient,
  caller: DiscoveryCallerContext = {},
): Promise<FinancialServiceDiscoveryResult> {
  const agent = resolveRegistrableAgentByRuntimeId(consumerAgentId);
  if (!agent) return { ok: false, error: `'${consumerAgentId}' is not a canonical registrable agent` };

  const context = await resolveAgentEligibilityContext(
    admin,
    agent,
    caller.actorPersonaId ?? null,
    caller.callerAuthProfileId ?? null,
  );

  const services = listFinancialServiceDefinitions().map((definition) => ({
    definition,
    eligibility: evaluateFinancialServiceEligibility(definition, context),
  }));

  return { ok: true, context, services };
}

/** Convenience filter over `discoverFinancialServicesForConsumer` — only what this consumer may currently request. */
export async function discoverEligibleFinancialServices(
  consumerAgentId: string,
  admin: SupabaseClient,
  caller: DiscoveryCallerContext = {},
): Promise<FinancialServiceDefinition[]> {
  const discovered = await discoverFinancialServicesForConsumer(consumerAgentId, admin, caller);
  if (!discovered.ok) return [];
  return discovered.services.filter((d) => d.eligibility.eligible === true).map((d) => d.definition);
}
