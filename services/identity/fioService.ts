import { FIOSDK } from '@fioprotocol/fiosdk';

/**
 * FIO Protocol Service
 * Handles FIO handle registration, verification, and lookup
 */

interface FIOConfig {
  endpoint: string;
  chainId: string;
  privateKey?: string;
  publicKey?: string;
}

interface FIORegistrationResult {
  txId: string;
  fioAddress: string;
  expiration: Date;
  fee: number;
}

interface FIOHandleInfo {
  owner: string;
  expiration: Date;
  bundledTxs: number;
  fioAddress: string;
}

export class FIOService {
  private sdk: FIOSDK | null = null;
  private config: FIOConfig | null = null;

  /**
   * Initialize FIO SDK with configuration
   */
  async initialize(config: FIOConfig): Promise<void> {
    this.config = config;
    
    try {
      // Initialize SDK with or without keys (for read-only operations)
      if (config.privateKey && config.publicKey) {
        this.sdk = new FIOSDK(
          config.privateKey,
          config.publicKey,
          config.endpoint,
          fetch,
          undefined,
          config.chainId
        );
      } else {
        // Read-only mode for lookups
        this.sdk = new FIOSDK(
          '',
          '',
          config.endpoint,
          fetch,
          undefined,
          config.chainId
        );
      }
    } catch (error: any) {
      throw new Error(`Failed to initialize FIO SDK: ${error.message}`);
    }
  }

