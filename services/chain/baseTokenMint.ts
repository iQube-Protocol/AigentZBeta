/**
 * baseTokenMint — Phase 7B Base TokenQube minting service.
 *
 * Mints canonical-mintable ContentQube editions as ERC-1155 tokens and
 * master qubes as ERC-721 tokens on Base. Commons are explicitly excluded
 * via isCanonicalRarity() — they use a remote-custody streaming model with
 * no canonical token.
 *
 * Token ID scheme (deterministic, collision-resistant):
 *   ERC-1155 editions: SHA-256("edition:<contentQubeId>:<editionNumber>") → uint256
 *   ERC-721 masters:   SHA-256("master:<contentQubeId>")                  → uint256
 *
 * DB writes on success:
 *   content_qube_editions.base_token_id   ← hex tokenId string
 *   content_qube_editions.chain_tx_hash   ← tx hash
 *   content_qube_editions.chain_minted_at ← ISO timestamp
 *
 * DVN receipt:
 *   content_qube_dvn_receipts.receipt_kind = 'mint'
 *   t2_alias_commitment                    ← T2 alias only (no personaId)
 *
 * Configuration (env vars):
 *   BASE_MINTER_PRIVATE_KEY        — server-side minter wallet private key
 *     (in v0 this is the AigentZ EOA itself, which owns iQubeNFT and
 *     therefore holds the only mint authority; long-term a separate
 *     minter EOA with a granted role would be safer)
 *   IQUBE_NFT_RPC_URL / BASE_RPC_URL / NEXT_PUBLIC_RPC_BASE_MAINNET
 *                                  — Base RPC endpoint (any one is read)
 *   CONTENT_QUBE_ERC1155_ADDRESS   — ERC-1155 editions contract on Base
 *                                    (DEFERRED — not yet deployed; edition
 *                                    mints no-op until this is set)
 *   CONTENT_QUBE_ERC721_ADDRESS / IQUBE_NFT_CONTRACT_ADDRESS
 *                                  — ERC-721 master contract on Base
 *                                    (the legacy name is kept for forward-
 *                                    compat; either env var works)
 *
 * When contract addresses or the minter key are not yet configured the
 * functions return { ok: true, skipped: 'contract_unconfigured' } without
 * throwing — this keeps the read path non-blocking during pre-deploy phases.
 */

import crypto from 'node:crypto';
import { Contract, Interface, JsonRpcProvider, Wallet } from 'ethers';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { isCanonicalRarity, type ContentQubeRarity } from '@/types/contentQube';
import { emitContentQubeMintReceipt } from '@/services/access/contentQubeReceiptEmitter';

// ─── Minimal ABIs ─────────────────────────────────────────────────────────────
// OpenZeppelin-style mint signatures expected by the deployed contracts.

const ERC1155_MINT_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to',     type: 'address' },
      { name: 'id',     type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'data',   type: 'bytes'   },
    ],
    outputs: [],
  },
] as const;

