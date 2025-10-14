export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { ethers } from "ethers";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const QCT_CONTRACT = "0x4C4f1aD931589449962bB675bcb8e95672349d09";

function getChainConfig(chainId: number) {
  switch (chainId) {
    case 11155111:
      return {
        name: "Ethereum Sepolia",
        rpc: process.env.NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA || process.env.NEXT_PUBLIC_RPC_SEPOLIA || "https://rpc.sepolia.org",
      };
    case 421614:
      return {
        name: "Arbitrum Sepolia", 
        rpc: process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA || process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA || "https://sepolia-rollup.arbitrum.io/rpc",
      };
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { addresses } = await req.json();
    
    if (!addresses || !Array.isArray(addresses)) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "addresses array required" 
      }), { status: 400 });
    }

    const results = [];
    const chainIds = [11155111, 421614]; // Ethereum Sepolia, Arbitrum Sepolia

    for (const address of addresses) {
      const addressResults = { address, chains: {} };
      
      for (const chainId of chainIds) {
        const config = getChainConfig(chainId);
        if (!config) continue;

        try {
          const provider = new ethers.JsonRpcProvider(config.rpc);
          const contract = new ethers.Contract(QCT_CONTRACT, ERC20_ABI, provider);
          
          const balance = await contract.balanceOf(address);
          const decimals = await contract.decimals();
          
          const formattedBalance = ethers.formatUnits(balance, decimals);
          
          addressResults.chains[config.name] = {
            balance: balance.toString(),
            decimals: Number(decimals),
            formatted: formattedBalance,
            hasBalance: balance > 0n
          };
        } catch (error: any) {
          addressResults.chains[config.name] = {
            error: error.message,
            hasBalance: false
          };
        }
      }
      
      results.push(addressResults);
    }

    return new Response(JSON.stringify({
      ok: true,
      results
    }), { status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: error.message || "Failed to check balances"
    }), { status: 500 });
  }
}
