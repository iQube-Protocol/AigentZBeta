import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
  private supabase: SupabaseClient;
  private encryptionKey: string;

  constructor() {
    // Support both NEXT_PUBLIC_ and regular env vars for flexibility
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
                        process.env.SUPABASE_ANON_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('[AgentKeyService] Initializing with env vars:', {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      AGENT_KEY_ENCRYPTION_SECRET: !!process.env.AGENT_KEY_ENCRYPTION_SECRET,
      NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET: !!process.env.NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET,
      supabaseUrlResolved: !!supabaseUrl,
      supabaseKeyResolved: !!supabaseKey,
      usingServiceRoleKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)
    });
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[AgentKeyService] Missing Supabase credentials');
      throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }
    
    // Use Supabase client directly to avoid SDK env var issues
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    
    // Encryption key from environment (32 bytes for AES-256)
    // Support both regular and NEXT_PUBLIC_ prefixed versions
    this.encryptionKey = process.env.AGENT_KEY_ENCRYPTION_SECRET || 
                         process.env.NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET || 
                         'default-insecure-key-change-in-production-32bytes';
    
    if (!process.env.AGENT_KEY_ENCRYPTION_SECRET && !process.env.NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET) {
      console.warn('[AgentKeyService] WARNING: Using default encryption key. Set AGENT_KEY_ENCRYPTION_SECRET in production!');
    }
    
    console.log('[AgentKeyService] Initialized successfully with encryption key:', {
      hasEncryptionKey: this.encryptionKey !== 'default-insecure-key-change-in-production-32bytes',
      keyLength: this.encryptionKey.length,
      keyPrefix: this.encryptionKey.substring(0, 16)
    });
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
   * Get agent keys from Supabase
   */
  async getAgentKeys(agentId: string): Promise<AgentKeys | null> {
    try {
      console.log(`[AgentKeyService] Querying Supabase for agent: ${agentId}`);
      
      const { data, error } = await this.supabase
        .from('agent_keys')
        .select('*')
        .eq('agent_id', agentId)
        .single();

      if (error) {
        console.error(`[AgentKeyService] Supabase error for ${agentId}:`, error);
        return null;
      }

      if (!data) {
        console.error(`[AgentKeyService] No data returned for ${agentId}`);
        return null;
      }

      console.log(`[AgentKeyService] Data found for ${agentId}:`, {
        hasEvmEncrypted: !!data.evm_private_key_encrypted,
        evmEncryptedLength: data.evm_private_key_encrypted?.length,
        evmAddress: data.evm_address
      });

      // Decrypt the private keys
      try {
        const decryptedEvmKey = this.decrypt(data.evm_private_key_encrypted);
        console.log(`[AgentKeyService] Decryption successful for ${agentId}`, {
          decryptedKeyLength: decryptedEvmKey?.length,
          startsWithOx: decryptedEvmKey?.startsWith('0x')
        });
        
        return {
          agentId: data.agent_id,
          agentName: data.agent_name,
          evmPrivateKey: decryptedEvmKey,
          btcPrivateKey: data.btc_private_key_encrypted ? this.decrypt(data.btc_private_key_encrypted) : undefined,
          solanaPrivateKey: data.solana_private_key_encrypted ? this.decrypt(data.solana_private_key_encrypted) : undefined,
          evmAddress: data.evm_address,
          btcAddress: data.btc_address,
          solanaAddress: data.solana_address
        };
      } catch (decryptError) {
        console.error(`[AgentKeyService] Decryption failed for ${agentId}:`, decryptError);
        return null;
      }
    } catch (error) {
      console.error(`[AgentKeyService] Exception getting keys for ${agentId}:`, error);
      return null;
    }
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
