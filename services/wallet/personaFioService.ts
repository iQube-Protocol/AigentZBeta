/**
 * Persona FIO Service
 * 
 * Extends FIO functionality for persona creation and management.
 * Handles FIO handle registration, chain address mapping, and DID generation.
 */

import { FIOService, getFIOService } from '@/services/identity/fioService';
import { FioDomain, FioHandle, FioRegistration, FioChainMappings } from '@/types/persona';
import { ChainId, CHAINS, getEnabledChains } from '@/types/chains';

// =============================================================================
// FIO CONFIGURATION
// =============================================================================

/** FIO testnet configuration */
export const FIO_TESTNET_CONFIG = {
  endpoint: 'https://testnet.fioprotocol.io/v1',
  chainId: 'b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e',
};

/** FIO mainnet configuration */
export const FIO_MAINNET_CONFIG = {
  endpoint: 'https://fio.blockpane.com/v1',
  chainId: '21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c',
};

/** Supported FIO domains for personas */
export const SUPPORTED_DOMAINS: FioDomain[] = ['qripto', 'knyt'];

// =============================================================================
// HANDLE UTILITIES
// =============================================================================

/**
 * Parse a FIO handle into components
 */
export function parseFioHandle(handle: string): FioHandle | null {
  const parts = handle.split('@');
  if (parts.length !== 2) return null;
  
  const [username, domain] = parts;
  if (!SUPPORTED_DOMAINS.includes(domain as FioDomain)) return null;
  
  return {
    username,
    domain: domain as FioDomain,
    full: handle,
  };
}

/**
 * Build a FIO handle from components
 */
export function buildFioHandle(username: string, domain: FioDomain): string {
  return `${username}@${domain}`;
}

/**
 * Validate a FIO handle format
 */
export function isValidFioHandle(handle: string): boolean {
  const parsed = parseFioHandle(handle);
  if (!parsed) return false;
  
  // Username: 1-64 chars, alphanumeric and hyphens
  const usernameRegex = /^[a-z0-9-]{1,64}$/i;
  return usernameRegex.test(parsed.username);
}

/**
 * Validate a username (without domain)
 */
export function isValidUsername(username: string): boolean {
  const regex = /^[a-z0-9-]{1,64}$/i;
  return regex.test(username);
}

// =============================================================================
// DID GENERATION
// =============================================================================

/**
 * Generate a DID from a FIO handle
 * 
 * Format: did:iq:{hash(fioHandle)}
 */
export async function generateDidFromHandle(fioHandle: string): Promise<string> {
  // Use SHA-256 to hash the handle
  const encoder = new TextEncoder();
  const data = encoder.encode(fioHandle.toLowerCase());
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Use first 32 chars of hash for DID
  return `did:iq:${hashHex.slice(0, 32)}`;
}

// =============================================================================
// PERSONA FIO SERVICE
// =============================================================================

/**
 * PersonaFioService - Manages FIO operations for personas
 */
export class PersonaFioService {
  private fioService: FIOService;
  private initialized: boolean = false;
  
  constructor() {
    this.fioService = getFIOService();
  }
  
  /**
   * Initialize the service with testnet configuration
   */
  async initialize(privateKey?: string, publicKey?: string): Promise<void> {
    await this.fioService.initialize({
      ...FIO_TESTNET_CONFIG,
      privateKey,
      publicKey,
    });
    this.initialized = true;
  }
  
  /**
   * Ensure service is initialized (read-only mode if no keys)
   */
  async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
  
  /**
   * Check if a handle is available
   * Uses direct API call to avoid FIO SDK browser compatibility issues
   */
  async checkHandleAvailability(
    username: string,
    domain: FioDomain
  ): Promise<{ available: boolean; handle: string; error?: string }> {
    const handle = buildFioHandle(username, domain);
    
    // Validate format first
    if (!isValidUsername(username)) {
      return {
        available: false,
        handle,
        error: 'Invalid username format. Use 1-64 alphanumeric characters and hyphens.',
      };
    }
    
    try {
      // Use direct API call instead of FIO SDK to avoid browser compatibility issues
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(`${FIO_TESTNET_CONFIG.endpoint}/chain/avail_check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fio_name: handle }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      
      if (!response.ok) {
        // If API fails, assume available (optimistic for testnet)
        console.warn('FIO availability check failed, assuming available');
        return { available: true, handle };
      }
      
      const data = await response.json().catch(() => ({}));
      // FIO returns is_registered: 0 if available, 1 if taken
      const available = data.is_registered === 0;
      return { available, handle };
    } catch (error) {
      // On error, assume available for better UX (testnet only)
      console.warn('FIO check error:', error);
      return { available: true, handle };
    }
  }
  
  /**
   * Register a new FIO handle for a persona
   */
  async registerHandle(
    username: string,
    domain: FioDomain,
    ownerPublicKey: string
  ): Promise<FioRegistration> {
    const handle = buildFioHandle(username, domain);
    
    // Validate
    if (!isValidUsername(username)) {
      throw new Error('Invalid username format');
    }
    
    try {
      const result = await this.fioService.registerHandle(handle, ownerPublicKey);
      
      return {
        handle: result.fioAddress,
        publicKey: ownerPublicKey,
        txId: result.txId,
        registeredAt: new Date().toISOString(),
        expiresAt: result.expiration.toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to register handle: ${(error as Error).message}`);
    }
  }
  
