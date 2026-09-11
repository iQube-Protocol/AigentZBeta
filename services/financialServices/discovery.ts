/**
 * MoneyPenny Financial Services Runtime — consumer-scoped service discovery
 * (Phase 3, Stage 3.2; corrected 2026-08-23, second pass).
 *
 * "Standing and admission status should drive service discovery/eligibility"
 * (operator ruling). Resolves the consumer's `FinancialServiceAgentContext`
 * ONCE (`services/financialServices/agentEligibilityContext.ts`) and runs the
 * SAME pure `evaluateFinancialServiceEligibility()` against every catalog
 * entry from that one context — no second eligibility rule, and no repeated
 * admission/assignment/verification/Standing reads per catalog item.
 *
 * Operator correction, second pass: eligibility no longer requires a current
 * bounded-delegation grant (see eligibility.ts's header) — a service can be
 * `eligible` while still lacking current CONSEQUENTIAL authority. For the
 * one service class where that distinction is load-bearing (Runtime,
 * `executionReachable: true`), this module ALSO exposes an `authority`
 * prerequisite alongside `eligibility` — never folded into it, and never
 * downgrading `eligible` to `false`. Advisor/Architect never reach real
 * authorisation (see serviceRequestOrchestrator.ts's file header), so no
 * authority prerequisite is computed for them — `authority` is `null`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { listFinancialServiceDefinitions } from './serviceCatalog';
import { evaluateFinancialServiceEligibility, type FinancialServiceEligibilityResult } from './eligibility';
import { resolveAgentEligibilityContext, type FinancialServiceAgentContext } from './agentEligibilityContext';
import { resolveConstitutionalAuthorityForService } from './constitutionalAuthorityAdapter';
import { deriveRuntimeReadinessProjection, type RuntimeReadinessProjection } from './runtimeReadinessProjection';
import { resolveRegistrableAgentByRuntimeId } from '@/services/horizen/registrableAgents';
import type { ConstitutionalAuthority } from '@/types/constitutionalCommerce';
import type { FinancialServiceDefinition } from '@/types/financialServices';

/** A read-only authority-readiness prerequisite for a CONSEQUENTIAL-class service — never a gate on `eligible`. */
export interface FinancialServiceAuthorityPrerequisite {
  state: ConstitutionalAuthority['state'];
  met: boolean;
  code: 'AUTHORITY_ACTIVE' | 'AUTHORITY_MANDATE_REQUIRED' | 'AUTHORITY_DELEGATION_REQUIRED' | 'AUTHORITY_UNRESOLVED';
  reason: string;
}

export interface DiscoveredFinancialService {
  definition: FinancialServiceDefinition;
  eligibility: FinancialServiceEligibilityResult;
  /** Non-null only for `executionPolicy.executionReachable` services (Runtime). */
  authority: FinancialServiceAuthorityPrerequisite | null;
  /**
   * A DERIVED, read-only UI projection (2026-08-23 operator directive) —
   * "the desired pre-Vela UI is not generic UNRESOLVED; it should make the
   * layered readiness visible". Non-null only alongside `authority` (Runtime-
   * class services); never a new frozen constitutional state — see
   * `runtimeReadinessProjection.ts`'s own header.
   */
  readiness: RuntimeReadinessProjection | null;
}

export interface DiscoveryCallerContext {
  /** The AUTHENTICATED caller's own identity — the human directing this agent. */
  callerAuthProfileId?: string | null;
  actorPersonaId?: string | null;
}

export type FinancialServiceDiscoveryResult =
  | { ok: true; context: FinancialServiceAgentContext; services: DiscoveredFinancialService[] }
  | { ok: false; error: string };

function describeAuthorityPrerequisite(state: ConstitutionalAuthority['state']): FinancialServiceAuthorityPrerequisite {
  switch (state) {
    case 'ACTIVE':
      return { state, met: true, code: 'AUTHORITY_ACTIVE', reason: 'a current delegation and an authorized mandate are both in place' };
    case 'BOUNDED':
      return { state, met: false, code: 'AUTHORITY_MANDATE_REQUIRED', reason: 'a current delegation exists, but no authorized Constitutional Agreement/mandate for this exact service' };
    case 'PENDING':
      return { state, met: false, code: 'AUTHORITY_DELEGATION_REQUIRED', reason: 'admitted, but no current bounded delegation to this exact agent' };
    case 'NONE':
    default:
      return { state, met: false, code: 'AUTHORITY_UNRESOLVED', reason: 'no authenticated principal or constitutional admission to derive authority from' };
  }
}

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

  const services: DiscoveredFinancialService[] = [];
  for (const definition of listFinancialServiceDefinitions()) {
    const eligibility = evaluateFinancialServiceEligibility(definition, context);
    let authority: FinancialServiceAuthorityPrerequisite | null = null;
    let readiness: RuntimeReadinessProjection | null = null;
    if (definition.executionPolicy.executionReachable) {
      const resolved = await resolveConstitutionalAuthorityForService(admin, context, definition);
      authority = describeAuthorityPrerequisite(resolved.authority.state);
      readiness = deriveRuntimeReadinessProjection(context, definition, authority);
    }
    services.push({ definition, eligibility, authority, readiness });
  }

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
