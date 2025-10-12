const { ethers } = require('hardhat');

async function main() {
  console.log('🚀 Deploying QCT Token to Base Sepolia...\n');

  // Generate a random wallet for deployment
  const wallet = ethers.Wallet.createRandom();
  console.log('🔑 Generated deployment wallet:', wallet.address);
  console.log('🔐 Private key (save this!):', wallet.privateKey);
  
  // Connect to Base Sepolia
  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const deployerWallet = wallet.connect(provider);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log('💰 Wallet balance:', ethers.formatEther(balance), 'ETH');
  
  if (balance === 0n) {
    console.log('\n❌ No ETH in wallet for deployment!');
    console.log('📝 To deploy:');
    console.log('1. Send some Base Sepolia ETH to:', wallet.address);
    console.log('2. Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet');
    console.log('3. Add private key to .env.local as EVM_DEPLOYER_KEY');
    console.log('4. Run: npx hardhat run scripts/deploy-qct.js --network baseSepolia');
    return;
  }

  // Contract parameters
  const TOKEN_NAME = 'Qripto Cross-Chain Token';
  const TOKEN_SYMBOL = 'QCT';
  const INITIAL_SUPPLY = ethers.parseEther('100000000'); // 100M QCT initial supply

  // Deploy QCT Token
  console.log('\n📄 Deploying QCT Token...');
  const QCTToken = await ethers.getContractFactory('QCTToken', deployerWallet);
  const qctToken = await QCTToken.deploy(
    TOKEN_NAME,
    TOKEN_SYMBOL,
    INITIAL_SUPPLY,
    wallet.address
  );

  await qctToken.waitForDeployment();
  const contractAddress = await qctToken.getAddress();
  console.log('✅ QCT Token deployed to:', contractAddress);

  // Verify deployment
  const tokenInfo = await qctToken.getInfo();
  console.log('\n📊 Token Info:');
  console.log('Name:', tokenInfo.name_);
  console.log('Symbol:', tokenInfo.symbol_);
  console.log('Total Supply:', ethers.formatEther(tokenInfo.totalSupply_), 'QCT');
  console.log('Owner:', tokenInfo.owner_);

  console.log('\n🎉 Deployment Complete!');
  console.log('🔗 Contract Address:', contractAddress);
  console.log('🌐 Explorer:', `https://sepolia.basescan.org/address/${contractAddress}`);
  
  console.log('\n📝 Update qct-contracts.ts with:');
  console.log(`baseSepolia: {`);
  console.log(`  chainId: 84532,`);
  console.log(`  address: '${contractAddress}',`);
  console.log(`  explorer: 'https://sepolia.basescan.org/address/${contractAddress}',`);
  console.log(`  decimals: 18,`);
  console.log(`  symbol: 'QCT',`);
  console.log(`  name: 'Qripto Cross-Chain Token'`);
  console.log(`}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
