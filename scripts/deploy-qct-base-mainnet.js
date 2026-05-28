#!/usr/bin/env node
/**
 * Single-network QCT (QriptoCENT) deployment to Base mainnet.
 *
 * Purpose-built replacement for `scripts/deploy-qct-erc20.js`, which
 * is a multi-chain iterator that — if any testnet RPC env var is
 * set in `.env.local` — will deploy QCT multiple times to whatever
 * network hardhat is configured for. That bug would burn the
 * deployer's entire ETH balance on duplicate contracts.
 *
 * This script:
 *   1. Pins to chainId 8453 (Base mainnet). Refuses to run on
 *      any other chain.
 *   2. Pre-checks the deployer balance (≥ 0.0005 ETH minimum).
 *   3. Deploys exactly once.
 *   4. Writes the address to `deployments/qct-base-mainnet.json`.
 *   5. Emits the Amplify env-var lines for paste-in.
 *
 * Usage:
 *   EVM_DEPLOYER_KEY=<hex> npx hardhat run scripts/deploy-qct-base-mainnet.js --network base
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

const EXPECTED_CHAIN_ID = 8453n; // Base mainnet
const MIN_BALANCE_WEI = ethers.parseEther('0.0005'); // ~3.5x typical Base mainnet deploy cost
const EXPLORER = 'https://basescan.org';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   QriptoCENT (QCT) — Base mainnet deployment');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── 1. Chain pin ──────────────────────────────────────────────────────
  const net = await ethers.provider.getNetwork();
  console.log(`   Connected to chainId=${net.chainId}, name=${net.name}`);
  if (net.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `Refusing to deploy: expected Base mainnet (chainId ${EXPECTED_CHAIN_ID}), got ${net.chainId}. `
      + `Run with: npx hardhat run scripts/deploy-qct-base-mainnet.js --network base`,
    );
  }

  // ── 2. Deployer + balance precheck ────────────────────────────────────
  const [deployer] = await ethers.getSigners();
  console.log(`   Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`   Balance:  ${ethers.formatEther(balance)} ETH on Base`);

  if (balance < MIN_BALANCE_WEI) {
    throw new Error(
      `Insufficient balance: ${ethers.formatEther(balance)} ETH < `
      + `${ethers.formatEther(MIN_BALANCE_WEI)} ETH minimum. `
      + `Top up the deployer EOA on Base mainnet before retrying.`,
    );
  }

  // ── 3. Deploy ─────────────────────────────────────────────────────────
  console.log('\n   📝 Deploying QriptoCENT contract...');
  const QCT = await ethers.getContractFactory('QriptoCENT');
  const qct = await QCT.deploy(deployer.address);
  const tx = qct.deploymentTransaction();
  console.log(`   📤 Deploy tx submitted: ${tx?.hash}`);
  console.log(`   ⏳ Waiting for inclusion...`);

  await qct.waitForDeployment();
  const address = await qct.getAddress();

  console.log(`\n   ✅ QCT deployed to: ${address}`);
  console.log(`   🔍 Explorer: ${EXPLORER}/address/${address}`);

  // ── 4. Sanity-check the contract responded ───────────────────────────
  const [name, symbol, decimals, totalSupply, maxSupply] = await Promise.all([
    qct.name(),
    qct.symbol(),
    qct.decimals(),
    qct.totalSupply(),
    qct.MAX_SUPPLY(),
  ]);
  console.log('\n   📊 Token info:');
  console.log(`      Name:           ${name}`);
  console.log(`      Symbol:         ${symbol}`);
  console.log(`      Decimals:       ${decimals}`);
  console.log(`      Initial Supply: ${ethers.formatEther(totalSupply)} QCT`);
  console.log(`      Max Supply:     ${ethers.formatEther(maxSupply)} QCT`);

  // ── 5. Persist + emit env-var lines ──────────────────────────────────
  const outputPath = path.join(__dirname, '..', 'deployments', 'qct-base-mainnet.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        chain: 'base',
        chainId: Number(net.chainId),
        contract: 'QriptoCENT',
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
  console.log(`\n   📁 Saved to: deployments/qct-base-mainnet.json`);

  console.log('\n   📋 Add to Amplify env vars:');
  console.log(`      NEXT_PUBLIC_QCT_BASE_MAINNET=${address}`);
  console.log(`      NEXT_PUBLIC_QCT_BASE_MAINNET_CHAIN_ID=${net.chainId}`);

  // ── 6. Post-deploy balance reminder ──────────────────────────────────
  const after = await ethers.provider.getBalance(deployer.address);
  console.log(`\n   💰 Remaining balance: ${ethers.formatEther(after)} ETH`);
  console.log(`   🔜 Next step: deploy iQubeNFT with:`);
  console.log(`      npx hardhat run scripts/deploy-iqube-nft.js --network base`);
  console.log('\n✨ QCT deploy complete.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Deployment failed:', err.message || err);
    process.exit(1);
  });