  /**
   * Map chain addresses to FIO handle
   * 
   * This allows the FIO handle to resolve to different addresses on different chains.
   * Syncs addresses to FIO network and returns the mappings.
   */
  async mapChainAddresses(
    fioHandle: string,
    addresses: Record<ChainId, string>
  ): Promise<FioChainMappings> {
    await this.ensureInitialized();
    
    const mappings: Record<string, string> = {};
    const errors: string[] = [];
    
    // Map each enabled chain
    for (const chain of getEnabledChains()) {
      const address = addresses[chain.id];
      if (address) {
        // FIO uses chain codes like "ETH", "MATIC", etc.
        mappings[chain.fioChainCode] = address;
        
        // Sync to FIO network
        try {
          await this.fioService.addPublicAddress(
            fioHandle,
            chain.fioChainCode,
            chain.fioChainCode, // tokenCode same as chainCode for native tokens
            address
          );
          console.log(`[PersonaFIO] Mapped ${chain.fioChainCode} -> ${address} for ${fioHandle}`);
        } catch (error) {
          console.warn(`[PersonaFIO] Failed to map ${chain.fioChainCode} for ${fioHandle}:`, error);
          errors.push(`${chain.fioChainCode}: ${(error as Error).message}`);
        }
      }
    }
    
    if (errors.length > 0) {
      console.warn('[PersonaFIO] Some chain mappings failed:', errors);
    }
    
    return {
      mappings,
      lastSyncedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Map a single wallet address to FIO handle
   * Convenience method for mapping individual addresses (EVM, BTC, SOL)
   */
  async mapWalletAddress(
    fioHandle: string,
    chainCode: string,
    address: string
  ): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();
    
    try {
      await this.fioService.addPublicAddress(
        fioHandle,
        chainCode,
        chainCode, // tokenCode same as chainCode
        address
      );
      console.log(`[PersonaFIO] Mapped ${chainCode} -> ${address} for ${fioHandle}`);
      return { success: true };
    } catch (error) {
      console.error(`[PersonaFIO] Failed to map ${chainCode} for ${fioHandle}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }
  
  /**
   * Resolve a FIO handle to chain addresses
   * Fetches all public addresses mapped to the FIO handle from the FIO network
   */
  async resolveHandle(fioHandle: string): Promise<Record<string, string> | null> {
    await this.ensureInitialized();
    
    try {
      const addresses = await this.fioService.getPublicAddresses(fioHandle);
      if (Object.keys(addresses).length === 0) {
        return null;
      }
      return addresses;
    } catch (error) {
      console.error('[PersonaFIO] Failed to resolve handle:', error);
      return null;
    }
  }
  
  /**
   * Get domain info for display
   */
  getDomainInfo(domain: FioDomain): { name: string; description: string; icon: string } {
    switch (domain) {
      case 'qripto':
        return {
          name: 'Qripto',
          description: 'Content & Reputation ecosystem',
          icon: '🔮',
        };
      case 'knyt':
        return {
          name: 'KNYT',
          description: 'Gaming & Rewards ecosystem',
          icon: '🗡️',
        };
      default:
        return {
          name: domain,
          description: 'Unknown domain',
          icon: '❓',
        };
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let personaFioServiceInstance: PersonaFioService | null = null;

export function getPersonaFioService(): PersonaFioService {
  if (!personaFioServiceInstance) {
    personaFioServiceInstance = new PersonaFioService();
  }
  return personaFioServiceInstance;
}

// All exports are inline with their declarations
