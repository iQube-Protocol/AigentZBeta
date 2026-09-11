#!/usr/bin/env -S npx tsx
/**
 * Deploy PolityOffchainResolver.sol to Sepolia + set as resolver on polity.eth.
 *
 * Prereqs:
 *   1. polity.eth registered on Sepolia (you already did this).
 *   2. Sepolia ETH in your deployer wallet (~0.005 ETH from a faucet).
 *   3. Local env:
 *      - DEPLOYER_PRIVATE_KEY=0x...    (signs both deploy + setResolver tx)
 *      - POLITY_ISSUER_PRIVATE_KEY=0x... (the polity issuer; we read pubkey)
 *      - GATEWAY_URL=https://dev-beta.aigentz.me/api/ens/ccip-read/{sender}/{data}.json
 *
 * Usage:
 *   npm install -D solc tsx
 *   DEPLOYER_PRIVATE_KEY=0x... POLITY_ISSUER_PRIVATE_KEY=0x... \
 *     GATEWAY_URL='https://dev-beta.aigentz.me/api/ens/ccip-read/{sender}/{data}.json' \
 *     npx tsx scripts/deploy-polity-resolver.ts
 *
 * What it does:
 *   1. Compiles contracts/PolityOffchainResolver.sol with solc.
 *   2. Deploys to Sepolia using your deployer key.
 *   3. Prints the resolver address.
 *   4. Prints the next step: set this address as the resolver on polity.eth
 *      via app.ens.domains (one-click, ~$0 in Sepolia gas).
 *
 * After deploy + resolver set:
 *   - any ENS-aware tool resolving first-citizen.polity.eth on Sepolia
 *     receives signed records from /api/ens/ccip-read/{sender}/{data}.json
 *   - records are minted via POST /api/identity/persona/[id]/ens
 */

import { readFileSync } from 'fs';
import { resolve as resolvePath } from 'path';
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import solc from 'solc';

const CONTRACT_SOURCE = readFileSync(
  resolvePath(process.cwd(), 'contracts/PolityOffchainResolver.sol'),
  'utf8',
);

const GATEWAY_URL =
  process.env.GATEWAY_URL ??
  'https://dev-beta.aigentz.me/api/ens/ccip-read/{sender}/{data}.json';

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
const ISSUER_PRIVATE_KEY = process.env.POLITY_ISSUER_PRIVATE_KEY as Hex | undefined;

function validateKey(name: string, value: string | undefined): asserts value is Hex {
  if (!value) {
    console.error(`❌ ${name} env var required.`);
    console.error(`   In your shell, run:    export ${name}=0x<64-hex-chars>`);
    console.error(`   (NOT just '${name}=...' — that's a one-shot assignment that doesn't propagate.)`);
    process.exit(1);
  }
  if (!value.startsWith('0x')) {
    console.error(`❌ ${name} must start with 0x. Got: '${value.slice(0, 10)}...'`);
    process.exit(1);
  }
  if (value.length !== 66) {
    const got = value.length;
    if (got === 42) {
      console.error(`❌ ${name} is ${got} characters (an Ethereum ADDRESS), not 66 (a private KEY).`);
      console.error(`   Get the private key from MetaMask: account menu → Account details → Show private key.`);
    } else {
      console.error(`❌ ${name} must be 66 characters total (0x + 64 hex). Got: ${got} chars.`);
    }
    process.exit(1);
  }
}

validateKey('DEPLOYER_PRIVATE_KEY', DEPLOYER_PRIVATE_KEY);
validateKey('POLITY_ISSUER_PRIVATE_KEY', ISSUER_PRIVATE_KEY);

const deployer = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
const issuer = privateKeyToAccount(ISSUER_PRIVATE_KEY);

console.log('Deployer:', deployer.address);
console.log('Issuer (signer):', issuer.address);
console.log('Gateway URL:', GATEWAY_URL);

const input = {
  language: 'Solidity',
  sources: {
    'PolityOffchainResolver.sol': { content: CONTRACT_SOURCE },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
  },
};

const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
if (compiled.errors) {
  const fatal = compiled.errors.filter((e: { severity: string }) => e.severity === 'error');
  if (fatal.length > 0) {
    console.error('Compilation errors:');
    fatal.forEach((e: { formattedMessage: string }) => console.error(e.formattedMessage));
    process.exit(1);
  }
}

const contract = compiled.contracts['PolityOffchainResolver.sol'].PolityOffchainResolver;
const abi = contract.abi;
const bytecode = (`0x${contract.evm.bytecode.object}`) as Hex;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL ?? 'https://sepolia.drpc.org'),
});
const wallet = createWalletClient({
  account: deployer,
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL ?? 'https://sepolia.drpc.org'),
});

async function main() {
  console.log('\nDeploying contract to Sepolia...');
  const hash = await wallet.deployContract({
    abi,
    bytecode,
    args: [GATEWAY_URL, issuer.address],
  });
  console.log('Deploy tx hash:', hash);
  console.log('Waiting for confirmation...');
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error('No contractAddress in receipt');
  console.log('\n✅ Resolver deployed at:', receipt.contractAddress);
  console.log('   Sepolia explorer: https://sepolia.etherscan.io/address/' + receipt.contractAddress);

  console.log('\n────────────────────────────────────────');
  console.log('NEXT STEP — set this resolver on polity.eth:');
  console.log('────────────────────────────────────────');
  console.log('1. Open https://sepolia.app.ens.domains/polity.eth');
  console.log('2. Click "Records" → scroll to "Resolver" → click Edit');
  console.log(`3. Set resolver address to: ${receipt.contractAddress}`);
  console.log('4. Sign the Sepolia tx (~0.001 ETH gas)');
  console.log('5. Done. first-citizen.polity.eth will now resolve via our gateway.');
  console.log('────────────────────────────────────────\n');
  console.log('Test the resolution from any ENS-aware tool, e.g.:');
  console.log(`   viem.getEnsAddress({ name: 'first-citizen.polity.eth', chain: sepolia })`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
