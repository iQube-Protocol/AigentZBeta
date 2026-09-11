/**
 * DiDQube Phase 4 item 7 (2026-09-07, execution plan §Phase 4, lowest
 * urgency, "do last; nothing else in the plan depends on it") — Registry
 * and Horizen bindings surfaced as EXTERNAL-PRESENCE records inside the
 * agent DiDQube, never as an alternate constitutional anchor.
 *
 * "External identifiers cannot redefine constitutional identity" (the
 * execution plan's own testing-matrix line for this sub-item): a Horizen/
 * ERC-8004 tokenId and an iQube Registry asset id are facts ABOUT an
 * already-established DiDQube, never a second way to establish one. This
 * module enforces that ordering structurally: `resolveAgentExternalPresence`
 * calls `resolveDiDQube` FIRST, and only reports external-presence facts
 * when the DiDQube itself already resolved — a `discovery`-trust-class
 * anchor lookup (the resolver's own `agent_card_url` input kind) is
 * deliberately never accepted here as a substitute.
 *
 * Composes the EXISTING, already-correct read functions
 * (`resolveAgentRegistrationState`, `getAsset` — the same ones Factor's own
 * readiness projection already calls) rather than re-deriving Horizen/
 * Registry state (Extend, Don't Duplicate). No new table, no new column, no
 * write of any kind — purely a projection.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveDiDQube, type CommitmentRef } from '@/services/identity/didQubeResolver';
import { resolveAgentRegistrationState, type AgentRegistrationState } from '@/services/horizen/agentRegistrationBinding';
import { getAsset } from '@/services/registry/persistence';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';

export type AgentDiDQubeExternalPresence =
  | {
      didqubeResolved: false;
      /** Why the DiDQube itself did not resolve — external presence is never checked in this case (ordering, not an oversight). */
      reason: string;
    }
  | {
      didqubeResolved: true;
      didqubeId: string;
      publicCommitment: CommitmentRef;
      horizenRegistration: AgentRegistrationState;
      registryAssetExists: boolean;
    };

/**
 * Never throws — a read failure on either external-presence source resolves
 * to its own honest "not established" shape rather than propagating, since
 * this is additive/informational only and must never block a caller that
 * merely wants to know whether an already-resolved DiDQube has external
 * presence.
 */
export async function resolveAgentExternalPresence(
  admin: SupabaseClient,
  agentRootIdentityId: string,
  agent: RegistrableAgentConfig,
): Promise<AgentDiDQubeExternalPresence> {
  const resolution = await resolveDiDQube({ kind: 'agent_root_identity_id', agentRootIdentityId });
  if (resolution.state !== 'resolved') {
    const reason =
      resolution.state === 'unresolved'
        ? `DiDQube unresolved (${resolution.reason})`
        : resolution.state === 'conflicted'
          ? `DiDQube conflicted (${resolution.detail})`
          : resolution.state === 'ambiguous'
            ? `DiDQube ambiguous (${resolution.candidateCount} candidates)`
            : 'DiDQube resolution reports an unsupported subject class';
    return { didqubeResolved: false, reason };
  }

  let horizenRegistration: AgentRegistrationState;
  try {
    horizenRegistration = await resolveAgentRegistrationState(admin, agent);
  } catch (e) {
    horizenRegistration = {
      registered: false,
      tokenId: null,
      registryAgentId: null,
      network: null,
      evidenceRefs: [],
      source: 'unresolved',
      settled: false,
      auditGaps: [`resolveAgentRegistrationState threw: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  let registryAssetExists = false;
  try {
    registryAssetExists = agent.aigentQubeId ? Boolean(await getAsset(agent.aigentQubeId)) : false;
  } catch {
    registryAssetExists = false;
  }

  return {
    didqubeResolved: true,
    didqubeId: resolution.primitive.didqubeId,
    publicCommitment: resolution.primitive.publicCommitment,
    horizenRegistration,
    registryAssetExists,
  };
}
