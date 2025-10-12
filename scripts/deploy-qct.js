const { ethers } = require('hardhat');

async function main() {
  console.log('🚀 Deploying QCT Token contracts...\n');

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await deployer.provider.getBalance(deployer.address)), 'ETH\n');

  // Contract parameters
  const TOKEN_NAME = 'Qripto Cross-Chain Token';
  const TOKEN_SYMBOL = 'QCT';
  const INITIAL_SUPPLY = ethers.parseEther('100000000'); // 100M QCT initial supply
  const DEPLOYER_ADDRESS = deployer.address;

  // Deploy QCT Token
  console.log('📄 Deploying QCT Token...');
  const QCTToken = await ethers.getContractFactory('QCTToken');
  const qctToken = await QCTToken.deploy(
    TOKEN_NAME,
    TOKEN_SYMBOL,
    INITIAL_SUPPLY,
    DEPLOYER_ADDRESS
  );

  await qctToken.waitForDeployment();
  const contractAddress = await qctToken.getAddress();
  console.log('✅ QCT Token deployed to:', contractAddress);

  // Verify deployment
  const tokenInfo = await qctToken.getInfo();
  console.log('\n📊 Token Info:');
  console.log('Name:', tokenInfo.name_);
  console.log('Symbol:', tokenInfo.symbol_);
  console.log('Decimals:', tokenInfo.decimals_);
  console.log('Total Supply:', ethers.formatEther(tokenInfo.totalSupply_), 'QCT');
  console.log('Max Supply:', ethers.formatEther(tokenInfo.maxSupply_), 'QCT');
  console.log('Owner:', tokenInfo.owner_);
  console.log('Paused:', tokenInfo.paused_);

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log('\n🌐 Network Info:');
  console.log('Chain ID:', network.chainId);
  console.log('Network Name:', network.name);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    contractAddress: contractAddress,
    deployerAddress: deployer.address,
    tokenName: TOKEN_NAME,
    tokenSymbol: TOKEN_SYMBOL,
    initialSupply: ethers.formatEther(INITIAL_SUPPLY),
    deploymentTime: new Date().toISOString(),
    transactionHash: qctToken.deploymentTransaction()?.hash || 'N/A',
    blockNumber: qctToken.deploymentTransaction()?.blockNumber?.toString() || 'N/A'
  };

  console.log('\n💾 Deployment Summary:');
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Instructions for next steps
  console.log('\n📋 Next Steps:');
  console.log('1. Verify contract on block explorer');
  console.log('2. Update QCT_CONTRACT_ADDRESS in environment variables');
  console.log('3. Update trading API with real contract address');
  console.log('4. Test minting/burning functionality');
  
  console.log('\n🔗 Contract Address for .env:');
  console.log(`QCT_CONTRACT_ADDRESS_${network.chainId}=${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
