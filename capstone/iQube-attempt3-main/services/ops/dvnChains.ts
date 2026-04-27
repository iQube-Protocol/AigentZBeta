export type ChainFamily = 'evm' | 'bitcoin' | 'solana';

export type DVNChainConfig = {
  chainId: number;
  name: string;
  family: ChainFamily;
  defaultRpcUrl?: string;
  explorerBaseUrl?: string;
};

const CHAIN_CONFIGS: Record<number, DVNChainConfig> = {
  0: {
    chainId: 0,
    name: 'Bitcoin',
    family: 'bitcoin',
  },
  101: {
    chainId: 101,
    name: 'Solana',
    family: 'solana',
  },
  11155111: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    family: 'evm',
    defaultRpcUrl: process.env.DVN_RPC_11155111 || 'https://rpc.sepolia.org',
    explorerBaseUrl: 'https://sepolia.etherscan.io',
  },
  421614: {
    chainId: 421614,
    name: 'Arbitrum Sepolia',
    family: 'evm',
    defaultRpcUrl: process.env.DVN_RPC_421614,
    explorerBaseUrl: 'https://sepolia.arbiscan.io',
  },
  84532: {
    chainId: 84532,
    name: 'Base Sepolia',
    family: 'evm',
    defaultRpcUrl: process.env.DVN_RPC_84532 || 'https://sepolia.base.org',
    explorerBaseUrl: 'https://sepolia.basescan.org',
  },
  11155420: {
    chainId: 11155420,
    name: 'Optimism Sepolia',
    family: 'evm',
    defaultRpcUrl: process.env.DVN_RPC_11155420,
    explorerBaseUrl: 'https://sepolia-optimism.etherscan.io',
  },
  80002: {
    chainId: 80002,
    name: 'Polygon Amoy',
    family: 'evm',
    defaultRpcUrl: process.env.DVN_RPC_80002 || 'https://rpc-amoy.polygon.technology',
    explorerBaseUrl: 'https://amoy.polygonscan.com',
  },
};

export function getChainConfig(chainId: number): DVNChainConfig | null {
  return CHAIN_CONFIGS[chainId] || null;
}

export function getDefaultRpc(chainId: number): string {
  return CHAIN_CONFIGS[chainId]?.defaultRpcUrl || '';
}

export function getChainName(chainId: number): string {
  return CHAIN_CONFIGS[chainId]?.name || `Chain ${chainId}`;
}

export function isSupportedChain(chainId: number): boolean {
  return Boolean(CHAIN_CONFIGS[chainId]);
}

export const SUPPORTED_CHAIN_IDS = Object.keys(CHAIN_CONFIGS)
  .map((id) => Number(id))
  .sort((a, b) => a - b);
