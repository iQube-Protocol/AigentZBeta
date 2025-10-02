import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as btcSignerIdl } from '@/services/ops/idl/btc_signer_psbt';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

// QCT Trading Infrastructure
// Handles cross-chain QCT transactions: EVM ↔ BTC, EVM ↔ EVM ↔ BTC cycles

interface QCTTradeRequest {
  action: 'buy' | 'sell' | 'swap' | 'bridge';
  orderType?: 'market' | 'limit' | 'stop';
  fromChain: 'bitcoin' | 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base';
  toChain: 'bitcoin' | 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base';
  amount: string; // QCT amount in smallest units
  fromAddress?: string; // EVM address or Bitcoin address
  toAddress?: string; // Destination address
  slippage?: number; // Max slippage percentage (default 1%)
  deadline?: number; // Transaction deadline timestamp
  limitPrice?: string; // For limit orders
  stopPrice?: string; // For stop orders
}

interface QCTBalance {
  chain: string;
  balance: string;
  decimals: number;
  symbol: string;
  contractAddress?: string; // For EVM chains
  runesId?: string; // For Bitcoin Runes
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const address = searchParams.get('address');

    if (action === 'balances' && address) {
      // Get QCT balances across all chains
      const balances = await getQCTBalances(address);
      return NextResponse.json({ ok: true, balances, at: new Date().toISOString() });
    }

    if (action === 'rates') {
      // Get current QCT exchange rates across chains
      const rates = await getQCTRates();
      return NextResponse.json({ ok: true, rates, at: new Date().toISOString() });
    }

    return NextResponse.json({ 
      ok: false, 
      error: 'Invalid action. Supported: balances, rates' 
    }, { status: 400 });

  } catch (error: any) {
    console.error('QCT trading GET error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to process QCT trading request'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tradeRequest: QCTTradeRequest = await req.json();
    
    // Validate trade request
    const validation = validateTradeRequest(tradeRequest);
    if (!validation.valid) {
      return NextResponse.json({ 
        ok: false, 
        error: validation.error 
      }, { status: 400 });
    }

    console.log('Processing QCT trade:', tradeRequest);

    let result;
    switch (tradeRequest.action) {
      case 'buy':
        result = await processBuyQCT(tradeRequest);
        break;
      case 'sell':
        result = await processSellQCT(tradeRequest);
        break;
      case 'swap':
        result = await processSwapQCT(tradeRequest);
        break;
      case 'bridge':
        result = await processBridgeQCT(tradeRequest);
        break;
      default:
        return NextResponse.json({ 
          ok: false, 
          error: 'Invalid action' 
        }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      ...result,
      at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('QCT trading POST error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to process QCT trade'
    }, { status: 500 });
  }
}

// Get QCT balances across all supported chains
async function getQCTBalances(address: string): Promise<QCTBalance[]> {
  const balances: QCTBalance[] = [];

  try {
    // Bitcoin QCT (Runes) balance
    const btcBalance = await getBitcoinQCTBalance(address);
    if (btcBalance) {
      balances.push({
        chain: 'bitcoin',
        balance: btcBalance.balance,
        decimals: 8,
        symbol: 'QCT',
        runesId: 'QCT_RUNES_ID' // TODO: Replace with actual Runes ID
      });
    }

    // EVM chains QCT balances using real RPC endpoints
    const evmChains = [
      {
        name: 'ethereum',
        rpc: process.env.NEXT_PUBLIC_RPC_ETH_SEPOLIA || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
        contractAddress: process.env.NEXT_PUBLIC_QCT_CONTRACT_ETHEREUM_SEPOLIA || '0x0000000000000000000000000000000000000000'
      },
      {
        name: 'polygon',
        rpc: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY || 'https://rpc-amoy.polygon.technology',
        contractAddress: process.env.NEXT_PUBLIC_QCT_CONTRACT_POLYGON_AMOY || '0x0000000000000000000000000000000000000000'
      },
      {
        name: 'arbitrum',
        rpc: process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc',
        contractAddress: process.env.NEXT_PUBLIC_QCT_CONTRACT_ARBITRUM_SEPOLIA || '0x0000000000000000000000000000000000000000'
      },
      {
        name: 'base',
        rpc: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
        contractAddress: process.env.NEXT_PUBLIC_QCT_CONTRACT_BASE_SEPOLIA || '0x0000000000000000000000000000000000000000'
      },
      {
        name: 'optimism',
        rpc: process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io',
        contractAddress: process.env.NEXT_PUBLIC_QCT_CONTRACT_OPTIMISM_SEPOLIA || '0x0000000000000000000000000000000000000000'
      }
    ];

    for (const chain of evmChains) {
      if (chain.rpc && chain.rpc !== 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY') {
        const evmBalance = await getEVMQCTBalance(address, chain.rpc, chain.contractAddress);
        if (evmBalance) {
          balances.push({
            chain: chain.name,
            balance: evmBalance.balance,
            decimals: 18,
            symbol: 'QCT',
            contractAddress: chain.contractAddress
          });
        }
      }
    }

  } catch (error) {
    console.error('Error fetching QCT balances:', error);
  }

  return balances;
}

// Get Bitcoin QCT balance (Runes)
async function getBitcoinQCTBalance(address: string): Promise<{ balance: string } | null> {
  try {
    // TODO: Implement Bitcoin Runes balance checking via Blockstream API or similar
    // For now, return mock data that scales based on address
    console.log(`Fetching Bitcoin QCT balance for ${address}`);

    const mockBalance = getMockBitcoinBalance(address);

    return {
      balance: mockBalance // Balance in satoshis (8 decimals for Runes)
    };
  } catch (error) {
    console.error('Error fetching Bitcoin QCT balance:', error);
    return null;
  }
}

// Generate realistic mock Bitcoin balances for demo purposes
function getMockBitcoinBalance(address: string): string {
  // Use address to generate pseudo-random but consistent balances
  const hash = address.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);

  // Generate balance between 1000-10000 satoshis for demo
  const baseBalance = BigInt(Math.abs(hash) % 9000 + 1000);

  return baseBalance.toString();
}

