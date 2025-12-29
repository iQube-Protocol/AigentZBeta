#!/usr/bin/env node
const { ethers } = require("hardhat");

async function main() {
  const net = await ethers.provider.getNetwork();
  console.log(`Deploying to chainId=${net.chainId}`);

  const ACL = await ethers.getContractFactory("TokenQubeACL");
  const acl = await ACL.deploy();
  await acl.waitForDeployment();
  console.log("TokenQubeACL:", await acl.getAddress());

  const CM = await ethers.getContractFactory("ClaimManager");
  const cm = await CM.deploy();
  await cm.waitForDeployment();
  console.log("ClaimManager:", await cm.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
