/**
 * Register Agent Keys Script
 * 
 * This script generates and registers EVM keys for the core agents:
 * - Aigent Z (System Agent) - already exists, will update with FIO handle
 * - MoneyPenny (Financial Agent)
 * - Kn0w1 (Knowledge Agent)
 * - Nakamoto (Crypto/Trading Agent)
 * 
 * Run with: npx ts-node scripts/register-agent-keys.ts
 * Or via API: POST /api/admin/register-agent-keys
 */

import { createClient } from '@supabase/supabase-js';
import { createCipheriv, randomBytes } from 'crypto';
import { ethers } from 'ethers';

// Agent definitions - matching existing database records
const AGENTS = [
  {
    agentId: 'aigent-z',
    agentName: 'Aigent Z',
    fioHandle: 'aigentz@aigent',
    entityType: 'agent',
    role: 'System Agent - Primary orchestrator and system operations',
  },
  {
    agentId: 'aigent-moneypenny',
    agentName: 'Aigent MoneyPenny',
    fioHandle: 'moneypenny@aigent',
    entityType: 'agent',
    role: 'Financial Agent - Payments, transfers, treasury operations',
  },
  {
    agentId: 'aigent-kn0w1',
    agentName: 'Aigent Kn0w1',
    fioHandle: 'kn0w1@aigent',
    entityType: 'agent',
    role: 'Knowledge Agent - Content, learning, information services',
  },
  {
    agentId: 'aigent-nakamoto',
    agentName: 'Aigent Nakamoto',
    fioHandle: 'nakamoto@aigent',
    entityType: 'agent',
    role: 'Crypto Agent - Trading, DeFi, blockchain operations',
  },
];

// Encrypt function matching AgentKeyService
function encrypt(text: string, encryptionKey: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(encryptionKey.slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Generate EVM wallet
function generateEvmWallet(): { privateKey: string; address: string } {
  const wallet = ethers.Wallet.createRandom();
  return {
    privateKey: wallet.privateKey,
    address: wallet.address,
  };
}

// Main registration function
async function registerAgentKeys() {
  // Get environment variables
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encryptionKey = process.env.AGENT_KEY_ENCRYPTION_SECRET;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  if (!encryptionKey) {
    throw new Error('Missing AGENT_KEY_ENCRYPTION_SECRET');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  console.log('🔐 Registering agent keys...\n');

  const results: any[] = [];

  for (const agent of AGENTS) {
    console.log(`Processing ${agent.agentName} (${agent.agentId})...`);

    // Check if agent already has keys
    const { data: existing } = await supabase
      .from('agent_keys')
      .select('agent_id, evm_address, fio_handle')
      .eq('agent_id', agent.agentId)
      .maybeSingle();

    if (existing?.evm_address) {
      // Agent exists - just update FIO handle and entity type
      console.log(`  ✓ ${agent.agentId} already has keys at ${existing.evm_address}`);
      
      const { error: updateError } = await supabase
        .from('agent_keys')
        .update({
          fio_handle: agent.fioHandle,
          entity_type: agent.entityType,
          agent_name: agent.agentName,
          updated_at: new Date().toISOString(),
        })
        .eq('agent_id', agent.agentId);

      if (updateError) {
        console.log(`  ⚠ Failed to update: ${updateError.message}`);
      } else {
        console.log(`  ✓ Updated FIO handle to ${agent.fioHandle}`);
      }

      results.push({
        agentId: agent.agentId,
        agentName: agent.agentName,
        fioHandle: agent.fioHandle,
        evmAddress: existing.evm_address,
        status: 'updated',
      });
    } else {
      // Generate new keys
      const evmWallet = generateEvmWallet();
      console.log(`  🔑 Generated new EVM wallet: ${evmWallet.address}`);

      // Encrypt the private key
      const encryptedPrivateKey = encrypt(evmWallet.privateKey, encryptionKey);

      // Insert new record
      const { error: insertError } = await supabase
        .from('agent_keys')
        .insert({
          agent_id: agent.agentId,
          agent_name: agent.agentName,
          fio_handle: agent.fioHandle,
          entity_type: agent.entityType,
          evm_address: evmWallet.address,
          evm_private_key_encrypted: encryptedPrivateKey,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.log(`  ❌ Failed to insert: ${insertError.message}`);
        results.push({
          agentId: agent.agentId,
          agentName: agent.agentName,
          status: 'error',
          error: insertError.message,
        });
      } else {
        console.log(`  ✓ Registered ${agent.agentId} with address ${evmWallet.address}`);
        results.push({
          agentId: agent.agentId,
          agentName: agent.agentName,
          fioHandle: agent.fioHandle,
          evmAddress: evmWallet.address,
          status: 'created',
        });
      }
    }

    console.log('');
  }

  console.log('\n📋 Summary:');
  console.log('─'.repeat(60));
  for (const r of results) {
    console.log(`${r.status === 'error' ? '❌' : '✓'} ${r.agentName} (${r.agentId})`);
    if (r.evmAddress) console.log(`  EVM: ${r.evmAddress}`);
    if (r.fioHandle) console.log(`  FIO: ${r.fioHandle}`);
    if (r.error) console.log(`  Error: ${r.error}`);
  }

  return results;
}

// Export for API use
export { registerAgentKeys, AGENTS };

// Run if called directly
if (require.main === module) {
  registerAgentKeys()
    .then((results) => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Error:', err);
      process.exit(1);
    });
}
