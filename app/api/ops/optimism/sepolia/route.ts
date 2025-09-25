import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const rpcUrl = 'https://sepolia.optimism.io';
    
    // Get latest block number
    const blockResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });
    
    if (!blockResponse.ok) {
      throw new Error(`RPC request failed: ${blockResponse.status}`);
    }
    
    const blockData = await blockResponse.json();
    const blockNumber = parseInt(blockData.result, 16);
    
    // Get latest block details
    const blockDetailsResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
        id: 2
      })
    });
    
    const blockDetailsData = await blockDetailsResponse.json();
    const block = blockDetailsData.result;
    
    const txCount = block?.transactions?.length || 0;
    const latestTx = txCount > 0 ? block.transactions[0] : null;
    
    return NextResponse.json({
      ok: true,
      blockNumber,
      txCount,
      latestTx,
      rpcUrl,
      explorerUrl: 'https://sepolia-optimism.etherscan.io',
      at: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Optimism Sepolia API error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to fetch Optimism Sepolia data',
      at: new Date().toISOString()
    }, { status: 500 });
  }
}
