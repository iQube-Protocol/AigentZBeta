const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount } = require('@solana/spl-token');
const fs = require('fs');

async function deployQCTSolana() {
  console.log('🚀 Deploying QCT SPL Token on Solana Devnet...\n');

  // Connect to Solana devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Generate or load keypair
  let payer;
  const keypairPath = './solana-keypair.json';
  
  if (fs.existsSync(keypairPath)) {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
    payer = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log('📂 Loaded existing keypair:', payer.publicKey.toString());
  } else {
    payer = Keypair.generate();
    fs.writeFileSync(keypairPath, JSON.stringify(Array.from(payer.secretKey)));
    console.log('🔑 Generated new keypair:', payer.publicKey.toString());
    console.log('💾 Saved keypair to:', keypairPath);
  }

  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log('💰 Wallet balance:', balance / 1e9, 'SOL');
  
  if (balance < 0.1 * 1e9) {
    console.log('\n❌ Insufficient SOL for deployment!');
    console.log('📝 To deploy:');
    console.log('1. Get devnet SOL from: https://faucet.solana.com/');
    console.log('2. Send to wallet:', payer.publicKey.toString());
    console.log('3. Run this script again');
    return;
  }

  try {
    console.log('\n📄 Creating QCT SPL Token...');
    
    // Create the mint
    const mint = await createMint(
      connection,
      payer,           // Payer
      payer.publicKey, // Mint authority
      payer.publicKey, // Freeze authority
      9                // Decimals (standard for SPL tokens)
    );

    console.log('✅ QCT SPL Token created:', mint.toString());

    // Create associated token account for the payer
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      payer.publicKey
    );

    console.log('✅ Token account created:', tokenAccount.address.toString());

    // Mint initial supply: 100M QCT
    const initialSupply = 100_000_000 * Math.pow(10, 9); // 100M with 9 decimals
    await mintTo(
      connection,
      payer,
      mint,
      tokenAccount.address,
      payer.publicKey,
      initialSupply
    );

    console.log('✅ Minted initial supply: 100M QCT');

    // Verify the mint
    const accountInfo = await getAccount(connection, tokenAccount.address);
    console.log('\n📊 Token Info:');
    console.log('Mint Address:', mint.toString());
    console.log('Token Account:', tokenAccount.address.toString());
    console.log('Balance:', Number(accountInfo.amount) / Math.pow(10, 9), 'QCT');
    console.log('Owner:', accountInfo.owner.toString());

    // Save deployment info
    const deploymentInfo = {
      network: 'devnet',
      mintAddress: mint.toString(),
      tokenAccount: tokenAccount.address.toString(),
      owner: payer.publicKey.toString(),
      initialSupply: '100000000',
      decimals: 9,
      deploymentTime: new Date().toISOString()
    };

    console.log('\n💾 Deployment Summary:');
    console.log(JSON.stringify(deploymentInfo, null, 2));

    console.log('\n🔗 Solana Explorer:');
    console.log(`https://explorer.solana.com/address/${mint.toString()}?cluster=devnet`);

    console.log('\n📝 Update qct-contracts.ts with:');
    console.log(`solana: {`);
    console.log(`  network: 'devnet',`);
    console.log(`  mintAddress: '${mint.toString()}',`);
    console.log(`  decimals: 9,`);
    console.log(`  symbol: 'QCT'`);
    console.log(`}`);

    return {
      mintAddress: mint.toString(),
      tokenAccount: tokenAccount.address.toString(),
      owner: payer.publicKey.toString()
    };

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  deployQCTSolana()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    });
}

module.exports = { deployQCTSolana };
