/**
 * Direct update of aigent-z private key in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { createCipheriv, randomBytes } from 'crypto';

async function directUpdateAigentZ() {
  console.log('🔐 Direct update of aigent-z private key...\n');

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const encryptionKey = process.env.AGENT_KEY_ENCRYPTION_SECRET!;
  const correctPrivateKey = process.env.SIGNER_PRIVATE_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Verify the key generates the correct address
  const { ethers } = await import('ethers');
  const wallet = new ethers.Wallet(correctPrivateKey);
  const expectedAddress = '0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844';
  
  console.log(`Expected address: ${expectedAddress}`);
  console.log(`Generated address: ${wallet.address}`);
  
  if (wallet.address.toLowerCase() !== expectedAddress.toLowerCase()) {
    console.error('❌ SIGNER_PRIVATE_KEY does not generate the expected address!');
    process.exit(1);
  }
  
  console.log('✅ Private key verified!\n');

  // Encrypt the private key
  function encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', Buffer.from(encryptionKey.slice(0, 32)), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  const encryptedKey = encrypt(correctPrivateKey);
  console.log('🔒 Private key encrypted');

  // Direct update using SQL
  console.log('📝 Updating aigent-z record...');
  
  const { data, error } = await supabase
    .from('agent_keys')
    .update({
      evm_private_key_encrypted: encryptedKey,
      evm_address: expectedAddress,
      updated_at: new Date().toISOString()
    })
    .eq('agent_id', 'aigent-z');

  if (error) {
    console.error('❌ Update failed:', error);
    process.exit(1);
  }

  console.log('✅ aigent-z key updated successfully!\n');

  // Verify by retrieving
  console.log('🔍 Verifying the fix...');
  const { data: retrievedData, error: retrieveError } = await supabase
    .from('agent_keys')
    .select('*')
    .eq('agent_id', 'aigent-z')
    .single();

  if (retrieveError || !retrievedData) {
    console.error('❌ Failed to retrieve updated record');
    process.exit(1);
  }

  console.log('✅ Record retrieved successfully');
  console.log(`EVM Address: ${retrievedData.evm_address}`);
  console.log(`Encrypted key length: ${retrievedData.evm_private_key_encrypted?.length}`);

  console.log('\n🎉 Fix complete! Try the transfer again.');
}

directUpdateAigentZ().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
