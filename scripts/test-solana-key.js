/**
 * Test Solana Private Key Format
 * Helps debug which format your key is in
 */

const { Keypair } = require('@solana/web3.js');

const privateKeyString = process.env.SOLANA_DEPLOYER_KEY;

if (!privateKeyString) {
  console.error('❌ SOLANA_DEPLOYER_KEY not set');
  console.log('\nUsage: export SOLANA_DEPLOYER_KEY="your_key" && node scripts/test-solana-key.js');
  process.exit(1);
}

console.log('🔍 Testing private key format...\n');
console.log('Key length:', privateKeyString.length);
console.log('First 20 chars:', privateKeyString.substring(0, 20) + '...\n');

let success = false;

// Test 1: Base58
try {
  const bs58 = require('bs58');
  const decoded = bs58.decode(privateKeyString);
  console.log('✅ Base58 decode successful');
  console.log('   Decoded length:', decoded.length, 'bytes');
  
  if (decoded.length === 64) {
    const keypair = Keypair.fromSecretKey(decoded);
    console.log('✅ Valid Solana keypair!');
    console.log('   Public key:', keypair.publicKey.toBase58());
    success = true;
  } else {
    console.log('❌ Wrong length (need 64 bytes for secret key)');
  }
} catch (e) {
  console.log('❌ Base58 decode failed:', e.message);
}

// Test 2: JSON Array
if (!success) {
  console.log('\n🔍 Trying JSON array format...');
  try {
    const arr = JSON.parse(privateKeyString);
    console.log('✅ JSON parse successful');
    console.log('   Array length:', arr.length);
    
    if (arr.length === 64) {
      const keypair = Keypair.fromSecretKey(Uint8Array.from(arr));
      console.log('✅ Valid Solana keypair!');
      console.log('   Public key:', keypair.publicKey.toBase58());
      success = true;
    } else {
      console.log('❌ Wrong array length (need 64)');
    }
  } catch (e) {
    console.log('❌ JSON parse failed:', e.message);
  }
}

// Test 3: Hex
if (!success) {
  console.log('\n🔍 Trying hex format...');
  try {
    const hex = Buffer.from(privateKeyString, 'hex');
    console.log('✅ Hex decode successful');
    console.log('   Decoded length:', hex.length, 'bytes');
    
    if (hex.length === 64) {
      const keypair = Keypair.fromSecretKey(hex);
      console.log('✅ Valid Solana keypair!');
      console.log('   Public key:', keypair.publicKey.toBase58());
      success = true;
    } else {
      console.log('❌ Wrong length (need 64 bytes)');
    }
  } catch (e) {
    console.log('❌ Hex decode failed:', e.message);
  }
}

if (!success) {
  console.log('\n❌ Could not parse private key in any format\n');
  console.log('💡 How to get the correct key from Phantom:');
  console.log('   1. Open Phantom wallet');
  console.log('   2. Click Settings (⚙️)');
  console.log('   3. Click "Security & Privacy"');
  console.log('   4. Click "Export Private Key"');
  console.log('   5. Enter your password');
  console.log('   6. Copy the ENTIRE key (should be ~88 characters)\n');
  console.log('   Example format: 5Jx7W8... (base58 string)\n');
} else {
  console.log('\n✅ Key format is valid! You can now run: npm run deploy:qct-spl\n');
}
