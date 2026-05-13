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
 *   IQUBE_NFT_RPC_URL / BASE_RPC_URL — Base RPC endpoint
 *   CONTENT_QUBE_ERC1155_ADDRESS   — ERC-1155 editions contract on Base
 *   CONTENT_QUBE_ERC721_ADDRESS    — ERC-721 master contract on Base
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
  const pk  = process.env.BASE_MINTER_PRIVATE_KEY;
  const rpc = process.env.IQUBE_NFT_RPC_URL || process.env.BASE_RPC_URL;
  if (!pk || !rpc) return null;
  const provider = new JsonRpcProvider(rpc);
  return { signer: new Wallet(pk, provider), provider };
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

  const contractAddress = process.env.CONTENT_QUBE_ERC721_ADDRESS;
  if (!contractAddress) {
    console.warn('[baseTokenMint] CONTENT_QUBE_ERC721_ADDRESS not configured; master mint deferred');
    return { ok: true, skipped: 'contract_unconfigured' };
  }

  const conn = buildBaseSigner();
  if (!conn) {
    console.warn('[baseTokenMint] BASE_MINTER_PRIVATE_KEY / RPC not configured; master mint deferred');
    return { ok: true, skipped: 'contract_unconfigured' };
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
