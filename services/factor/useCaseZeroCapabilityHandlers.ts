/**
 * Use Case Zero — thin action-handler wrappers over
 * services/factor/useCaseZeroReadinessProjection.ts (2026-09-06), mirroring
 * services/factor/bankrCapabilityHandlers.ts's own pattern: one function per
 * distinct manifest action, each a real, callable server-side function
 * ("service" handlerKind — no REST route yet, same honest status
 * vela_confidential_compute's own prepare action carries).
 *
 * Both entry paths ("Bring my own agent" and "Create and establish an
 * agent") call the SAME projection, differing only in `path` — there is
 * exactly one readiness model, never two.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { projectUseCaseZeroReadiness, type UseCaseZeroReadiness } from '@/services/factor/useCaseZeroReadinessProjection';

export interface UseCaseZeroActionInput {
  admin: SupabaseClient;
  tenantId: string;
  actorPersonaId: string;
  agentSlug: string;
  caseId?: string;
}

export async function bringOwnAgent(input: UseCaseZeroActionInput): Promise<UseCaseZeroReadiness> {
  return projectUseCaseZeroReadiness({ ...input, path: 'bring_own_agent' });
}

export async function createAndEstablishAgent(input: UseCaseZeroActionInput): Promise<UseCaseZeroReadiness> {
  return projectUseCaseZeroReadiness({ ...input, path: 'create_and_establish' });
}