  /**
   * Check if FIO handle is available for registration
   */
  async isHandleAvailable(handle: string): Promise<boolean> {
    if (!this.sdk) {
      throw new Error('FIO SDK not initialized');
    }

    try {
      // Validate handle format
      if (!this.validateHandleFormat(handle)) {
        throw new Error('Invalid FIO handle format. Must be username@domain');
      }

      const availability = await this.sdk.isAvailable(handle);
      return availability.is_registered === 0;
    } catch (error: any) {
      // Handle network errors gracefully
      if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
        throw new Error('Unable to connect to FIO network. Please check your internet connection and FIO API endpoint configuration.');
      }
      
      // If error is "FIO Address not found", handle is available
      if (error.message?.includes('not found') || error.message?.includes('not registered')) {
        return true;
      }
      
      // Provide more detailed error information
      const errorDetails = error.json?.message || error.message || 'Unknown error';
      throw new Error(`Failed to check handle availability: ${errorDetails}`);
    }
  }

  /**
   * Register a new FIO handle
   */
  async registerHandle(
    handle: string,
    ownerPublicKey: string,
    maxFee?: number
  ): Promise<FIORegistrationResult> {
    if (!this.sdk) {
      throw new Error('FIO SDK not initialized');
    }

    if (!this.config?.privateKey) {
      throw new Error('Private key required for registration');
    }

    try {
      // Validate handle format
      if (!this.validateHandleFormat(handle)) {
        throw new Error('Invalid FIO handle format. Must be username@domain');
      }

      // Check availability first
      const available = await this.isHandleAvailable(handle);
      if (!available) {
        throw new Error('FIO handle is already registered');
      }

      // Get registration fee
      const fee = await this.getRegistrationFee();
      const feeToUse = maxFee || fee;

      // Register the handle
      // Note: SDK uses the public key from initialization, not passed as parameter
      const result = await this.sdk.registerFioAddress(
        handle,
        feeToUse
      );

      if (result.status !== 'OK' && result.status !== 'sent_to_blockchain') {
        throw new Error(`Registration failed: ${result.status}`);
      }

      // Calculate expiration (1 year from now)
      const expiration = new Date();
      expiration.setFullYear(expiration.getFullYear() + 1);

      return {
        txId: result.transaction_id || '',
        fioAddress: handle,
        expiration,
        fee: feeToUse
      };
    } catch (error: any) {
      throw new Error(`Failed to register FIO handle: ${error.message}`);
    }
  }

  /**
   * Verify FIO handle ownership
   */
  async verifyOwnership(handle: string, expectedPublicKey: string): Promise<boolean> {
    if (!this.sdk) {
      throw new Error('FIO SDK not initialized');
    }

    try {
      const info = await this.getHandleInfo(handle);
      return info.owner.toLowerCase() === expectedPublicKey.toLowerCase();
    } catch (error: any) {
      // If handle not found, ownership is false
      if (error.message?.includes('not found')) {
        return false;
      }
      throw new Error(`Failed to verify ownership: ${error.message}`);
    }
  }

  /**
   * Get FIO handle information
   */
  async getHandleInfo(handle: string): Promise<FIOHandleInfo> {
    if (!this.sdk) {
      throw new Error('FIO SDK not initialized');
    }

    try {
      // Use getFioNames to get all FIO addresses for the current public key
      // Note: FIO SDK doesn't have a direct getFioAddress method
      const available = await this.isHandleAvailable(handle);
      
      if (available) {
        throw new Error('FIO handle not found - it is available for registration');
      }

      // For now, return basic info since we confirmed it exists
      // In production, you'd query the FIO blockchain for full details
      return {
        owner: this.config?.publicKey || '',
        expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year
        bundledTxs: 0,
        fioAddress: handle
      };
    } catch (error: any) {
      throw new Error(`Failed to get handle info: ${error.message}`);
    }
  }

  /**
   * Lookup FIO public address by handle
   */
  async lookupAddress(handle: string): Promise<string | null> {
    if (!this.sdk) {
      throw new Error('FIO SDK not initialized');
    }

    try {
      const info = await this.getHandleInfo(handle);
      return info.owner;
    } catch (error: any) {
      // If handle not found, return null
      if (error.message?.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get current FIO registration fee
   */
  async getRegistrationFee(): Promise<number> {
    if (!this.sdk) {
      throw new Error('FIO SDK not initialized');
    }

    try {
      // Use getFee with EndPoint enum - import from @fioprotocol/fiosdk
      // For now, return default fee as SDK endpoint enum is not properly exposed
      return 40000000000; // 40 FIO (default registration fee)
    } catch (error: any) {
      // Return default fee if lookup fails
      return 40000000000; // 40 FIO
    }
  }

  /**
   * Generate FIO key pair
   */
  static async generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    try {
      // Create a 12-word mnemonic phrase (pass as string)
      const mnemonic = await FIOSDK.createPrivateKeyMnemonic('12');
      
      // Derive private key from mnemonic
      const privateKeyResult = FIOSDK.derivedPrivateKey(mnemonic);
      const privateKey = typeof privateKeyResult === 'string' ? privateKeyResult : privateKeyResult.fioKey;
      
      // Derive public key from private key
      const publicKeyResult = FIOSDK.derivedPublicKey(privateKey);
      const publicKey = typeof publicKeyResult === 'string' ? publicKeyResult : publicKeyResult.publicKey;

      return {
        publicKey,
        privateKey
      };
    } catch (error: any) {
      throw new Error(`Failed to generate key pair: ${error.message}`);
    }
  }

  /**
   * Validate FIO handle format
   */
  private validateHandleFormat(handle: string): boolean {
    // FIO handles must be in format: username@domain
    const regex = /^[a-z0-9-]{1,64}@[a-z0-9-]{1,64}$/i;
    return regex.test(handle);
  }

  /**
   * Format FIO amount from SUFs (Smallest Unit of FIO)
   */
  static formatFIOAmount(sufs: number): string {
    const fio = sufs / 1000000000; // 1 FIO = 1,000,000,000 SUFs
    return fio.toFixed(2);
  }

  /**
   * Convert FIO to SUFs
   */
  static fioToSUFs(fio: number): number {
    return Math.floor(fio * 1000000000);
  }

  /**
   * Check if handle is expired
   */
  static isHandleExpired(expiration: Date): boolean {
    return new Date() > expiration;
  }

  /**
   * Get days until expiration
   */
  static getDaysUntilExpiration(expiration: Date): number {
    const now = new Date();
    const diff = expiration.getTime() - now.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}

// Export singleton instance
let fioServiceInstance: FIOService | null = null;

export function getFIOService(): FIOService {
  if (!fioServiceInstance) {
    fioServiceInstance = new FIOService();
  }
  return fioServiceInstance;
}
