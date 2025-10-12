import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// USDC Contract Addresses (testnet)
const USDC_CONTRACTS = {
  ethereum: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
  polygon: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Amoy USDC
  arbitrum: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia USDC
  optimism: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', // Optimism Sepolia USDC
  base: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
  solana: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // Devnet USDC
  bitcoin: 'N/A' // Bitcoin doesn't have USDC contracts, uses wrapped/bridged assets
};

// Treasury wallet addresses (same as QCT deployment wallet for simplicity)
const TREASURY_WALLET = '0xE9c2A64226a698117986D44473FA73Ed767d3455';

interface TreasuryRequest {
  action: 'balances' | 'buy_qct' | 'sell_qct' | 'add_liquidity' | 'remove_liquidity';
  chain?: string;
  amount?: string;
  slippage?: string;
}

// Get USDC balance for treasury operations
async function getUSDCBalance(chain: string, address: string): Promise<{ balance: string } | null> {
  try {
    // Treasury USDC balances (mock for now - 6 decimals for USDC)
    const treasuryBalances: Record<string, string> = {
      ethereum: '500000000', // $500 USDC (500 * 10^6)
      polygon: '1000000000', // $1,000 USDC (1000 * 10^6)
      arbitrum: '750000000', // $750 USDC (750 * 10^6)
      optimism: '250000000', // $250 USDC (250 * 10^6)
      base: '300000000', // $300 USDC (300 * 10^6)
      solana: '400000000', // $400 USDC (400 * 10^6)
      bitcoin: '0' // Bitcoin doesn't hold USDC directly
    };

    return { balance: treasuryBalances[chain] || '0' };

    // TODO: Uncomment below for real USDC balance checking
    /*
    const contractAddress = USDC_CONTRACTS[chain as keyof typeof USDC_CONTRACTS];
    if (!contractAddress || chain === 'solana' || chain === 'bitcoin') {
      return { balance: treasuryBalances[chain] || '0' };
    }

    // Get RPC URL for the chain
    let rpcUrl;
    switch (chain) {
      case 'ethereum':
        rpcUrl = process.env.NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA;
        break;
      case 'polygon':
        rpcUrl = process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY;
        break;
      case 'arbitrum':
        rpcUrl = process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA;
        break;
      case 'optimism':
        rpcUrl = process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA;
        break;
      case 'base':
        rpcUrl = process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA;
        break;
      default:
        return { balance: treasuryBalances[chain] || '0' };
    }

    if (!rpcUrl) {
      return { balance: treasuryBalances[chain] || '0' };
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
      const balance = BigInt(data.result).toString();
      return { balance };
    }
    
    return { balance: treasuryBalances[chain] || '0' };
    */
  } catch (error) {
    console.error(`Error fetching USDC balance for ${chain}:`, error);
    return { balance: '0' };
  }
}

// Calculate QCT/USDC exchange rate (mock for now)
function getQCTUSDCRate(): number {
  // Corrected rate: 1 QCT = 0.01 USDC
  return 0.01;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'balances') {
      console.log('Fetching treasury USDC balances...');

      const balances = [];
      const chains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'solana', 'bitcoin'];

      // Get USDC balances across all chains
      for (const chain of chains) {
        const usdcBalance = await getUSDCBalance(chain, TREASURY_WALLET);
        if (usdcBalance) {
          balances.push({
            chain,
            asset: 'USDC',
            balance: usdcBalance.balance,
            decimals: 6, // USDC has 6 decimals
            contractAddress: USDC_CONTRACTS[chain as keyof typeof USDC_CONTRACTS]
          });
        }
      }

      // Add current QCT/USDC rate
      const rate = getQCTUSDCRate();

      return NextResponse.json({
        ok: true,
        treasury: {
          usdcBalances: balances,
          qctUsdcRate: rate,
          totalUSDCValue: balances.reduce((sum, b) => {
            return sum + (parseFloat(b.balance) / Math.pow(10, 6));
          }, 0),
          treasuryWallet: TREASURY_WALLET
        },
        at: new Date().toISOString()
      });
    }

    if (action === 'buy_qct') {
      const chain = searchParams.get('chain') || 'polygon';
      const usdcAmount = searchParams.get('amount') || '100';
      const slippage = parseFloat(searchParams.get('slippage') || '0.5');

      const rate = getQCTUSDCRate();
      const qctAmount = parseFloat(usdcAmount) / rate;
      const minQctAmount = qctAmount * (1 - slippage / 100);

      return NextResponse.json({
        ok: true,
        trade: {
          type: 'buy_qct',
          chain,
          usdcAmount: parseFloat(usdcAmount),
          expectedQctAmount: qctAmount,
          minQctAmount: minQctAmount,
          rate,
          slippage,
          estimatedGas: '0.005', // ETH/MATIC for gas
          status: 'ready'
        }
      });
    }

    if (action === 'sell_qct') {
      const chain = searchParams.get('chain') || 'polygon';
      const qctAmount = searchParams.get('amount') || '1000';
      const slippage = parseFloat(searchParams.get('slippage') || '0.5');

      const rate = getQCTUSDCRate();
      const usdcAmount = parseFloat(qctAmount) * rate;
      const minUsdcAmount = usdcAmount * (1 - slippage / 100);

      return NextResponse.json({
        ok: true,
        trade: {
          type: 'sell_qct',
          chain,
          qctAmount: parseFloat(qctAmount),
          expectedUsdcAmount: usdcAmount,
          minUsdcAmount: minUsdcAmount,
          rate,
          slippage,
          estimatedGas: '0.005',
          status: 'ready'
        }
      });
    }

    return NextResponse.json({ 
      error: 'Invalid action. Use: balances, buy_qct, sell_qct' 
    }, { status: 400 });

  } catch (error) {
    console.error('Treasury API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TreasuryRequest;
    const { action, chain = 'polygon', amount = '0', slippage = '0.5' } = body;

    if (action === 'buy_qct') {
      // Execute QCT purchase with USDC
      // This would integrate with DEX APIs (Uniswap, SushiSwap, etc.)
      
      return NextResponse.json({
        ok: true,
        transaction: {
          type: 'buy_qct',
          chain,
          usdcAmount: parseFloat(amount),
          status: 'pending',
          txHash: '0x' + Math.random().toString(16).slice(2, 66), // Mock tx hash
          message: 'QCT purchase initiated'
        }
      });
    }

    if (action === 'sell_qct') {
      // Execute QCT sale for USDC
      
      return NextResponse.json({
        ok: true,
        transaction: {
          type: 'sell_qct',
          chain,
          qctAmount: parseFloat(amount),
          status: 'pending',
          txHash: '0x' + Math.random().toString(16).slice(2, 66), // Mock tx hash
          message: 'QCT sale initiated'
        }
      });
    }

    return NextResponse.json({ 
      error: 'Invalid action for POST request' 
    }, { status: 400 });

  } catch (error) {
    console.error('Treasury POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
