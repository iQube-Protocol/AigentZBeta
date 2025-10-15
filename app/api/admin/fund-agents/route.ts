export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { agentConfigs } from "@/app/data/agentConfig";

export async function POST(req: NextRequest) {
  try {
    const { chainIds, amountQct } = await req.json();
    
    if (!chainIds || !Array.isArray(chainIds) || !amountQct) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "chainIds (array) and amountQct required" 
      }), { status: 400 });
    }

    const results = [];
    
    // Fund each agent on each chain
    for (const [agentId, agentConfig] of Object.entries(agentConfigs)) {
      for (const chainId of chainIds) {
        try {
          // Skip if agent doesn't support this chain
          const chainName = getChainName(chainId);
          if (!agentConfig.supportedChains[chainName as keyof typeof agentConfig.supportedChains]) {
            continue;
          }

          // Fund the agent's address directly
          console.log(`Funding ${agentId} on chain ${chainId} at address ${agentConfig.walletAddresses.evmAddress}`);
          
          const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/fund-signer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chainIds: [chainId],
              amountQct,
              targetAddress: agentConfig.walletAddresses.evmAddress // Fund agent instead of signer
            })
          });

          const result = await response.json();
          results.push({
            agent: agentId,
            chainId,
            success: response.ok,
            result
          });

        } catch (error: any) {
          results.push({
            agent: agentId,
            chainId,
            success: false,
            error: error.message
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalAttempts = results.length;

    return new Response(JSON.stringify({
      ok: true,
      message: `Funded ${successCount}/${totalAttempts} agent/chain combinations`,
      results
    }), { status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: error.message || "Failed to fund agents"
    }), { status: 500 });
  }
}

function getChainName(chainId: number): string {
  switch (chainId) {
    case 11155111: return 'ethereum';
    case 421614: return 'arbitrum';
    case 84532: return 'base';
    case 11155420: return 'optimism';
    case 80002: return 'polygon';
    default: return 'unknown';
  }
}
