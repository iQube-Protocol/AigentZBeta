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
 * ── Why the first version of this fallback could never fire (same day) ─────
 *
 * Two wrong assumptions, both invisible because the canaries encoded them
 * rather than testing against a real receipt:
 *
 *   1. IT LOOKED UNDER THE WRONG PERSONA. Receipts are written with
 *      `personaId: actorPersonaId` — the OPERATOR who acted (ArkAgent) — but
 *      the fallback resolved `personas.fio_handle = agent.fioHandle` (the
 *      AGENT's own persona) and listed receipts for that. Nakamoto's persona
 *      never holds Nakamoto's registration receipt, so the lookup searched a
 *      persona that structurally cannot have it and found nothing, every
 *      time. `findAgentRegistrationReceipts` keys on `agents_invoked`
 *      instead — the only field naming the registration's SUBJECT.
 *
 *   2. IT ONLY UNDERSTOOD RECEIPTS WRITTEN AFTER ITSELF. It read solely the
 *      structured `actionInput.registration` block added in the same change,
 *      so the ALREADY-EXISTING receipt it was built to rescue — Nakamoto's,
 *      carrying only `{txHash, network, aigentQubeId}` — was skipped as
 *      malformed. A fallback that cannot read the evidence that already
 *      exists is not a fallback.
 *
 * A pre-enrichment receipt still carries the one fact that matters: WHICH
 * transaction. The tokenId is then recovered from the chain by decoding that
 * transaction's own logs (`decodeAgentIdFromReceipt`) — the same decoder the
 * live confirmation path uses, with the same owner check. Nothing is guessed:
 * either the chain says which tokenId that transaction minted to this agent's
 * wallet, or the agent is reported unregistered.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { findAgentRegistrationReceipts } from '@/services/receipts/activityReceiptService';
import type { ExternalAgentRegistryBinding } from '@/types/registry-canonical';
import type { RegistrableAgentConfig } from './registrableAgents';

/** Where a fallback tokenId came from. Named, never blended into the projection silently. */
export type BindingFallbackSource = 'receipt-structured' | 'receipt-tx-chain-decode';

export interface ResolvedHorizenBinding {
  binding: ExternalAgentRegistryBinding | null;
  /** True when `binding.token_id` came from a receipt rather than the registry_assets projection. */
  fromReceiptFallback: boolean;
  /** How the fallback established the tokenId — null when the projection answered. */
  fallbackSource: BindingFallbackSource | null;
}

export interface ResolveBindingDeps {
  /** Injected for tests; production resolves from the network's own RPC config. */
  rpcProvider?: (network: string) => ethers.Provider | null;
  /** The agent's own custodied wallet — the address the minted tokenId must resolve to. */
  agentOwnerAddress?: (runtimeAgentId: string) => Promise<string | null>;
}

/**
 * The SAME resolution `registerCeremony.ts:496` uses for the broadcast path —
 * mirrored, not re-invented, and deliberately not widened to networks this
 * repo has no configured URL for. An unknown network yields null (no provider,
 * no recovery) rather than a guessed endpoint.
 */
function defaultRpcProvider(network: string): ethers.Provider | null {
  if (network !== 'base-sepolia') return null;
  const url = process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org';
  return new ethers.JsonRpcProvider(url);
}

async function defaultAgentOwnerAddress(runtimeAgentId: string): Promise<string | null> {
  try {
    const { AgentKeyService } = await import('@/services/identity/agentKeyService');
    const addresses = await new AgentKeyService().getAgentAddresses(runtimeAgentId);
    return addresses?.evmAddress ?? null;
  } catch {
    return null;
  }
}

export async function resolveHorizenRegistrationBinding(
  admin: SupabaseClient,
  agent: RegistrableAgentConfig,
  deps: ResolveBindingDeps = {},
): Promise<ResolvedHorizenBinding> {
  const { data } = await admin.from('registry_assets').select('metadata').eq('asset_id', agent.aigentQubeId).maybeSingle();
  const bindings = (data?.metadata as { external_registry_bindings?: ExternalAgentRegistryBinding[] } | null)
    ?.external_registry_bindings;
  const stored = Array.isArray(bindings) && bindings.length > 0 ? bindings[0] : null;
  if (stored?.token_id) return { binding: stored, fromReceiptFallback: false, fallbackSource: null };

  const unresolved: ResolvedHorizenBinding = { binding: stored, fromReceiptFallback: false, fallbackSource: null };

  try {
    const receipts = await findAgentRegistrationReceipts(agent.runtimeAgentId, { limit: 20 });
    if (receipts.length === 0) return unresolved;

    const build = (
      tokenId: string,
      network: string | null,
      registryAddress: string | null,
      fallbackSource: BindingFallbackSource,
    ): ResolvedHorizenBinding => ({
      binding: {
        protocol: 'erc-8004',
        registry: stored?.registry ?? 'horizen',
        network: network ?? stored?.network,
        identity_registry_contract: registryAddress ?? stored?.identity_registry_contract,
        token_id: tokenId,
        registry_alias: stored?.registry_alias ?? null,
        status: 'registered',
        agent_card_url: stored?.agent_card_url,
        agent_identifier: stored?.agent_identifier ?? null,
        human_readable_url: stored?.human_readable_url ?? null,
        transparency: stored?.transparency,
      },
      fromReceiptFallback: true,
      fallbackSource,
    });

    // A receipt that already carries the structured block answers directly —
    // no chain call needed, and preferred over decoding for exactly that reason.
    for (const r of receipts) {
      if (r.tokenId) return build(r.tokenId, r.network, r.registryAddress, 'receipt-structured');
    }

    // Otherwise recover from the chain. Only the OWNER check makes this safe:
    // decoding a transaction proves what that transaction did, and requiring
    // the mint to land on this agent's own wallet is what makes it proof about
    // THIS agent rather than any registration that happened to share a tx.
    const ownerAddress = await (deps.agentOwnerAddress ?? defaultAgentOwnerAddress)(agent.runtimeAgentId);
    if (!ownerAddress) return unresolved;

    const { decodeAgentIdFromReceipt } = await import('./agentIdRecovery');
    for (const r of receipts) {
      const network = r.network ?? stored?.network ?? null;
      if (!network) continue;
      const provider = (deps.rpcProvider ?? defaultRpcProvider)(network);
      if (!provider) continue;

      const decoded = await decodeAgentIdFromReceipt({
        provider,
        txHash: r.txHash,
        expectedOwner: ownerAddress,
        expectedRegistry: r.registryAddress ?? stored?.identity_registry_contract ?? undefined,
      });
      if (decoded.ok) {
        return build(decoded.agentId, network, decoded.registry, 'receipt-tx-chain-decode');
      }
    }
    return unresolved;
  } catch {
    // A failed fallback lookup is not an answer either way — report what the
    // projection itself said, which may honestly be "not registered".
    return unresolved;
  }
}

/**
 * THE ONE ANSWER to "is this agent registered on Horizen" — settled once,
 * consumed thereafter.
 *
 * ── WHY (operator ruling, 2026-08-03) ────────────────────────────────────
 *
 *   > "It's already been reasoned. Why is it re-reasoning again as to whether
 *   >  Nakamoto is registered or not? That's an invariant now. It's proven,
 *   >  we have the proof, it's been registered."
 *
 * `resolveHorizenRegistrationBinding` above is a RESILIENT READER: it consults
 * the projection, then a structured receipt, then the chain. That resilience
 * was the right fix for a stuck write — but it is still a derivation, and it
 * ran independently on every screen, which is how one settled fact came to
 * have five observers capable of five answers.
 *
 * This function is the resolution boundary. It derives ONCE, records the
 * result as a `SettledFact`, and from then on RETRIEVES rather than reasons.
 * Downstream stages ask `state.settled`; they never re-run the ladder.
 *
 * The order matters and is the operator's:
 *   1. the settled fact, if one exists  (retrieval — no reasoning)
 *   2. the canonical persisted binding
 *   3. reconstruction from transaction + receipts
 *   4. unresolved
 *
 * A step-2/3 success SETTLES, so step 1 answers every subsequent call.
 *
 * `source: 'unresolved'` is NOT `registered: false`. It means this resolver
 * could not establish the fact — an evidence gap, not a negative finding. The
 * distinction is the whole point: an observer's inability to find evidence
 * has never been evidence that a settled fact stopped being true.
 */
export type RegistrationStateSource = 'settled' | 'binding' | 'receipt-reconstruction' | 'unresolved';

export interface AgentRegistrationState {
  registered: boolean;
  tokenId: string | null;
  /** The Registry REST rendering — hex (§2.4.1). Derived, never re-typed. */
  registryAgentId: string | null;
  network: string | null;
  evidenceRefs: string[];
  source: RegistrationStateSource;
  /** True once this fact is settled — downstream must not re-derive. */
  settled: boolean;
  /**
   * Evidence the resolver expected and did not find. Reported so a gap stays
   * visible and fixable — and NEVER folded into `registered`.
   */
  auditGaps: string[];
}

export async function resolveAgentRegistrationState(
  admin: SupabaseClient,
  agent: RegistrableAgentConfig,
  deps: ResolveBindingDeps = {},
): Promise<AgentRegistrationState> {
  const { readSettledFact, settleFact, isSettled } = await import('@/services/journey/settledFacts');
  const { parseAgentId, serializeForSurfaces } = await import('./identity');

  // ── 1. Retrieval. No reasoning happens past this point. ─────────────────
  const existing = await readSettledFact<{
    standard: string;
    network: string;
    tokenId: string;
    registryId: string;
  }>(admin, agent.aigentQubeId, agent.runtimeAgentId, 'is_registered');
  if (isSettled(existing) && existing) {
    return {
      registered: true,
      tokenId: existing.object.tokenId,
      registryAgentId: existing.object.registryId,
      network: existing.object.network,
      evidenceRefs: existing.evidenceRefs,
      source: 'settled',
      settled: true,
      auditGaps: [],
    };
  }

  // ── 2/3. Derive once, through the shared resilient reader. ──────────────
  const { binding, fromReceiptFallback, fallbackSource } = await resolveHorizenRegistrationBinding(admin, agent, deps);
  if (!binding?.token_id) {
    return {
      registered: false,
      tokenId: null,
      registryAgentId: null,
      network: binding?.network ?? null,
      evidenceRefs: [],
      source: 'unresolved',
      settled: false,
      auditGaps: ['no registration binding could be resolved from the projection, receipts or the chain'],
    };
  }

  const network = binding.network ?? 'base-sepolia';
  const parsed = parseAgentId(binding.token_id);
  const registryAgentId = parsed.ok
    ? serializeForSurfaces(parsed.value, network === 'base-mainnet' ? 'base-mainnet' : 'base-sepolia').registryAgentId
    : null;

  const auditGaps: string[] = [];
  if (fromReceiptFallback) {
    auditGaps.push(
      `the registry_assets projection did not carry this binding; it was reconstructed via ${fallbackSource ?? 'a fallback'}`,
    );
  }
  if (!binding.human_readable_url) {
    auditGaps.push("Horizen's human-readable page identifier was never returned for this registration");
  }

  const evidenceRefs = [
    `binding:${agent.aigentQubeId}`,
    ...(binding.identity_registry_contract ? [`registry:${binding.identity_registry_contract}`] : []),
    ...(fallbackSource ? [`fallback:${fallbackSource}`] : []),
  ];

  // ── The settlement. Idempotent: a race cannot produce two truths. ───────
  const settled = await settleFact(admin, agent.aigentQubeId, {
    subject: agent.runtimeAgentId,
    predicate: 'is_registered',
    object: { standard: 'ERC-8004', network, tokenId: binding.token_id, registryId: registryAgentId ?? binding.token_id },
    evidenceRefs,
    resolutionAuthority: 'services/horizen/agentRegistrationBinding.resolveAgentRegistrationState',
  });
  if (!settled.ok) {
    // The fact is still TRUE — we simply failed to record that it is settled.
    // Reported as an audit gap, never as a failure to be registered.
    auditGaps.push(`the settlement could not be persisted (${settled.reason}): ${settled.detail}`);
  }

  return {
    registered: true,
    tokenId: binding.token_id,
    registryAgentId,
    network,
    evidenceRefs,
    source: fromReceiptFallback ? 'receipt-reconstruction' : 'binding',
    settled: settled.ok,
    auditGaps,
  };
}
