/**
 * QCT SPL Token Deployment Script
 * Deploys QriptoCENT (QCT) as an SPL token on Solana
 */

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');

const {
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} = require('@solana/spl-token');

// QCT Token Configuration
const QCT_CONFIG = {
  name: 'QriptoCENT',
  symbol: 'QCT',
  decimals: 9, // Solana standard
  totalSupply: 1_000_000_000, // 1 billion
  initialMint: 400_000_000, // 40% premine
};

async function deployQCTSPL() {
  console.log('🚀 Deploying QCT SPL Token on Solana...\n');
  console.log('Token Configuration:');
  console.log('  Name:', QCT_CONFIG.name);
  console.log('  Symbol:', QCT_CONFIG.symbol);
  console.log('  Decimals:', QCT_CONFIG.decimals);
  console.log('  Total Supply:', QCT_CONFIG.totalSupply.toLocaleString(), 'QCT');
  console.log('  Initial Mint:', QCT_CONFIG.initialMint.toLocaleString(), 'QCT (40%)\n');

  // Get deployer keypair from environment
  const privateKeyString = process.env.SOLANA_DEPLOYER_KEY;
  if (!privateKeyString) {
    throw new Error('SOLANA_DEPLOYER_KEY environment variable not set');
  }

  // Parse private key (array of numbers)
  const privateKey = Uint8Array.from(JSON.parse(privateKeyString));
  const payer = Keypair.fromSecretKey(privateKey);

  console.log('📍 Deployer Address:', payer.publicKey.toBase58());

  // Connect to Solana Devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log('💰 Balance:', balance / LAMPORTS_PER_SOL, 'SOL\n');

  if (balance === 0) {
    throw new Error('Insufficient SOL. Get devnet SOL from: https://faucet.solana.com/');
  }

  // Generate mint keypair
  const mintKeypair = Keypair.generate();
  console.log('🪙 Mint Address:', mintKeypair.publicKey.toBase58());

  // Get rent exemption amount
  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  // Get associated token account
  const associatedTokenAccount = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    payer.publicKey
  );

  console.log('📦 Token Account:', associatedTokenAccount.toBase58());
  console.log('\n📝 Creating mint and token account...\n');

  // Create transaction
  const transaction = new Transaction().add(
    // Create mint account
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    // Initialize mint
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      QCT_CONFIG.decimals,
      payer.publicKey, // Mint authority
      payer.publicKey, // Freeze authority
      TOKEN_PROGRAM_ID
    ),
    // Create associated token account
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      associatedTokenAccount,
      payer.publicKey,
      mintKeypair.publicKey
    ),
    // Mint initial supply
    createMintToInstruction(
      mintKeypair.publicKey,
      associatedTokenAccount,
      payer.publicKey,
      QCT_CONFIG.initialMint * Math.pow(10, QCT_CONFIG.decimals)
    )
  );

  // Send transaction
  console.log('📤 Sending transaction...');
  const signature = await connection.sendTransaction(
    transaction,
    [payer, mintKeypair],
    { skipPreflight: false }
  );

  console.log('⏳ Confirming transaction...');
  await connection.confirmTransaction(signature, 'confirmed');

  console.log('\n✅ QCT SPL Token Deployed Successfully!\n');
  console.log('📊 Deployment Summary:');
  console.log('  Transaction:', signature);
  console.log('  Mint Address:', mintKeypair.publicKey.toBase58());
  console.log('  Token Account:', associatedTokenAccount.toBase58());
  console.log('  Explorer:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  console.log('  Mint Explorer:', `https://explorer.solana.com/address/${mintKeypair.publicKey.toBase58()}?cluster=devnet`);
  console.log('\n  Initial Supply Minted:', QCT_CONFIG.initialMint.toLocaleString(), 'QCT');
  console.log('  Remaining Supply:', (QCT_CONFIG.totalSupply - QCT_CONFIG.initialMint).toLocaleString(), 'QCT (for bridge minting)');

  return {
    signature,
    mintAddress: mintKeypair.publicKey.toBase58(),
    tokenAccount: associatedTokenAccount.toBase58(),
    decimals: QCT_CONFIG.decimals,
    initialSupply: QCT_CONFIG.initialMint,
    totalSupply: QCT_CONFIG.totalSupply
  };
}

// Run deployment
if (require.main === module) {
  deployQCTSPL()
    .then((result) => {
      console.log('\n✨ Deployment complete!');
      
      // Save deployment info
      const fs = require('fs');
      const path = require('path');
      
      const outputPath = path.join(__dirname, '../deployments/qct-spl-address.json');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      
      console.log('📁 Deployment info saved to: deployments/qct-spl-address.json\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Deployment failed:', error.message);
      process.exit(1);
    });
}

module.exports = { deployQCTSPL };
