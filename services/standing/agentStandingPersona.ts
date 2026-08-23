/**
 * resolveAgentStandingPersonaId — the agent's OWN CRM Standing persona, not
 * the sponsoring human's.
 *
 * `app/api/persona/sponsored-agents/route.ts` already performs this exact
 * join to enrich an aigentMe's Standing lanes: `agent_root_identity.agent_id`
 * (== `RegistrableAgentConfig.runtimeAgentId` by construction — both are the
 * one canonical runtime agent identifier) -> `crm_personas.identity_persona_id`
 * -> the row whose `id` is the CRM persona `computeStandingScore()`/
 * `accrueStanding()` key on. This is the same join, factored out so the
 * Financial Services Runtime doesn't accept a client-asserted
 * `standingPersonaId` (CLAUDE.md's "no client assertions on constitutional
 * gates" discipline) and doesn't hand-roll a second copy of the join.
 *
 * Deliberately NOT `resolveSponsorCrmPersonaId`
 * (services/crm/standingAccrualService.ts) — that resolves the SPONSORING
 * HUMAN's persona (a different fact, used for delegated-Standing rollup).
 * This resolves the agent's own Standing identity.
 *
 * Uses the CRM's own Supabase client (`getCrmClient()`), not the app admin
 * client `resolveAgentAdmissionState` reads with — `crm_personas` lives in
 * the CRM database, exactly as `sponsored-agents/route.ts` already does.
 *
 * Three-valued, matching this codebase's house style: `undefined` means the
 * read itself failed (audit gap); `null` means the read succeeded and this
 * agent genuinely has no CRM Standing persona yet.
 */

import { getCrmClient } from '@/services/crm/crmDataAccess';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';

export async function resolveAgentStandingPersonaId(
  agent: RegistrableAgentConfig,
): Promise<string | null | undefined> {
  try {
    const crm = getCrmClient();
    const { data, error } = await crm
      .from('crm_personas')
      .select('id')
      .eq('identity_persona_id', agent.runtimeAgentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? String((data as { id: string }).id) : null;
  } catch {
    return undefined;
  }
}