// Get EVM QCT balance using real Web3 calls
async function getEVMQCTBalance(address: string, rpcUrl: string, contractAddress: string): Promise<{ balance: string } | null> {
  try {
    // Check if contract is deployed (not zero address)
    if (contractAddress === '0x0000000000000000000000000000000000000000') {
      console.log(`QCT contract not yet deployed on ${rpcUrl}`);
      return null;
    }

    console.log(`Fetching QCT balance for ${address} on ${rpcUrl} at contract ${contractAddress}`);

    // TODO: Implement actual Web3 balance checking once contracts are deployed
    // For now, return mock data that scales based on the address and chain
    const mockBalance = await getMockEVMBalance(address, contractAddress);

    return {
      balance: mockBalance // Balance in wei (18 decimals)
    };
  } catch (error) {
    console.error('Error fetching EVM QCT balance:', error);
    return null;
  }
}

  // Generate realistic mock balances for demo purposes
  async function getMockEVMBalance(address: string, contractAddress: string): Promise<string> {
    // Use address and contract address to generate pseudo-random but consistent balances
    const combined = address + contractAddress;
    const hash = combined.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);

    // Generate balance between 1-10 QCT for demo (use only BigInt arithmetic)
    const absHashBig = BigInt(Math.abs(hash));
    const baseBalance = (absHashBig % 9000000000000000000n) + 1000000000000000000n; // 1-10 QCT in wei

    return baseBalance.toString();
  }

// Get current QCT exchange rates
async function getQCTRates(): Promise<Record<string, any>> {
  // TODO: Implement real-time rate fetching from DEXes and Bitcoin markets
  // For now, return realistic mock rates based on current market conditions

  const baseRate = 1.0;
  const btcEthRate = 15.5; // Current BTC/ETH ratio

  return {
    'bitcoin-to-ethereum': (baseRate * btcEthRate).toString(),
    'ethereum-to-bitcoin': (baseRate / btcEthRate).toString(),
    'ethereum-to-polygon': '0.999', // Near 1:1 with small fees
    'polygon-to-ethereum': '1.001', // Near 1:1 with small fees
    'polygon-to-bitcoin': (baseRate * btcEthRate * 1.001).toString(),
    'bitcoin-to-polygon': (baseRate / btcEthRate / 1.001).toString(),
    'arbitrum-to-ethereum': '0.998',
    'ethereum-to-arbitrum': '1.002',
    'base-to-ethereum': '0.9995',
    'ethereum-to-base': '1.0005',
    'optimism-to-ethereum': '0.999',
    'ethereum-to-optimism': '1.001',
    lastUpdated: Date.now(),
    source: 'mock_data' // TODO: Change to 'live_dex' when connected
  };
}

