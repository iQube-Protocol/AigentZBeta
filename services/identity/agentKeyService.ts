import { initAgentiqClient } from '@qriptoagentiq/core-client';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * AgentKeyService - Secure management of agent private keys
 * 
 * Keys are stored encrypted in Supabase and only decrypted server-side when needed.
 * NEVER expose private keys to client-side code.
 */

export interface AgentKeys {
  agentId: string;
  agentName: string;
  evmPrivateKey?: string;
  btcPrivateKey?: string;
  solanaPrivateKey?: string;
  evmAddress?: string;
  btcAddress?: string;
  solanaAddress?: string;
}

export interface AgentAddresses {
  agentId: string;
  evmAddress?: string;
  btcAddress?: string;
  solanaAddress?: string;
}

export class AgentKeyService {
  private supabase;
  private encryptionKey: string;

  constructor() {
    const client = initAgentiqClient({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    });
    
    this.supabase = client.supabase;
    
    // Encryption key from environment (32 bytes for AES-256)
    this.encryptionKey = process.env.AGENT_KEY_ENCRYPTION_SECRET || 'default-insecure-key-change-in-production-32bytes';
  }

  /**
   * Encrypt a private key using AES-256-CBC
   */
  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.slice(0, 32)), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt a private key
   */
  private decrypt(encrypted: string): string {
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Store agent keys securely (encrypted)
   * SERVER-SIDE ONLY
   */
  async storeAgentKeys(keys: AgentKeys): Promise<void> {
    const { data, error } = await this.supabase
      .from('agent_keys')
      .upsert({
        agent_id: keys.agentId,
        agent_name: keys.agentName,
        evm_private_key_encrypted: keys.evmPrivateKey ? this.encrypt(keys.evmPrivateKey) : null,
        btc_private_key_encrypted: keys.btcPrivateKey ? this.encrypt(keys.btcPrivateKey) : null,
        solana_private_key_encrypted: keys.solanaPrivateKey ? this.encrypt(keys.solanaPrivateKey) : null,
        evm_address: keys.evmAddress,
        btc_address: keys.btcAddress,
        solana_address: keys.solanaAddress,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  /**
   * Get agent private keys (decrypted)
   * SERVER-SIDE ONLY - NEVER expose to client
   */
  async getAgentKeys(agentId: string): Promise<AgentKeys | null> {
    const { data, error } = await this.supabase
      .from('agent_keys')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (error || !data) return null;

    return {
      agentId: data.agent_id,
      agentName: data.agent_name,
      evmPrivateKey: data.evm_private_key_encrypted ? this.decrypt(data.evm_private_key_encrypted) : undefined,
      btcPrivateKey: data.btc_private_key_encrypted ? this.decrypt(data.btc_private_key_encrypted) : undefined,
      solanaPrivateKey: data.solana_private_key_encrypted ? this.decrypt(data.solana_private_key_encrypted) : undefined,
      evmAddress: data.evm_address,
      btcAddress: data.btc_address,
      solanaAddress: data.solana_address
    };
  }

  /**
   * Get agent public addresses only (safe to expose)
   * Can be called from client-side
   */
  async getAgentAddresses(agentId: string): Promise<AgentAddresses | null> {
    const { data, error } = await this.supabase
      .rpc('get_agent_addresses', { p_agent_id: agentId })
      .single();

    if (error || !data) return null;

    // Type assertion for RPC result
    const result = data as any;
    
    return {
      agentId: result.agent_id,
      evmAddress: result.evm_address,
      btcAddress: result.btc_address,
      solanaAddress: result.solana_address
    };
  }

  /**
   * Update last used timestamp
   */
  async markKeyUsed(agentId: string): Promise<void> {
    await this.supabase
      .from('agent_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('agent_id', agentId);
  }

  /**
   * Rotate agent keys (generate new keys and update)
   */
  async rotateKeys(agentId: string, newKeys: Partial<AgentKeys>): Promise<void> {
    const currentKeys = await this.getAgentKeys(agentId);
    if (!currentKeys) throw new Error('Agent not found');

    await this.storeAgentKeys({
      ...currentKeys,
      ...newKeys,
      agentId
    });
  }
}
