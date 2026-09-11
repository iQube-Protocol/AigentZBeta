#!/usr/bin/env node
/**
 * Verify that EVM_DEPLOYER_KEY corresponds to the expected EOA.
 *
 * Pure local derivation — no RPC calls, no network contact. The
 * private key never leaves the process; the script just derives the
 * matching address and compares it to the expected one.
 *
 * Usage:
 *   EVM_DEPLOYER_KEY=<hex> node scripts/verify-deployer-key.js
 *
 *   # or with the expected address overridden
 *   EVM_DEPLOYER_KEY=<hex> EXPECTED_ADDRESS=0xabc... \
 *     node scripts/verify-deployer-key.js
 *
 * Exits 0 on match, 1 on mismatch / missing key.
 */

const path = require('path');
const fs = require('fs');

// Load .env.local if present so the user doesn't have to export the
// key in every shell session. We DO NOT print the key — only derive
// from it and print the resulting address.
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  try {
    require('dotenv').config({ path: envPath });
  } catch {
    // dotenv not installed at top level — env vars from the shell still work.
  }
}

const EXPECTED = (process.env.EXPECTED_ADDRESS
  || '0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844').toLowerCase();

const raw = process.env.EVM_DEPLOYER_KEY;
if (!raw || !raw.trim()) {
  console.error('❌ EVM_DEPLOYER_KEY is not set.');
  console.error('   Set it in .env.local or export it in your shell, e.g.:');
  console.error('     export EVM_DEPLOYER_KEY=0xabc123...');
  process.exit(1);
}

// Accept with or without 0x prefix.
const key = raw.trim().startsWith('0x') ? raw.trim() : `0x${raw.trim()}`;

let derivedAddress;
try {
  // Use ethers from the project's existing dependency graph (hardhat
  // pulls it in, so no extra install needed).
  const { Wallet } = require('ethers');
  const wallet = new Wallet(key);
  derivedAddress = wallet.address;
} catch (err) {
  console.error('❌ Failed to derive address from key.');
  console.error(`   ${err && err.message ? err.message : err}`);
  console.error('   The key must be a 64-character hex string (32 bytes), optionally prefixed with 0x.');
  process.exit(1);
}

const derivedLower = derivedAddress.toLowerCase();

console.log('═══════════════════════════════════════════════════════');
console.log('   EVM Deployer Key Verification');
console.log('═══════════════════════════════════════════════════════');
console.log(`   Expected address: ${EXPECTED}`);
console.log(`   Derived address:  ${derivedLower}`);
console.log('───────────────────────────────────────────────────────');

if (derivedLower === EXPECTED) {
  console.log('   ✅ MATCH — this key controls the expected EOA.');
  console.log('       Safe to use for the Base mainnet deploy.');
  process.exit(0);
} else {
  console.log('   ❌ MISMATCH — this key controls a different address.');
  console.log('       Do NOT deploy with this key. The contracts would');
  console.log('       be deployed by, and owned by, the wrong account.');
  process.exit(1);
}
