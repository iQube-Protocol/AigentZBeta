/**
 * Chain Configuration for Multi-Chain Wallet
 * 
 * Supports 4 chains in Phase 1:
 * - Base (QCT)
 * - Optimism (QCT)
 * - Polygon (QCT)
 * - KNYT Chain (KNYT)
 * 
 * Future chains:
 * - Arbitrum (QCT)
 * - Ethereum (QCT)
 * - Bitcoin (KNYT)
 * - Solana (future token)
 */

// =============================================================================
// CHAIN IDENTIFIERS
// =============================================================================

/** Supported chain IDs */
export type ChainId = 
  | 'base'
  | 'optimism'
  | 'polygon'
  | 'arbitrum'
  | 'ethereum'
  | 'knyt'
  | 'bitcoin'
  | 'solana';

/** EVM-compatible chains */
export type EvmChainId = 'base' | 'optimism' | 'polygon' | 'arbitrum' | 'ethereum';

/** Phase 1 supported chains */
export type Phase1ChainId = 'base' | 'optimism' | 'polygon' | 'knyt';

// =============================================================================
// TOKEN CONFIGURATION
// =============================================================================

/** Supported tokens */
export type TokenSymbol = 'QCT' | 'KNYT';

/** Token metadata */
export interface TokenConfig {
  symbol: TokenSymbol;
  name: string;
  decimals: number;
  iconUri?: string;
}

/** Token configurations */
export const TOKENS: Record<TokenSymbol, TokenConfig> = {
  QCT: {
    symbol: 'QCT',
    name: 'Qripto Content Token',
    decimals: 18,
    iconUri: '/icons/qct.svg',
  },
  KNYT: {
    symbol: 'KNYT',
    name: 'KNYT Token',
    decimals: 18,
    iconUri: '/icons/knyt.svg',
  },
};

// =============================================================================
// CHAIN CONFIGURATION
// =============================================================================

/** Network type */
export type NetworkType = 'mainnet' | 'testnet';

/** Chain configuration */
export interface ChainConfig {
  /** Chain identifier */
  id: ChainId;
  
  /** Display name */
  name: string;
  
  /** Short name for UI */
  shortName: string;
  
  /** Chain ID (numeric, for EVM chains) */
  chainId?: number;
  
  /** Native token symbol */
  nativeToken: string;
  
  /** Supported tokens on this chain */
  supportedTokens: TokenSymbol[];
  
  /** RPC URL (testnet) */
  rpcUrlTestnet: string;
  
  /** RPC URL (mainnet) */
  rpcUrlMainnet?: string;
  
  /** Block explorer URL */
  explorerUrl: string;
  
  /** Token contract addresses */
  tokenContracts: {
    testnet: Record<TokenSymbol, string>;
    mainnet?: Record<TokenSymbol, string>;
  };
  
  /** Whether this chain is EVM-compatible */
  isEvm: boolean;
  
  /** Whether this chain is enabled in current phase */
  isEnabled: boolean;
  
  /** Phase when this chain was added */
  phase: 1 | 2 | 3;
  
  /** Chain icon URI */
  iconUri?: string;
  
  /** FIO chain code for address mapping */
  fioChainCode: string;
}

// =============================================================================
// CHAIN CONFIGURATIONS
// =============================================================================

