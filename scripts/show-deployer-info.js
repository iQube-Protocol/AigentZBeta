#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { Wallet } = require('ethers');

// load .env.local if present
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

function ok(x) { return x && String(x).trim().length > 0; }

const pk = process.env.EVM_DEPLOYER_KEY;
if (!ok(pk)) {
  console.error('EVM_DEPLOYER_KEY is missing. Add it to .env.local');
  process.exit(1);
}

try {
  const w = new Wallet(pk);
  console.log('Deployer address:', w.address);
} catch (e) {
  console.error('Invalid EVM_DEPLOYER_KEY:', e.message);
  process.exit(1);
}

const nets = [
  { name: 'amoy', url: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY },
  { name: 'arbitrumSepolia', url: process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA },
];

for (const n of nets) {
  const ready = ok(n.url);
  console.log(`Network ${n.name}: ${ready ? 'OK' : 'MISSING RPC URL'}`);
}
