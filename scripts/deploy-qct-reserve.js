/**
 * Deploy QCT Reserve System
 * 
 * Deploys:
 * 1. MockUSDC (testnet only)
 * 2. QCTReserve contract
 * 3. Links QCT token to reserve
 * 
 * Usage: npx hardhat run scripts/deploy-qct-reserve.js --network sepolia
 */

const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

// Import existing QCT addresses
const qctAddresses = require('../deployments/qct-erc20-addresses.json');

async function main() {
  console.log('\n🏦 Deploying QCT Reserve System...\n');
  
  const [deployer] = await hre.ethers.getSigners();
  console.log('📍 Deployer:', deployer.address);
  console.log('💰 Balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), 'ETH\n');
  
  const network = hre.network.name;
  console.log('🌐 Network:', network);
  
  // Get existing QCT address for this network
  const qctAddress = qctAddresses[network]?.address;
  if (!qctAddress) {
    throw new Error(`No QCT token deployed on ${network}. Deploy QCT first.`);
  }
  console.log('🪙 QCT Token:', qctAddress);
  
  const deployments = {
    network: network,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {}
  };
  
  // Step 1: Deploy MockUSDC (testnet only)
  console.log('\n📝 Step 1: Deploying MockUSDC...');
  
  let usdcAddress;
  
  if (network === 'mainnet' || network === 'polygon' || network === 'arbitrum' || network === 'optimism' || network === 'base') {
    // Use real USDC on mainnet
    const REAL_USDC_ADDRESSES = {
      mainnet: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      arbitrum: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      optimism: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
      base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    };
    usdcAddress = REAL_USDC_ADDRESSES[network];
    console.log('   Using real USDC:', usdcAddress);
  } else {
    // Deploy MockUSDC for testnets
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    usdcAddress = await mockUSDC.getAddress();
    
    console.log('   ✅ MockUSDC deployed:', usdcAddress);
    
    // Mint some USDC to deployer for testing
    const mintTx = await mockUSDC.faucet();
    await mintTx.wait();
    console.log('   💰 Minted 1000 USDC to deployer');
    
    deployments.contracts.mockUSDC = {
      address: usdcAddress,
      type: 'MockUSDC'
    };
  }
  
  // Step 2: Deploy QCTReserve
  console.log('\n📝 Step 2: Deploying QCTReserve...');
  
  const QCTReserve = await hre.ethers.getContractFactory("QCTReserve");
  const reserve = await QCTReserve.deploy(
    usdcAddress,
    qctAddress,
    deployer.address
  );
  await reserve.waitForDeployment();
  const reserveAddress = await reserve.getAddress();
  
  console.log('   ✅ QCTReserve deployed:', reserveAddress);
  
  deployments.contracts.reserve = {
    address: reserveAddress,
    usdc: usdcAddress,
    qct: qctAddress,
    mintRatio: 100,
    mintFee: '0.1%',
    burnFee: '0.1%'
  };
  
  // Step 3: Link Reserve to QCT Token
  console.log('\n📝 Step 3: Linking Reserve to QCT Token...');
  
  const QCT = await hre.ethers.getContractAt("QriptoCENT", qctAddress);
  const setReserveTx = await QCT.setReserve(reserveAddress);
  await setReserveTx.wait();
  
  console.log('   ✅ Reserve linked to QCT token');
  
  // Step 4: Approve USDC for testing (testnet only)
  if (network !== 'mainnet' && network !== 'polygon' && network !== 'arbitrum' && network !== 'optimism' && network !== 'base') {
    console.log('\n📝 Step 4: Approving USDC for Reserve...');
    
    const MockUSDC = await hre.ethers.getContractAt("MockUSDC", usdcAddress);
    const approveTx = await MockUSDC.approve(reserveAddress, hre.ethers.parseUnits('1000', 6));
    await approveTx.wait();
    
    console.log('   ✅ Approved 1000 USDC for reserve');
  }
  
  // Save deployment info
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = `qct-reserve-${network}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deployments, null, 2));
  
  console.log('\n✅ Deployment Complete!\n');
  console.log('📊 Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Network:', network);
  console.log('QCT Token:', qctAddress);
  console.log('USDC:', usdcAddress);
  console.log('Reserve:', reserveAddress);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n💡 Next Steps:');
  console.log('1. Verify contracts on block explorer');
  console.log('2. Fund reserve with initial USDC');
  console.log('3. Test mint/burn functionality');
  console.log('4. Set up multisig for reserve control');
  console.log('\n📁 Deployment saved to:', filepath);
  console.log('\n🎉 Ready to mint QCT!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });
