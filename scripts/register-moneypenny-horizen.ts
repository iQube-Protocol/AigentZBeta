/**
 * Register Aigent MoneyPenny in Horizen's ERC-8004 IdentityRegistry on Base
 * Sepolia -- Pilot Slice 1A (2026-07-30, operator-ruled): "MoneyPenny is
 * registered outward through Horizen's documented MCP write flow."
 *
 * WHY A LIVE MCP DISCOVERY, NOT A HARDCODED CALL SHAPE. The operator's brief
 * names the tool IDs (`build_registration_tx`, `submit_registry_tx`,
 * `get_onboarding_status`) and the on-chain method (`IdentityRegistry.
 * register(string agentURI)`), but this repo has never called Horizen's MCP
 * endpoint and does not have its tools' exact input schemas on file. Per
 * CLAUDE.md's "No Guessing" rule, this script does NOT fabricate parameter
 * names. It connects with the real `@modelcontextprotocol/sdk` client,
 * calls `tools/list`, and prints each tool's server-declared JSON Schema
 * before ever calling it. Arguments are inferred from that schema by best-
 * effort name matching, PRINTED IN FULL, and require an explicit typed "yes"
 * before any write call -- propose-and-confirm, never guess-and-broadcast.
 *
 * WHAT THIS SCRIPT NEVER DOES: it never reads, prints, or persists
 * MONEYPENNY_OWNER_WALLET_PRIVATE_KEY. It is read from the environment once,
 * used in-memory by ethers.Wallet to sign a transaction locally, and never
 * logged, written to a file, or included in any tool-call argument (only the
 * resulting SIGNED TRANSACTION HEX -- not the key -- goes to Horizen).
 *
 * Cross-checks before signing: the unsigned transaction's `to` and `chainId`
 * (if present) are verified against this repo's own recorded facts
 * (services/horizen/identity.ts HORIZEN_NETWORK_FACTS['base-sepolia']) --
 * `0x8004A818BFB912233c491871b3d84c89A494BD9e` / chainId 84532 -- refusing on
 * any mismatch rather than trusting the MCP response blindly.
 *
 * Requires real network egress to agent-registry.horizenlabs.io and (for gas/
 * nonce population) sepolia.base.org -- run from the operator's machine, not
 * a network-restricted sandbox.
 *
 * Usage:
 *   npx tsx scripts/register-moneypenny-horizen.ts \
 *     --agent-card-base=https://dev-beta.aigentz.me
 *
 *   # after reviewing the printed unsigned tx and tool schemas:
 *   MONEYPENNY_OWNER_WALLET_PRIVATE_KEY=0x... \
 *     npx tsx scripts/register-moneypenny-horizen.ts \
 *       --agent-card-base=https://dev-beta.aigentz.me --execute
 *
 * Env:
 *   MONEYPENNY_OWNER_WALLET_PRIVATE_KEY  required for --execute only. Never
 *     printed. This wallet becomes the on-chain owner of MoneyPenny's
 *     ERC-8004 registration.
 *   NEXT_PUBLIC_RPC_BASE_SEPOLIA  optional; defaults to
 *     https://sepolia.base.org (this repo's established default -- see
 *     types/chains.ts, services/wallet/metamask.ts, scripts/deploy-qct-base.js).
 */

import { createHash } from 'node:crypto';
import * as readline from 'node:readline';
import { ethers } from 'ethers';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { HORIZEN_NETWORK_FACTS } from '../services/horizen/identity';
import { HORIZEN_REGISTRY_MCP } from '../services/horizen/client';

const DEFAULT_AGENT_CARD_BASE = 'https://dev-beta.aigentz.me';
const DEFAULT_RPC = process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org';
const NETWORK: 'base-sepolia' = 'base-sepolia';
const FACTS = HORIZEN_NETWORK_FACTS[NETWORK];

function parseArgs() {
  const args = process.argv.slice(2);
  const flag = (name: string, fallback?: string) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
  };
  return {
    agentCardBase: flag('agent-card-base', DEFAULT_AGENT_CARD_BASE)!,
    execute: args.includes('--execute'),
  };
}

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Best-effort schema-to-argument matcher. Prints its reasoning; never silent. */
function matchSchemaFields(schema: any, candidates: Record<string, unknown>): Record<string, unknown> {
  const props: Record<string, unknown> = schema?.properties ?? {};
  const propNames = Object.keys(props);
  const matched: Record<string, unknown> = {};
  for (const propName of propNames) {
    const lower = propName.toLowerCase();
    for (const [candidateKey, candidateValue] of Object.entries(candidates)) {
      if (lower === candidateKey.toLowerCase() || lower.includes(candidateKey.toLowerCase())) {
        matched[propName] = candidateValue;
        break;
      }
    }
  }
  return matched;
}

