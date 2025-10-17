import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as btcSignerIdl } from '@/services/ops/idl/btc_signer_psbt';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';

export const dynamic = 'force-dynamic';

// QCT Trading Infrastructure
// Handles cross-chain QCT transactions: EVM ↔ BTC, EVM ↔ EVM ↔ BTC cycles

interface QCTTradeRequest {
  action: 'buy' | 'sell' | 'swap' | 'bridge';
  fromChain: 'bitcoin' | 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base';
  toChain: 'bitcoin' | 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base';
  amount: string; // QCT amount in smallest units
  fromAddress?: string; // EVM address or Bitcoin address
  toAddress?: string; // Destination address
  slippage?: number; // Max slippage percentage (default 1%)
  deadline?: number; // Transaction deadline timestamp
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
      // Get current QCT exchange rates
      const rates = await getQCTRates();
      
      // Get live crypto prices
      const livePrices = await getLiveCryptoPrices();
      
      // Add USDC rates for treasury operations
      const usdcRates = {
        'qct-to-usdc': '0.01',  // 1 QCT = 0.01 USDC
        'usdc-to-qct': '100.0', // 1 USDC = 100 QCT
        'btc-to-usdc': livePrices.bitcoin.toString(), // Live BTC price
        'sol-to-usdc': livePrices.solana.toString()   // Live SOL price
      };

      return NextResponse.json({
        ok: true,
        rates: { ...rates, ...usdcRates },
        treasury: {
          qctUsdcRate: 0.01,
          supportedPairs: ['QCT/USDC', 'BTC/USDC', 'SOL/USDC'],
          availableChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'solana', 'bitcoin']
        },
        at: new Date().toISOString()
      });
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

    // EVM chains QCT balances
    const { QCT_CONTRACTS } = await import('@/config/qct-contracts');
    const evmChains = [
      { 
        name: 'ethereum', 
        rpc: process.env.NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA || process.env.NEXT_PUBLIC_RPC_SEPOLIA, 
        contractAddress: QCT_CONTRACTS.evm.sepolia.address 
      },
      { 
        name: 'polygon', 
        rpc: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY, 
        contractAddress: QCT_CONTRACTS.evm.amoy.address 
      },
      { 
        name: 'arbitrum', 
        rpc: process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA || process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA, 
        contractAddress: QCT_CONTRACTS.evm.arbitrumSepolia.address 
      },
      { 
        name: 'optimism', 
        rpc: process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA, 
        contractAddress: QCT_CONTRACTS.evm.optimismSepolia.address 
      },
      { 
        name: 'base', 
        rpc: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA, 
        contractAddress: QCT_CONTRACTS.evm.baseSepolia.address 
      }
    ];

    for (const chain of evmChains) {
      const evmBalance = await getEVMQCTBalance(address, chain.rpc || '', chain.contractAddress);
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

    // Solana QCT (SPL Token) balance
    const solanaBalance = await getSolanaQCTBalance(address);
    if (solanaBalance) {
      balances.push({
        chain: 'solana',
        balance: solanaBalance.balance,
        decimals: 9,
        symbol: 'QCT',
        contractAddress: 'H9FwtJbadVob3rpAwrjbw5dcfBM9VtbXHbM3UaDNKWBT' // SPL mint address
      });
    }

  } catch (error) {
    console.error('Error fetching QCT balances:', error);
  }

  return balances;
}

// Get Bitcoin QCT balance (Runes)
async function getBitcoinQCTBalance(address: string): Promise<{ balance: string } | null> {
  try {
    // TODO: Implement Bitcoin Runes balance checking
    // Treasury distribution: 100M QCT for Bitcoin (8 decimals)
    return {
      balance: '10000000000000000' // 100M QCT in satoshis (100,000,000 * 10^8)
    };
  } catch (error) {
    console.error('Error fetching Bitcoin QCT balance:', error);
    return null;
  }
}

