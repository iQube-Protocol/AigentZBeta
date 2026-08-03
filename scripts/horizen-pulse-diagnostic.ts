/**
 * ONE definitive transcript of a Horizen Pulse authorization attempt.
 *
 * Operator direction, 2026-08-03: *"Instead of repeatedly changing the parser,
 * have it produce a complete transcript (redacted where appropriate) of one
 * failed interaction… That gives you one definitive artifact rather than
 * another round of guessing."*
 *
 * This CALLS NOTHING THAT MUTATES. It lists tools, calls the build tool, and
 * prints what came back. It signs nothing, submits nothing, and writes no
 * receipt — running it cannot advance or damage a journey stage.
 *
 * ── The contract it validates against (Horizen partner Q&A) ──────────────
 *
 * Pulse is a Horizen capability layered ON TOP of ERC-8004 registration, not
 * part of it. Its authorization message is byte-exact plaintext:
 *
 *   ASR Pulse enable
 *   Agent: 7866                  <- DECIMAL (hex in the registry, decimal here)
 *   Network: sepolia
 *   Chain: 84532
 *   Registry: 0x8004a818…        <- lowercased
 *   Wallet: 0x…                  <- lowercased, MUST equal ownerOf(agentId)
 *   Issued At: <ISO-8601>        <- five-minute validity
 *
 * And not every row in Horizen's registry is an ERC-8004 token: `source` must
 * be `on-chain`, and ids at or above 10,000,000 can be service-onboarded
 * identities with no NFT — hence no `ownerOf`, hence no Pulse authorization.
 *
 * Usage:
 *   npx tsx scripts/horizen-pulse-diagnostic.ts --agent=nakamoto
 *   npx tsx scripts/horizen-pulse-diagnostic.ts --agent=nakamoto --tokenId=8798
 */

import { HORIZEN_NETWORK_FACTS, parseAgentId, classifyIdentity, type HorizenNetwork } from '../services/horizen/identity';
import { resolveRegistrableAgent } from '../services/horizen/registrableAgents';

const NETWORK: HorizenNetwork = 'base-sepolia';
/** Error bodies ARE the diagnostic and are printed whole. Success payloads are not. */
const SUCCESS_PAYLOAD_PREVIEW = 400;

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function line(label: string, value: unknown): void {
  console.log(`${label.padEnd(22)}${String(value)}`);
}

