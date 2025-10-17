/**
 * Fix aigent-z private key in Supabase
 */

import { AgentKeyService } from '../services/identity/agentKeyService';

async function fixAigentZKey() {
  console.log('🔐 Fixing aigent-z private key...\n');

  const keyService = new AgentKeyService();
  
  // Use SIGNER_PRIVATE_KEY as the correct key for aigent-z
  const correctPrivateKey = process.env.SIGNER_PRIVATE_KEY;
  const expectedAddress = '0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844';
  
  if (!correctPrivateKey) {
    console.error('❌ SIGNER_PRIVATE_KEY not found in environment');
    process.exit(1);
  }

  // Verify the key generates the correct address
  const { ethers } = await import('ethers');
  const wallet = new ethers.Wallet(correctPrivateKey);
  
  console.log(`Expected address: ${expectedAddress}`);
  console.log(`Generated address: ${wallet.address}`);
  
  if (wallet.address.toLowerCase() !== expectedAddress.toLowerCase()) {
    console.error('❌ SIGNER_PRIVATE_KEY does not generate the expected address!');
    process.exit(1);
  }
  
  console.log('✅ Private key verified!\n');

  // Update the record in Supabase
  console.log('📝 Updating aigent-z in Supabase...');
  
  await keyService.storeAgentKeys({
    agentId: 'aigent-z',
    agentName: 'Aigent Z',
    evmPrivateKey: correctPrivateKey,
    evmAddress: expectedAddress,
    btcAddress: 'tb1q03256641efc3dd9877560daf26e4d6bb46086a42',
    solanaAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
  });

  console.log('✅ aigent-z key updated successfully!\n');

  // Verify by retrieving and testing
  console.log('🔍 Verifying the fix...');
  const retrievedKeys = await keyService.getAgentKeys('aigent-z');
  
  if (retrievedKeys?.evmPrivateKey) {
    const testWallet = new ethers.Wallet(retrievedKeys.evmPrivateKey);
    console.log(`Retrieved key generates: ${testWallet.address}`);
    console.log(`Matches expected: ${testWallet.address.toLowerCase() === expectedAddress.toLowerCase() ? '✅ YES' : '❌ NO'}`);
  }

  console.log('\n🎉 Fix complete! Try the transfer again.');
}

fixAigentZKey().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
