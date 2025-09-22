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
    
    // Get gas price as additional info, but keep transaction display
    const gasPriceResponse = await fetch(amoyRPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_gasPrice',
        params: [],
        id: 3
      })
    });
    
    const gasPriceData = await gasPriceResponse.json();
    const gasPrice = parseInt(gasPriceData.result, 16);
    
    // Provide network stats without random transaction fetching
    return NextResponse.json({
      ok: true,
      chainId: '80002',
      blockNumber: latestBlockNumber.toLocaleString(),
      latestTx: 'Network active - create transaction to see hash',
      gasPrice: gasPrice.toLocaleString(),
      transactionCount: block.transactions ? block.transactions.length : 0,
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
      gasPrice: '—',
      transactionCount: 0,
      rpcUrl: '—',
      at: new Date().toISOString()
    });
  }
}
