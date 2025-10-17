/**
 * Verify Agent Keys in Supabase
 * 
 * This script checks if agent keys exist in the database
 * Run with: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... AGENT_KEY_ENCRYPTION_SECRET=... npx tsx scripts/verify-agent-keys.ts
 */

import { AgentKeyService } from '../services/identity/agentKeyService';

const AGENT_IDS = ['aigent-z', 'aigent-x', 'aigent-y', 'aigent-nakamoto', 'aigent-kn0w1'];

async function verifyKeys() {
  console.log('🔍 Verifying agent keys in Supabase...\n');
  
  console.log('Environment check:');
  console.log(`  SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`  AGENT_KEY_ENCRYPTION_SECRET: ${process.env.AGENT_KEY_ENCRYPTION_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log('');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.AGENT_KEY_ENCRYPTION_SECRET) {
    console.error('❌ Missing required environment variables');
    console.error('Run with: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... AGENT_KEY_ENCRYPTION_SECRET=... npx tsx scripts/verify-agent-keys.ts');
    process.exit(1);
  }

  const keyService = new AgentKeyService();
  
  for (const agentId of AGENT_IDS) {
    try {
      console.log(`Checking ${agentId}...`);
      
      // Try to get keys
      const keys = await keyService.getAgentKeys(agentId);
      
      if (keys) {
        console.log(`  ✅ Keys found`);
        console.log(`     EVM Address: ${keys.evmAddress}`);
        console.log(`     EVM Private Key: ${keys.evmPrivateKey ? '✅ Present' : '❌ Missing'}`);
        console.log(`     BTC Address: ${keys.btcAddress || 'N/A'}`);
        console.log(`     SOL Address: ${keys.solanaAddress || 'N/A'}`);
      } else {
        console.log(`  ❌ No keys found in database`);
      }
      
      console.log('');
    } catch (error) {
      console.error(`  ❌ Error checking ${agentId}:`, error instanceof Error ? error.message : error);
      console.log('');
    }
  }
  
  console.log('✅ Verification complete!\n');
}

verifyKeys().catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
