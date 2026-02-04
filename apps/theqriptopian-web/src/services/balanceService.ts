/**
 * Balance Service - Fetches live token balances across chains
 * 
 * Supports:
 * - QCT (QriptoCENT) on 5 EVM testnets + Bitcoin + Solana
 * - USDC on EVM testnets
 * - KNYT on mainnet (future)
 */

import { ethers } from 'ethers';

// QCT Token Contract Address (same across all EVM chains)
const QCT_CONTRACT = "0x4C4f1aD931589449962bB675bcb8e95672349d09";

// Chain configurations
export const CHAIN_CONFIGS = {
  ethereum: {
    id: 11155111,
    name: "Ethereum Sepolia",
    symbol: "ETH",
    rpc: "https://rpc.sepolia.org",
    qctAddress: QCT_CONTRACT,
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    explorer: "https://sepolia.etherscan.io",
  },
  arbitrum: {
    id: 421614,
    name: "Arbitrum Sepolia",
    symbol: "ETH",
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    qctAddress: QCT_CONTRACT,
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    explorer: "https://sepolia.arbiscan.io",
  },
  base: {
    id: 84532,
    name: "Base Sepolia",
    symbol: "ETH",
    rpc: "https://sepolia.base.org",
    qctAddress: QCT_CONTRACT,
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    explorer: "https://sepolia.basescan.org",
  },
  optimism: {
    id: 11155420,
    name: "Optimism Sepolia",
    symbol: "ETH",
    rpc: "https://sepolia.optimism.io",
    qctAddress: QCT_CONTRACT,
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    explorer: "https://sepolia-optimism.etherscan.io",
  },
  polygon: {
    id: 80002,
    name: "Polygon Amoy",
    symbol: "MATIC",
    rpc: "https://rpc-amoy.polygon.technology",
    qctAddress: QCT_CONTRACT,
    usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    explorer: "https://www.oklink.com/amoy",
  },
  bitcoin: {
    id: 0,
    name: "Bitcoin Testnet",
    symbol: "BTC",
    rpc: "https://blockstream.info/testnet/api",
    explorer: "https://blockstream.info/testnet",
  },
  solana: {
    id: 101,
    name: "Solana Testnet",
    symbol: "SOL",
    rpc: "https://api.testnet.solana.com",
    explorer: "https://explorer.solana.com/?cluster=testnet",
  },
};

// Agent wallet addresses
export const AGENT_WALLETS: Record<string, { evmAddress: string; btcAddress?: string; solanaAddress?: string }> = {
  'aigent-z': {
    evmAddress: "0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844",
    btcAddress: "tb1q03256641efc3dd9877560daf26e4d6bb46086a42",
    solanaAddress: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  },
  'aigent-moneypenny': {
    evmAddress: "0x8D286CcECf7B838172A45c26a11F019C4303E742",
  },
  'aigent-nakamoto': {
    evmAddress: "0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9",
  },
  'aigent-kn0w1': {
    evmAddress: "0x875E825E0341b330065152ddaE37CBb843FC8D84",
  },
  'devagent': {
    evmAddress: "0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844", // Same as Aigent Z for dev
  },
};

