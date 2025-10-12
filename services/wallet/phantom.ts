// Phantom Wallet Integration Helper for Solana

export interface SolanaChainConfig {
  name: string;
  cluster: 'mainnet-beta' | 'testnet' | 'devnet';
  rpc: string;
  explorer: string;
}

export const SOLANA_CLUSTERS: Record<string, SolanaChainConfig> = {
  'mainnet-beta': {
    name: 'Solana Mainnet',
    cluster: 'mainnet-beta',
    rpc: 'https://api.mainnet-beta.solana.com',
    explorer: 'https://explorer.solana.com'
  },
  'testnet': {
    name: 'Solana Testnet',
    cluster: 'testnet',
    rpc: 'https://api.testnet.solana.com',
    explorer: 'https://explorer.solana.com?cluster=testnet'
  },
  'devnet': {
    name: 'Solana Devnet',
    cluster: 'devnet',
    rpc: 'https://api.devnet.solana.com',
    explorer: 'https://explorer.solana.com?cluster=devnet'
  }
};

export class PhantomWallet {
  private solana: any;

  constructor() {
    if (typeof window !== 'undefined') {
      this.solana = (window as any).solana;
    }
  }

  // Check if Phantom is installed
  isInstalled(): boolean {
    return !!this.solana && this.solana.isPhantom;
  }

  // Connect wallet
  async connect(): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('Phantom wallet is not installed. Please install Phantom to continue.');
    }

    try {
      const response = await this.solana.connect();
      return response.publicKey.toString();
    } catch (error: any) {
      throw new Error(`Failed to connect wallet: ${error.message}`);
    }
  }

  // Disconnect wallet
  async disconnect(): Promise<void> {
    if (!this.isInstalled()) {
      return;
    }

    try {
      await this.solana.disconnect();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }

  // Get connected public key
  getPublicKey(): string | null {
    if (!this.isInstalled() || !this.solana.isConnected) {
      return null;
    }

    return this.solana.publicKey?.toString() || null;
  }

  // Check if wallet is connected
  isConnected(): boolean {
    return this.isInstalled() && this.solana.isConnected;
  }

  // Sign and send transaction
  async signAndSendTransaction(transaction: any): Promise<{ signature: string }> {
    if (!this.isInstalled()) {
      throw new Error('Phantom wallet is not installed');
    }

    if (!this.isConnected()) {
      throw new Error('Wallet is not connected');
    }

    try {
      const { signature } = await this.solana.signAndSendTransaction(transaction);
      return { signature };
    } catch (error: any) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  // Sign transaction (without sending)
  async signTransaction(transaction: any): Promise<any> {
    if (!this.isInstalled()) {
      throw new Error('Phantom wallet is not installed');
    }

    if (!this.isConnected()) {
      throw new Error('Wallet is not connected');
    }

    try {
      const signedTransaction = await this.solana.signTransaction(transaction);
      return signedTransaction;
    } catch (error: any) {
      throw new Error(`Failed to sign transaction: ${error.message}`);
    }
  }

  // Sign multiple transactions
  async signAllTransactions(transactions: any[]): Promise<any[]> {
    if (!this.isInstalled()) {
      throw new Error('Phantom wallet is not installed');
    }

    if (!this.isConnected()) {
      throw new Error('Wallet is not connected');
    }

    try {
      const signedTransactions = await this.solana.signAllTransactions(transactions);
      return signedTransactions;
    } catch (error: any) {
      throw new Error(`Failed to sign transactions: ${error.message}`);
    }
  }

  // Sign message
  async signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }> {
    if (!this.isInstalled()) {
      throw new Error('Phantom wallet is not installed');
    }

    if (!this.isConnected()) {
      throw new Error('Wallet is not connected');
    }

    try {
      const { signature } = await this.solana.signMessage(message, 'utf8');
      return { signature };
    } catch (error: any) {
      throw new Error(`Failed to sign message: ${error.message}`);
    }
  }

  // Listen for account changes
  onAccountChanged(callback: (publicKey: any) => void): void {
    if (this.isInstalled()) {
      this.solana.on('accountChanged', callback);
    }
  }

  // Listen for disconnect
  onDisconnect(callback: () => void): void {
    if (this.isInstalled()) {
      this.solana.on('disconnect', callback);
    }
  }

  // Remove event listener
  removeListener(event: string, callback: any): void {
    if (this.isInstalled()) {
      this.solana.removeListener(event, callback);
    }
  }
}

// Singleton instance
let phantomInstance: PhantomWallet | null = null;

export function getPhantomWallet(): PhantomWallet {
  if (!phantomInstance) {
    phantomInstance = new PhantomWallet();
  }
  return phantomInstance;
}

// Helper function to format lamports to SOL
export function lamportsToSol(lamports: number | string): string {
  const lamportsNum = typeof lamports === 'string' ? parseInt(lamports) : lamports;
  const sol = lamportsNum / 1e9;
  return sol.toFixed(4);
}

// Helper function to format SOL to lamports
export function solToLamports(sol: number | string): number {
  const solNum = typeof sol === 'string' ? parseFloat(sol) : sol;
  return Math.floor(solNum * 1e9);
}
