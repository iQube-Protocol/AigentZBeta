export interface AgentConfig {
  id: string;
  name: string;
  fioId: string;
  color: string;
  walletKeys: {
    // EVM chains use same private key across chains
    evmPrivateKey: string;
    evmAddress: string;
    // Bitcoin uses separate key pair
    btcPrivateKey?: string;
    btcAddress?: string;
    // Solana uses separate key pair  
    solanaPrivateKey?: string;
    solanaAddress?: string;
  };
  supportedChains: {
    ethereum: boolean;
    arbitrum: boolean;
    base: boolean;
    optimism: boolean;
    polygon: boolean;
    bitcoin: boolean;
    solana: boolean;
  };
}

// Agent wallet configurations
// NOTE: In production, these private keys should be stored securely (env vars, HSM, etc.)
export const agentConfigs: Record<string, AgentConfig> = {
  "aigent-z": {
    id: "aigent-z",
    name: "Aigent Z",
    fioId: "z@aigent",
    color: "blue",
    walletKeys: {
      // Using the existing A2A signer key for Aigent Z
      evmPrivateKey: process.env.SIGNER_PRIVATE_KEY || "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      evmAddress: "0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844", // Updated signer address
      btcPrivateKey: "cVN4VvHzRK31VOEMS6BwlWVNMuBDMq8SDWG5B3YyvMacLyK8dJw8",
      btcAddress: "tb1q03256641efc3dd9877560daf26e4d6bb46086a42",
      solanaPrivateKey: "5J8QhkrwTZHCQYjLKV2T3JNJKqNxvQfgKjSHJHJHJHJHJHJHJHJHJHJHJHJHJHJH",
      solanaAddress: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
    },
    supportedChains: {
      ethereum: true,
      arbitrum: true,
      base: true,
      optimism: true,
      polygon: true,
      bitcoin: true,
      solana: true
    }
  },
  "aigent-moneypenny": {
    id: "aigent-moneypenny",
    name: "Aigent MoneyPenny",
    fioId: "moneypenny@aigent",
    color: "purple",
    walletKeys: {
      // Generated unique keys for MoneyPenny
      evmPrivateKey: "0xa7e4c2d8f9b3e6a1c5d8f2b9e6a3c7d0f4b8e1a5c9d2f6b0e3a7c4d8f1b5e9a2",
      evmAddress: "0x8D286CcECf7B838172A45c26a11F019C4303E742",
      btcPrivateKey: "cVhJ8QhkrwTZHCQYjLKV2T3JNJKqNxvQfgKjSHJHJHJHJHJHJHJHJHJHJHJHJHJH",
      btcAddress: "tb1qmp0neypenny1234567890abcdef1234567890ab",
      solanaPrivateKey: "2x8QhkrwTZHCQYjLKV2T3JNJKqNxvQfgKjSHJHJHJHJHJHJHJHJHJHJHJHJHJHJH",
      solanaAddress: "MoneyPennyWallet123456789ABCDEFGHIJKLMNOP"
    },
    supportedChains: {
      ethereum: true,
      arbitrum: true,
      base: true,
      optimism: true,
      polygon: true,
      bitcoin: true,
      solana: true
    }
  },
  "aigent-nakamoto": {
    id: "aigent-nakamoto",
    name: "Aigent Nakamoto",
    fioId: "nakamoto@aigent",
    color: "orange",
    walletKeys: {
      // Generated unique keys for Nakamoto (Bitcoin focused)
      evmPrivateKey: "0xb8f5d3e0a2c6f9b4e7a0d3f6c9b2e5a8d1f4c7b0e3a6d9f2c5b8e1a4d7f0c3b6",
      evmAddress: "0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9",
      btcPrivateKey: "cSatoshiNakamotoPrivateKeyForBitcoinTestnetWalletAddress12345678901234567890",
      btcAddress: "tb1qnakamoto1234567890abcdef1234567890abcdef",
      solanaPrivateKey: "3x8QhkrwTZHCQYjLKV2T3JNJKqNxvQfgKjSHJHJHJHJHJHJHJHJHJHJHJHJHJHJH",
      solanaAddress: "NakamotoWallet123456789ABCDEFGHIJKLMNOPQR"
    },
    supportedChains: {
      ethereum: true, // Enable Ethereum for EVM compatibility
      arbitrum: true,
      base: true,
      optimism: true,
      polygon: true,
      bitcoin: true,
      solana: true // Show all 7 chains
    }
  },
  "aigent-kn0w1": {
    id: "aigent-kn0w1",
    name: "Aigent Kn0w1",
    fioId: "kn0w1@aigent",
    color: "green",
    walletKeys: {
      // Generated unique keys for Kn0w1 (Data focused)
      evmPrivateKey: "0xc9g6e4f1b3d7a0c4f7b0e3d6a9c2f5b8e1d4a7c0f3b6e9d2a5c8f1b4e7a0d3c6",
      evmAddress: "0x875E825E0341b330065152ddaE37CBb843FC8D84",
      btcPrivateKey: "cKn0w1DataSovereigntyPrivateKeyForBitcoinTestnetWallet1234567890123456789",
      btcAddress: "tb1qkn0w1data1234567890abcdef1234567890abcd",
      solanaPrivateKey: "4x8QhkrwTZHCQYjLKV2T3JNJKqNxvQfgKjSHJHJHJHJHJHJHJHJHJHJHJHJHJHJH",
      solanaAddress: "Kn0w1DataWallet123456789ABCDEFGHIJKLMNOPQ"
    },
    supportedChains: {
      ethereum: true,
      arbitrum: true,
      base: true,
      optimism: true,
      polygon: true,
      bitcoin: true, // Show all 7 chains
      solana: true
    }
  }
};