// ERC20 ABI for balance checking
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// Cache for balances
const balanceCache = new Map<string, { data: ChainBalances; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

export interface ChainBalance {
  chain: string;
  chainName: string;
  qct: string;
  usdc: string;
  native: string;
}

export interface ChainBalances {
  totalQct: number;
  totalUsdc: number;
  chains: ChainBalance[];
  lastUpdated: string;
}

/**
 * Get wallet address for a persona/agent
 */
export function getWalletAddress(fioHandle: string | null): string | null {
  if (!fioHandle) return null;
  
  // Check if it's a known agent
  const agentId = fioHandle.split('@')[0].toLowerCase();
  
  // Map FIO handles to agent IDs
  const handleToAgent: Record<string, string> = {
    'aigentz': 'aigent-z',
    'moneypenny': 'aigent-moneypenny',
    'nakamoto': 'aigent-nakamoto',
    'kn0w1': 'aigent-kn0w1',
    'devagent': 'devagent',
  };
  
  const mappedAgentId = handleToAgent[agentId] || agentId;
  const wallet = AGENT_WALLETS[mappedAgentId];
  
  return wallet?.evmAddress || null;
}

/**
 * Fetch QCT and USDC balances across all chains for an address
 */
export async function fetchBalances(address: string): Promise<ChainBalances> {
  const cacheKey = address.toLowerCase();
  const cached = balanceCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }
  
  const chains: ChainBalance[] = [];
  let totalQct = 0;
  let totalUsdc = 0;
  
  // Fetch EVM chain balances in parallel
  const evmChains = ['arbitrum', 'base', 'optimism', 'polygon', 'ethereum'] as const;
  
  const chainPromises = evmChains.map(async (chainKey) => {
    const chain = CHAIN_CONFIGS[chainKey];
    try {
      const provider = new ethers.JsonRpcProvider(chain.rpc);
      
      // Fetch QCT, USDC, and Native in parallel
      const [qctResult, usdcResult, nativeResult] = await Promise.all([
        // QCT
        (async () => {
          try {
            const qctContract = new ethers.Contract(chain.qctAddress!, ERC20_ABI, provider);
            const balance = await qctContract.balanceOf(address);
            return ethers.formatUnits(balance, 18);
          } catch (e) {
            console.warn(`QCT balance fetch failed on ${chain.name}:`, e);
            return '0';
          }
        })(),
        // USDC
        (async () => {
          if (!chain.usdcAddress) return '0';
          try {
            const usdcContract = new ethers.Contract(chain.usdcAddress, ERC20_ABI, provider);
            const balance = await usdcContract.balanceOf(address);
            return ethers.formatUnits(balance, 6);
          } catch (e) {
            console.warn(`USDC balance fetch failed on ${chain.name}:`, e);
            return '0';
          }
        })(),
        // Native
        (async () => {
          try {
            const balance = await provider.getBalance(address);
            return ethers.formatEther(balance);
          } catch (e) {
            console.warn(`Native balance fetch failed on ${chain.name}:`, e);
            return '0';
          }
        })()
      ]);

      return {
        chain: chainKey,
        chainName: chain.name,
        qct: qctResult,
        usdc: usdcResult,
        native: nativeResult,
      };
    } catch (e) {
      console.warn(`Chain ${chain.name} fetch failed:`, e);
      return {
        chain: chainKey,
        chainName: chain.name,
        qct: '0',
        usdc: '0',
        native: '0',
      };
    }
  });

  const resolvedChains = await Promise.all(chainPromises);
  
  resolvedChains.forEach(chain => {
    chains.push(chain);
    totalQct += parseFloat(chain.qct);
    totalUsdc += parseFloat(chain.usdc);
  });
  
  // Add Bitcoin placeholder (would need separate API)
  chains.push({
    chain: 'bitcoin',
    chainName: 'Bitcoin Testnet',
    qct: '0', // QCT Runes not yet implemented
    usdc: '0',
    native: '0',
  });
  
  // Add Solana placeholder (would need separate API)
  chains.push({
    chain: 'solana',
    chainName: 'Solana Testnet',
    qct: '0', // SPL token not yet implemented
    usdc: '0',
    native: '0',
  });
  
  const result: ChainBalances = {
    totalQct,
    totalUsdc,
    chains,
    lastUpdated: new Date().toISOString(),
  };
  
  // Cache the result
  balanceCache.set(cacheKey, { data: result, timestamp: now });
  
  return result;
}

/**
 * Format balance for display
 */
export function formatBalance(balance: number | string, decimals: number = 2): string {
  const num = typeof balance === 'string' ? parseFloat(balance) : balance;
  if (isNaN(num)) return '0';
  if (num === 0) return '0';
  if (num < 0.01) return '<0.01';
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}
