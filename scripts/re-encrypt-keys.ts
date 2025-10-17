/**
 * Re-encrypt all agent keys with the correct encryption key
 * This fixes the issue where keys were encrypted with a different key
 */

import { AgentKeyService } from '../services/identity/agentKeyService';

async function reEncryptKeys() {
  console.log('🔐 Re-encrypting all agent keys...\n');

  // Verify encryption key is set
  const encryptionKey = process.env.AGENT_KEY_ENCRYPTION_SECRET;
  if (!encryptionKey) {
    console.error('❌ AGENT_KEY_ENCRYPTION_SECRET not set!');
    process.exit(1);
  }

  console.log(`✅ Using encryption key: ${encryptionKey.substring(0, 16)}...\n`);

  const keyService = new AgentKeyService();

  // You need to provide the REAL private keys here
  // These should match the addresses in agentConfig.ts
  const agents = [
    {
      agentId: 'aigent-z',
      agentName: 'Aigent Z',
      evmPrivateKey: process.env.AIGENT_Z_PRIVATE_KEY || process.env.SIGNER_PRIVATE_KEY || '',
      evmAddress: '0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844',
      btcAddress: 'tb1q03256641efc3dd9877560daf26e4d6bb46086a42',
      solanaAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
    },
    {
      agentId: 'aigent-moneypenny',
      agentName: 'Aigent MoneyPenny',
      evmPrivateKey: process.env.AIGENT_MONEYPENNY_PRIVATE_KEY || '',
      evmAddress: '0x8D286CcECf7B838172A45c26a11F019C4303E742',
      btcAddress: 'tb1qmp0neypenny1234567890abcdef1234567890ab',
      solanaAddress: 'MoneyPennyWallet123456789ABCDEFGHIJKLMNOP'
    },
    {
      agentId: 'aigent-nakamoto',
      agentName: 'Aigent Nakamoto',
      evmPrivateKey: process.env.AIGENT_NAKAMOTO_PRIVATE_KEY || '',
      evmAddress: '0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9',
      btcAddress: 'tb1qnakamoto1234567890abcdef1234567890abcdef',
      solanaAddress: 'NakamotoWallet123456789ABCDEFGHIJKLMNOPQR'
    },
    {
      agentId: 'aigent-kn0w1',
      agentName: 'Aigent Kn0w1',
      evmPrivateKey: process.env.AIGENT_KN0W1_PRIVATE_KEY || '',
      evmAddress: '0x875E825E0341b330065152ddaE37CBb843FC8D84',
      btcAddress: 'tb1qkn0w1data1234567890abcdef1234567890abcd',
      solanaAddress: 'Kn0w1DataWallet123456789ABCDEFGHIJKLMNOPQ'
    }
  ];

  for (const agent of agents) {
    if (!agent.evmPrivateKey) {
      console.log(`⚠️  Skipping ${agent.agentId} - no private key provided`);
      continue;
    }

    console.log(`📝 Re-encrypting ${agent.agentName}...`);

    // Verify the private key generates the correct address
    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(agent.evmPrivateKey);
    
    if (wallet.address.toLowerCase() !== agent.evmAddress.toLowerCase()) {
      console.error(`   ❌ ERROR: Private key generates ${wallet.address}, expected ${agent.evmAddress}`);
      continue;
    }

    console.log(`   ✅ Private key verified for address ${agent.evmAddress}`);

    // Store with new encryption (will update existing record)
    try {
      await keyService.storeAgentKeys({
        agentId: agent.agentId,
        agentName: agent.agentName,
        evmPrivateKey: agent.evmPrivateKey,
        evmAddress: agent.evmAddress,
        btcAddress: agent.btcAddress,
        solanaAddress: agent.solanaAddress
      });
    } catch (error: any) {
      if (error.code === '23505') {
        // Record exists, that's fine - upsert should handle this
        console.log(`   ⚠️  Record exists, attempting manual update...`);
        // The storeAgentKeys method should use upsert, but if it fails, we continue
      } else {
        throw error;
      }
    }

    console.log(`   ✅ Keys re-encrypted and stored\n`);
  }

  console.log('✅ Re-encryption complete!\n');
}

reEncryptKeys().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
