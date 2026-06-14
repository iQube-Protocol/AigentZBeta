#!/usr/bin/env -S npx tsx
/**
 * Smoke-test the deployed PolityOffchainResolver from any environment.
 *
 * After:
 *   1. POLITY_ISSUER_PRIVATE_KEY set on Amplify (server)
 *   2. PolityOffchainResolver.sol deployed to Sepolia (script output gives address)
 *   3. Resolver address set on polity.eth via sepolia.app.ens.domains
 *   4. At least one subname minted via POST /api/identity/persona/[id]/ens
 *
 * Run:
 *   npx tsx scripts/test-ens-resolution.ts first-citizen.polity.eth
 *
 * Or with a custom RPC:
 *   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<key> \
 *     npx tsx scripts/test-ens-resolution.ts first-citizen.polity.eth
 *
 * What it does:
 *   - Resolves the address for the given subname via ENS protocol
 *   - Resolves the text record 'polity.public_ref' (our commitment hash)
 *   - Prints both side-by-side with the CCIP-Read trace
 *
 * Success criteria (judges' demo):
 *   - addr resolves to a non-zero 0x...
 *   - text record returns the expected commitment hash
 *   - both go through the CCIP-Read OffchainLookup → gateway → on-chain
 *     signature recovery flow (visible if you trace the RPC calls)
 */

import { createPublicClient, http } from 'viem';
import { normalize } from 'viem/ens';
import { sepolia } from 'viem/chains';

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL ?? 'https://sepolia.drpc.org';
const name = process.argv[2];

if (!name) {
  console.error('Usage: npx tsx scripts/test-ens-resolution.ts <name.polity.eth>');
  process.exit(1);
}

const client = createPublicClient({
  chain: sepolia,
  transport: http(SEPOLIA_RPC),
});

async function main() {
  console.log(`\n🔍 Resolving ${name} on Sepolia...`);
  console.log('   (this triggers ENS CCIP-Read: registry → resolver → OffchainLookup → gateway → ecrecover → result)\n');

  const normalized = normalize(name);

  // 1. Resolve address
  try {
    console.log('1. Resolving address...');
    const addr = await client.getEnsAddress({ name: normalized });
    if (addr && addr !== '0x0000000000000000000000000000000000000000') {
      console.log(`   ✅ Address: ${addr}`);
    } else {
      console.log('   ⚠️  No address record found (or null returned)');
    }
  } catch (e) {
    console.log(`   ❌ Address resolution failed: ${e instanceof Error ? e.message : e}`);
  }

  // 2. Resolve text records
  const textKeys = ['polity.public_ref', 'polity.kind', 'polity.parent', 'avatar', 'description'];
  console.log('\n2. Resolving text records...');
  for (const key of textKeys) {
    try {
      const value = await client.getEnsText({ name: normalized, key });
      if (value) {
        const display = value.length > 60 ? `${value.slice(0, 57)}…` : value;
        console.log(`   ${key}: ${display}`);
      }
    } catch {
      // Skip
    }
  }

  // 3. Resolver address
  console.log('\n3. Resolver contract...');
  try {
    const resolver = await client.getEnsResolver({ name: normalized });
    console.log(`   ${resolver}`);
    console.log(`   Sepolia Etherscan: https://sepolia.etherscan.io/address/${resolver}`);
  } catch (e) {
    console.log(`   ❌ Could not fetch resolver: ${e instanceof Error ? e.message : e}`);
  }

  console.log('\n────────────────────────────────────────');
  console.log('If everything above resolved correctly, your CCIP-Read');
  console.log('integration is judge-ready. Show this in the submission:');
  console.log(`   sepolia.app.ens.domains/${normalized}`);
  console.log('────────────────────────────────────────\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
