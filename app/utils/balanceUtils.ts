import { ethers } from 'ethers';

const QCT_CONTRACT = "0x4C4f1aD931589449962bB675bcb8e95672349d09";

// Chain configurations for funded testnets
const CHAINS = {
  arbitrum: {
    name: "Arbitrum Sepolia",
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    chainId: 421614
  },
  optimism: {
    name: "Optimism Sepolia", 
    rpc: "https://sepolia.optimism.io",
    chainId: 11155420
  },
  base: {
    name: "Base Sepolia",
    rpc: "https://sepolia.base.org",
    chainId: 84532
  },
  polygon: {
    name: "Polygon Amoy",
    rpc: "https://rpc-amoy.polygon.technology",
    chainId: 80002
  }
  // Ethereum Sepolia excluded due to RPC 522 errors
};

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// Cache for total balances and individual chain balances
const balanceCache = new Map<string, { balance: string; timestamp: number }>();
const chainBalanceCache = new Map<string, { balances: Record<string, string>; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

export async function getQCTBalance(address: string): Promise<string> {
  if (!address) return "0";
  
  const cacheKey = address.toLowerCase();
  const cached = balanceCache.get(cacheKey);
  const now = Date.now();
  
  // Return cached value if still valid
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.balance;
  }
  
  let totalBalance = 0;
  
  // Check all funded chains
  for (const [chainKey, chain] of Object.entries(CHAINS)) {
    try {
      const provider = new ethers.JsonRpcProvider(chain.rpc);
      const contract = new ethers.Contract(QCT_CONTRACT, ERC20_ABI, provider);
      
      const balance = await contract.balanceOf(address);
      const decimals = await contract.decimals();
      
      // Convert to number and add to total
      const balanceNum = parseFloat(ethers.formatUnits(balance, decimals));
      totalBalance += balanceNum;
      
    } catch (error) {
      console.warn(`Balance fetch failed for ${address} on ${chain.name}:`, error);
      // Continue to next chain
    }
  }
  
  const formatted = totalBalance.toString();
  
  // Cache the result
  balanceCache.set(cacheKey, {
    balance: formatted,
    timestamp: now
  });
  
  return formatted;
}

export async function getQCTBalancesByChain(address: string): Promise<Record<string, string>> {
  if (!address) return {};
  
  const cacheKey = address.toLowerCase();
  const cached = chainBalanceCache.get(cacheKey);
  const now = Date.now();
  
  // Return cached value if still valid
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.balances;
  }
  
  const balances: Record<string, string> = {};
  
  // Check all funded chains
  for (const [chainKey, chain] of Object.entries(CHAINS)) {
    try {
      const provider = new ethers.JsonRpcProvider(chain.rpc);
      const contract = new ethers.Contract(QCT_CONTRACT, ERC20_ABI, provider);
      
      const balance = await contract.balanceOf(address);
      const decimals = await contract.decimals();
      
      // Convert to human readable format
      balances[chainKey] = ethers.formatUnits(balance, decimals);
      
    } catch (error) {
      console.warn(`Balance fetch failed for ${address} on ${chain.name}:`, error);
      balances[chainKey] = "0";
    }
  }
  
  // Cache the result
  chainBalanceCache.set(cacheKey, {
    balances,
    timestamp: now
  });
  
  return balances;
}