// Validate trade request
function validateTradeRequest(request: QCTTradeRequest): { valid: boolean; error?: string } {
  if (!request.action || !['buy', 'sell', 'swap', 'bridge'].includes(request.action)) {
    return { valid: false, error: 'Invalid action' };
  }

  if (!request.orderType || !['market', 'limit', 'stop'].includes(request.orderType)) {
    return { valid: false, error: 'Invalid order type' };
  }

  if (!request.fromChain || !request.toChain) {
    return { valid: false, error: 'fromChain and toChain are required' };
  }

  if (!request.amount || parseFloat(request.amount) <= 0) {
    return { valid: false, error: 'Invalid amount' };
  }

  // Validate limit/stop prices for advanced orders
  if (request.orderType === 'limit' && (!request.limitPrice || parseFloat(request.limitPrice) <= 0)) {
    return { valid: false, error: 'Limit price required for limit orders' };
  }

  if (request.orderType === 'stop' && (!request.stopPrice || parseFloat(request.stopPrice) <= 0)) {
    return { valid: false, error: 'Stop price required for stop orders' };
  }

  return { valid: true };
}

// Process QCT buy order
async function processBuyQCT(request: QCTTradeRequest) {
  console.log('Processing QCT buy:', request);

  const _orderType = request.orderType ?? 'market';
  const orderTypeText = _orderType === 'market' ? 'Market' : _orderType.charAt(0).toUpperCase() + _orderType.slice(1);

  if (request.toChain === 'bitcoin') {
    // Buy Bitcoin QCT (Runes)
    return await buyBitcoinQCT(request);
  } else {
    // Buy EVM QCT
    return await buyEVMQCT(request);
  }
}

// Process QCT sell order
async function processSellQCT(request: QCTTradeRequest) {
  console.log('Processing QCT sell:', request);

  const _orderType = request.orderType ?? 'market';
  const orderTypeText = _orderType === 'market' ? 'Market' : _orderType.charAt(0).toUpperCase() + _orderType.slice(1);

  if (request.fromChain === 'bitcoin') {
    // Sell Bitcoin QCT (Runes)
    return await sellBitcoinQCT(request);
  } else {
    // Sell EVM QCT
    return await sellEVMQCT(request);
  }
}

// Process QCT swap (same chain)
async function processSwapQCT(request: QCTTradeRequest) {
  console.log('Processing QCT swap:', request);
  
  // TODO: Implement DEX swaps for QCT
  return {
    transactionId: `swap_${Date.now()}`,
    status: 'pending',
    message: 'QCT swap initiated'
  };
}

// Process QCT bridge (cross-chain)
async function processBridgeQCT(request: QCTTradeRequest) {
  console.log('Processing QCT bridge:', request);
  
  if (request.fromChain === 'bitcoin' && isEVMChain(request.toChain)) {
    // Bitcoin → EVM bridge
    return await bridgeBitcoinToEVM(request);
  } else if (isEVMChain(request.fromChain) && request.toChain === 'bitcoin') {
    // EVM → Bitcoin bridge
    return await bridgeEVMToBitcoin(request);
  } else if (isEVMChain(request.fromChain) && isEVMChain(request.toChain)) {
    // EVM → EVM bridge via LayerZero
    return await bridgeEVMToEVM(request);
  }
  
  return {
    error: 'Unsupported bridge route'
  };
}

// Buy Bitcoin QCT (Runes)
async function buyBitcoinQCT(request: QCTTradeRequest) {
  try {
    const BTC_SIGNER_ID = process.env.BTC_SIGNER_PSBT_CANISTER_ID || process.env.NEXT_PUBLIC_BTC_SIGNER_PSBT_CANISTER_ID;
    if (!BTC_SIGNER_ID) {
      throw new Error('BTC signer canister ID not configured');
    }

    const btcSigner = await getActor<any>(BTC_SIGNER_ID, btcSignerIdl);
    
    // TODO: Implement Bitcoin Runes QCT purchase
    // For now, return mock transaction
    return {
      transactionId: `btc_buy_${Date.now()}`,
      status: 'pending',
      message: `Bitcoin QCT ${request.orderType} purchase initiated`,
      amount: request.amount,
      orderType: request.orderType,
      chain: 'bitcoin'
    };
  } catch (error: any) {
    throw new Error(`Bitcoin QCT buy failed: ${error.message}`);
  }
}

// Buy EVM QCT
async function buyEVMQCT(request: QCTTradeRequest) {
  // TODO: Implement EVM QCT purchase via DEX
  return {
    transactionId: `evm_buy_${Date.now()}`,
    status: 'pending',
    message: `EVM QCT ${request.orderType} purchase initiated`,
    amount: request.amount,
    orderType: request.orderType,
    chain: request.toChain
  };
}