export const CHAINS: Record<ChainId, ChainConfig> = {
  // Phase 1 Chains
  base: {
    id: 'base',
    name: 'Base',
    shortName: 'BASE',
    chainId: 84532, // Base Sepolia testnet
    nativeToken: 'ETH',
    supportedTokens: ['QCT'],
    rpcUrlTestnet: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
    rpcUrlMainnet: 'https://mainnet.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    tokenContracts: {
      testnet: {
        QCT: process.env.NEXT_PUBLIC_QCT_BASE_SEPOLIA || '',
        KNYT: '',
      },
    },
    isEvm: true,
    isEnabled: true,
    phase: 1,
    iconUri: '/icons/chains/base.svg',
    fioChainCode: 'BASE',
  },
  
  optimism: {
    id: 'optimism',
    name: 'Optimism',
    shortName: 'OP',
    chainId: 11155420, // Optimism Sepolia testnet
    nativeToken: 'ETH',
    supportedTokens: ['QCT'],
    rpcUrlTestnet: process.env.NEXT_PUBLIC_RPC_OP_SEPOLIA || 'https://sepolia.optimism.io',
    rpcUrlMainnet: 'https://mainnet.optimism.io',
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
    tokenContracts: {
      testnet: {
        QCT: process.env.NEXT_PUBLIC_QCT_OP_SEPOLIA || '',
        KNYT: '',
      },
    },
    isEvm: true,
    isEnabled: true,
    phase: 1,
    iconUri: '/icons/chains/optimism.svg',
    fioChainCode: 'OP',
  },
  
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    shortName: 'MATIC',
    chainId: 80002, // Polygon Amoy testnet
    nativeToken: 'MATIC',
    supportedTokens: ['QCT'],
    rpcUrlTestnet: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY || 'https://rpc-amoy.polygon.technology',
    rpcUrlMainnet: 'https://polygon-rpc.com',
    explorerUrl: 'https://amoy.polygonscan.com',
    tokenContracts: {
      testnet: {
        QCT: process.env.NEXT_PUBLIC_QCT_POLYGON_AMOY || '',
        KNYT: '',
      },
    },
    isEvm: true,
    isEnabled: true,
    phase: 1,
    iconUri: '/icons/chains/polygon.svg',
    fioChainCode: 'MATIC',
  },
  
  knyt: {
    id: 'knyt',
    name: 'KNYT Chain',
    shortName: 'KNYT',
    chainId: undefined, // Non-EVM or custom chain
    nativeToken: 'KNYT',
    supportedTokens: ['KNYT'],
    rpcUrlTestnet: process.env.NEXT_PUBLIC_RPC_KNYT_TESTNET || '',
    explorerUrl: '',
    tokenContracts: {
      testnet: {
        QCT: '',
        KNYT: process.env.NEXT_PUBLIC_KNYT_CONTRACT || '',
      },
    },
    isEvm: false, // KNYT may have its own chain type
    isEnabled: true,
    phase: 1,
    iconUri: '/icons/chains/knyt.svg',
    fioChainCode: 'KNYT',
  },
  
  // Phase 2 Chains
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    shortName: 'ARB',
    chainId: 421614, // Arbitrum Sepolia testnet
    nativeToken: 'ETH',
    supportedTokens: ['QCT'],
    rpcUrlTestnet: process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc',
    rpcUrlMainnet: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
    tokenContracts: {
      testnet: {
        QCT: process.env.NEXT_PUBLIC_QCT_ARB_SEPOLIA || '',
        KNYT: '',
      },
    },
    isEvm: true,
    isEnabled: false,
    phase: 2,
    iconUri: '/icons/chains/arbitrum.svg',
    fioChainCode: 'ARB',
  },
  
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    shortName: 'ETH',
    chainId: 11155111, // Sepolia testnet
    nativeToken: 'ETH',
    supportedTokens: ['QCT'],
    rpcUrlTestnet: process.env.NEXT_PUBLIC_RPC_SEPOLIA || 'https://sepolia.infura.io/v3/',
    rpcUrlMainnet: 'https://mainnet.infura.io/v3/',
    explorerUrl: 'https://sepolia.etherscan.io',
    tokenContracts: {
      testnet: {
        QCT: process.env.NEXT_PUBLIC_QCT_SEPOLIA || '',
        KNYT: '',
      },
    },
    isEvm: true,
    isEnabled: false,
    phase: 2,
    iconUri: '/icons/chains/ethereum.svg',
    fioChainCode: 'ETH',
  },
  
  // Phase 3 Chains
  bitcoin: {
    id: 'bitcoin',
    name: 'Bitcoin',
    shortName: 'BTC',
    nativeToken: 'BTC',
    supportedTokens: ['KNYT'], // KNYT on Bitcoin via Ordinals or similar
    rpcUrlTestnet: '',
    explorerUrl: 'https://mempool.space/testnet',
    tokenContracts: {
      testnet: {
        QCT: '',
        KNYT: '',
      },
    },
    isEvm: false,
    isEnabled: false,
    phase: 3,
    iconUri: '/icons/chains/bitcoin.svg',
    fioChainCode: 'BTC',
  },
  
  solana: {
    id: 'solana',
    name: 'Solana',
    shortName: 'SOL',
    nativeToken: 'SOL',
    supportedTokens: [], // Future token support
    rpcUrlTestnet: 'https://api.devnet.solana.com',
    rpcUrlMainnet: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://explorer.solana.com',
    tokenContracts: {
      testnet: {
        QCT: '',
        KNYT: '',
      },
    },
    isEvm: false,
    isEnabled: false,
    phase: 3,
    iconUri: '/icons/chains/solana.svg',
    fioChainCode: 'SOL',
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Get all enabled chains */
export function getEnabledChains(): ChainConfig[] {
  return Object.values(CHAINS).filter(chain => chain.isEnabled);
}

/** Get all EVM chains */
export function getEvmChains(): ChainConfig[] {
  return Object.values(CHAINS).filter(chain => chain.isEvm);
}

/** Get enabled EVM chains */
export function getEnabledEvmChains(): ChainConfig[] {
  return Object.values(CHAINS).filter(chain => chain.isEvm && chain.isEnabled);
}

/** Get chain by ID */
export function getChain(id: ChainId): ChainConfig | undefined {
  return CHAINS[id];
}

/** Get chains supporting a specific token */
export function getChainsForToken(token: TokenSymbol): ChainConfig[] {
  return Object.values(CHAINS).filter(chain => 
    chain.isEnabled && chain.supportedTokens.includes(token)
  );
}

/** Get RPC URL for chain */
export function getRpcUrl(chainId: ChainId, network: NetworkType = 'testnet'): string {
  const chain = CHAINS[chainId];
  if (!chain) return '';
  return network === 'mainnet' && chain.rpcUrlMainnet 
    ? chain.rpcUrlMainnet 
    : chain.rpcUrlTestnet;
}

/** Get token contract address */
export function getTokenContract(
  chainId: ChainId, 
  token: TokenSymbol, 
  network: NetworkType = 'testnet'
): string {
  const chain = CHAINS[chainId];
  if (!chain) return '';
  const contracts = network === 'mainnet' && chain.tokenContracts.mainnet
    ? chain.tokenContracts.mainnet
    : chain.tokenContracts.testnet;
  return contracts[token] || '';
}

// =============================================================================
// WALLET BALANCE TYPES
// =============================================================================

/** Balance for a single token on a single chain */
export interface TokenBalance {
  chainId: ChainId;
  token: TokenSymbol;
  balance: string; // BigNumber as string
  balanceFormatted: string; // Human-readable
  usdValue?: number;
}

/** All balances for a persona */
export interface WalletBalances {
  personaId: string;
  balances: TokenBalance[];
  totalUsdValue?: number;
  lastUpdatedAt: string;
}

// All exports are inline with their declarations