const ERC721_SAFE_MINT_ABI = [
  {
    type: 'function',
    name: 'safeMint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to',      type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

// ─── Token ID derivation ──────────────────────────────────────────────────────

/** Derive a deterministic uint256 token ID for a canonical edition row. */
function deriveEditionTokenId(contentQubeId: string, editionNumber: number): bigint {
  const digest = crypto
    .createHash('sha256')
    .update(`edition:${contentQubeId}:${editionNumber}`)
    .digest('hex');
  return BigInt('0x' + digest);
}

/** Derive a deterministic uint256 token ID for an ERC-721 master qube. */
function deriveMasterTokenId(contentQubeId: string): bigint {
  const digest = crypto
    .createHash('sha256')
    .update(`master:${contentQubeId}`)
    .digest('hex');
  return BigInt('0x' + digest);
}

// ─── Signer builder ───────────────────────────────────────────────────────────

function buildBaseSigner(): { signer: Wallet; provider: JsonRpcProvider } | null {
  // Minter key — Amplify holds this server-side; do NOT add a
  // NEXT_PUBLIC_ alias, ever.
  const pk = process.env.BASE_MINTER_PRIVATE_KEY;
  // RPC — accept any of the three names that already exist in the
  // codebase. `NEXT_PUBLIC_RPC_BASE_MAINNET` is also writable from the
  // browser side, but for the server-side signer we just read it here.
  const rpc =
    process.env.IQUBE_NFT_RPC_URL
    || process.env.BASE_RPC_URL
    || process.env.NEXT_PUBLIC_RPC_BASE_MAINNET
    || 'https://mainnet.base.org';
  if (!pk) return null;
  const provider = new JsonRpcProvider(rpc);
  return { signer: new Wallet(pk, provider), provider };
}

/**
 * Base mainnet chainId. Asserted before every signed tx so a
 * misconfigured RPC (e.g. one of the *_RPC_URL env vars pointing at
 * Base Sepolia by mistake) fails loud rather than silently submitting
 * the tx to the wrong chain. The wrong-chain failure mode is silent
 * because EVMs accept any calldata sent to any address — so a call
 * to a mainnet contract address on Sepolia "succeeds" but does
 * nothing, and the route returns ok=true with a real-looking tx hash.
 * Caught the hard way on 2026-05-29 (one phantom mint to Sepolia
 * burned ~$0.000... of testnet ETH, no real harm).
 */
const BASE_MAINNET_CHAIN_ID = 8453n;

async function assertConnectedToBaseMainnet(
  provider: JsonRpcProvider,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const net = await provider.getNetwork();
    if (net.chainId !== BASE_MAINNET_CHAIN_ID) {
      return {
        ok: false,
        error:
          `Connected RPC is chainId ${net.chainId} (${net.name}), expected `
          + `${BASE_MAINNET_CHAIN_ID} (Base mainnet). Check IQUBE_NFT_RPC_URL / `
          + `BASE_RPC_URL / NEXT_PUBLIC_RPC_BASE_MAINNET env vars.`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `Failed to query RPC chainId: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Resolve the ERC-721 master-qube contract address. Accepts the legacy
 * `CONTENT_QUBE_ERC721_ADDRESS` name AND the newer
 * `IQUBE_NFT_CONTRACT_ADDRESS` name (which is what the Amplify env vars
 * actually use after the 2026-05-28 Base mainnet deploy). Either works.
 */
function resolveErc721Address(): string | undefined {
  return process.env.CONTENT_QUBE_ERC721_ADDRESS
      || process.env.IQUBE_NFT_CONTRACT_ADDRESS;
}

// ─── Input / result types ─────────────────────────────────────────────────────

export interface MintEditionInput {
  /** UUID of the content_qubes row. */
  contentQubeId: string;
  /** UUID of the content_qube_editions row to update on success. */
  editionId: string;
  editionNumber: number;
  rarity: ContentQubeRarity;
  /** EVM address of the edition holder. */
  holderAddress: string;
  /** T2 alias commitment — the ONLY persona handle written to the receipt. */
  aliasCommitment?: string | null;
}

export type MintEditionSkipReason = 'commons_excluded' | 'contract_unconfigured';

export interface MintEditionResult {
  ok: boolean;
  /** Hex uint256 token ID (set on success). */
  tokenId?: string;
  txHash?: string;
  skipped?: MintEditionSkipReason;
  error?: string;
}

export interface MintMasterInput {
  /** UUID of the content_qubes row. */
  contentQubeId: string;
  /** EVM address of the master owner (e.g. protocol treasury). */
  ownerAddress: string;
  /** T2 alias commitment for the DVN receipt (optional for system-level mints). */
  aliasCommitment?: string | null;
}

export interface MintMasterResult {
  ok: boolean;
  tokenId?: string;
  txHash?: string;
  skipped?: 'contract_unconfigured';
  error?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Mint a canonical ERC-1155 edition token on Base for a
 * content_qube_editions row. Commons are explicitly excluded.
 *
 * On success:
 *   - writes base_token_id, chain_tx_hash, chain_minted_at to the edition row
 *   - emits a DVN 'mint' receipt (T2-safe)
 */
export async function mintCanonicalEdition(
  input: MintEditionInput,
): Promise<MintEditionResult> {
  const { contentQubeId, editionId, editionNumber, rarity, holderAddress, aliasCommitment } = input;

  // Commons use the remote-custody streaming model — never canonically minted.
  if (!isCanonicalRarity(rarity)) {
    return { ok: true, skipped: 'commons_excluded' };
  }

  const contractAddress = process.env.CONTENT_QUBE_ERC1155_ADDRESS;
  if (!contractAddress) {
    console.warn('[baseTokenMint] CONTENT_QUBE_ERC1155_ADDRESS not configured; edition mint deferred');
    return { ok: true, skipped: 'contract_unconfigured' };
  }

  const conn = buildBaseSigner();
  if (!conn) {
    console.warn('[baseTokenMint] BASE_MINTER_PRIVATE_KEY / RPC not configured; edition mint deferred');
    return { ok: true, skipped: 'contract_unconfigured' };
  }

  // Chain assertion — refuse to broadcast if the connected RPC isn't
  // Base mainnet. See assertConnectedToBaseMainnet() for context.
  const chainCheck = await assertConnectedToBaseMainnet(conn.provider);
  if (!chainCheck.ok) {
    console.error('[baseTokenMint] wrong-chain refusal (edition):', chainCheck.error);
    return { ok: false, error: chainCheck.error };
  }

  const tokenId    = deriveEditionTokenId(contentQubeId, editionNumber);
  const tokenIdHex = '0x' + tokenId.toString(16);

  try {
    const contract = new Contract(contractAddress, new Interface(ERC1155_MINT_ABI as any), conn.signer);
    const tx       = await contract.mint(holderAddress, tokenId, BigInt(1), '0x');
    const rcpt     = await tx.wait(1);
    const txHash   = (rcpt?.hash ?? tx.hash) as string;
    const mintedAt = new Date().toISOString();

    const supabase = getSupabaseServer();
    if (supabase) {
      const { error } = await supabase
        .from('content_qube_editions')
        .update({ base_token_id: tokenIdHex, chain_tx_hash: txHash, chain_minted_at: mintedAt })
        .eq('id', editionId);
      if (error) {
        console.warn('[baseTokenMint] edition row update failed', error.message);
      }
    }

    await emitContentQubeMintReceipt({
      contentQubeId,
      editionId,
      tokenId: tokenIdHex,
      txHash,
      rarity,
      chain: 'base',
      aliasCommitment: aliasCommitment ?? null,
      masterMint: false,
    });

    return { ok: true, tokenId: tokenIdHex, txHash };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[baseTokenMint] mintCanonicalEdition failed', { contentQubeId, editionId, message });
    return { ok: false, error: message };
  }
}

/**
 * Mint an ERC-721 master token on Base for a content_qubes row.
 * Advances lifecycle_state to 'chain_minted' in the DB on success.
 */
export async function mintMasterQube(input: MintMasterInput): Promise<MintMasterResult> {
  const { contentQubeId, ownerAddress, aliasCommitment } = input;

  const contractAddress = resolveErc721Address();
  if (!contractAddress) {
    console.warn('[baseTokenMint] ERC-721 master contract address not configured (CONTENT_QUBE_ERC721_ADDRESS / IQUBE_NFT_CONTRACT_ADDRESS); master mint deferred');
    return { ok: true, skipped: 'contract_unconfigured' };
  }

  const conn = buildBaseSigner();
  if (!conn) {
    console.warn('[baseTokenMint] BASE_MINTER_PRIVATE_KEY / RPC not configured; master mint deferred');
    return { ok: true, skipped: 'contract_unconfigured' };
  }

  // Chain assertion — refuse to broadcast if the connected RPC isn't
  // Base mainnet. See assertConnectedToBaseMainnet() for context.
  const chainCheck = await assertConnectedToBaseMainnet(conn.provider);
  if (!chainCheck.ok) {
    console.error('[baseTokenMint] wrong-chain refusal (master):', chainCheck.error);
    return { ok: false, error: chainCheck.error };
  }

  const tokenId    = deriveMasterTokenId(contentQubeId);
  const tokenIdHex = '0x' + tokenId.toString(16);

  try {
    const contract = new Contract(contractAddress, new Interface(ERC721_SAFE_MINT_ABI as any), conn.signer);
    const tx       = await contract.safeMint(ownerAddress, tokenId);
    const rcpt     = await tx.wait(1);
    const txHash   = (rcpt?.hash ?? tx.hash) as string;

    const supabase = getSupabaseServer();
    if (supabase) {
      const { error } = await supabase
        .from('content_qubes')
        .update({ lifecycle_state: 'chain_minted' })
        .eq('id', contentQubeId);
      if (error) {
        console.warn('[baseTokenMint] lifecycle_state update failed', error.message);
      }
    }

    await emitContentQubeMintReceipt({
      contentQubeId,
      tokenId: tokenIdHex,
      txHash,
      chain: 'base',
      aliasCommitment: aliasCommitment ?? null,
      masterMint: true,
    });

    return { ok: true, tokenId: tokenIdHex, txHash };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[baseTokenMint] mintMasterQube failed', { contentQubeId, message });
    return { ok: false, error: message };
  }
}