// Sell Bitcoin QCT
async function sellBitcoinQCT(request: QCTTradeRequest) {
  // TODO: Implement Bitcoin QCT selling
  return {
    transactionId: `btc_sell_${Date.now()}`,
    status: 'pending',
    message: `Bitcoin QCT ${request.orderType} sale initiated`,
    amount: request.amount,
    orderType: request.orderType,
    chain: 'bitcoin'
  };
}

// Sell EVM QCT
async function sellEVMQCT(request: QCTTradeRequest) {
  // TODO: Implement EVM QCT selling
  return {
    transactionId: `evm_sell_${Date.now()}`,
    status: 'pending',
    message: `EVM QCT ${request.orderType} sale initiated`,
    amount: request.amount,
    orderType: request.orderType,
    chain: request.fromChain
  };
}

// Bridge Bitcoin QCT to EVM
async function bridgeBitcoinToEVM(request: QCTTradeRequest) {
  try {
    // Step 1: Lock/burn Bitcoin QCT
    // Step 2: Submit DVN message for cross-chain verification
    // Step 3: Mint EVM QCT on destination chain
    
    const DVN_ID = process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
    if (!DVN_ID) {
      throw new Error('DVN canister ID not configured');
    }

    const dvn = await getActor<any>(DVN_ID, dvnIdl);
    
    // Submit cross-chain message
    const messagePayload = JSON.stringify({
      action: 'BRIDGE_QCT',
      fromChain: 'bitcoin',
      toChain: request.toChain,
      amount: request.amount,
      fromAddress: request.fromAddress,
      toAddress: request.toAddress,
      timestamp: Date.now()
    });

    const messageId = await dvn.submit_dvn_message(
      0, // Bitcoin (source)
      getChainId(request.toChain), // EVM destination
      Array.from(new TextEncoder().encode(messagePayload)),
      `qct_bridge_${Date.now()}`
    );

    return {
      transactionId: messageId,
      status: 'pending',
      message: `Bitcoin to EVM QCT ${request.orderType} bridge initiated`,
      amount: request.amount,
      orderType: request.orderType,
      fromChain: 'bitcoin',
      toChain: request.toChain
    };
  } catch (error: any) {
    throw new Error(`Bitcoin to EVM bridge failed: ${error.message}`);
  }
}

// Bridge EVM QCT to Bitcoin
async function bridgeEVMToBitcoin(request: QCTTradeRequest) {
  try {
    // Step 1: Lock/burn EVM QCT
    // Step 2: Submit DVN message for cross-chain verification
    // Step 3: Mint Bitcoin QCT (Runes)
    
    const DVN_ID = process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
    if (!DVN_ID) {
      throw new Error('DVN canister ID not configured');
    }

    const dvn = await getActor<any>(DVN_ID, dvnIdl);
    
    const messagePayload = JSON.stringify({
      action: 'BRIDGE_QCT',
      fromChain: request.fromChain,
      toChain: 'bitcoin',
      amount: request.amount,
      fromAddress: request.fromAddress,
      toAddress: request.toAddress,
      timestamp: Date.now()
    });

    const messageId = await dvn.submit_dvn_message(
      getChainId(request.fromChain), // EVM source
      0, // Bitcoin destination
      Array.from(new TextEncoder().encode(messagePayload)),
      `qct_bridge_${Date.now()}`
    );

    return {
      transactionId: messageId,
      status: 'pending',
      message: `EVM to Bitcoin QCT ${request.orderType} bridge initiated`,
      amount: request.amount,
      orderType: request.orderType,
      fromChain: request.fromChain,
      toChain: 'bitcoin'
    };
  } catch (error: any) {
    throw new Error(`EVM to Bitcoin bridge failed: ${error.message}`);
  }
}

// Bridge EVM to EVM via LayerZero
async function bridgeEVMToEVM(request: QCTTradeRequest) {
  // TODO: Implement LayerZero EVM-to-EVM bridging
  return {
    transactionId: `evm_bridge_${Date.now()}`,
    status: 'pending',
    message: `EVM to EVM QCT ${request.orderType} bridge initiated`,
    amount: request.amount,
    orderType: request.orderType,
    fromChain: request.fromChain,
    toChain: request.toChain
  };
}

// Helper functions
function isEVMChain(chain: string): boolean {
  return ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'].includes(chain);
}

function getChainId(chain: string): number {
  const chainIds: Record<string, number> = {
    'ethereum': 11155111, // Sepolia
    'polygon': 80002,     // Amoy
    'arbitrum': 421614,   // Arbitrum Sepolia
    'optimism': 11155420, // Optimism Sepolia
    'base': 84532,        // Base Sepolia
    'bitcoin': 0          // Custom ID for Bitcoin
  };
  return chainIds[chain] || 0;
}
