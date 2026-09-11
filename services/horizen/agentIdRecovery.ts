/**
 * Recovers a Horizen/ERC-8004 agentId by decoding the registration
 * transaction's OWN receipt — never by asking the registry to resolve a
 * wallet address (operator direction via Al, 2026-08-02, superseding the
 * earlier registry-lookup hop in registrationClient.ts).
 *
 * ERC-721 gives no reverse (wallet -> tokenId) enumeration guarantee —
 * `balanceOf` is a count, not a list. A registry read keyed by the owner
 * wallet can therefore answer confidently and WRONGLY. The transaction that
 * minted the identifier carries it directly: Horizen's ERC-8004 `Registered`
 * event and the standard ERC-721 `Transfer` mint event (`from ==
 * address(0)`) are both emitted in that transaction's own receipt. Decoding
 * the receipt is deterministic and needs no registry lookup at all.
 *
 * Scans ALL receipt logs, not just those whose `log.address` equals the
 * transaction's `to` — Horizen may relay registration through a wrapper
 * contract, and the Identity Registry's own emitted event still appears in
 * the outer receipt under its own `log.address`.
 *
 * Read-only by construction: getTransactionReceipt + view calls
 * (ownerOf/tokenURI). No signer, no write path — recovery can never submit a
 * new registration.
 */

import { ethers } from 'ethers';

const REGISTERED_EVENT_ABI = ['event Registered(uint256 indexed agentId, string agentURI, address indexed owner)'];
const TRANSFER_EVENT_ABI = ['event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'];
const ERC721_READ_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

const registeredInterface = new ethers.Interface(REGISTERED_EVENT_ABI);
const transferInterface = new ethers.Interface(TRANSFER_EVENT_ABI);

export interface AgentIdRecoveryInput {
  provider: ethers.Provider;
  txHash: string;
  /** The registration's owner wallet — the decoded agentId MUST resolve to this via `ownerOf`. */
  expectedOwner: string;
  /**
   * When known, restricts log scanning to events emitted by this contract
   * address — the actual Identity Registry, not necessarily the tx's `to`
   * (which may be a wrapper). Without it, every log in the receipt is a
   * decode candidate, which is only safe because the ambiguity check below
   * refuses rather than guesses when more than one distinct agentId decodes.
   */
  expectedRegistry?: string;
}

export type AgentIdRecoverySource = 'Registered' | 'Transfer';

export type AgentIdRecoveryResult =
  | {
      ok: true;
      agentId: string;
      registry: string;
      agentURI: string | null;
      source: AgentIdRecoverySource;
      /** Where the minting event sits in the chain — for the receipt, not the recovery decision. */
      blockNumber: number;
      logIndex: number;
    }
  | { ok: false; reason: string };

interface Candidate {
  agentId: bigint;
  registry: string;
  agentURI: string | null;
  source: AgentIdRecoverySource;
  blockNumber: number;
  logIndex: number;
}

