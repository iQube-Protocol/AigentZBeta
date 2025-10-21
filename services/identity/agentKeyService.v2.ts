/**
 * AgentKeyService v2 - Migrated to Universal iQube Service
 * 
 * This is the updated version of AgentKeyService that uses the UniversalQubeService
 * for robust, conflict-free Supabase access within the iQube ecosystem.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { UniversalQubeService, createPaymentService } from '../core/UniversalQubeService';

export interface AgentKeys {
  agentId: string;
  agentName: string;
  evmPrivateKey: string;
  btcPrivateKey?: string;
  solanaPrivateKey?: string;
  evmAddress: string;
  btcAddress?: string;
  solanaAddress?: string;
}

export class AgentKeyServiceV2 {
  private universalService: UniversalQubeService;
  private encryptionKey: string;

  constructor() {
    // Initialize Universal Service for Payment Operations
    this.universalService = createPaymentService();
    
    // Get encryption key from environment
    this.encryptionKey = process.env.AGENT_KEY_ENCRYPTION_SECRET || process.env.NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET || '';
    
    if (!this.encryptionKey) {
      throw new Error('AGENT_KEY_ENCRYPTION_SECRET environment variable is required');
    }
  }

  /**
   * Retrieve and decrypt agent keys using Universal Service
   */
  async getAgentKeys(agentId: string): Promise<AgentKeys | null> {
    try {
      console.log(`[AgentKeyServiceV2] Retrieving keys for agent: ${agentId}`);

      // Use Universal Service with automatic service role client selection
      const result = await this.universalService.executeQuery(
        async (client) => {
          const { data, error } = await client
            .from('agent_keys')
            .select('*')
            .eq('agent_id', agentId)
            .single();

          if (error) {
            console.error(`[AgentKeyServiceV2] Database query failed:`, error);
            return null;
          }

          return data;
        },
        { serviceType: 'payment' } // Ensures service role client is used
      );

      if (!result) {
        console.error(`[AgentKeyServiceV2] No agent keys found for ${agentId}`);
        return null;
      }

      // Decrypt the private keys
      const decryptedEvmKey = this.decrypt(result.evm_private_key_encrypted);
      
      if (!decryptedEvmKey) {
        console.error(`[AgentKeyServiceV2] No EVM private key found or decryption failed for ${agentId}`);
        return null;
      }

      console.log(`[AgentKeyServiceV2] Successfully retrieved and decrypted keys for ${agentId}`, {
        hasEvmKey: !!decryptedEvmKey,
        evmAddress: result.evm_address,
        hasBtcKey: !!result.btc_private_key_encrypted,
        hasSolanaKey: !!result.solana_private_key_encrypted
      });

      return {
        agentId: result.agent_id,
        agentName: result.agent_name,
        evmPrivateKey: decryptedEvmKey,
        btcPrivateKey: this.decrypt(result.btc_private_key_encrypted) || undefined,
        solanaPrivateKey: this.decrypt(result.solana_private_key_encrypted) || undefined,
        evmAddress: result.evm_address,
        btcAddress: result.btc_address,
        solanaAddress: result.solana_address
      };

    } catch (error) {
      console.error(`[AgentKeyServiceV2] Error retrieving agent keys:`, error);
      return null;
    }
  }

  /**
   * Store encrypted agent keys using Universal Service
   */
  async storeAgentKeys(keys: AgentKeys): Promise<boolean> {
    try {
      console.log(`[AgentKeyServiceV2] Storing keys for agent: ${keys.agentId}`);

      const encryptedData = {
        agent_id: keys.agentId,
        agent_name: keys.agentName,
        evm_private_key_encrypted: this.encrypt(keys.evmPrivateKey),
        btc_private_key_encrypted: keys.btcPrivateKey ? this.encrypt(keys.btcPrivateKey) : null,
        solana_private_key_encrypted: keys.solanaPrivateKey ? this.encrypt(keys.solanaPrivateKey) : null,
        evm_address: keys.evmAddress,
        btc_address: keys.btcAddress || null,
        solana_address: keys.solanaAddress || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Use Universal Service with automatic service role client selection
      const success = await this.universalService.executeQuery(
        async (client) => {
          const { error } = await client
            .from('agent_keys')
            .upsert(encryptedData, { onConflict: 'agent_id' });

          if (error) {
            console.error(`[AgentKeyServiceV2] Failed to store agent keys:`, error);
            return false;
          }

          return true;
        },
        { serviceType: 'payment' }
      );

      console.log(`[AgentKeyServiceV2] Keys storage ${success ? 'successful' : 'failed'} for ${keys.agentId}`);
      return success;

    } catch (error) {
      console.error(`[AgentKeyServiceV2] Error storing agent keys:`, error);
      return false;
    }
  }

  /**
   * List all agents with keys using Universal Service
   */
  async listAgents(): Promise<Array<{ agentId: string; agentName: string; evmAddress: string }>> {
    try {
      console.log(`[AgentKeyServiceV2] Listing all agents with keys`);

      const agents = await this.universalService.executeQuery(
        async (client) => {
          const { data, error } = await client
            .from('agent_keys')
            .select('agent_id, agent_name, evm_address')
            .order('agent_name');

          if (error) {
            console.error(`[AgentKeyServiceV2] Failed to list agents:`, error);
            return [];
          }

          return data || [];
        },
        { serviceType: 'payment' }
      );

      return agents.map(agent => ({
        agentId: agent.agent_id,
        agentName: agent.agent_name,
        evmAddress: agent.evm_address
      }));

    } catch (error) {
      console.error(`[AgentKeyServiceV2] Error listing agents:`, error);
      return [];
    }
  }

  /**
   * Health check using Universal Service
   */
  async healthCheck(): Promise<{
    serviceAvailable: boolean;
    encryptionWorking: boolean;
    databaseConnected: boolean;
  }> {
    const health = {
      serviceAvailable: false,
      encryptionWorking: false,
      databaseConnected: false
    };

    try {
      // Check Universal Service health
      const serviceHealth = await this.universalService.healthCheck();
      health.serviceAvailable = serviceHealth.serviceRole;
      health.databaseConnected = serviceHealth.serviceRole;

      // Test encryption/decryption
      const testData = 'test-encryption-key';
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);
      health.encryptionWorking = decrypted === testData;

    } catch (error) {
      console.error(`[AgentKeyServiceV2] Health check failed:`, error);
    }

    return health;
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(text: string): string {
    try {
      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.slice(0, 32)), iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('[AgentKeyServiceV2] Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data with improved error handling
   */
  private decrypt(encrypted: string | null | undefined): string | null {
    if (!encrypted) {
      return null;
    }
    
    try {
      const parts = encrypted.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const decipher = createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.slice(0, 32)), iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('[AgentKeyServiceV2] Decryption error:', error);
      return null;
    }
  }
}
