import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Polygon Amoy testnet RPC endpoint
    const amoyRPC = 'https://rpc-amoy.polygon.technology';
    
    // Get latest block
    const blockResponse = await fetch(amoyRPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });
    
    const blockData = await blockResponse.json();
    const latestBlockHex = blockData.result;
    const latestBlockNumber = parseInt(latestBlockHex, 16);
    
    // Get block details
    const blockDetailsResponse = await fetch(amoyRPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: [latestBlockHex, true],
        id: 2
      })
    });
    
    const blockDetails = await blockDetailsResponse.json();
    const block = blockDetails.result;
    
    // Get latest transaction from the block
    const latestTx = block.transactions && block.transactions.length > 0 
      ? block.transactions[block.transactions.length - 1].hash 
      : null;
    
    return NextResponse.json({
      ok: true,
      chainId: '80002',
      blockNumber: latestBlockNumber.toLocaleString(),
      latestTx: latestTx || 'No transactions in latest block',
      rpcUrl: 'rpc-amoy.polygon.technology',
      at: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Polygon Amoy API error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message,
      chainId: '80002',
      blockNumber: '—',
      latestTx: '—',
      rpcUrl: '—',
      at: new Date().toISOString()
    });
  }
}
