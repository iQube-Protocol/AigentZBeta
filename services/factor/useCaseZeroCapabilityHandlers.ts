/**
 * Use Case Zero — thin action-handler wrappers over
 * services/factor/useCaseZeroReadinessProjection.ts (2026-09-06).
 *
 * CORRECTED same day (operator review, correction 6): these two functions
 * do NOT create, establish, or provision anything — they are, today, purely
 * read-only readiness ASSESSMENTS. The manifest's own action labels stay
 * user-facing ("Bring my own agent" / "Create and establish an agent" — the
 * chosen path, not a claim about what already happened), but `mode` is
 * `assess-readiness`, not `prepare`, and these function names say exactly
 * what they do. Once Phase 2's orchestrator (useCaseZeroOrchestrator.ts)
 * exists, a SEPARATE `execute`-mode action invokes it to actually advance
 * one step — never this pair, and never silently upgraded to imply action
 * without the corresponding orchestrator existing first.
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
  /** Item 2 (2026-09-07): the operator's explicit journey-profile choice —
   *  threaded through unmodified to the projection, which is the only place
   *  it has any effect (making Pulse/P&L required under
   *  'financial_intelligence'). Never inferred or defaulted here. */
  journeyProfile?: 'standard' | 'financial_intelligence';
}

/** Read-only readiness assessment for the "bring my own agent" path — never
 *  provisions or mutates anything. */
export async function assessBringOwnAgentReadiness(input: UseCaseZeroActionInput): Promise<UseCaseZeroReadiness> {
  return projectUseCaseZeroReadiness({ ...input, path: 'bring_own_agent' });
}

/** Read-only readiness assessment for the "create and establish an agent"
 *  path — never provisions or mutates anything. */
export async function assessCreateAndEstablishReadiness(input: UseCaseZeroActionInput): Promise<UseCaseZeroReadiness> {
  return projectUseCaseZeroReadiness({ ...input, path: 'create_and_establish' });
}
