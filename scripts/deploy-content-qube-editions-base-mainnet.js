#!/usr/bin/env node
/**
 * Single-network ContentQubeEditions (ERC-1155) deployment to Base
 * mainnet. Companion to deploy-qct / deploy-iqube-nft scripts.
 *
 * Safety rails:
 *   - chainId 8453 pin (refuses any other network)
 *   - balance precheck (≥ 0.0005 ETH)
 *   - persists address to deployments/content-qube-editions-base-mainnet.json
 *   - emits Amplify env-var line for paste-in
 *
 * Usage:
 *   EVM_DEPLOYER_KEY=<hex> npx hardhat run scripts/deploy-content-qube-editions-base-mainnet.js --network base
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

const EXPECTED_CHAIN_ID = 8453n;
const MIN_BALANCE_WEI = ethers.parseEther('0.0005');
const EXPLORER = 'https://basescan.org';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   ContentQubeEditions (ERC-1155) — Base mainnet deployment');
  console.log('═══════════════════════════════════════════════════════\n');

  const net = await ethers.provider.getNetwork();
  console.log(`   Connected to chainId=${net.chainId}, name=${net.name}`);
  if (net.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `Refusing to deploy: expected Base mainnet (chainId ${EXPECTED_CHAIN_ID}), got ${net.chainId}. `
      + `Run with: --network base`,
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log(`   Deployer: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`   Balance:  ${ethers.formatEther(balance)} ETH on Base`);
  if (balance < MIN_BALANCE_WEI) {
    throw new Error(
      `Insufficient balance: ${ethers.formatEther(balance)} ETH < `
      + `${ethers.formatEther(MIN_BALANCE_WEI)} ETH minimum.`,
    );
  }

  console.log('\n   📝 Deploying ContentQubeEditions contract...');
  const Editions = await ethers.getContractFactory('ContentQubeEditions');
  const contract = await Editions.deploy(deployer.address);
  const tx = contract.deploymentTransaction();
  console.log(`   📤 Deploy tx submitted: ${tx?.hash}`);
  console.log(`   ⏳ Waiting for inclusion...`);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`\n   ✅ ContentQubeEditions deployed to: ${address}`);
  console.log(`   🔍 Explorer: ${EXPLORER}/address/${address}`);

  const outputPath = path.join(__dirname, '..', 'deployments', 'content-qube-editions-base-mainnet.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        chain: 'base',
        chainId: Number(net.chainId),
        contract: 'ContentQubeEditions',
        address,
        deployer: deployer.address,
        txHash: tx?.hash,
        explorer: `${EXPLORER}/address/${address}`,
        deployedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`\n   📁 Saved to: deployments/content-qube-editions-base-mainnet.json`);

  console.log('\n   📋 Add to Amplify env vars:');
  console.log(`      CONTENT_QUBE_ERC1155_ADDRESS=${address}`);

  const after = await ethers.provider.getBalance(deployer.address);
  console.log(`\n   💰 Remaining balance: ${ethers.formatEther(after)} ETH`);
  console.log('\n✨ ContentQubeEditions deploy complete. Edition mints will activate once env var is set on Amplify.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Deployment failed:', err.message || err);
    process.exit(1);
  });
