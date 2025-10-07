// MetaMask Wallet Integration Helper
// Extracted from DVN Mint Tests for reuse across the app

export interface ChainConfig {
  chainId: number;
  hex: string;
  name: string;
  symbol: string;
  rpc: string;
  explorer: string;
}

export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  11155111: {
    chainId: 11155111,
    hex: '0xaa36a7',
    name: 'Ethereum Sepolia',
    symbol: 'ETH',
    rpc: 'https://rpc.sepolia.org',
    explorer: 'https://sepolia.etherscan.io'
  },
  80002: {
    chainId: 80002,
    hex: '0x13882',
    name: 'Polygon Amoy',
    symbol: 'MATIC',
    rpc: 'https://rpc-amoy.polygon.technology',
    explorer: 'https://www.oklink.com/amoy'
  },
  11155420: {
    chainId: 11155420,
    hex: '0xaa37dc',
    name: 'Optimism Sepolia',
    symbol: 'ETH',
    rpc: 'https://sepolia.optimism.io',
    explorer: 'https://sepolia-optimism.etherscan.io'
  },
  421614: {
    chainId: 421614,
    hex: '0x66eee',
    name: 'Arbitrum Sepolia',
    symbol: 'ETH',
    rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io'
  },
  84532: {
    chainId: 84532,
    hex: '0x14a34',
    name: 'Base Sepolia',
    symbol: 'ETH',
    rpc: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org'
  }
};

export class MetaMaskWallet {
  private ethereum: any;

  constructor() {
    if (typeof window !== 'undefined') {
      const ethAll = (window as any).ethereum;
      this.ethereum = ethAll?.providers?.find((p: any) => p && p.isMetaMask) ?? ethAll;
    }
  }

  // Check if MetaMask is installed
  isInstalled(): boolean {
    return !!this.ethereum;
  }

  // Connect wallet and get accounts
  async connect(): Promise<string[]> {
    if (!this.isInstalled()) {
      throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
    }

    try {
      const accounts: string[] = await this.ethereum.request({
        method: 'eth_requestAccounts'
      });
      return accounts;
    } catch (error: any) {
      throw new Error(`Failed to connect wallet: ${error.message}`);
    }
  }

  // Get current connected accounts
  async getAccounts(): Promise<string[]> {
    if (!this.isInstalled()) {
      return [];
    }

    try {
      const accounts: string[] = await this.ethereum.request({
        method: 'eth_accounts'
      });
      return accounts;
    } catch (error) {
      return [];
    }
  }

  // Get current chain ID
  async getChainId(): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('MetaMask is not installed');
    }

    return await this.ethereum.request({ method: 'eth_chainId' });
  }

  // Switch to a specific chain
  async switchChain(chainId: number): Promise<void> {
    if (!this.isInstalled()) {
      throw new Error('MetaMask is not installed');
    }

    const chainConfig = SUPPORTED_CHAINS[chainId];
    if (!chainConfig) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    try {
      await this.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainConfig.hex }]
      });
    } catch (error: any) {
      // Chain not added, try to add it
      if (error.code === 4902) {
        await this.addChain(chainId);
        await this.switchChain(chainId); // Retry after adding
      } else {
        throw error;
      }
    }
  }

  // Add a new chain to MetaMask
  async addChain(chainId: number): Promise<void> {
    if (!this.isInstalled()) {
      throw new Error('MetaMask is not installed');
    }

    const chainConfig = SUPPORTED_CHAINS[chainId];
    if (!chainConfig) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    await this.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: chainConfig.hex,
        chainName: chainConfig.name,
        nativeCurrency: {
          name: chainConfig.symbol,
          symbol: chainConfig.symbol,
          decimals: 18
        },
        rpcUrls: [chainConfig.rpc],
        blockExplorerUrls: [chainConfig.explorer]
      }]
    });
  }

  // Send a transaction
  async sendTransaction(params: {
    from: string;
    to: string;
    value?: string;
    data?: string;
    gas?: string;
  }): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('MetaMask is not installed');
    }

    const txHash: string = await this.ethereum.request({
      method: 'eth_sendTransaction',
      params: [params]
    });

    return txHash;
  }

  // Get balance for an address
  async getBalance(address: string): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('MetaMask is not installed');
    }

    const balance: string = await this.ethereum.request({
      method: 'eth_getBalance',
      params: [address, 'latest']
    });

    return balance;
  }

  // Get ERC20 token balance
  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('MetaMask is not installed');
    }

    // ERC20 balanceOf function signature
    const data = '0x70a08231' + walletAddress.slice(2).padStart(64, '0');

    const balance: string = await this.ethereum.request({
      method: 'eth_call',
      params: [{
        to: tokenAddress,
        data: data
      }, 'latest']
    });

    return balance;
  }

  // Listen for account changes
  onAccountsChanged(callback: (accounts: string[]) => void): void {
    if (this.isInstalled()) {
      this.ethereum.on('accountsChanged', callback);
    }
  }

  // Listen for chain changes
  onChainChanged(callback: (chainId: string) => void): void {
    if (this.isInstalled()) {
      this.ethereum.on('chainChanged', callback);
    }
  }

  // Remove event listeners
  removeListener(event: string, callback: any): void {
    if (this.isInstalled()) {
      this.ethereum.removeListener(event, callback);
    }
  }
}

// Singleton instance
let walletInstance: MetaMaskWallet | null = null;

export function getMetaMaskWallet(): MetaMaskWallet {
  if (!walletInstance) {
    walletInstance = new MetaMaskWallet();
  }
  return walletInstance;
}

// Helper function to format wei to ether
export function weiToEther(wei: string): string {
  const weiNum = BigInt(wei);
  const etherNum = Number(weiNum) / 1e18;
  return etherNum.toFixed(4);
}

// Helper function to format ether to wei
export function etherToWei(ether: string): string {
  const etherNum = parseFloat(ether);
  const weiNum = BigInt(Math.floor(etherNum * 1e18));
  return '0x' + weiNum.toString(16);
}