async function main(): Promise<void> {
  const slug = arg('agent') ?? 'nakamoto';
  const agent = resolveRegistrableAgent(slug);
  if (!agent) throw new Error(`"${slug}" is not a registrable agent`);
  const facts = HORIZEN_NETWORK_FACTS[NETWORK];

  console.log('\n═══ Horizen Pulse Diagnostic ═══\n');
  line('Agent', `${agent.displayName} (${agent.runtimeAgentId})`);
  line('Network', NETWORK);

  // ── 1. The identifier, normalised the way the contract requires ──────────
  const rawTokenId = arg('tokenId');
  if (!rawTokenId) {
    console.log('\nNo --tokenId given. Pass the tokenId this agent holds, e.g. --tokenId=8798.');
    console.log('(Not read from the database here: this script is deliberately side-effect free.)\n');
    return;
  }
  const parsed = parseAgentId(rawTokenId);
  if (!parsed.ok) {
    console.log(`\nREFUSED: "${rawTokenId}" is not a usable agent id (${parsed.reason}): ${parsed.detail}\n`);
    return;
  }
  const decimalAgentId = parsed.value.toString(10);
  console.log('\n── Identifier ──');
  line('Given', rawTokenId);
  line('Decimal (for Pulse)', decimalAgentId);
  line('Hex (registry form)', `0x${parsed.value.toString(16)}`);
  line('Service-onboarded?', parsed.value >= 10_000_000n ? 'YES — likely no ERC-8004 token, Pulse cannot apply' : 'no');

  // ── 2. Is this row actually an on-chain ERC-8004 identity? ───────────────
  console.log('\n── Registry record ──');
  let ownerFromRegistry: string | null = null;
  try {
    const { fetchRegistryAgent } = await import('../services/horizen/client');
    const read = await fetchRegistryAgent(decimalAgentId, NETWORK);
    const record = (read as { ok?: boolean; value?: Record<string, unknown> }).value ?? null;
    if (!record) {
      line('Lookup', 'no record returned');
    } else {
      const source = typeof record.source === 'string' ? record.source : null;
      ownerFromRegistry = typeof record.owner === 'string' ? record.owner : null;
      line('source', source ?? '(absent)');
      line('classification', classifyIdentity(source, parsed.value));
      line('owner', ownerFromRegistry ?? '(absent)');
      if (source !== 'on-chain') {
        console.log('\n  ⚠ source is not "on-chain" — Pulse owner authorization has no ERC-8004');
        console.log('    ownership anchor for this row and should refuse rather than attempt.');
      }
    }
  } catch (err) {
    line('Lookup FAILED', err instanceof Error ? err.message : String(err));
  }

  // ── 3. The arguments the contract specifies ──────────────────────────────
  const walletArg = arg('wallet');
  const wallet = (walletArg ?? ownerFromRegistry ?? '').toLowerCase();
  console.log('\n── Request arguments (per the documented contract) ──');
  line('agentId', `${decimalAgentId}  (decimal)`);
  line('network', facts.pulseSelector);
  line('chain', facts.chainId);
  line('registry', facts.identityRegistry.toLowerCase());
  line('wallet', wallet || '(unresolved — pass --wallet= or fix the registry read)');
  if (!wallet) {
    console.log('\n  Wallet unresolved. The contract requires it to equal ownerOf(agentId);');
    console.log('  guessing it is exactly what this diagnostic exists to stop.\n');
    return;
  }

  // ── 4. The call, and everything that came back ───────────────────────────
  console.log('\n── MCP call ──');
  const { HORIZEN_REGISTRY_MCP } = await import('../services/horizen/client');
  line('Endpoint', HORIZEN_REGISTRY_MCP);

  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const client = new Client({ name: 'metame-horizen-diagnostic', version: '0.1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(HORIZEN_REGISTRY_MCP)));

  const { tools } = await client.listTools();
  line('Tools declared', tools.length);
  const build = tools.find((t) => t.name === 'build_pulse_auth_message');
  if (!build) {
    console.log(`\nNo build_pulse_auth_message. Declared: ${tools.map((t) => t.name).join(', ')}\n`);
    return;
  }
  line('Tool', build.name);
  console.log('Input schema:');
  console.log(JSON.stringify(build.inputSchema, null, 2));

  const args = { agentId: decimalAgentId, network: facts.pulseSelector, chain: facts.chainId, wallet };
  console.log('\nArguments sent:');
  console.log(JSON.stringify(args, null, 2));

  const result = (await client.callTool({ name: build.name, arguments: args })) as {
    isError?: boolean;
    content?: { type: string; text?: string }[];
  };

  console.log('\n── Response ──');
  line('isError', result.isError === true);
  const content = Array.isArray(result.content) ? result.content : [];
  line('Content blocks', content.length);

  content.forEach((block, i) => {
    console.log(`\nBlock ${i + 1}\n${'-'.repeat(8)}`);
    line('Type', block.type);
    if (typeof block.text !== 'string') return;
    line('Length', `${block.text.length} chars`);
    let isJson = false;
    try {
      JSON.parse(block.text);
      isJson = true;
    } catch {
      /* not JSON */
    }
    line('Parsed JSON', isJson ? 'Yes' : 'No');
    console.log('Content:');
    // An error body is the diagnostic and is printed whole. A SUCCESS payload
    // is truncated — it may carry material that should not land in a log.
    console.log(
      result.isError === true || block.text.length <= SUCCESS_PAYLOAD_PREVIEW
        ? block.text
        : `${block.text.slice(0, SUCCESS_PAYLOAD_PREVIEW)}… (truncated, ${block.text.length} chars)`,
    );
  });

  console.log('\n═══ end ═══\n');
}

main().catch((err) => {
  console.error('\nDiagnostic failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
