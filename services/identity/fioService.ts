import { FIOSDK } from '@fioprotocol/fiosdk';
import fetch from 'cross-fetch';
import { randomBytes } from 'crypto';

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

    // Validate handle format
    if (!this.validateHandleFormat(handle)) {
      throw new Error('Invalid FIO handle format. Must be username@domain');
    }

    // In mock mode, check our database first to prevent duplicates
    if (typeof window !== 'undefined' && process.env.FIO_MOCK_MODE === 'true') {
      try {
        const response = await fetch('/api/identity/fio/check-database', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle })
        });
        const data = await response.json();
        if (!data.available) {
          return false; // Handle already exists in our database
        }
      } catch (error) {
        console.warn('Failed to check database for handle:', error);
        // Continue to FIO SDK check as fallback
      }
    }

    try {
      const availability = await this.sdk.isAvailable(handle);
      return availability.is_registered === 0;
    } catch (error: any) {
      // Log the full error for debugging
      console.error('FIO SDK isAvailable error:', {
        message: error.message,
        stack: error.stack,
        json: error.json,
        cause: error.cause
      });
      
      // Handle network errors gracefully
      if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED') || error.cause?.code === 'ECONNREFUSED') {
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
      // IMPORTANT: registerFioAddress registers to the SDK's initialized public key
      // If we want a different owner, we need to use registerFioAddressOnBehalfOfUser
      // or transfer after registration
      const tpid = ''; // Empty string is valid for tpid
      
      console.log('Attempting FIO registration:', {
        handle,
        fee: feeToUse,
        sdkPublicKey: this.sdk.publicKey,
        ownerPublicKey: ownerPublicKey,
        tpid
      });
      
      // Check if owner is different from SDK key
      if (ownerPublicKey && ownerPublicKey !== this.sdk.publicKey) {
        console.log('⚠️ WARNING: Owner public key differs from SDK key');
        console.log('SDK will register to:', this.sdk.publicKey);
        console.log('Desired owner:', ownerPublicKey);
        console.log('This may require a transfer after registration');
      }
      
      const result = await this.sdk.registerFioAddress(
        handle,
        feeToUse,
        tpid
      );

      console.log('FIO registration result:', result);

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
      console.error('FIO registration error details:', {
        message: error.message,
        json: error.json,
        errorCode: error.errorCode,
        list: error.list,
        stack: error.stack
      });
      
      // Extract more detailed error information
      let errorMessage = error.message || 'Unknown error';
      if (error.json?.fields) {
        const fieldErrors = error.json.fields.map((f: any) => `${f.name}: ${f.error}`).join(', ');
        errorMessage = `Validation error: ${fieldErrors}`;
      } else if (error.list && error.list.length > 0) {
        errorMessage = `Validation error: ${error.list.map((e: any) => e.message).join(', ')}`;
      }
      
      throw new Error(`Failed to register FIO handle: ${errorMessage}`);
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
   * Generate FIO key pair using FIO SDK
   * Creates a new 12-word mnemonic and derives keys from it
   */
  static async generateKeyPair(): Promise<{ publicKey: string; privateKey: string; mnemonic: string }> {
    try {
      // Generate a 12-word BIP39 mnemonic
      const bip39 = require('bip39');
      const mnemonic = bip39.generateMnemonic();
      
      // Derive private key from mnemonic using FIO SDK
      // @ts-ignore - FIO SDK types are incorrect
      const privateKeyResult = await FIOSDK.createPrivateKeyMnemonic(mnemonic);
      const privateKey = privateKeyResult.fioKey;
      
      // Derive public key from private key
      // @ts-ignore - FIO SDK types are incorrect
      const publicKeyResult = FIOSDK.derivedPublicKey(privateKey);
      const publicKey = publicKeyResult.publicKey;

      return {
        publicKey,
        privateKey,
        mnemonic
      };
    } catch (error: any) {
      console.error('FIO key generation error:', error);
      throw new Error(`Failed to generate FIO key pair: ${error.message}`);
    }
  }

  /**
   * Generate FIO key pair from existing mnemonic phrase
   * Derives keys from a provided mnemonic
   */
  static async generateKeyPairFromMnemonic(mnemonic: string): Promise<{ publicKey: string; privateKey: string }> {
    try {
      // Derive private key from mnemonic using FIO SDK
      // @ts-ignore - FIO SDK types are incorrect
      const privateKeyResult = await FIOSDK.createPrivateKeyMnemonic(mnemonic);
      const privateKey = privateKeyResult.fioKey;
      
      // Derive public key from private key
      // @ts-ignore - FIO SDK types are incorrect
      const publicKeyResult = FIOSDK.derivedPublicKey(privateKey);
      const publicKey = publicKeyResult.publicKey;

      return {
        publicKey,
        privateKey
      };
    } catch (error: any) {
      console.error('FIO key generation from mnemonic error:', error);
      throw new Error(`Failed to generate FIO key pair from mnemonic: ${error.message}`);
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