async function fetchAgentCard(base: string): Promise<{ card: any; url: string; raw: string }> {
  const url = `${base.replace(/\/$/, '')}/api/agents/moneypenny/agent-card.json`;
  console.log(`Fetching MoneyPenny's Agent Card from ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Agent Card fetch failed: HTTP ${res.status} from ${url}`);
  }
  const raw = await res.text();
  return { card: JSON.parse(raw), url, raw };
}

function validateAgentCard(card: any): string[] {
  const problems: string[] = [];
  if (card?.name !== 'Aigent MoneyPenny') problems.push(`name mismatch: expected "Aigent MoneyPenny", got ${JSON.stringify(card?.name)}`);
  if (card?.metadata?.runtime_agent_id !== 'aigent-moneypenny') problems.push(`metadata.runtime_agent_id mismatch: got ${JSON.stringify(card?.metadata?.runtime_agent_id)}`);
  if (card?.metadata?.horizen?.network !== NETWORK) problems.push(`metadata.horizen.network mismatch: expected "${NETWORK}", got ${JSON.stringify(card?.metadata?.horizen?.network)}`);
  if (card?.metadata?.horizen?.identityRegistry !== FACTS.identityRegistry) {
    problems.push(`metadata.horizen.identityRegistry drift: card says ${JSON.stringify(card?.metadata?.horizen?.identityRegistry)}, repo's HORIZEN_NETWORK_FACTS says ${FACTS.identityRegistry}`);
  }
  if (card?.metadata?.horizen?.tokenId != null) {
    problems.push(`metadata.horizen.tokenId is already set (${JSON.stringify(card.metadata.horizen.tokenId)}) -- card believes MoneyPenny is ALREADY registered. Refusing to re-register.`);
  }
  if (!card?.url) problems.push('card.url (the agentURI to register) is missing');
  return problems;
}