// Get EVM QCT balance
async function getEVMQCTBalance(address: string, rpcUrl: string, contractAddress: string): Promise<{ balance: string } | null> {
  try {
    // Treasury distribution: 50M QCT for each EVM chain (18 decimals)
    // Return treasury amount directly for now
    return { balance: '50000000000000000000000000' }; // 50M * 10^18
    
    // TODO: Uncomment below for real contract balance checking
    /*
    if (!rpcUrl || !contractAddress || contractAddress === '0x...') {
      console.log('Skipping EVM balance check - missing RPC or contract address');
      return { balance: '0' };
    }

    // ERC-20 balanceOf function call
    const balanceOfData = '0x70a08231' + address.slice(2).padStart(64, '0');
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to: contractAddress,
            data: balanceOfData
          },
          'latest'
        ],
        id: 1
      })
    });

    const data = await response.json();
    
    if (data.result && data.result !== '0x') {
      // Convert hex result to decimal string
      const balance = BigInt(data.result).toString();
      console.log(`QCT balance for ${address} on ${contractAddress}: ${balance}`);
      return { balance };
    }
    
    return { balance: '50000000000000000000000000' }; // 50M * 10^18
    */
  } catch (error) {
    console.error('Error fetching EVM QCT balance:', error);
    return { balance: '50000000000000000000000000' }; // 50M * 10^18
  }
}

// Get Solana QCT balance (SPL Token)
async function getSolanaQCTBalance(address: string): Promise<{ balance: string } | null> {
  try {
    // TODO: Implement Solana SPL token balance checking
    // Treasury distribution: 50M QCT for Solana (9 decimals)
    return {
      balance: '50000000000000000' // 50M * 10^9
    };
  } catch (error) {
    console.error('Error fetching Solana QCT balance:', error);
    return null;
  }
}

// Get current QCT exchange rates
async function getQCTRates(): Promise<Record<string, any>> {
  // TODO: Implement real-time rate fetching
  return {
    'bitcoin-to-ethereum': '1.0',
    'ethereum-to-polygon': '0.999',
    'polygon-to-bitcoin': '1.001',
    lastUpdated: Date.now()
  };
}

// Validate trade request
function validateTradeRequest(request: QCTTradeRequest): { valid: boolean; error?: string } {
  if (!request.action || !['buy', 'sell', 'swap', 'bridge'].includes(request.action)) {
    return { valid: false, error: 'Invalid action' };
  }

  if (!request.fromChain || !request.toChain) {
    return { valid: false, error: 'fromChain and toChain are required' };
  }

  if (!request.amount || parseFloat(request.amount) <= 0) {
    return { valid: false, error: 'Invalid amount' };
  }

  return { valid: true };
}

// Process QCT buy order
async function processBuyQCT(request: QCTTradeRequest) {
  console.log('Processing QCT buy:', request);
  
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
      message: 'Bitcoin QCT purchase initiated',
      amount: request.amount,
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
    message: 'EVM QCT purchase initiated',
    amount: request.amount,
    chain: request.toChain
  };
}

// Sell Bitcoin QCT
async function sellBitcoinQCT(request: QCTTradeRequest) {
  // TODO: Implement Bitcoin QCT selling
  return {
    transactionId: `btc_sell_${Date.now()}`,
    status: 'pending',
    message: 'Bitcoin QCT sale initiated',
    amount: request.amount,
    chain: 'bitcoin'
  };
}

// Sell EVM QCT
async function sellEVMQCT(request: QCTTradeRequest) {
  // TODO: Implement EVM QCT selling
  return {
    transactionId: `evm_sell_${Date.now()}`,
    status: 'pending',
    message: 'EVM QCT sale initiated',
    amount: request.amount,
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
      message: 'Bitcoin to EVM QCT bridge initiated',
      amount: request.amount,
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
      message: 'EVM to Bitcoin QCT bridge initiated',
      amount: request.amount,
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
    message: 'EVM to EVM QCT bridge initiated',
    amount: request.amount,
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

// Get live cryptocurrency prices from CoinGecko
async function getLiveCryptoPrices(): Promise<{ bitcoin: number; solana: number }> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,solana&vs_currencies=usd', {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 300 } // Cache for 5 minutes
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch live prices');
    }
    
    const data = await response.json();
    
    return {
      bitcoin: Math.round(data.bitcoin?.usd || 111000), // Fallback to ~$111k
      solana: Math.round(data.solana?.usd || 240)       // Fallback to ~$240
    };
  } catch (error) {
    console.error('Error fetching live crypto prices:', error);
    // Return current approximate prices as fallback
    return {
      bitcoin: 111000,
      solana: 240
    };
  }
}
