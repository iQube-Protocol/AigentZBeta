/**
 * Verify ALL actual agents from agentConfig.ts
 */

import { AgentKeyService } from '../services/identity/agentKeyService';

const ACTUAL_AGENTS = ['aigent-z', 'aigent-moneypenny', 'aigent-nakamoto', 'aigent-kn0w1'];

async function verifyAll() {
  console.log('🔍 Verifying all actual agents...\n');

  const keyService = new AgentKeyService();
  
  for (const agentId of ACTUAL_AGENTS) {
    try {
      const keys = await keyService.getAgentKeys(agentId);
      
      if (keys) {
        console.log(`✅ ${agentId}`);
        console.log(`   EVM Address: ${keys.evmAddress}`);
        console.log(`   Private Key: ${keys.evmPrivateKey ? '✅ Present' : '❌ Missing'}`);
      } else {
        console.log(`❌ ${agentId} - NO KEYS FOUND`);
      }
      console.log('');
    } catch (error) {
      console.error(`❌ ${agentId} - Error:`, error instanceof Error ? error.message : error);
      console.log('');
    }
  }
  
  console.log('✅ Verification complete!\n');
}

verifyAll().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
