/**
 * Add Aigent MoneyPenny to Supabase
 */

import { AgentKeyService } from '../services/identity/agentKeyService';

async function addMoneyPenny() {
  console.log('🔐 Adding Aigent MoneyPenny...\n');

  const keyService = new AgentKeyService();

  await keyService.storeAgentKeys({
    agentId: 'aigent-moneypenny',
    agentName: 'Aigent MoneyPenny',
    evmPrivateKey: '0xa7e4c2d8f9b3e6a1c5d8f2b9e6a3c7d0f4b8e1a5c9d2f6b0e3a7c4d8f1b5e9a2',
    evmAddress: '0x8D286CcECf7B838172A45c26a11F019C4303E742',
    btcAddress: 'tb1qmp0neypenny1234567890abcdef1234567890ab',
    solanaAddress: 'MoneyPennyWallet123456789ABCDEFGHIJKLMNOP'
  });

  console.log('✅ Keys encrypted and stored\n');

  const verify = await keyService.getAgentKeys('aigent-moneypenny');
  console.log('✅ Verification:', verify ? 'Keys found and decrypted successfully' : 'Failed');
  console.log('   EVM Address:', verify?.evmAddress);
}

addMoneyPenny().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