async function main() {
  const { agentCardBase, execute } = parseArgs();

  console.log(`Network: ${NETWORK} (chainId ${FACTS.chainId})`);
  console.log(`IdentityRegistry (this repo's recorded fact): ${FACTS.identityRegistry}`);
  console.log(`Horizen MCP endpoint: ${HORIZEN_REGISTRY_MCP}\n`);

  // ── Step 0: resolve + validate MoneyPenny's Agent Card ──────────────────
  const { card, url: cardUrl, raw: cardRaw } = await fetchAgentCard(agentCardBase);
  const cardHash = sha256Hex(cardRaw);
  console.log(`Resolved Agent Card: ${cardUrl}`);
  console.log(`Agent Card sha256: ${cardHash}\n`);

  const problems = validateAgentCard(card);
  if (problems.length > 0) {
    console.error('Refusing: MoneyPenny\'s Agent Card failed pre-registration validation:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log('Agent Card validation: OK (name, runtime_agent_id, network, identityRegistry all match; not already registered)\n');

  // ── Step 1: connect to Horizen's public MCP endpoint ─────────────────────
  const client = new Client({ name: 'metame-moneypenny-registrar', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(HORIZEN_REGISTRY_MCP));
  await client.connect(transport);
  console.log('Connected to Horizen MCP.\n');

  const { tools } = await client.listTools();
  const toolNames = ['build_registration_tx', 'submit_registry_tx', 'get_onboarding_status'];
  const byName: Record<string, any> = {};
  for (const name of toolNames) {
    const found = tools.find((t: any) => t.name === name);
    if (!found) {
      console.error(`Refusing: Horizen's MCP server does not currently declare a "${name}" tool. Cannot proceed without guessing its shape. Declared tools: ${tools.map((t: any) => t.name).join(', ')}`);
      process.exitCode = 1;
      return;
    }
    byName[name] = found;
    console.log(`Tool "${name}" input schema:\n${JSON.stringify(found.inputSchema, null, 2)}\n`);
  }

  // ── Step 2: build_registration_tx ───────────────────────────────────────
  const buildArgs = matchSchemaFields(byName.build_registration_tx.inputSchema, {
    agentURI: cardUrl,
    agentUri: cardUrl,
    uri: cardUrl,
    metadataURI: cardUrl,
    network: 'base-sepolia',
    chain: 'base-sepolia',
  });
  console.log('Proposed build_registration_tx arguments (matched from the declared schema above):');
  console.log(JSON.stringify(buildArgs, null, 2));
  if (!(await confirm('\nType "yes" to call build_registration_tx with exactly these arguments, anything else to abort: '))) {
    console.log('Aborted -- no call made.');
    return;
  }

  const buildResult = await client.callTool({ name: 'build_registration_tx', arguments: buildArgs });
  console.log('\nbuild_registration_tx result:');
  console.log(JSON.stringify(buildResult, null, 2));

  const unsignedTx = extractUnsignedTx(buildResult);
  if (!unsignedTx) {
    console.error('\nRefusing: could not locate an unsigned transaction object in the tool result. Inspect the raw result above and adjust manually -- this script will not guess a transaction shape.');
    process.exitCode = 1;
    return;
  }

  // ── Cross-check against this repo's recorded facts before ever signing ──
  if (unsignedTx.to && unsignedTx.to.toLowerCase() !== FACTS.identityRegistry.toLowerCase()) {
    console.error(`Refusing: unsigned tx "to" (${unsignedTx.to}) does not match this repo's recorded IdentityRegistry (${FACTS.identityRegistry}).`);
    process.exitCode = 1;
    return;
  }
  if (unsignedTx.chainId != null && Number(unsignedTx.chainId) !== FACTS.chainId) {
    console.error(`Refusing: unsigned tx chainId (${unsignedTx.chainId}) does not match Base Sepolia (${FACTS.chainId}).`);
    process.exitCode = 1;
    return;
  }
  console.log('\nUnsigned tx cross-check: OK (to == recorded IdentityRegistry, chainId == Base Sepolia or unset)\n');

  if (!execute) {
    console.log('Dry run complete (no --execute). Nothing signed, nothing submitted.');
    console.log('Next, with --execute and MONEYPENNY_OWNER_WALLET_PRIVATE_KEY set: sign locally, submit_registry_tx, poll get_onboarding_status, reread the registry.');
    return;
  }

  // ── Step 3: sign locally -- the private key never leaves this process ──
  const pk = process.env.MONEYPENNY_OWNER_WALLET_PRIVATE_KEY;
  if (!pk) {
    console.error('Refusing: MONEYPENNY_OWNER_WALLET_PRIVATE_KEY is not set.');
    process.exitCode = 1;
    return;
  }
  const provider = new ethers.JsonRpcProvider(DEFAULT_RPC);
  const wallet = new ethers.Wallet(pk, provider);
  console.log(`Owner wallet address (derived, key never printed): ${wallet.address}`);

  const populated = await wallet.populateTransaction({
    to: unsignedTx.to,
    data: unsignedTx.data,
    value: unsignedTx.value ?? 0,
    chainId: FACTS.chainId,
  });
  console.log('\nPopulated transaction (nonce/gas filled from live RPC where the MCP response omitted them):');
  console.log(JSON.stringify(populated, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));

  if (!(await confirm('\nType "yes" to sign this transaction with the owner wallet, anything else to abort: '))) {
    console.log('Aborted -- nothing signed.');
    return;
  }
  const signedTx = await wallet.signTransaction(populated);
  console.log('Signed locally. Raw signed tx will now be submitted via Horizen\'s submit_registry_tx -- the private key was never sent anywhere.\n');

  // ── Step 4: submit_registry_tx ───────────────────────────────────────────
  const submitArgs = matchSchemaFields(byName.submit_registry_tx.inputSchema, {
    signedTransaction: signedTx,
    signedTx,
    rawTransaction: signedTx,
    rawTx: signedTx,
    tx: signedTx,
    network: 'base-sepolia',
    chain: 'base-sepolia',
  });
  console.log('Proposed submit_registry_tx arguments (signed tx hex omitted from this printout; full length ' + signedTx.length + ' chars):');
  console.log(JSON.stringify({ ...submitArgs, ...Object.fromEntries(Object.keys(submitArgs).map((k) => [k, typeof submitArgs[k] === 'string' && submitArgs[k] === signedTx ? '<signed tx hex>' : submitArgs[k]])) }, null, 2));
  if (!(await confirm('\nType "yes" to submit this signed transaction to Horizen, anything else to abort: '))) {
    console.log('Aborted -- nothing submitted.');
    return;
  }

  const submitResult = await client.callTool({ name: 'submit_registry_tx', arguments: submitArgs });
  console.log('\nsubmit_registry_tx result:');
  console.log(JSON.stringify(submitResult, null, 2));

  const txHash = extractTxHash(submitResult);
  if (!txHash) {
    console.error('Could not locate a transaction hash in the submit result -- inspect the raw result above.');
    process.exitCode = 1;
    return;
  }
  console.log(`\nTransaction hash: ${txHash}`);
  console.log(`Explorer: https://sepolia.basescan.org/tx/${txHash}`);

  // ── Step 5: poll get_onboarding_status ───────────────────────────────────
  const statusArgs = matchSchemaFields(byName.get_onboarding_status.inputSchema, {
    transactionHash: txHash,
    txHash,
    hash: txHash,
    network: 'base-sepolia',
    chain: 'base-sepolia',
  });
  console.log('\nPolling get_onboarding_status every 15s (up to 10 attempts)...');
  let finalStatus: any = null;
  for (let attempt = 1; attempt <= 10; attempt++) {
    const statusResult = await client.callTool({ name: 'get_onboarding_status', arguments: statusArgs });
    console.log(`Attempt ${attempt}: ${JSON.stringify(statusResult)}`);
    const text = JSON.stringify(statusResult).toLowerCase();
    if (text.includes('"active"') || text.includes('"confirmed"') || text.includes('"complete"')) {
      finalStatus = statusResult;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
  if (!finalStatus) {
    console.error('\nOnboarding status did not reach a recognisable terminal state within the poll window. Re-run manually with get_onboarding_status once more time has passed -- do not assume success.');
    process.exitCode = 1;
    return;
  }

  // ── Step 6: reread the registry using this repo's existing read client ──
  const { fetchRegistryAgent } = await import('../services/horizen/client');
  const reread = await fetchRegistryAgent(wallet.address, NETWORK);
  console.log('\nRegistry reread (via services/horizen/client.ts fetchRegistryAgent -- the existing read client, not a new parallel one):');
  console.log(JSON.stringify(reread, null, 2));

  console.log('\n=== Summary ===');
  console.log('network:', NETWORK);
  console.log('registry contract:', FACTS.identityRegistry);
  console.log('transaction hash:', txHash);
  console.log('owner wallet:', wallet.address);
  console.log('Agent Card URI:', cardUrl);
  console.log('Agent Card sha256:', cardHash);
  console.log('onboarding status:', JSON.stringify(finalStatus));
  console.log('registry reread ok:', reread.ok);
  console.log(
    '\nNext (not run by this script): persist a metaMe binding record + DVN receipt for this OUTBOUND ' +
    'registration once the above fields are confirmed real. That requires a small new route mirroring ' +
    'services/horizen/operatorClaim.ts\'s pattern for the inbound direction -- ask for it once you have ' +
    'these real values in hand.',
  );

  await client.close();
}

function extractUnsignedTx(toolResult: any): { to?: string; data?: string; value?: string | number; chainId?: string | number } | null {
  const content = toolResult?.content;
  if (!Array.isArray(content)) return null;
  for (const item of content) {
    if (item?.type === 'text') {
      try {
        const parsed = JSON.parse(item.text);
        if (parsed?.to && parsed?.data) return parsed;
        if (parsed?.transaction?.to && parsed?.transaction?.data) return parsed.transaction;
        if (parsed?.unsignedTransaction) return parsed.unsignedTransaction;
      } catch {
        // not JSON -- keep looking
      }
    }
  }
  return null;
}

function extractTxHash(toolResult: any): string | null {
  const content = toolResult?.content;
  if (!Array.isArray(content)) return null;
  for (const item of content) {
    if (item?.type === 'text') {
      try {
        const parsed = JSON.parse(item.text);
        const candidate = parsed?.transactionHash ?? parsed?.txHash ?? parsed?.hash;
        if (typeof candidate === 'string' && candidate.startsWith('0x')) return candidate;
      } catch {
        const match = /0x[a-fA-F0-9]{64}/.exec(item.text);
        if (match) return match[0];
      }
    }
  }
  return null;
}

const isEntrypoint = (() => {
  try {
    return import.meta.url === new URL(process.argv[1] ?? '', 'file://').href;
  } catch {
    return false;
  }
})();

if (isEntrypoint) {
  main().catch((err) => {
    console.error('Failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}

export { matchSchemaFields, validateAgentCard, extractUnsignedTx, extractTxHash, sha256Hex };
