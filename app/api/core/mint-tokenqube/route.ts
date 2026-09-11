import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';
import { updateTokenQubeChainAnchor } from '@/server/services/iqRegistryService';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getTokenExplorerUrl, getTxExplorerUrl } from '@/services/chain/mintChains';

// Minimal ABI — only functions called from the server
const IQUBE_NFT_ABI = [
  'function mintQube(address to, string memory uri) returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function getMetaQubeLocation(uint256 tokenId) view returns (string)',
  'function minterOf(uint256 tokenId) view returns (address)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event QubeAnchored(uint256 indexed tokenId, address indexed to, address indexed minter, string uri)',
] as const;

// Explorer URLs come from services/chain/mintChains — a second copy here is
// how a Base Sepolia mint ends up linking to mainnet.

/**
 * Resolve the calling user from the Supabase Bearer token. Minting spends the
 * deployer's gas and (when tokenQubeId is supplied) writes a chain anchor into
 * the registry, so this route cannot be anonymous. Clients must call it through
 * `personaFetch`, which attaches the token.
 */
async function resolveAuthedUserId(request: NextRequest): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!url || !anon || !token) return null;

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : user.id;
}

/**
 * A caller may only anchor a TokenQube that their own staged iQube references.
 * Without this an authenticated caller could pass any tokenQubeId and overwrite
 * another subject's chain anchor — the anchor is what key escrow later trusts.
 */
async function callerOwnsTokenQube(userId: string, tokenQubeId: string): Promise<boolean> {
  const admin = getSupabaseServer();
  if (!admin) return false;
  const { data } = await admin
    .from('iqube_mint_stubs')
    .select('id')
    .eq('user_id', userId)
    .eq('token_qube_id', tokenQubeId)
    .maybeSingle();
  return Boolean(data);
}

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveAuthedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { metaIdentifier, tokenQubeId, recipientAddress, network = 'base' } = body;

    if (!metaIdentifier) {
      return NextResponse.json({ error: 'metaIdentifier required' }, { status: 400 });
    }

    if (tokenQubeId && !(await callerOwnsTokenQube(userId, tokenQubeId))) {
      return NextResponse.json(
        { error: 'tokenQubeId does not belong to the calling user' },
        { status: 403 },
      );
    }

    const contractAddress = process.env.IQUBE_NFT_CONTRACT_ADDRESS;
    const rpcUrl = process.env.IQUBE_NFT_RPC_URL;
    const deployerKey = process.env.EVM_DEPLOYER_KEY;
    const chainId = parseInt(process.env.IQUBE_NFT_CHAIN_ID || '84532', 10); // default Base Sepolia

    if (!contractAddress || !rpcUrl || !deployerKey) {
      return NextResponse.json(
        { error: 'iQubeNFT not configured — set IQUBE_NFT_CONTRACT_ADDRESS, IQUBE_NFT_RPC_URL, EVM_DEPLOYER_KEY' },
        { status: 503 },
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(deployerKey, provider);
    const contract = new ethers.Contract(contractAddress, IQUBE_NFT_ABI, wallet);

    // URI: use metaIdentifier as the on-chain pointer (IPFS CID, Autonomys CID, or iq: ref)
    const uri = metaIdentifier;
    // The recipient is the persona's own connected wallet. It falls back to the
    // deployer only when no address was supplied — a persona that has not
    // connected a wallet yet.
    if (recipientAddress && !/^0x[0-9a-fA-F]{40}$/.test(String(recipientAddress))) {
      return NextResponse.json(
        { error: 'recipientAddress must be a 0x-prefixed 20-byte EVM address' },
        { status: 400 },
      );
    }
    const to = recipientAddress || wallet.address;

    const tx = await (contract.mintQube as (to: string, uri: string) => Promise<ethers.ContractTransactionResponse>)(to, uri);
    const receipt = await tx.wait();
    if (!receipt) throw new Error('Transaction receipt not received');

    // Parse tokenId from QubeAnchored event
    const iface = new ethers.Interface(IQUBE_NFT_ABI);
    let mintedTokenId: number | null = null;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === 'QubeAnchored') {
          mintedTokenId = Number(parsed.args[0]);
          break;
        }
      } catch {
        // skip unparseable logs
      }
    }

    const txHash = receipt.hash;
    const explorerUrl = getTxExplorerUrl(chainId, txHash);

    // Write chain anchor back to Supabase if a tokenQubeId was provided
    if (tokenQubeId && mintedTokenId !== null) {
      await updateTokenQubeChainAnchor(tokenQubeId, {
        chainTokenId: mintedTokenId,
        chainId,
        chainTxHash: txHash,
        chainMinter: wallet.address,
      });
    }

    // Fire Proof-of-State receipt (non-blocking)
    let receiptId: string | null = null;
    try {
      const POS_ID = (process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID) as string;
      if (POS_ID) {
        const pos = await getActor<{ issue_receipt: (hash: string) => Promise<string> }>(POS_ID, posIdl);
        receiptId = await pos.issue_receipt(`mint_${chainId}_${mintedTokenId}_${metaIdentifier}`);
      }
    } catch {
      // non-fatal
    }

    return NextResponse.json({
      success: true,
      message: 'TokenQube minted successfully',
      metaIdentifier,
      tokenId: mintedTokenId,
      network,
      chainId,
      contractAddress,
      tx: txHash,
      explorerUrl,
      mintedAt: new Date().toISOString(),
      owner: to,
      minter: wallet.address,
      proofOfState: receiptId ? { receiptId, status: 'pending' } : null,
    });
  } catch (err) {
    console.error('[mint-tokenqube]', err);
    const message = err instanceof Error ? err.message : 'Mint failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/core/mint-tokenqube — list all minted TokenQubes from the contract
export async function GET() {
  const contractAddress = process.env.IQUBE_NFT_CONTRACT_ADDRESS;
  const rpcUrl = process.env.IQUBE_NFT_RPC_URL;
  const chainId = parseInt(process.env.IQUBE_NFT_CHAIN_ID || '84532', 10);

  if (!contractAddress || !rpcUrl) {
    return NextResponse.json({ error: 'iQubeNFT not configured' }, { status: 503 });
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, IQUBE_NFT_ABI, provider);

    const total = Number(await (contract.totalSupply as () => Promise<bigint>)());
    if (total === 0) return NextResponse.json({ tokens: [], total: 0, contractAddress, chainId });

    const tokens = await Promise.all(
      Array.from({ length: total }, (_, i) => i + 1).map(async (tokenId) => {
        try {
          const [uri, minter, owner] = await Promise.all([
            (contract.getMetaQubeLocation as (id: number) => Promise<string>)(tokenId),
            (contract.minterOf as (id: number) => Promise<string>)(tokenId),
            (contract.ownerOf as (id: number) => Promise<string>)(tokenId),
          ]);
          return { tokenId, uri, minter, owner, explorerUrl: getTokenExplorerUrl(chainId, contractAddress, tokenId) };
        } catch {
          return null;
        }
      }),
    );

    return NextResponse.json({
      tokens: tokens.filter(Boolean),
      total,
      contractAddress,
      chainId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list tokens';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
