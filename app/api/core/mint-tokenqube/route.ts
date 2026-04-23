import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';
import { updateTokenQubeChainAnchor } from '@/server/services/iqRegistryService';

// Minimal ABI — only functions called from the server
const IQUBE_NFT_ABI = [
  'function mintQube(address to, string memory uri) returns (uint256)',
  'event QubeAnchored(uint256 indexed tokenId, address indexed to, address indexed minter, string uri)',
] as const;

function getExplorerUrl(chainId: number, txHash: string): string {
  switch (chainId) {
    case 8453:   return `https://basescan.org/tx/${txHash}`;
    case 84532:  return `https://sepolia.basescan.org/tx/${txHash}`;
    case 1:      return `https://etherscan.io/tx/${txHash}`;
    case 11155111: return `https://sepolia.etherscan.io/tx/${txHash}`;
    default:     return `https://basescan.org/tx/${txHash}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metaIdentifier, tokenQubeId, recipientAddress, network = 'base' } = body;

    if (!metaIdentifier) {
      return NextResponse.json({ error: 'metaIdentifier required' }, { status: 400 });
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
    const explorerUrl = getExplorerUrl(chainId, txHash);

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
