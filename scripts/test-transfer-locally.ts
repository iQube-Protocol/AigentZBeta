/**
 * Test agent key retrieval locally to simulate production
 */

import { AgentKeyService } from '../services/identity/agentKeyService';

async function testTransfer() {
  console.log('🧪 Testing agent key retrieval (simulating transfer API)...\n');

  const testAgents = ['aigent-z', 'aigent-moneypenny', 'aigent-nakamoto', 'aigent-kn0w1'];

  for (const agentId of testAgents) {
    console.log(`\n--- Testing ${agentId} ---`);
    
    try {
      console.log(`[1] Creating AgentKeyService...`);
      const keyService = new AgentKeyService();
      
      console.log(`[2] Retrieving keys for ${agentId}...`);
      const agentKeys = await keyService.getAgentKeys(agentId);
      
      console.log(`[3] Keys retrieved:`, {
        keysFound: !!agentKeys,
        hasEvmKey: !!agentKeys?.evmPrivateKey,
        evmAddress: agentKeys?.evmAddress
      });
      
      if (!agentKeys?.evmPrivateKey) {
        console.error(`❌ FAIL: No private key found for ${agentId}`);
      } else {
        console.log(`✅ SUCCESS: Private key found for ${agentId}`);
        console.log(`   Address: ${agentKeys.evmAddress}`);
        console.log(`   Key length: ${agentKeys.evmPrivateKey.length} chars`);
      }
      
    } catch (error) {
      console.error(`❌ ERROR for ${agentId}:`, error instanceof Error ? error.message : error);
    }
  }
  
  console.log('\n✅ Test complete!\n');
}

testTransfer().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
