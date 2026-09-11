#!/usr/bin/env node
/**
 * Single-network QCTReserve deployment to Base mainnet.
 *
 * Companion to `deploy-qct-base-mainnet.js` — reads the QCT address
 * from `deployments/qct-base-mainnet.json` (written by that script),
 * uses canonical Circle-issued USDC on Base, and links the new
 * Reserve back to the QCT token via `setReserve()`.
 *
 * Safety rails:
 *   - chainId 8453 pin
 *   - balance precheck (≥ 0.0005 ETH)
 *   - refuses if QCT address file is missing
 *   - sanity-checks that the deployer is the QCT owner before
 *     attempting setReserve() (the call only works for the owner)
 *
 * Usage (after QCT is deployed):
 *   EVM_DEPLOYER_KEY=<hex> npx hardhat run scripts/deploy-qct-reserve-base-mainnet.js --network base
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

const EXPECTED_CHAIN_ID = 8453n;
const MIN_BALANCE_WEI = ethers.parseEther('0.0005');
const EXPLORER = 'https://basescan.org';

// Canonical Circle USDC on Base mainnet — not a deploy target.
// This is the real production USDC contract; we don't redeploy it.
const BASE_MAINNET_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   QCTReserve — Base mainnet deployment');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── 1. Chain pin ──────────────────────────────────────────────────────
  const net = await ethers.provider.getNetwork();
  console.log(`   Connected to chainId=${net.chainId}, name=${net.name}`);
  if (net.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `Refusing to deploy: expected Base mainnet (chainId ${EXPECTED_CHAIN_ID}), got ${net.chainId}.`,
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
      + `${ethers.formatEther(MIN_BALANCE_WEI)} ETH minimum.`,
    );
  }

  // ── 3. Load QCT address from the QCT deploy record ────────────────────
  const qctRecordPath = path.join(__dirname, '..', 'deployments', 'qct-base-mainnet.json');
  if (!fs.existsSync(qctRecordPath)) {
    throw new Error(
      `Missing ${qctRecordPath}. Run deploy-qct-base-mainnet.js first.`,
    );
  }
  const qctRecord = JSON.parse(fs.readFileSync(qctRecordPath, 'utf8'));
  if (!qctRecord.address) {
    throw new Error(`No 'address' field in ${qctRecordPath}.`);
  }
  const qctAddress = qctRecord.address;
  console.log(`   QCT token: ${qctAddress}`);
  console.log(`   USDC:      ${BASE_MAINNET_USDC} (canonical Circle USDC)`);

  // ── 4. Verify QCT exists at that address and deployer owns it ────────
  const QCT = await ethers.getContractAt('QriptoCENT', qctAddress);
  let qctOwner;
  try {
    qctOwner = await QCT.owner();
  } catch (err) {
    throw new Error(
      `Could not read owner() on QCT at ${qctAddress}. Is the address correct? `
      + `Underlying error: ${err.message}`,
    );
  }
  console.log(`   QCT owner: ${qctOwner}`);
  if (qctOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      `Deployer (${deployer.address}) is not the QCT owner (${qctOwner}). `
      + `setReserve() will revert. Either run this script with the owner key, or `
      + `transfer ownership first.`,
    );
  }

  // ── 5. Deploy QCTReserve ──────────────────────────────────────────────
  console.log('\n   📝 Deploying QCTReserve contract...');
  const QCTReserve = await ethers.getContractFactory('QCTReserve');
  const reserve = await QCTReserve.deploy(
    BASE_MAINNET_USDC,
    qctAddress,
    deployer.address,
  );
  const deployTx = reserve.deploymentTransaction();
  console.log(`   📤 Deploy tx submitted: ${deployTx?.hash}`);
  console.log(`   ⏳ Waiting for inclusion...`);
  await reserve.waitForDeployment();
  const reserveAddress = await reserve.getAddress();
  console.log(`   ✅ QCTReserve deployed to: ${reserveAddress}`);
  console.log(`   🔍 Explorer: ${EXPLORER}/address/${reserveAddress}`);

  // ── 6. Link Reserve into QCT ──────────────────────────────────────────
  console.log('\n   📝 Linking Reserve to QCT token (setReserve)...');
  const setReserveTx = await QCT.setReserve(reserveAddress);
  console.log(`   📤 setReserve tx: ${setReserveTx.hash}`);
  await setReserveTx.wait();
  console.log(`   ✅ Reserve linked.`);

  // ── 7. Persist ────────────────────────────────────────────────────────
  const outputPath = path.join(__dirname, '..', 'deployments', 'qct-reserve-base-mainnet.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        chain: 'base',
        chainId: Number(net.chainId),
        contract: 'QCTReserve',
        address: reserveAddress,
        qct: qctAddress,
        usdc: BASE_MAINNET_USDC,
        mintRatio: 100,
        mintFee: '0.1%',
        burnFee: '0.1%',
        deployer: deployer.address,
        deployTxHash: deployTx?.hash,
        setReserveTxHash: setReserveTx.hash,
        explorer: `${EXPLORER}/address/${reserveAddress}`,
        deployedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`\n   📁 Saved to: deployments/qct-reserve-base-mainnet.json`);

  console.log('\n   📋 Add to Amplify env vars:');
  console.log(`      NEXT_PUBLIC_QCT_RESERVE_BASE_MAINNET=${reserveAddress}`);

  const after = await ethers.provider.getBalance(deployer.address);
  console.log(`\n   💰 Remaining balance: ${ethers.formatEther(after)} ETH`);
  console.log('\n✨ QCTReserve deploy complete. Base Q¢ ↔ Base USDC swap is now live.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Deployment failed:', err.message || err);
    process.exit(1);
  });