// Chain configurations
export const chainConfigs = {
  ethereum: {
    id: 11155111,
    name: "Ethereum Sepolia",
    symbol: "ETH",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_SEPOLIA,
    explorerUrl: "https://sepolia.etherscan.io",
    qctTokenAddress: "0x4C4f1aD931589449962bB675bcb8e95672349d09",
    usdcTokenAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
  },
  arbitrum: {
    id: 421614,
    name: "Arbitrum Sepolia",
    symbol: "ETH",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA,
    explorerUrl: "https://sepolia.arbiscan.io",
    qctTokenAddress: "0x4C4f1aD931589449962bB675bcb8e95672349d09",
    usdcTokenAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"
  },
  base: {
    id: 84532,
    name: "Base Sepolia",
    symbol: "ETH",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA,
    explorerUrl: "https://sepolia.basescan.org",
    qctTokenAddress: "0x4C4f1aD931589449962bB675bcb8e95672349d09",
    usdcTokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  },
  optimism: {
    id: 11155420,
    name: "Optimism Sepolia",
    symbol: "ETH",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA,
    explorerUrl: "https://sepolia-optimism.etherscan.io",
    qctTokenAddress: "0x4C4f1aD931589449962bB675bcb8e95672349d09",
    usdcTokenAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7"
  },
  polygon: {
    id: 80002,
    name: "Polygon Amoy",
    symbol: "MATIC",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY,
    explorerUrl: "https://www.oklink.com/amoy",
    qctTokenAddress: "0x4C4f1aD931589449962bB675bcb8e95672349d09",
    usdcTokenAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"
  },
  bitcoin: {
    id: 0,
    name: "Bitcoin Testnet",
    symbol: "BTC",
    rpcUrl: "https://blockstream.info/testnet/api",
    explorerUrl: "https://blockstream.info/testnet"
  },
  solana: {
    id: 101,
    name: "Solana Testnet",
    symbol: "SOL",
    rpcUrl: "https://api.testnet.solana.com",
    explorerUrl: "https://explorer.solana.com/?cluster=testnet"
  }
};

// Get agent configuration by ID
export function getAgentConfig(agentId: string): AgentConfig | undefined {
  return agentConfigs[agentId];
}

// Get supported chains for an agent
export function getAgentSupportedChains(agentId: string) {
  const config = getAgentConfig(agentId);
  if (!config) return [];
  
  return Object.entries(config.supportedChains)
    .filter(([_, supported]) => supported)
    .map(([chainName]) => chainConfigs[chainName as keyof typeof chainConfigs])
    .filter(Boolean);
}
