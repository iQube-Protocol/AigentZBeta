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

import {
  HORIZEN_NETWORK_FACTS,
  parseAgentId,
  classifyIdentity,
  serializeForSurfaces,
  type HorizenNetwork,
} from '../services/horizen/identity';
import { resolveRegistrableAgent } from '../services/horizen/registrableAgents';
import { pulseBuildCandidates } from '../services/horizen/authorizationClient';
import { matchSchemaFields, missingRequiredFields } from '../services/horizen/mcpSchemaMatch';

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

/**
 * The chain's own answer, when the REST index cannot give one.
 *
 * `ownerOf` reverting means the token was never minted — a real answer.
 * Anything else means the call could not be made, which is not an answer at
 * all. Reported as two different things, because reading either as "not
 * registered" is what sent this hunt in the wrong direction twice.
 */
async function ownerFromChain(agentId: bigint, identityRegistry: string): Promise<string | null> {
  const { ethers } = await import('ethers');
  const { fetchOwnerOnChain } = await import('../services/horizen/agentIdRecovery');
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org';

  console.log('\n── ownerOf, on chain (authoritative) ──');
  line('RPC', rpcUrl);
  line('IdentityRegistry', identityRegistry);
  const read = await fetchOwnerOnChain({
    provider: new ethers.JsonRpcProvider(rpcUrl),
    identityRegistry,
    agentId,
  });
  if (read.ok) {
    line('ownerOf', read.owner);
    return read.owner;
  }
  line('ownerOf', `unavailable (${read.reason})`);
  line('Detail', read.detail);
  console.log(
    read.reason === 'not-minted'
      ? '\n  This IS an answer: no such token on this registry. Pulse cannot apply.'
      : '\n  This is NOT an answer: the call could not be made. Nothing follows about registration.',
  );
  return null;
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
  const surfaces = serializeForSurfaces(parsed.value, NETWORK);
  const decimalAgentId = surfaces.pulseAgentId;
  console.log('\n── Identifier, per surface (§2.4.1) ──');
  line('Given', rawTokenId);
  line('registryAgentId', `${surfaces.registryAgentId}   (Registry REST path — HEX)`);
  line('registryNetwork', surfaces.registryNetwork);
  line('pulseAgentId', `${surfaces.pulseAgentId}   (Pulse / PnL — DECIMAL)`);
  line('pulseChain', surfaces.pulseChain);
  line('Service-onboarded?', parsed.value >= 10_000_000n ? 'YES — likely no ERC-8004 token, Pulse cannot apply' : 'no');

  // ── 2. Is this row actually an on-chain ERC-8004 identity? ───────────────
  console.log('\n── Registry record ──');
  let ownerFromRegistry: string | null = null;
  try {
    const { fetchRegistryAgent } = await import('../services/horizen/client');
    const read = (await fetchRegistryAgent(decimalAgentId, NETWORK)) as {
      ok?: boolean;
      reason?: string;
      value?: Record<string, unknown>;
    };
    const record = read.value ?? null;
    if (!record) {
      /*
       * "no record returned" WAS ITSELF A DISCARDED ANSWER (2026-08-03).
       *
       * This branch collapsed three different facts into one sentence: the
       * registry answered and has no such agent; the read failed and said why;
       * the read succeeded with an unexpected shape. The first would mean
       * Pulse can never work for this id. The second means we learned nothing.
       * Printing them identically is the same defect as `res.json()` reporting
       * a parser error — a diagnostic that hides its own finding.
       */
      const { HORIZEN_REGISTRY_API } = await import('../services/horizen/client');
      line('Lookup ok', read.ok === true);
      line('Reason', read.reason ?? '(none given)');
      line('Detail', (read as { detail?: string }).detail ?? '(none)');
      line('URL', `${HORIZEN_REGISTRY_API}/agents/${surfaces.registryAgentId}?network=${surfaces.registryNetwork}`);
      line(
        'Means',
        read.ok === true
          ? 'the registry ANSWERED and holds no agent at this id'
          : 'the INDEX read did not complete — this says NOTHING about whether the agent is registered',
      );
      /*
       * AN INDEX FAILURE IS NOT NON-REGISTRATION (operator direction, 2026-08-03).
       *
       * The chain is the ledger; the REST index is a lookup service over it.
       * Falling back to `ownerOf` against the documented IdentityRegistry
       * answers the question the index could not — and distinguishes "no such
       * token" (a revert, a real answer) from "could not read" (no answer).
       */
      ownerFromRegistry = await ownerFromChain(parsed.value, facts.identityRegistry);
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
      // The index answered but withheld the owner — the chain still can.
      if (!ownerFromRegistry) ownerFromRegistry = await ownerFromChain(parsed.value, facts.identityRegistry);
    }
  } catch (err) {
    line('Lookup FAILED', err instanceof Error ? err.message : String(err));
  }

  // ── 3. Does the wallet we would sign with actually own the token? ─────────
  /*
   * THE QUESTION THAT COULD MAKE EVERYTHING ELSE MOOT. The contract requires
   * the signing wallet to equal `ownerOf(agentId)`; if registration was
   * broadcast from a different wallet, Pulse must refuse however correct the
   * call is. It had gone unasked through five rounds of parser fixes.
   */
  const walletArg = arg('wallet');
  const wallet = (walletArg ?? ownerFromRegistry ?? '').toLowerCase();
  console.log('\n── Owner vs signer ──');
  line('Token owner', ownerFromRegistry ? ownerFromRegistry.toLowerCase() : '(unestablished)');
  line('Signing wallet', wallet || '(unresolved)');
  if (ownerFromRegistry && walletArg) {
    const match = ownerFromRegistry.toLowerCase() === walletArg.toLowerCase();
    line('Match', match ? 'YES — the signer owns the token' : 'NO');
    if (!match) {
      console.log('\n  ⚠ BLOCKING: the wallet we sign with does not own this token. Pulse must refuse.');
      console.log('    Whatever else is wrong, this alone prevents authorization.');
    }
  } else if (!ownerFromRegistry) {
    console.log('\n  Ownership UNESTABLISHED — neither the index nor the chain answered.');
    console.log('  Proceeding to the Pulse call anyway, since Horizen is the authority on');
    console.log('  its own acceptance; but a success here would not prove ownership.');
  }
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
  // The whole declared surface, once. Every later question — "is there an
  // agent lookup?", "what is the submit tool really called?" — is answered
  // from this list instead of another round trip.
  console.log(`\nAll declared tools:\n  ${tools.map((t) => t.name).join('\n  ')}`);

  const build = tools.find((t) => t.name === 'build_pulse_auth_message');
  if (!build) {
    console.log('\nNo build_pulse_auth_message among the tools listed above.\n');
    return;
  }
  console.log(`\n── ${build.name} ──`);
  console.log('Input schema:');
  console.log(JSON.stringify(build.inputSchema, null, 2));

  /*
   * THE ARGUMENTS THE REAL CLIENT WOULD SEND — not a hand-rolled imitation.
   *
   * This script previously built its own `{ action, agentId, network, chain,
   * wallet }` literal. Horizen's schema requires `walletAddress`, so the run
   * failed with `walletAddress Required` and read as a defect in the client.
   * It was a defect in THIS FILE: `matchSchemaFields` matches on containment,
   * so `walletAddress` selects the `wallet` candidate and the real client
   * sends it correctly. A diagnostic that does not execute the path it claims
   * to diagnose returns confident wrong answers.
   */
  const args = matchSchemaFields(build.inputSchema, pulseBuildCandidates(facts, decimalAgentId, wallet));
  console.log('\nArguments sent (built by the client\'s own matcher):');
  console.log(JSON.stringify(args, null, 2));
  const missing = missingRequiredFields(build.inputSchema, args);
  if (missing.length > 0) {
    console.log(`\n  ⚠ The schema declares required argument(s) we supply no value for: ${missing.join(', ')}`);
    console.log('    The client refuses locally in this case rather than calling. Not calling either.\n');
    return;
  }

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
