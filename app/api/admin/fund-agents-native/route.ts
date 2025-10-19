export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

/**
 * Fund all agents with native tokens (ETH/MATIC/etc) from Aigent Z for gas fees
 * Supports ETH, BTC, and Solana with fallback handling
 */
export async function POST(req: NextRequest) {
  try {
    console.log(`[Fund Agents Native] Starting native token distribution from Aigent Z...`);
    
    const results: any[] = [];
    
    // Agent addresses (excluding Aigent Z)
    const agents = [
      { name: 'Aigent MoneyPenny', address: '0x8D286CcECf7B838172A45c26a11F019C4303E742' },
      { name: 'Aigent Nakamoto', address: '0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9' },
      { name: 'Aigent Kn0w1', address: '0x875E825E0341b330065152ddaE37CBb843FC8D84' }
    ];

    // EVM chains to fund
    const evmChains = [
      { chainId: 84532, name: 'Base Sepolia', amount: '0.001' },
      { chainId: 11155420, name: 'Optimism Sepolia', amount: '0.001' },
      { chainId: 421614, name: 'Arbitrum Sepolia', amount: '0.002' },
      { chainId: 80002, name: 'Polygon Amoy', amount: '0.01' }, // More MATIC since Aigent Z has plenty
      { chainId: 11155111, name: 'Ethereum Sepolia', amount: '0.001' }
    ];

    console.log(`[Fund Agents Native] Funding ${agents.length} agents on ${evmChains.length} EVM chains...`);

    // Fund each agent on each EVM chain
    for (const agent of agents) {
      for (const chain of evmChains) {
        try {
          console.log(`[Fund Agents Native] Funding ${agent.name} with ${chain.amount} ETH on ${chain.name}...`);
          
          const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/transfer-eth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromAgentId: 'aigent-z',
              toAddress: agent.address,
              chainId: chain.chainId,
              amount: chain.amount
            })
          });

          const result = await response.json();
          
          if (response.ok && result.ok) {
            results.push({
              agent: agent.name,
              chain: chain.name,
              currency: 'ETH',
              amount: chain.amount,
              success: true,
              txHash: result.txHash
            });
            console.log(`[Fund Agents Native] ✅ ${agent.name} funded on ${chain.name}: ${result.txHash}`);
          } else {
            results.push({
              agent: agent.name,
              chain: chain.name,
              currency: 'ETH',
              amount: chain.amount,
              success: false,
              error: result.error || 'Transfer failed'
            });
            console.log(`[Fund Agents Native] ❌ ${agent.name} failed on ${chain.name}: ${result.error}`);
          }
        } catch (error: any) {
          results.push({
            agent: agent.name,
            chain: chain.name,
            currency: 'ETH',
            amount: chain.amount,
            success: false,
            error: error.message || 'Network error'
          });
          console.log(`[Fund Agents Native] ❌ ${agent.name} error on ${chain.name}: ${error.message}`);
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // TODO: Add BTC funding logic when BTC support is implemented
    // For now, add placeholder results
    for (const agent of agents) {
      results.push({
        agent: agent.name,
        chain: 'Bitcoin Testnet',
        currency: 'BTC',
        amount: '0.001',
        success: false,
        error: 'BTC funding not yet implemented - use faucets manually'
      });
    }

    // TODO: Add Solana funding logic when Solana support is implemented
    // For now, add placeholder results
    for (const agent of agents) {
      results.push({
        agent: agent.name,
        chain: 'Solana Testnet',
        currency: 'SOL',
        amount: '0.1',
        success: false,
        error: 'SOL funding not yet implemented - use faucets manually'
      });
    }

    // Calculate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const ethSuccessful = results.filter(r => r.currency === 'ETH' && r.success).length;
    const ethFailed = results.filter(r => r.currency === 'ETH' && !r.success).length;

    console.log(`[Fund Agents Native] Summary: ${successful}/${results.length} successful (ETH: ${ethSuccessful}/${ethSuccessful + ethFailed})`);

    return new Response(JSON.stringify({
      ok: true,
      summary: {
        total: results.length,
        successful,
        failed,
        ethSuccessful,
        ethFailed,
        btcImplemented: false,
        solImplemented: false
      },
      results,
      message: `Native token funding completed. ETH: ${ethSuccessful}/${ethSuccessful + ethFailed} successful. BTC/SOL: Not yet implemented.`
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('[Fund Agents Native] Error:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      error: error.message || 'Failed to fund agents with native tokens',
      summary: {
        total: 0,
        successful: 0,
        failed: 0,
        ethSuccessful: 0,
        ethFailed: 0,
        btcImplemented: false,
        solImplemented: false
      }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
