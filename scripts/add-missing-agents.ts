/**
 * Add Missing Agent Keys to Supabase
 * 
 * This script adds aigent-nakamoto and aigent-kn0w1 to the database
 * You need to provide their private keys
 * 
 * Run with: 
 * SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... AGENT_KEY_ENCRYPTION_SECRET=... \
 * NAKAMOTO_PRIVATE_KEY=0x... KN0W1_PRIVATE_KEY=0x... \
 * npx tsx scripts/add-missing-agents.ts
 */

import { AgentKeyService } from '../services/identity/agentKeyService';

const missingAgents = [
  {
    agentId: 'aigent-nakamoto',
    agentName: 'Aigent Nakamoto',
    evmPrivateKey: process.env.NAKAMOTO_PRIVATE_KEY || process.env.AIGENT_NAKAMOTO_PRIVATE_KEY,
    evmAddress: '0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9',
    btcPrivateKey: process.env.NAKAMOTO_BTC_KEY,
    btcAddress: 'tb1qnakamoto1234567890abcdef1234567890abcdef',
    solanaPrivateKey: process.env.NAKAMOTO_SOL_KEY,
    solanaAddress: 'NakamotoWallet123456789ABCDEFGHIJKLMNOPQR'
  },
  {
    agentId: 'aigent-kn0w1',
    agentName: 'Aigent Kn0w1',
    evmPrivateKey: process.env.KN0W1_PRIVATE_KEY || process.env.AIGENT_KN0W1_PRIVATE_KEY,
    evmAddress: '0x875E825E0341b330065152ddaE37CBb843FC8D84',
    btcPrivateKey: process.env.KN0W1_BTC_KEY,
    btcAddress: 'tb1qkn0w1data1234567890abcdef1234567890abcd',
    solanaPrivateKey: process.env.KN0W1_SOL_KEY,
    solanaAddress: 'Kn0w1DataWallet123456789ABCDEFGHIJKLMNOPQ'
  }
];

async function addMissingAgents() {
  console.log('🔐 Adding missing agent keys to Supabase...\n');

  // Check environment
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.AGENT_KEY_ENCRYPTION_SECRET) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const keyService = new AgentKeyService();
  
  for (const agent of missingAgents) {
    try {
      // Check if already exists
      const existing = await keyService.getAgentKeys(agent.agentId);
      if (existing) {
        console.log(`⏭️  ${agent.agentName} already exists, skipping...`);
        continue;
      }

      if (!agent.evmPrivateKey) {
        console.log(`⚠️  ${agent.agentName}: No EVM private key provided, skipping...`);
        console.log(`   Set ${agent.agentId.toUpperCase().replace(/-/g, '_')}_PRIVATE_KEY environment variable`);
        continue;
      }

      console.log(`📝 Adding ${agent.agentName} (${agent.agentId})...`);
      
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
      
      // Verify
      const retrieved = await keyService.getAgentKeys(agent.agentId);
      if (retrieved && retrieved.evmPrivateKey === agent.evmPrivateKey) {
        console.log(`   ✅ Verification successful`);
      } else {
        console.log(`   ⚠️  Warning: Verification failed`);
      }
      
      console.log('');
      
    } catch (error) {
      console.error(`   ❌ Error adding ${agent.agentId}:`, error);
    }
  }
  
  console.log('✅ Complete!\n');
}

addMissingAgents().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
