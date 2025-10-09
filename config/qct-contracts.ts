/**
 * QCT Token Contract Addresses
 * Deployed across Bitcoin, Solana, and EVM chains
 */

export const QCT_CONTRACTS = {
  // Bitcoin Runes
  bitcoin: {
    network: 'testnet',
    runeName: 'QRIPTOCENT',
    runeId: 'PENDING', // Update after 6 confirmations
    deploymentTx: '61f7b8e6682f29235ee2f3096132ef9fce0cf094bc22c8d2fbb067aef6ee29f2',
    explorer: 'https://mempool.space/testnet/tx/61f7b8e6682f29235ee2f3096132ef9fce0cf094bc22c8d2fbb067aef6ee29f2',
    decimals: 8,
    symbol: 'Q¢'
  },

  // Solana SPL
  solana: {
    network: 'devnet',
    mintAddress: 'PENDING', // Deploy with deploy:qct-spl
    decimals: 9,
    symbol: 'QCT'
  },

  // EVM Chains (ERC20)
  evm: {
    sepolia: {
      chainId: 11155111,
      address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      explorer: 'https://sepolia.etherscan.io/address/0x5FbDB2315678afecb367f032d93F642f64180aa3',
      decimals: 18,
      symbol: 'QCT',
      name: 'QriptoCENT'
    },
    amoy: {
      chainId: 80002,
      address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      explorer: 'https://amoy.polygonscan.com/address/0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      decimals: 18,
      symbol: 'QCT',
      name: 'QriptoCENT'
    },
    arbitrumSepolia: {
      chainId: 421614,
      address: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      explorer: 'https://sepolia.arbiscan.io/address/0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      decimals: 18,
      symbol: 'QCT',
      name: 'QriptoCENT'
    },
    optimismSepolia: {
      chainId: 11155420,
      address: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
      explorer: 'https://sepolia-optimism.etherscan.io/address/0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
      decimals: 18,
      symbol: 'QCT',
      name: 'QriptoCENT'
    },
    baseSepolia: {
      chainId: 84532,
      address: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
      explorer: 'https://sepolia.basescan.org/address/0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
      decimals: 18,
      symbol: 'QCT',
      name: 'QriptoCENT'
    }
  }
};

// Helper function to get QCT contract for a chain
export function getQCTContract(chainId: number | string) {
  if (chainId === 0 || chainId === 'bitcoin') {
    return QCT_CONTRACTS.bitcoin;
  }
  
  if (chainId === 101 || chainId === 'solana') {
    return QCT_CONTRACTS.solana;
  }
  
  // EVM chains
  const evmChain = Object.values(QCT_CONTRACTS.evm).find(
    chain => chain.chainId === Number(chainId)
  );
  
  return evmChain || null;
}

// Get all deployed QCT contracts
export function getAllQCTContracts() {
  return {
    bitcoin: QCT_CONTRACTS.bitcoin,
    solana: QCT_CONTRACTS.solana,
    evm: Object.values(QCT_CONTRACTS.evm)
  };
}
