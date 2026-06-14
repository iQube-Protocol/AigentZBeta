#!/usr/bin/env node
/**
 * One-shot interactive CCIP-Read resolver deployer.
 *
 * Run:    node scripts/deploy.mjs
 *
 * On first run, prompts for:
 *   - DEPLOYER_PRIVATE_KEY  (your MetaMask Sepolia wallet private key)
 *   - POLITY_ISSUER_PRIVATE_KEY  (auto-generates if you say "yes" to "Generate one?")
 *
 * Saves both to ~/.polity-ccip-read.env (mode 600, user-only) so subsequent
 * runs skip the prompts. Validates length BEFORE spending gas.
 *
 * After successful deploy, prints exact instructions for setting the
 * resolver on polity.eth via sepolia.app.ens.domains.
 */

import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

const ENV_FILE = join(homedir(), '.polity-ccip-read.env');
const GATEWAY_URL =
  process.env.GATEWAY_URL ??
  'https://dev-beta.aigentz.me/api/ens/ccip-read/{sender}/{data}.json';

// ── Helpers ─────────────────────────────────────────────────────────────
function loadEnvFile() {
  if (!existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function saveEnvFile(vars) {
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  writeFileSync(ENV_FILE, body + '\n');
  chmodSync(ENV_FILE, 0o600);
}

function isValidPrivateKey(v) {
  return typeof v === 'string' && /^0x[a-fA-F0-9]{64}$/.test(v);
}

function normalizePrivateKey(v) {
  if (typeof v !== 'string') return v;
  const trimmed = v.trim();
  // MetaMask exports keys as 64-hex without 0x prefix — auto-prepend so the
  // operator doesn't have to remember to type 0x before paste.
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return `0x${trimmed}`;
  return trimmed;
}

async function prompt(question, { hidden = false } = {}) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Hide echoed characters
    const stdin = process.openStdin();
    process.stdout.write(question);
    return new Promise((resolve) => {
      let answer = '';
      const onData = (char) => {
        const ch = char.toString();
        if (ch === '\n' || ch === '\r' || ch === '') {
          stdin.removeListener('data', onData);
          stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write('\n');
          rl.close();
          resolve(answer);
          return;
        }
        if (ch === '') process.exit(1);
        if (ch === '' || ch === '\b') {
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
  const ans = await rl.question(question);
  rl.close();
  return ans.trim();
}

// ── Main ────────────────────────────────────────────────────────────────
console.log('\n🛠  Polity CCIP-Read resolver deploy\n');

const saved = loadEnvFile();
const env = {
  DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY || saved.DEPLOYER_PRIVATE_KEY,
  POLITY_ISSUER_PRIVATE_KEY:
    process.env.POLITY_ISSUER_PRIVATE_KEY || saved.POLITY_ISSUER_PRIVATE_KEY,
};

// 1. Polity issuer key
if (!isValidPrivateKey(env.POLITY_ISSUER_PRIVATE_KEY)) {
  console.log('POLITY_ISSUER_PRIVATE_KEY: not set or malformed.');
  const choice = await prompt(
    '   Generate a new one? [Y/n] (or paste an existing 0x… private key): ',
  );
  if (!choice || choice.toLowerCase().startsWith('y')) {
    env.POLITY_ISSUER_PRIVATE_KEY = generatePrivateKey();
    console.log(`   ✅ Generated. Public address: ${privateKeyToAccount(env.POLITY_ISSUER_PRIVATE_KEY).address}`);
    console.log(`   ⚠️  ADD THIS TO AMPLIFY before the deploy will work end-to-end:`);
    console.log(`      POLITY_ISSUER_PRIVATE_KEY=${env.POLITY_ISSUER_PRIVATE_KEY}`);
  } else if (isValidPrivateKey(normalizePrivateKey(choice))) {
    env.POLITY_ISSUER_PRIVATE_KEY = normalizePrivateKey(choice);
  } else {
    console.error(`   ❌ '${choice.slice(0, 10)}…' is not a valid 0x+64-hex private key.`);
    process.exit(1);
  }
} else {
  console.log(
    `POLITY_ISSUER_PRIVATE_KEY: ✅ loaded (issuer addr ${privateKeyToAccount(env.POLITY_ISSUER_PRIVATE_KEY).address})`,
  );
}

// 2. Deployer key
if (!isValidPrivateKey(env.DEPLOYER_PRIVATE_KEY)) {
  console.log('\nDEPLOYER_PRIVATE_KEY: not set or malformed.');
  console.log('   This is your Sepolia wallet private key (the one that owns polity.eth).');
  console.log('   Get it from MetaMask: account menu → Account details → Show private key.');
  console.log('   Must be 0x + 64 hex characters (32 bytes). An ADDRESS is 0x + 40 hex — not the same.');
  const raw = await prompt('   Paste the private key (hidden input): ', { hidden: true });
  const input = normalizePrivateKey(raw);
  if (!isValidPrivateKey(input)) {
    console.error(
      `   ❌ Invalid. Got ${raw.length} chars (expected 64 hex, with or without 0x prefix). Try again.`,
    );
    process.exit(1);
  }
  env.DEPLOYER_PRIVATE_KEY = input;
}
console.log(
  `DEPLOYER_PRIVATE_KEY: ✅ ready (deployer addr ${privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY).address})`,
);

// 3. Save for next time
saveEnvFile(env);
console.log(`\n💾 Keys saved to ${ENV_FILE} (mode 600). Re-runs will skip prompts.\n`);

// 4. Run the deploy script with both env vars set
console.log('🚀 Running scripts/deploy-polity-resolver.ts ...\n');
const child = spawn(
  'npx',
  ['tsx', 'scripts/deploy-polity-resolver.ts'],
  {
    stdio: 'inherit',
    env: { ...process.env, ...env, GATEWAY_URL },
  },
);
child.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✅ Deploy succeeded.');
    console.log('\nNext step — set the resolver address (from above) on polity.eth:');
    console.log('   1. Open https://sepolia.app.ens.domains/polity.eth');
    console.log('   2. Records tab → Resolver → Edit');
    console.log('   3. Paste the deployed resolver address');
    console.log('   4. Sign the Sepolia tx');
    console.log('\nThen test resolution:');
    console.log('   npx tsx scripts/test-ens-resolution.ts first-citizen.polity.eth\n');
  }
  process.exit(code ?? 1);
});
