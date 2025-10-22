const { FIOSDK } = require('@fioprotocol/fiosdk');

async function generateFIOWallet() {
  try {
    console.log('=== GENERATING AIGENT Z FIO WALLET ===\n');

    // Generate private key directly
    const result = await FIOSDK.createPrivateKeyMnemonic();
    const privateKey = result.fioKey;
    const mnemonic = result.mnemonic;
    
    if (mnemonic) {
      console.log('Mnemonic (SAVE THIS SECURELY - BACKUP PHRASE):');
      console.log(mnemonic);
      console.log('');
    }
    
    // Derive public key from private key
    const publicKeyObj = FIOSDK.derivedPublicKey(privateKey);
    const publicKey = publicKeyObj.publicKey;

    console.log('Private Key (KEEP SECRET - NEVER SHARE):');
    console.log(privateKey);
    console.log('');

    console.log('Public Key:');
    console.log(publicKey);
    console.log('');

    console.log('=== ENVIRONMENT VARIABLES ===');
    console.log('Add these to your .env.local file:\n');
    console.log('FIO_SYSTEM_PRIVATE_KEY=' + privateKey);
    console.log('FIO_SYSTEM_PUBLIC_KEY=' + publicKey);
    console.log('');

    console.log('=== HANDLE TO REGISTER ===');
    console.log('aigent-z@aigent');
    console.log('');

    console.log('=== NEXT STEPS ===');
    console.log('1. Save the private key in a secure location (password manager)');
    console.log('2. Add environment variables to .env.local');
    console.log('3. Get FIO testnet tokens from: https://faucet.fioprotocol.io/');
    console.log('4. Use the PUBLIC KEY above to get testnet tokens');
    console.log('5. The FIO address will be derived when you register aigent-z@aigent');
    console.log('');
    console.log('⚠️  SECURITY WARNING:');
    console.log('   - NEVER commit the private key to git');
    console.log('   - Store it securely in a password manager');
    console.log('   - The private key controls all funds in this wallet');
    console.log('');
    console.log('=== TO GET TESTNET TOKENS ===');
    console.log('Visit: https://faucet.fioprotocol.io/');
    console.log('Enter your PUBLIC KEY: ' + publicKey);
    console.log('Request testnet FIO tokens (you need ~40 FIO for handle registration)');

  } catch (error) {
    console.error('Error generating wallet:', error);
  }
}

generateFIOWallet();
