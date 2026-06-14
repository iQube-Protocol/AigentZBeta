#!/usr/bin/env node
/**
 * Set the resolver on polity.eth (Sepolia) to point at our deployed
 * PolityOffchainResolver. Bypasses the ENS Manager UI entirely.
 *
 * Usage:
 *   node scripts/set-resolver.mjs 0xb906eff8d87436ff03d2a8ec08a1674066d3c0a8
 *
 * Or pass nothing and it prompts for the resolver address.
 *
 * Reads DEPLOYER_PRIVATE_KEY from ~/.polity-ccip-read.env (saved by
 * scripts/deploy.mjs). The deployer must be the OWNER of polity.eth
 * on Sepolia — which is the same wallet that registered it.
 *
 * Calls ENS Registry's setResolver(node, resolver) on Sepolia at
 * 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e (same address as mainnet,
 * deployed via CREATE2).
 */

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { createPublicClient, createWalletClient, http, namehash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const ENV_FILE = join(homedir(), '.polity-ccip-read.env');
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
const ENS_NAME = process.env.ENS_PARENT_NAME ?? 'polity.eth';
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL ?? 'https://sepolia.drpc.org';

const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'setResolver',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'resolver', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolver',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
];

function loadEnvFile() {
  if (!existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function normalizePrivateKey(v) {
  if (typeof v !== 'string') return v;
  const trimmed = v.trim();
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return `0x${trimmed}`;
  return trimmed;
}

function isValidPrivateKey(v) {
  return typeof v === 'string' && /^0x[a-fA-F0-9]{64}$/.test(v);
}

async function promptHidden(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const stdin = process.openStdin();
  process.stdout.write(question);
  return new Promise((resolve) => {
    let answer = '';
    const onData = (char) => {
      const ch = char.toString();
      if (ch === '\n' || ch === '\r' || ch === '') {
        stdin.removeListener('data', onData);
        stdin.setRawMode(false);
        stdin.pause();
        process.stdout.write('\n');
        rl.close();
        resolve(answer);
        return;
      }
      if (ch === '') process.exit(1);
      if (ch === '' || ch === '\b') {
        if (answer.length > 0) answer = answer.slice(0, -1);
      } else {
        answer += ch;
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

const saved = loadEnvFile();
let DEPLOYER_PRIVATE_KEY = normalizePrivateKey(
  process.env.DEPLOYER_PRIVATE_KEY || saved.DEPLOYER_PRIVATE_KEY,
);

if (!isValidPrivateKey(DEPLOYER_PRIVATE_KEY)) {
  console.log(`No saved deployer key found at ${ENV_FILE}.`);
  console.log(`Paste your Sepolia wallet private key (the one that owns polity.eth).`);
  console.log(`Hidden input — your key will not echo. 64 hex chars, with or without 0x prefix.`);
  const raw = await promptHidden('   Private key: ');
  DEPLOYER_PRIVATE_KEY = normalizePrivateKey(raw);
  if (!isValidPrivateKey(DEPLOYER_PRIVATE_KEY)) {
    console.error(`❌ Invalid. Got ${raw.length} chars. Expected 64 hex.`);
    process.exit(1);
  }
}

let resolverAddress = process.argv[2];
if (!resolverAddress) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  resolverAddress = (await rl.question('Resolver address (from deploy output, 0x...): ')).trim();
  rl.close();
}
if (!resolverAddress.startsWith('0x') || resolverAddress.length !== 42) {
  console.error(`❌ Resolver address must be 0x + 40 hex chars. Got: '${resolverAddress}'`);
  process.exit(1);
}

const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
const node = namehash(ENS_NAME);

const publicClient = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(SEPOLIA_RPC) });

console.log(`\n🔧 Setting resolver for ${ENS_NAME} on Sepolia`);
console.log(`   ENS Registry:  ${ENS_REGISTRY}`);
console.log(`   namehash:      ${node}`);
console.log(`   New resolver:  ${resolverAddress}`);
console.log(`   Caller:        ${account.address}\n`);

// 1. Verify caller owns the name
const owner = await publicClient.readContract({
  address: ENS_REGISTRY,
  abi: REGISTRY_ABI,
  functionName: 'owner',
  args: [node],
});
console.log(`Current owner of ${ENS_NAME}: ${owner}`);
if (owner.toLowerCase() !== account.address.toLowerCase()) {
  console.error(`❌ Caller ${account.address} is not the owner of ${ENS_NAME}.`);
  console.error(`   The owner is ${owner}. Use that wallet's private key instead.`);
  process.exit(1);
}
console.log(`✅ Caller owns the name.`);

// 2. Show current resolver (informational)
const currentResolver = await publicClient.readContract({
  address: ENS_REGISTRY,
  abi: REGISTRY_ABI,
  functionName: 'resolver',
  args: [node],
});
console.log(`Current resolver: ${currentResolver}`);
if (currentResolver.toLowerCase() === resolverAddress.toLowerCase()) {
  console.log(`\n✅ Resolver is already set to ${resolverAddress}. Nothing to do.\n`);
  process.exit(0);
}

// 3. Send the setResolver tx
console.log(`\n📡 Sending setResolver transaction...`);
const hash = await wallet.writeContract({
  address: ENS_REGISTRY,
  abi: REGISTRY_ABI,
  functionName: 'setResolver',
  args: [node, resolverAddress],
});
console.log(`Tx hash: ${hash}`);
console.log(`Sepolia explorer: https://sepolia.etherscan.io/tx/${hash}`);
console.log(`\nWaiting for confirmation...`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status === 'success') {
  console.log(`\n✅ Resolver set successfully on ${ENS_NAME}.\n`);
  console.log(`Block: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed}\n`);
  console.log(`Verify:`);
  console.log(`   https://sepolia.app.ens.domains/${ENS_NAME}`);
  console.log(`\nThen test resolution:`);
  console.log(`   npx tsx scripts/test-ens-resolution.ts first-citizen.${ENS_NAME}\n`);
} else {
  console.error(`❌ Tx reverted. See explorer link above for details.`);
  process.exit(1);
}
