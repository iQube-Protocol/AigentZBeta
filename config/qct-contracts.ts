/**
 * QCT Token Contract Addresses
 * Deployed across Bitcoin, Solana, and EVM chains
 */

export const QCT_CONTRACTS = {
  // Bitcoin (testnet) - DEPLOYED
  bitcoin: {
    network: 'testnet',
    establishmentTx: 'caaabee2695d173d718f012b065514f1b313fcad767dc3d836056cdb74de1903',
    address: 'tb1qywewf6kshzgvq9awzr46awhylu40v68tr8acm2',
    blockHeight: 4736703,
    decimals: 8,
    symbol: 'QCT',
    name: 'QriptoCENT',
    totalSupply: '1000000000',
    explorer: 'https://mempool.space/testnet/tx/caaabee2695d173d718f012b065514f1b313fcad767dc3d836056cdb74de1903'
  },

  // Solana SPL Token (devnet) - DEPLOYED
  solana: {
    network: 'devnet',
    mintAddress: 'H9FwtJbadVob3rpAwrjbw5dcfBM9VtbXHbM3UaDNKWBT',
    tokenAccount: 'DWdX5dvBwAh4ds5jKCnWPkz5amqUqc5nzBndPMG34rck',
    owner: '5LJ8dAwGPvWSZ1FAWhk3fcnBXbyX9LvFxgxXoHALZxuT',
    decimals: 9,
    symbol: 'QCT',
    name: 'QriptoCENT',
    explorer: 'https://explorer.solana.com/address/H9FwtJbadVob3rpAwrjbw5dcfBM9VtbXHbM3UaDNKWBT?cluster=devnet'
  },

  // EVM Chains (ERC20)
  evm: {
    sepolia: {
      chainId: 11155111,
      address: '0x4C4f1aD931589449962bB675bcb8e95672349d09',
      explorer: 'https://sepolia.etherscan.io/address/0x4C4f1aD931589449962bB675bcb8e95672349d09',
      decimals: 18,
      symbol: 'QCT',
      name: 'QriptoCENT'
    },
    amoy: {
      chainId: 80002,
      address: '0x4C4f1aD931589449962bB675bcb8e95672349d09',
      explorer: 'https://amoy.polygonscan.com/address/0x4C4f1aD931589449962bB675bcb8e95672349d09',
      decimals: 18,
      symbol: 'QCT',
      name: 'QriptoCENT'
    },
    arbitrumSepolia: {
      chainId: 421614,
      address: '0x4C4f1aD931589449962bB675bcb8e95672349d09',
      explorer: 'https://sepolia.arbiscan.io/address/0x4C4f1aD931589449962bB675bcb8e95672349d09',
      decimals: 18,
      symbol: 'QCT',
      name: 'QriptoCENT'
    },
    optimismSepolia: {
      chainId: 11155420,
      address: '0x4C4f1aD931589449962bB675bcb8e95672349d09',
      explorer: 'https://sepolia-optimism.etherscan.io/address/0x4C4f1aD931589449962bB675bcb8e95672349d09',
      decimals: 18,
      symbol: 'QCT',
      name: 'QriptoCENT'
    },
    baseSepolia: {
      chainId: 84532,
      address: '0x4C4f1aD931589449962bB675bcb8e95672349d09',
      explorer: 'https://sepolia.basescan.org/address/0x4C4f1aD931589449962bB675bcb8e95672349d09',
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