export async function decodeAgentIdFromReceipt(input: AgentIdRecoveryInput): Promise<AgentIdRecoveryResult> {
  const receipt = await input.provider.getTransactionReceipt(input.txHash);
  if (!receipt) {
    return { ok: false, reason: `no receipt found for transaction ${input.txHash} — it may not be mined yet` };
  }

  const registryFilter = input.expectedRegistry?.toLowerCase();
  const candidates: Candidate[] = [];

  for (const log of receipt.logs) {
    if (registryFilter && log.address.toLowerCase() !== registryFilter) continue;

    try {
      const parsed = registeredInterface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed && parsed.name === 'Registered') {
        candidates.push({
          agentId: parsed.args.agentId as bigint,
          registry: log.address,
          agentURI: typeof parsed.args.agentURI === 'string' ? parsed.args.agentURI : null,
          source: 'Registered',
          blockNumber: log.blockNumber,
          logIndex: log.index,
        });
        continue;
      }
    } catch {
      // Topic hash did not match Registered — fall through and try Transfer.
    }

    try {
      const parsed = transferInterface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed && parsed.name === 'Transfer' && parsed.args.from === ethers.ZeroAddress) {
        candidates.push({
          agentId: parsed.args.tokenId as bigint,
          registry: log.address,
          agentURI: null,
          source: 'Transfer',
          blockNumber: log.blockNumber,
          logIndex: log.index,
        });
      }
    } catch {
      // Not every log in the receipt is ours to decode — expected for most logs.
    }
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      reason:
        `no Registered or Transfer(mint) event found in transaction ${input.txHash}'s receipt logs` +
        (registryFilter ? ` at registry ${input.expectedRegistry}` : ''),
    };
  }

  const distinctIds = new Set(candidates.map((c) => c.agentId.toString()));
  if (distinctIds.size > 1) {
    return {
      ok: false,
      reason: `ambiguous: transaction ${input.txHash}'s receipt decodes to multiple distinct agentIds (${[...distinctIds].join(', ')}) — refusing to guess`,
    };
  }

  // Prefer a Registered candidate (carries agentURI directly) over a bare Transfer mint.
  const chosen = candidates.find((c) => c.source === 'Registered') ?? candidates[0];

  // MANDATORY: the decoded identifier is only accepted once its own registry
  // confirms it resolves to the expected owner — decoding a log by shape
  // alone is not proof of what it means.
  let onChainOwner: string;
  try {
    const registryContract = new ethers.Contract(chosen.registry, ERC721_READ_ABI, input.provider);
    onChainOwner = (await registryContract.ownerOf(chosen.agentId)) as string;
  } catch (err) {
    return {
      ok: false,
      reason: `ownerOf(${chosen.agentId}) verification failed against registry ${chosen.registry}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (onChainOwner.toLowerCase() !== input.expectedOwner.toLowerCase()) {
    return {
      ok: false,
      reason: `decoded agentId ${chosen.agentId} is owned by ${onChainOwner}, not the expected ${input.expectedOwner} — refusing to accept a mismatched identifier`,
    };
  }

  // Best-effort enrichment only — never blocks acceptance of an already-verified identifier.
  let agentURI = chosen.agentURI;
  if (!agentURI) {
    try {
      const registryContract = new ethers.Contract(chosen.registry, ERC721_READ_ABI, input.provider);
      agentURI = (await registryContract.tokenURI(chosen.agentId)) as string;
    } catch {
      // tokenURI is best-effort — absence does not invalidate the verified identifier.
    }
  }

  return {
    ok: true,
    agentId: chosen.agentId.toString(),
    registry: chosen.registry,
    agentURI: agentURI ?? null,
    source: chosen.source,
    blockNumber: chosen.blockNumber,
    logIndex: chosen.logIndex,
  };
}

/**
 * `ownerOf(agentId)` against the documented IdentityRegistry — the
 * AUTHORITATIVE answer to "who holds this token", used when the registry
 * INDEX cannot be read.
 *
 * ── WHY THIS IS A SEPARATE, AUTHORITATIVE PATH (operator direction, 2026-08-03) ──
 *
 * Horizen's REST index and the chain are two different sources, and only one
 * of them is the ledger. An index read can fail for reasons that say nothing
 * about registration — the wrong identifier representation (which is exactly
 * what happened: `/agents/8798` where §2.4.1 requires `/agents/0x225e`), a
 * cache still warming, a host not answering. Treating any of those as
 * "this agent is not registered" infers a fact about the CHAIN from a fact
 * about an INDEXER.
 *
 * `ownerOf` reverts for a token that was never minted and returns an address
 * for one that was, so the two cases are distinguishable — which is the whole
 * point. This lives beside the receipt-decode recovery because it is the same
 * concern (establish the truth from the chain, not from a lookup service) and
 * reuses the ERC-721 read ABI already defined above rather than a second copy.
 *
 * Read-only: one `view` call, no signer, nothing submittable.
 */
export type RegistryOwnerRead =
  | { ok: true; owner: string }
  /** The token does not exist on this registry — `ownerOf` reverted. A real answer. */
  | { ok: false; reason: 'not-minted'; detail: string }
  /** The call itself could not be made. Says NOTHING about registration. */
  | { ok: false; reason: 'unreadable'; detail: string };

export async function fetchOwnerOnChain(input: {
  provider: ethers.Provider;
  identityRegistry: string;
  agentId: string | bigint;
}): Promise<RegistryOwnerRead> {
  let tokenId: bigint;
  try {
    tokenId = typeof input.agentId === 'bigint' ? input.agentId : BigInt(input.agentId);
  } catch {
    return { ok: false, reason: 'unreadable', detail: `"${String(input.agentId)}" is not a token id` };
  }
  try {
    const contract = new ethers.Contract(input.identityRegistry, ERC721_READ_ABI, input.provider);
    return { ok: true, owner: (await contract.ownerOf(tokenId)) as string };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    /*
     * ERC-721 mandates a revert for a nonexistent token, so a revert IS the
     * answer "no such token" — distinguished from a transport/RPC failure,
     * which is not an answer at all. Conflating them is the same error as
     * reading the index's silence as non-registration, one layer down.
     */
    const reverted = /revert|CALL_EXCEPTION|nonexistent|invalid token/i.test(message);
    return reverted
      ? { ok: false, reason: 'not-minted', detail: `ownerOf(${tokenId}) reverted on ${input.identityRegistry}: ${message}` }
      : { ok: false, reason: 'unreadable', detail: `ownerOf(${tokenId}) could not be read: ${message}` };
  }
}
