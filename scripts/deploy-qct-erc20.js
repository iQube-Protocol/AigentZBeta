/**
 * QCT ERC20 Token Deployment Script
 * Deploys QriptoCENT (QCT) to multiple EVM chains
 */

const hre = require("hardhat");

// Chain configurations
const CHAINS = {
  sepolia: {
    name: "Ethereum Sepolia",
    rpc: process.env.NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA,
    chainId: 11155111,
    explorer: "https://sepolia.etherscan.io"
  },
  amoy: {
    name: "Polygon Amoy",
    rpc: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY,
    chainId: 80002,
    explorer: "https://amoy.polygonscan.com"
  },
  arbitrumSepolia: {
    name: "Arbitrum Sepolia",
    rpc: process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA,
    chainId: 421614,
    explorer: "https://sepolia.arbiscan.io"
  },
  optimismSepolia: {
    name: "Optimism Sepolia",
    rpc: process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA,
    chainId: 11155420,
    explorer: "https://sepolia-optimism.etherscan.io"
  },
  baseSepolia: {
    name: "Base Sepolia",
    rpc: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA,
    chainId: 84532,
    explorer: "https://sepolia.basescan.org"
  },
  // Mainnet — deploy with: npx hardhat run scripts/deploy-qct-erc20.js --network base
  base: {
    name: "Base Mainnet",
    rpc: process.env.NEXT_PUBLIC_RPC_BASE_MAINNET || "https://mainnet.base.org",
    chainId: 8453,
    explorer: "https://basescan.org"
  }
};

async function deployQCT(chainName, chainConfig) {
  console.log(`\n🚀 Deploying QCT to ${chainConfig.name}...`);
  console.log(`   Chain ID: ${chainConfig.chainId}`);
  console.log(`   RPC: ${chainConfig.rpc}\n`);

  try {
    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log(`   Deployer: ${deployer.address}`);
    
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`   Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

    if (balance === 0n) {
      throw new Error(`Insufficient balance on ${chainConfig.name}. Get testnet tokens from faucet.`);
    }

    // Deploy QCT contract
    console.log(`   📝 Deploying QriptoCENT contract...`);
    const QCT = await hre.ethers.getContractFactory("QriptoCENT");
    const qct = await QCT.deploy(deployer.address);
    
    await qct.waitForDeployment();
    const address = await qct.getAddress();
    
    console.log(`   ✅ QCT deployed to: ${address}`);
    console.log(`   🔍 Explorer: ${chainConfig.explorer}/address/${address}`);
    
    // Get token info
    const name = await qct.name();
    const symbol = await qct.symbol();
    const decimals = await qct.decimals();
    const totalSupply = await qct.totalSupply();
    const maxSupply = await qct.MAX_SUPPLY();
    
    console.log(`\n   📊 Token Information:`);
    console.log(`      Name: ${name}`);
    console.log(`      Symbol: ${symbol}`);
    console.log(`      Decimals: ${decimals}`);
    console.log(`      Initial Supply: ${hre.ethers.formatEther(totalSupply)} QCT`);
    console.log(`      Max Supply: ${hre.ethers.formatEther(maxSupply)} QCT`);
    
    return {
      chain: chainName,
      chainId: chainConfig.chainId,
      address: address,
      deployer: deployer.address,
      txHash: qct.deploymentTransaction()?.hash,
      explorer: `${chainConfig.explorer}/address/${address}`
    };
    
  } catch (error) {
    console.error(`   ❌ Deployment failed on ${chainConfig.name}:`, error.message);
    return null;
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("   QriptoCENT (QCT) ERC20 Multi-Chain Deployment");
  console.log("═══════════════════════════════════════════════════════\n");
  
  const deployments = [];
  
  // Deploy to all chains
  for (const [chainName, chainConfig] of Object.entries(CHAINS)) {
    if (!chainConfig.rpc) {
      console.log(`\n⚠️  Skipping ${chainConfig.name} - No RPC configured`);
      continue;
    }
    
    const result = await deployQCT(chainName, chainConfig);
    if (result) {
      deployments.push(result);
    }
    
    // Wait a bit between deployments
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("   📊 Deployment Summary");
  console.log("═══════════════════════════════════════════════════════\n");
  
  if (deployments.length === 0) {
    console.log("❌ No successful deployments");
    process.exit(1);
  }
  
  console.log(`✅ Successfully deployed to ${deployments.length} chain(s):\n`);
  
  deployments.forEach((deployment, index) => {
    console.log(`${index + 1}. ${CHAINS[deployment.chain].name}`);
    console.log(`   Address: ${deployment.address}`);
    console.log(`   Explorer: ${deployment.explorer}`);
    console.log(`   TX Hash: ${deployment.txHash}\n`);
  });
  
  // Save deployment addresses
  const addresses = {};
  deployments.forEach(d => {
    addresses[d.chain] = {
      address: d.address,
      chainId: d.chainId,
      explorer: d.explorer
    };
  });
  
  const fs = require('fs');
  const path = require('path');
  
  const outputPath = path.join(__dirname, '../deployments/qct-erc20-addresses.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
  
  console.log(`📁 Deployment addresses saved to: deployments/qct-erc20-addresses.json`);
  console.log("\n✨ Deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
