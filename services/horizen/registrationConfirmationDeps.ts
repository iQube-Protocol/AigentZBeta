/**
 * The `RegistrationDeps` implementation `checkAgentRegistrationStatus` needs
 * to persist a confirmed registration — extracted out of
 * `app/api/journey/moneypenny-horizen/register/status/route.ts` (2026-08-03)
 * so the interactive status route and the scheduled reconciliation route
 * (`app/api/ops/horizen/reconcile-registrations/route.ts`) share ONE
 * implementation of "what confirmation writes" (inv.engineering.036/037).
 * Neither route reimplements `updateRegistryAssetBinding` or
 * `createRegistrationReceipt` — both call `buildRegistrationStatusDeps()`.
 *
 * `checkAgentRegistrationStatus` itself is untouched by this extraction —
 * this module only supplies its injectable `deps`.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { ExternalAgentRegistryBinding } from '@/types/registry-canonical';
import type { RegistrationDeps } from './registrationClient';

/**
 * WHY THIS MUST NEVER FAIL SILENTLY (Aigent Nakamoto's live registration,
 * 2026-08-03). This write and the confirmation receipt are two INDEPENDENT
 * Supabase writes from the same confirmation event — nothing makes them
 * atomic. Every branch below is named rather than a silent early return.
 */
async function updateRegistryAssetBinding(
  aigentQubeId: string,
  patch: { tokenId: string; registryAlias: string; agentIdentifier: string | null; humanReadableUrl: string | null },
) {
  const admin = getSupabaseServer();
  if (!admin) {
    console.error(`[HORIZEN BINDING] no Supabase admin client — cannot persist tokenId ${patch.tokenId} onto "${aigentQubeId}"`);
    return;
  }
  const { data: row, error: readError } = await admin.from('registry_assets').select('metadata').eq('asset_id', aigentQubeId).maybeSingle();
  if (readError) {
    console.error(`[HORIZEN BINDING] read failed for "${aigentQubeId}": ${readError.message} — tokenId ${patch.tokenId} not persisted`);
    return;
  }
  if (!row) {
    console.error(`[HORIZEN BINDING] no registry_assets row for "${aigentQubeId}" — tokenId ${patch.tokenId} not persisted`);
    return;
  }
  const metadata = (row.metadata ?? {}) as { external_registry_bindings?: ExternalAgentRegistryBinding[] };
  const bindings = Array.isArray(metadata.external_registry_bindings) ? [...metadata.external_registry_bindings] : [];
  if (bindings.length === 0) {
    console.error(`[HORIZEN BINDING] "${aigentQubeId}" has no external_registry_bindings entry to update — tokenId ${patch.tokenId} not persisted`);
    return;
  }
  bindings[0] = {
    ...bindings[0],
    token_id: patch.tokenId,
    registry_alias: patch.registryAlias,
    agent_identifier: patch.agentIdentifier,
    human_readable_url: patch.humanReadableUrl,
    status: 'registered',
  };
  const { error: writeError } = await admin
    .from('registry_assets')
    .update({ metadata: { ...metadata, external_registry_bindings: bindings }, updated_at: new Date().toISOString() })
    .eq('asset_id', aigentQubeId);
  if (writeError) {
    console.error(`[HORIZEN BINDING] write failed for "${aigentQubeId}": ${writeError.message} — tokenId ${patch.tokenId} not persisted`);
  }
}

/**
 * `createRegistrationReceipt` — structured confirmation evidence
 * (`horizen_agent_registered`), plus the two Wallet Signing Topology
 * receipts (`horizen_registration_confirmed`, `agent_registry_binding_recorded`)
 * written alongside it, never replacing it.
 */
async function createRegistrationReceipt(input: Parameters<Required<RegistrationDeps>['createRegistrationReceipt']>[0]): Promise<string | null> {
  const { actorPersonaId, agent, network, txHash, tokenId, registryAddress, ownerAddress, confirmationSource, blockNumber, logIndex } = input;
  const receipt = await createActivityReceipt({
    personaId: actorPersonaId,
    activeCartridge: 'agentiq',
    actionType: 'horizen_agent_registered',
    summary: `${agent.displayName} registered in Horizen's ERC-8004 registry (${network}, tx ${txHash}, tokenId ${tokenId})`,
    agentsInvoked: [agent.runtimeAgentId],
    actionInput: {
      aigentQubeId: agent.aigentQubeId,
      network,
      txHash,
      registration: {
        protocol: 'erc-8004',
        network,
        txHash,
        tokenId,
        registryAddress,
        ownerAddress,
        blockNumber,
        logIndex,
        confirmationSource,
        confirmedAt: new Date().toISOString(),
      },
    },
  });
  await createActivityReceipt({
    personaId: actorPersonaId,
    activeCartridge: 'agentiq',
    actionType: 'horizen_registration_confirmed',
    summary: `Horizen confirmed ${agent.displayName}'s registration on reread (${network}, tx ${txHash})`,
    agentsInvoked: [agent.runtimeAgentId],
    actionInput: { aigentQubeId: agent.aigentQubeId, network, txHash },
  });
  await createActivityReceipt({
    personaId: actorPersonaId,
    activeCartridge: 'agentiq',
    actionType: 'agent_registry_binding_recorded',
    summary: `${agent.displayName}'s Horizen registry binding recorded on her AigentQube (${network})`,
    agentsInvoked: [agent.runtimeAgentId],
    actionInput: { aigentQubeId: agent.aigentQubeId, network, txHash },
  });
  return receipt?.id ?? null;
}

/** The one `RegistrationDeps` slice every confirmation caller must share. */
export function buildRegistrationStatusDeps(): Pick<RegistrationDeps, 'updateRegistryAssetBinding' | 'createRegistrationReceipt'> {
  return { updateRegistryAssetBinding, createRegistrationReceipt };
}
