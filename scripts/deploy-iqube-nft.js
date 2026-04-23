#!/usr/bin/env node
const { ethers } = require("hardhat");

async function main() {
  const net = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying iQubeNFT to chainId=${net.chainId}`);
  console.log(`Deployer: ${deployer.address}`);

  const iQubeNFT = await ethers.getContractFactory("iQubeNFT");
  const contract = await iQubeNFT.deploy(deployer.address);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`iQubeNFT deployed: ${address}`);
  console.log(`\nAdd to Amplify env vars:`);
  console.log(`  IQUBE_NFT_CONTRACT_ADDRESS=${address}`);
  console.log(`  IQUBE_NFT_CHAIN_ID=${net.chainId}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
