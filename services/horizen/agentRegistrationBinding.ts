/**
 * The one resilient way to read an agent's Horizen registration binding —
 * consumed by both served Agent Card routes and the Claim stage's own gate
 * (inv.engineering.036/037: previously each read `registry_assets` directly,
 * a parallel implementation of the same projection).
 *
 * ── Why this exists (Aigent Nakamoto's live registration, 2026-08-03) ──────
 *
 * A confirmed registration makes TWO independent Supabase writes:
 * `createRegistrationReceipt` (always attempted) and
 * `updateRegistryAssetBinding` (a separate write, silently no-op-able on a
 * missing row/binding array — see the fix in register/status/route.ts).
 * Nakamoto's registration (tx 0xedda5f73…, tokenId 8798) proved these are
 * not atomic: the receipt existed and the registry_assets projection did
 * not, so the master Journey stepper (receipt-driven, `/state`'s
 * `hasReceipt('horizen_agent_registered')`) correctly advanced to Verify
 * while the Verify surface itself (registry_assets-driven) still reported
 * her unregistered.
 *
 * This reads the projection FIRST — it is the intended, indexed source once
 * the write lands — and falls back to the confirmation receipt ONLY when the
 * projection carries no tokenId, using the structured fields
 * `registrationClient.ts`'s `createRegistrationReceipt` call was enriched
 * with for exactly this purpose. `fromReceiptFallback: true` is reported so
 * a stuck write stays diagnosable rather than silently working around
 * itself forever.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';
import type { ExternalAgentRegistryBinding } from '@/types/registry-canonical';
import type { RegistrableAgentConfig } from './registrableAgents';

export interface ResolvedHorizenBinding {
  binding: ExternalAgentRegistryBinding | null;
  /** True when `binding.token_id` came from the confirmation receipt rather
   *  than the registry_assets projection. */
  fromReceiptFallback: boolean;
}

interface ReceiptRegistrationDetail {
  tokenId: string;
  registryAddress: string | null;
  network: string | null;
}

/** Reads the structured `actionInput.registration` block a `horizen_agent_registered`
 *  receipt is written with. Absent/malformed is null, never a guess. */
function readReceiptRegistration(actionInput: Record<string, unknown> | null): ReceiptRegistrationDetail | null {
  const reg = actionInput?.registration as Record<string, unknown> | undefined;
  const tokenId = reg?.tokenId;
  if (typeof tokenId !== 'string' || !tokenId) return null;
  return {
    tokenId,
    registryAddress: typeof reg?.registryAddress === 'string' ? reg.registryAddress : null,
    network: typeof reg?.network === 'string' ? reg.network : null,
  };
}

export async function resolveHorizenRegistrationBinding(
  admin: SupabaseClient,
  agent: RegistrableAgentConfig,
): Promise<ResolvedHorizenBinding> {
  const { data } = await admin.from('registry_assets').select('metadata').eq('asset_id', agent.aigentQubeId).maybeSingle();
  const bindings = (data?.metadata as { external_registry_bindings?: ExternalAgentRegistryBinding[] } | null)
    ?.external_registry_bindings;
  const stored = Array.isArray(bindings) && bindings.length > 0 ? bindings[0] : null;
  if (stored?.token_id) return { binding: stored, fromReceiptFallback: false };

  try {
    const { data: persona } = await admin.from('personas').select('id').ilike('fio_handle', agent.fioHandle).maybeSingle();
    if (!persona?.id) return { binding: stored, fromReceiptFallback: false };

    const receipts = await listActivityReceiptsForPersona(persona.id, {
      actionTypes: ['horizen_agent_registered'],
      limit: 20,
    });
    for (const r of receipts) {
      if (!(r.agentsInvoked ?? []).includes(agent.runtimeAgentId)) continue;
      const decoded = readReceiptRegistration(r.actionInput);
      if (!decoded) continue;
      return {
        binding: {
          protocol: 'erc-8004',
          registry: stored?.registry ?? 'horizen',
          network: decoded.network ?? stored?.network,
          identity_registry_contract: decoded.registryAddress ?? stored?.identity_registry_contract,
          token_id: decoded.tokenId,
          registry_alias: stored?.registry_alias ?? null,
          status: 'registered',
          agent_card_url: stored?.agent_card_url,
          agent_identifier: stored?.agent_identifier ?? null,
          human_readable_url: stored?.human_readable_url ?? null,
          transparency: stored?.transparency,
        },
        fromReceiptFallback: true,
      };
    }
    return { binding: stored, fromReceiptFallback: false };
  } catch {
    // A failed fallback lookup is not an answer either way — report what the
    // projection itself said, which may honestly be "not registered".
    return { binding: stored, fromReceiptFallback: false };
  }
}
