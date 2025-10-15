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

// Current agent keys from agentConfig.ts
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
    agentId: 'aigent-x',
    agentName: 'Aigent X',
    evmPrivateKey: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    evmAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
    btcPrivateKey: 'cT1vNvQzJsZZhVQqZvXzYvXzYvXzYvXzYvXzYvXzYvXz',
    btcAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
    solanaPrivateKey: '5K8QhkrwTZHCQYjLKV2T3JNJKqNxvQfgKjSHJHJHJHJHJHJHJHJHJHJHJHJHJHJH',
    solanaAddress: '8WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
  },
  {
    agentId: 'aigent-y',
    agentName: 'Aigent Y',
    evmPrivateKey: '0x1111111111111111111111111111111111111111111111111111111111111111',
    evmAddress: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
    btcPrivateKey: 'cU1vNvQzJsZZhVQqZvXzYvXzYvXzYvXzYvXzYvXzYvXz',
    btcAddress: 'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7',
    solanaPrivateKey: '5L8QhkrwTZHCQYjLKV2T3JNJKqNxvQfgKjSHJHJHJHJHJHJHJHJHJHJHJHJHJHJH',
    solanaAddress: '7WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
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
