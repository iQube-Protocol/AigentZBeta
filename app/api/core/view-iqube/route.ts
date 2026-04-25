import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const IQUBE_NFT_ABI = [
  'function getMetaQubeLocation(uint256 tokenId) view returns (string)',
  'function minterOf(uint256 tokenId) view returns (address)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)',
] as const;

function getContract() {
  const contractAddress = process.env.IQUBE_NFT_CONTRACT_ADDRESS;
  const rpcUrl = process.env.IQUBE_NFT_RPC_URL;
  if (!contractAddress || !rpcUrl) return null;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Contract(contractAddress, IQUBE_NFT_ABI, provider);
}

// GET /api/core/view-iqube?id=1  (on-chain tokenId)
// GET /api/core/view-iqube?id=<uuid>  (Supabase meta_qube id — future)
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const tokenId = parseInt(id, 10);
  if (!isNaN(tokenId) && tokenId > 0) {
    // On-chain lookup
    const contract = getContract();
    if (!contract) {
      return NextResponse.json({ error: 'iQubeNFT contract not configured' }, { status: 503 });
    }
    try {
      const [uri, minter, owner] = await Promise.all([
        (contract.getMetaQubeLocation as (tokenId: number) => Promise<string>)(tokenId),
        (contract.minterOf as (tokenId: number) => Promise<string>)(tokenId),
        (contract.ownerOf as (tokenId: number) => Promise<string>)(tokenId),
      ]);
      return NextResponse.json({
        id: String(tokenId),
        source: 'on-chain',
        contractAddress: process.env.IQUBE_NFT_CONTRACT_ADDRESS,
        chainId: parseInt(process.env.IQUBE_NFT_CHAIN_ID || '84532', 10),
        meta: {
          ownerType: 'wallet',
          contentType: 'iQube',
          creator: minter,
          uri,
        },
        token: {
          id: String(tokenId),
          owner,
          minter,
          status: 'minted',
          explorerUrl: `https://sepolia.basescan.org/token/${process.env.IQUBE_NFT_CONTRACT_ADDRESS}?a=${tokenId}`,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Token not found';
      return NextResponse.json({ error: msg }, { status: 404 });
    }
  }

  return NextResponse.json({ error: 'Invalid id — provide a numeric tokenId' }, { status: 400 });
}
