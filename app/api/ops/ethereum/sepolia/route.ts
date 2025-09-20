import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Sepolia testnet RPC endpoint
    const sepoliaRPC = 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
    
    // Get latest block
    const blockResponse = await fetch(sepoliaRPC, {
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
    const blockDetailsResponse = await fetch(sepoliaRPC, {
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
      chainId: '11155111',
      blockNumber: latestBlockNumber.toLocaleString(),
      latestTx: latestTx || 'No transactions in latest block',
      rpcUrl: 'sepolia.infura.io',
      at: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Sepolia API error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message,
      chainId: '11155111',
      blockNumber: '—',
      latestTx: '—',
      rpcUrl: '—',
      at: new Date().toISOString()
    });
  }
}
