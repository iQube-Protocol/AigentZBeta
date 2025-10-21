/**
 * Migrate Agent Keys to Supabase
 * 
 * This script:
 * 1. Reads current agent keys from agentConfig.ts
 * 2. Encrypts them using AgentKeyService
 * 3. Stores them in Supabase agent_keys table
 * 4. Verifies storage
 * 
 * Run with: npx tsx scripts/migrate-agent-keys.ts
 */

import { AgentKeyService } from '../services/identity/agentKeyService';

// Current agent keys matching agentConfig.ts
const agentKeys = [
  {
    agentId: 'aigent-z',
    agentName: 'Aigent Z',
    evmPrivateKey: process.env.SIGNER_PRIVATE_KEY || '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    evmAddress: '0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844',
    btcPrivateKey: 'cVN4VvHzRK31VOEMS6BwlWVNMuBDMq8SDWG5B3YyvMacLyK8dJw8',
    btcAddress: 'tb1q03256641efc3dd9877560daf26e4d6bb46086a42',
    solanaPrivateKey: '5J8QhkrwTZHCQYjLKV2T3JNJKqNxvQfgKjSHJHJHJHJHJHJHJHJHJHJHJHJHJHJH',
    solanaAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
  },
  {
    agentId: 'aigent-moneypenny',
    agentName: 'Aigent MoneyPenny',
    evmPrivateKey: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    evmAddress: '0x8D286CcECf7B838172A45c26a11F019C4303E742',
    btcPrivateKey: 'cT1vNvQzJsZZhVQqZvXzYvXzYvXzYvXzYvXzYvXzYvXz',
    btcAddress: 'tb1qmp0neypenny1234567890abcdef1234567890ab',
    solanaPrivateKey: '5K8QhkrwTZHCQYjLKV2T3JNJKqNxvQfgKjSHJHJHJHJHJHJHJHJHJHJHJHJHJHJH',
    solanaAddress: 'MoneyPennyWallet123456789ABCDEFGHIJKLMNOP'
  },
  {
    agentId: 'aigent-nakamoto',
    agentName: 'Aigent Nakamoto',
    evmPrivateKey: '0x2222222222222222222222222222222222222222222222222222222222222222',
    evmAddress: '0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9',
    btcPrivateKey: 'cU1vNvQzJsZZhVQqZvXzYvXzYvXzYvXzYvXzYvXzYvXz',
    btcAddress: 'tb1qnakamoto1234567890abcdef1234567890abcdef',
    solanaPrivateKey: '5L8QhkrwTZHCQYjLKV2T3JNJKqNxvQfgKjSHJHJHJHJHJHJHJHJHJHJHJHJHJHJH',
    solanaAddress: 'NakamotoWallet123456789ABCDEFGHIJKLMNOPQR'
  },
  {
    agentId: 'aigent-kn0w1',
    agentName: 'Aigent Kn0w1',
    evmPrivateKey: '0x3333333333333333333333333333333333333333333333333333333333333333',
    evmAddress: '0x875E825E0341b330065152ddaE37CBb843FC8D84',
    btcPrivateKey: 'cV1vNvQzJsZZhVQqZvXzYvXzYvXzYvXzYvXzYvXzYvXz',
    btcAddress: 'tb1qkn0w1data1234567890abcdef1234567890abcd',
    solanaPrivateKey: '5M8QhkrwTZHCQYjLKV2T3JNJKqNxvQfgKjSHJHJHJHJHJHJHJHJHJHJHJHJHJHJH',
    solanaAddress: 'Kn0w1DataWallet123456789ABCDEFGHIJKLMNOPQ'
  }
];

async function migrateKeys() {
  console.log('🔐 Starting agent keys migration...\n');

  // Check environment variable
  if (!process.env.AGENT_KEY_ENCRYPTION_SECRET) {
    console.error('❌ ERROR: AGENT_KEY_ENCRYPTION_SECRET not set in environment');
    console.error('   Add to .env.local: AGENT_KEY_ENCRYPTION_SECRET=e35c7d79651daadd8723ff952c90fe55c567143065e1159d5e683ff3c9703fda');
    process.exit(1);
  }

  const keyService = new AgentKeyService();
  
  for (const agent of agentKeys) {
    try {
      console.log(`📝 Migrating keys for ${agent.agentName} (${agent.agentId})...`);
      
      // Store encrypted keys in Supabase
      await keyService.storeAgentKeys({
        agentId: agent.agentId,
        agentName: agent.agentName,
        evmPrivateKey: agent.evmPrivateKey,
        btcPrivateKey: agent.btcPrivateKey,
        solanaPrivateKey: agent.solanaPrivateKey,
        evmAddress: agent.evmAddress,
        btcAddress: agent.btcAddress,
        solanaAddress: agent.solanaAddress
      });
      
      console.log(`   ✅ Keys encrypted and stored`);
      
      // Verify by retrieving (will decrypt)
      const retrieved = await keyService.getAgentKeys(agent.agentId);
      if (retrieved && retrieved.evmPrivateKey === agent.evmPrivateKey) {
        console.log(`   ✅ Verification successful - keys can be decrypted`);
      } else {
        console.log(`   ⚠️  Warning: Verification failed for ${agent.agentId}`);
      }
      
      // Get public addresses (safe to expose)
      const addresses = await keyService.getAgentAddresses(agent.agentId);
      console.log(`   📍 Public addresses stored:`);
      console.log(`      EVM: ${addresses?.evmAddress}`);
      console.log(`      BTC: ${addresses?.btcAddress}`);
      console.log(`      SOL: ${addresses?.solanaAddress}`);
      
      console.log('');
      
    } catch (error) {
      console.error(`   ❌ Error migrating ${agent.agentId}:`, error);
    }
  }
  
  console.log('✅ Migration complete!\n');
  console.log('Next steps:');
  console.log('1. Verify keys in Supabase dashboard');
  console.log('2. Test key retrieval in application');
  console.log('3. Remove hardcoded keys from agentConfig.ts');
  console.log('4. Remove Supabase fallback credentials from code');
}

// Run migration
migrateKeys().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
