/**
 * Unisat Wallet Helper
 * Provides Bitcoin wallet connectivity and PSBT transaction signing
 */

export interface UnisatAccount {
  address: string;
  publicKey: string;
  compressedPublicKey: string;
}

export interface UnisatBalance {
  confirmed: number;
  unconfirmed: number;
  total: number;
}

export interface UnisatInscription {
  inscriptionId: string;
  inscriptionNumber: number;
  address: string;
  outputValue: number;
  content: string;
  contentType: string;
  preview: string;
  timestamp: number;
}

export class UnisatWallet {
  private unisat: any;

  constructor() {
    if (typeof window !== 'undefined') {
      this.unisat = (window as any).unisat;
    }
  }

  /**
   * Check if Unisat wallet is installed
   */
  isInstalled(): boolean {
    return typeof this.unisat !== 'undefined';
  }

  /**
   * Connect to Unisat wallet
   * @returns Bitcoin address
   */
  async connect(): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('Unisat wallet is not installed. Please install from https://unisat.io');
    }

    try {
      const accounts = await this.unisat.requestAccounts();
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found in Unisat wallet');
      }
      return accounts[0];
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected the connection request');
      }
      throw new Error(`Failed to connect to Unisat: ${error.message}`);
    }
  }

  /**
   * Disconnect from Unisat wallet
   */
  async disconnect(): Promise<void> {
    // Unisat doesn't have explicit disconnect, just clear local state
    console.log('Unisat wallet disconnected');
  }

  /**
   * Get current accounts
   */
  async getAccounts(): Promise<string[]> {
    if (!this.isInstalled()) {
      throw new Error('Unisat wallet is not installed');
    }

    try {
      return await this.unisat.getAccounts();
    } catch (error: any) {
      throw new Error(`Failed to get accounts: ${error.message}`);
    }
  }

  /**
   * Get current Bitcoin address
   */
  getAddress(): string | null {
    if (!this.isInstalled()) return null;
    
    try {
      // Unisat stores the current account
      return this.unisat.selectedAddress || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.getAddress() !== null;
  }

  /**
   * Get public key
   */
  async getPublicKey(): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('Unisat wallet is not installed');
    }

    try {
      return await this.unisat.getPublicKey();
    } catch (error: any) {
      throw new Error(`Failed to get public key: ${error.message}`);
    }
  }

  /**
   * Get current network
   */
  async getNetwork(): Promise<'livenet' | 'testnet'> {
    if (!this.isInstalled()) {
      throw new Error('Unisat wallet is not installed');
    }

    try {
      const network = await this.unisat.getNetwork();
      return network as 'livenet' | 'testnet';
    } catch (error: any) {
      throw new Error(`Failed to get network: ${error.message}`);
    }
  }

  /**
   * Switch network
   */
  async switchNetwork(network: 'livenet' | 'testnet'): Promise<void> {
    if (!this.isInstalled()) {
      throw new Error('Unisat wallet is not installed');
    }

    try {
      await this.unisat.switchNetwork(network);
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected network switch');
      }
      throw new Error(`Failed to switch network: ${error.message}`);
    }
  }

  /**
   * Get balance
   */
  async getBalance(): Promise<UnisatBalance> {
    if (!this.isInstalled()) {
      throw new Error('Unisat wallet is not installed');
    }

    try {
      const balance = await this.unisat.getBalance();
      return balance;
    } catch (error: any) {
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  /**
   * Sign PSBT (Partially Signed Bitcoin Transaction)
   * @param psbtHex - PSBT in hex format
   * @returns Signed PSBT in hex format
   */
  async signPsbt(psbtHex: string): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('Unisat wallet is not installed');
    }

    try {
      const signedPsbt = await this.unisat.signPsbt(psbtHex);
      return signedPsbt;
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected transaction signing');
      }
      throw new Error(`Failed to sign PSBT: ${error.message}`);
    }
  }

  /**
   * Sign multiple PSBTs
   */
  async signPsbts(psbtHexs: string[]): Promise<string[]> {
    if (!this.isInstalled()) {
      throw new Error('Unisat wallet is not installed');
    }

    try {
      const signedPsbts = await this.unisat.signPsbts(psbtHexs);
      return signedPsbts;
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected transaction signing');
      }
      throw new Error(`Failed to sign PSBTs: ${error.message}`);
    }
  }

  /**
   * Push signed PSBT to network
   * @param psbtHex - Signed PSBT in hex format
   * @returns Transaction ID
   */
  async pushPsbt(psbtHex: string): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('Unisat wallet is not installed');
    }

    try {
      const txid = await this.unisat.pushPsbt(psbtHex);
      return txid;
    } catch (error: any) {
      throw new Error(`Failed to broadcast transaction: ${error.message}`);
    }
  }

  /**
   * Sign and push PSBT in one call
   */
  async signAndPushPsbt(psbtHex: string): Promise<string> {
    const signedPsbt = await this.signPsbt(psbtHex);
    const txid = await this.pushPsbt(signedPsbt);
    return txid;
  }

  /**
   * Sign message
   */
  async signMessage(message: string): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('Unisat wallet is not installed');
    }

    try {
      const signature = await this.unisat.signMessage(message);
      return signature;
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected message signing');
      }
      throw new Error(`Failed to sign message: ${error.message}`);
    }
  }

  /**
   * Send Bitcoin
   */
  async sendBitcoin(to: string, amount: number): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('Unisat wallet is not installed');
    }

    try {
      const txid = await this.unisat.sendBitcoin(to, amount);
      return txid;
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected transaction');
      }
      throw new Error(`Failed to send Bitcoin: ${error.message}`);
    }
  }

  /**
   * Get inscriptions (for Ordinals/Runes)
   */
  async getInscriptions(cursor: number = 0, size: number = 20): Promise<{
    total: number;
    list: UnisatInscription[];
  }> {
    if (!this.isInstalled()) {
      throw new Error('Unisat wallet is not installed');
    }

    try {
      const result = await this.unisat.getInscriptions(cursor, size);
      return result;
    } catch (error: any) {
      throw new Error(`Failed to get inscriptions: ${error.message}`);
    }
  }

  /**
   * Send inscriptions (Ordinals/Runes)
   */
  async sendInscription(to: string, inscriptionId: string): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('Unisat wallet is not installed');
    }

    try {
      const txid = await this.unisat.sendInscription(to, inscriptionId);
      return txid;
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected transaction');
      }
      throw new Error(`Failed to send inscription: ${error.message}`);
    }
  }
}

// Singleton instance
let unisatWalletInstance: UnisatWallet | null = null;

export function getUnisatWallet(): UnisatWallet {
  if (!unisatWalletInstance) {
    unisatWalletInstance = new UnisatWallet();
  }
  return unisatWalletInstance;
}
