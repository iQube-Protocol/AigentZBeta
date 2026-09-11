/**
 * Horizen integration — kickoff read-path canaries.
 *
 * Every fixture below is derived from the payloads in the "Horizen Agentic
 * Services — Partner Integration Brief" (2026-07-28) §3.2–§3.5. Nothing is
 * invented, and NOTHING here touches the network: the client takes an injected
 * `fetchImpl`, so the suite is deterministic and runs offline (kickoff
 * requirement 8).
 *
 * The nine required properties map to the describes below, in order.
 */

import { describe, it, expect } from 'vitest';

import {
  normalizeAgentIdentity,
  identityKey,
  sameAgent,
  parseAgentId,
  classifyIdentity,
  isServiceOnboardedId,
  SERVICE_ONBOARDED_ID_FLOOR,
  HORIZEN_NETWORK_FACTS,
  serializeForSurfaces,
} from '@/services/horizen/identity';
import {
  parseAgentCardObject,
  parseAgentUri,
  normalizeSupportedTrust,
  agentUriScheme,
  ERC_8004_REGISTRATION_TYPE,
  MAX_DECODED_CARD_BYTES,
} from '@/services/horizen/agentCard';
import { correlateAgent } from '@/services/horizen/correlate';
import {
  buildHorizenEvidence,
  summariseHorizenEvidence,
  HORIZEN_EVIDENCE_ACTION_TYPE,
  HORIZEN_PARTNERSHIP,
} from '@/services/horizen/evidence';
import { resolveBinding } from '@/services/horizen/agentBinding';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchRegistryAgent, fetchRegistryPulseStatus, type HorizenFetch } from '@/services/horizen/client';

// ─── Fixtures, from the brief ──────────────────────────────────────────────

/** §3.2 — the reference agent's card, verbatim. */
const REFERENCE_CARD = {
  type: ERC_8004_REGISTRATION_TYPE,
  name: 'My Pulse Test Agent',
  description: "Look I'm alive !",
  active: true,
  services: [{ endpoint: 'https://www.example.com', pricing: { amount: '0.01', currency: 'USDC' } }],
  supportedTrust: [{ type: 'zkverify', verifier: 'zkverify' }],
  metadata: {
    x402: { configured: false },
    pricing: { model: 'per-call', amount: '0.01', currency: 'USDC', network: 'base-sepolia', payTo: '0x9D911C43F9B14eaf3969CB2C44Ff4dd69e1f497d' },
  },
  circuitMetadata: {
    proofSystem: 'Groth16', verifier: 'zkVerify', selfAttested: true, curve: 'bn254',
    library: 'gnark', constraintCount: 4096, proves: ['Test'], doesNotProve: ['Test'],
    vkHash: '0x708036d2e4c025b8afed3b2bc6a3860e382e6897ec86a42bfc3fa0c197ed74a1',
    proofType: 'test-proof',
  },
};

const REFERENCE_CARD_DATA_URI =
  `data:application/json;base64,${Buffer.from(JSON.stringify(REFERENCE_CARD), 'utf8').toString('base64')}`;

/** §3.3 — the registry representation of 0x1eba. */
const REGISTRY_0X1EBA = {
  agent: {
    agentId: '0x1eba',
    name: 'My Pulse Test Agent',
    agentURI: REFERENCE_CARD_DATA_URI,
    owner: '0x9D911C43F9B14eaf3969CB2C44Ff4dd69e1f497d',
    active: true,
    source: 'on-chain',
  },
  validationsCount: 120,
  agentStats: { totalValidations: 120, allPassed: true },
  feedbackEntries: [],
  ready: true,
  validations: [
    {
      id: 'val-61711', agentId: '0x1eba',
      validatorAddress: '0xbbdcb0C9C3B9ce60555fdF50cFB99802E7c33920',
      status: 'validated', tag: 'pulse-sla', timestamp: '2026-07-09T18:25:20.000Z',
      zkDetails: {
        proofType: 'pulse-sla', curve: 'bn254', verificationMethod: 'zkVerify Volta',
        blockHash: '0x104bc71551f8179e480d4f871282d928e85e756775220afe10c2f977c0719110',
        txHash: '0xda75e0da3479bf8e091110035ffa918b32c9c1f6456d98c7ac29651c3bd51de6',
        allAssertionsPassed: true, constraintCount: 3769,
      },
    },
  ],
};

/** §3.4 — the Pulse record for decimal 7866. */
const PULSE_7866 = {
  agent: { agentId: 7866, name: 'My Pulse Test Agent', endpoint: 'https://www.example.com', slaTarget: 99, challengeIntervalSeconds: 60 },
  uptime: { current: 0, totalChallenges: 28333, totalSuccessful: 0, slaMet: false },
  recentHeartbeats: [{ timestamp: '2026-07-28T10:43:15.707Z', status: 'timeout', latencyMs: 117 }],
  slaProofs: [
    {
      periodStart: '2026-07-28T09:00:00.002Z', periodEnd: '2026-07-28T10:00:00.002Z',
      uptimePercent: 0, totalChallenges: 59,
      merkleRoot: '0x63550489d7209f8c5df706963349fff4e836fe711e299139d310e4389e0c58b5',
      zkverifyAttestationId: '51708',
      adapterTxHash: '0x9a07d6dfead8b0293ea23256a7b87cf3e02e3f7bbb8273a1b271bc31947b0ffa',
    },
  ],
};

/** A routing fake — asserts the URL shapes the brief specifies, offline. */
function fakeFetch(routes: Record<string, { status?: number; body?: unknown }>): HorizenFetch {
  return async (url: string) => {
    const hit = Object.entries(routes).find(([fragment]) => url.includes(fragment));
    if (!hit) return { ok: false, status: 404, json: async () => ({}) };
    const { status = 200, body = {} } = hit[1];
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
}

// ─── 1. 0x1eba normalizes to 7866 ──────────────────────────────────────────

describe('identifier normalization (§2.4.1)', () => {
  it('0x1eba normalizes to 7866', () => {
    const r = normalizeAgentIdentity({ agentId: '0x1eba', network: 'base-sepolia', source: 'on-chain' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.identity.tokenId).toBe('7866');
    expect(r.identity.pulseAlias).toBe('7866');
    expect(r.identity.registryAlias).toBe('0x1eba');
  });

  it('the decimal rendering normalizes to the same identity as the hex one', () => {
    const fromHex = normalizeAgentIdentity({ agentId: '0x1eba', network: 'base-sepolia' });
    const fromDec = normalizeAgentIdentity({ agentId: '7866', network: 'base-sepolia' });
    expect(fromHex.ok && fromDec.ok).toBe(true);
    if (!fromHex.ok || !fromDec.ok) return;
    expect(identityKey(fromHex.identity)).toBe(identityKey(fromDec.identity));
  });

  it('uses BigInt — a tokenId beyond 2^53 survives without precision loss', () => {
    // Number() would silently round this; the brief mandates BigInt.
    const huge = '9007199254740993'; // 2^53 + 1
    const r = normalizeAgentIdentity({ agentId: huge, network: 'base-mainnet' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.identity.tokenId).toBe(huge);
  });

  it('synthetic catalogue ids are refused, never coerced into a token id (§2.4.2)', () => {
    for (const synthetic of ['0xPulse', 'virtuals:26', 'antseed:1', '']) {
      expect(parseAgentId(synthetic).ok, `'${synthetic}' was accepted as a token id`).toBe(false);
    }
  });
});

// ─── 2. Network is part of the identity key ────────────────────────────────

describe('one token id, two representations — the surface decides (§2.4.1)', () => {
  /*
   * ── THE DEFECT (operator direction, 2026-08-03) ─────────────────────────
   *
   * §2.4.1 has been quoted at the top of `identity.ts` since it was written:
   * the Registry renders HEX, Pulse and PnL use DECIMAL. `fetchRegistryAgent`'s
   * own doc comment said "passed in the registry's own HEX rendering" — and
   * then interpolated whatever string arrived.
   *
   * So the Verify path asked for `/api/agents/8798?network=sepolia`: right
   * token, right network, WRONG REPRESENTATION. The registry did not answer,
   * and we read that silence first as "Horizen has no record of this agent"
   * and then as a transport fault — two diagnostic rounds spent on a
   * representation bug.
   *
   * ── WHY NO EXISTING CANARY CAUGHT IT (OS-9) ─────────────────────────────
   *
   * Every test in this file fed `'0x1eba'` — the correct rendering — so the
   * suite only ever proved that hex stays hex. The one representation a
   * caller is most likely to hold (the DECIMAL tokenId stored in
   * `registry_assets.token_id`, which is what Verify passes) was never
   * exercised. A canary that only supplies pre-corrected input cannot fail on
   * the defect it exists to prevent.
   */
  const CASES: Array<{ given: string; label: string }> = [
    { given: '8798', label: 'the DECIMAL form Verify actually holds — the failing case' },
    { given: '0x225e', label: 'the hex form, already correct' },
    { given: '7866', label: "the brief's own reference agent, in decimal" },
    { given: '0x1eba', label: "the brief's own reference agent, in hex" },
  ];

  for (const { given, label } of CASES) {
    it(`registry REST is keyed by HEX whatever the caller holds — ${label}`, async () => {
      const seen: string[] = [];
      const spy: HorizenFetch = async (url) => {
        seen.push(url);
        return { ok: true, status: 200, json: async () => ({ ready: true }) };
      };
      await fetchRegistryAgent(given, 'base-sepolia', { fetchImpl: spy });

      const expectedHex = `0x${BigInt(given).toString(16)}`;
      expect(seen[0]).toContain(`/api/agents/${expectedHex}?`);
      expect(seen[0]).toContain('network=sepolia');
      // THE ASSERTION THAT FAILS ON THE HISTORICAL DEFECT: a decimal path
      // segment is what produced the silence we chased.
      expect(seen[0], 'a decimal registry path is the defect returning').not.toMatch(
        new RegExp(`/api/agents/${BigInt(given).toString(10)}[?/]`),
      );
    });
  }

  it('the pulse-status route on the same host uses the same HEX rendering', async () => {
    // The representation belongs to the SURFACE, not to one route — fixing
    // only the route we happened to be debugging would leave the twin broken.
    const seen: string[] = [];
    const spy: HorizenFetch = async (url) => {
      seen.push(url);
      return { ok: true, status: 200, json: async () => ({ enrolled: true }) };
    };
    await fetchRegistryPulseStatus('8798', 'base-sepolia', { fetchImpl: spy });
    expect(seen[0]).toContain('/api/agents/0x225e/pulse-status');
  });

  it('a non-numeric catalogue reference passes through unchanged', () => {
    // §2.4.2 rows carry genuine slugs (`virtuals:26`). Hex-ifying something
    // that is not a number is not available, and coercing one would
    // manufacture a token id.
    expect(parseAgentId('virtuals:26').ok).toBe(false);
  });

  it('the surfaces name their own serialization — there is no generic agentId to reach for', () => {
    const s = serializeForSurfaces(8798n, 'base-sepolia');
    expect(s).toEqual({
      registryAgentId: '0x225e',
      registryNetwork: 'sepolia',
      pulseAgentId: '8798',
      pulseChain: 'base-sepolia',
    });
  });
});

describe('the DEFAULT transport actually issues a request (2026-08-03)', () => {
  /*
   * ── THE DEFECT ──────────────────────────────────────────────────────────
   *
   * `client.ts`'s `defaultFetch` did:
   *
   *   const { fetchWithRetry } = await import('@/services/corpusScout/retrieval');
   *   return fetchWithRetry(url, init) as unknown as ...
   *
   * `fetchWithRetry` was NOT EXPORTED, so the destructure yielded `undefined`
   * and calling it threw `fetchWithRetry is not a function` — which
   * `readJson`'s catch classified as `reason: 'transport'`. Its real signature
   * is `(url, init, timeoutMs) => {ok, response}`, not a `Response`, so even
   * exported the shape was wrong. One `as unknown as` cast concealed both.
   *
   * EVERY Horizen REST read therefore returned `transport` WITHOUT A PACKET
   * LEAVING THE PROCESS — and we read that as "the host is not answering",
   * even contrasting it against the MCP endpoint on the same host. It was
   * never dialled.
   *
   * ── WHY NOTHING CAUGHT IT (OS-9, same shape as the hex defect above) ─────
   *
   * Every test in this file injects `fetchImpl`. That is correct for offline
   * determinism and it means the DEFAULT path — the only one production uses —
   * had no coverage at all. These canaries stub the global `fetch` instead, so
   * the real adapter runs end to end without a socket.
   */
  const withStubbedFetch = async <T>(stub: typeof globalThis.fetch, run: () => Promise<T>): Promise<T> => {
    const original = globalThis.fetch;
    globalThis.fetch = stub;
    try {
      return await run();
    } finally {
      globalThis.fetch = original;
    }
  };

  it('fetchWithRetry is exported — the destructure that yielded undefined', async () => {
    const { fetchWithRetry } = await import('@/services/corpusScout/retrieval');
    expect(typeof fetchWithRetry, 'not exported is exactly the defect').toBe('function');
  });

  it('a registry read with NO injected fetchImpl reaches the network and returns the body', async () => {
    const seen: string[] = [];
    const result = await withStubbedFetch(
      (async (url: string | URL) => {
        seen.push(String(url));
        return new Response(JSON.stringify({ ready: true, agent: { agentId: '0x225e' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }) as typeof globalThis.fetch,
      () => fetchRegistryAgent('8798', 'base-sepolia'),
    );

    // Before the fix this was {ok:false, reason:'transport'} and `seen` was empty.
    expect(seen, 'no request was issued — the default transport is broken again').toHaveLength(1);
    expect(seen[0]).toContain('/api/agents/0x225e?network=sepolia');
    expect(result.ok).toBe(true);
  });

  it('a 404 is reported as not-found, not as transport — the statuses are readable now', async () => {
    // `res.status` was undefined under the cast, so no status-based branch in
    // `readJson` could ever have been reached.
    const result = await withStubbedFetch(
      (async () => new Response('', { status: 404 })) as typeof globalThis.fetch,
      () => fetchRegistryAgent('8798', 'base-sepolia'),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('not-found');
  });

  it('a genuine transport failure is still reported as transport', async () => {
    // The classification must stay correct for the case it was always claiming.
    const result = await withStubbedFetch(
      (async () => {
        throw new TypeError('fetch failed');
      }) as typeof globalThis.fetch,
      () => fetchRegistryAgent('8798', 'base-sepolia'),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('transport');
  });

  it('no `as unknown as` cast stands between the transport and its declared type', () => {
    // The cast is what allowed a wrong shape AND a missing export to compile.
    const src = readFileSync(join(process.cwd(), 'services/horizen/client.ts'), 'utf8');
    const defaultFetchBody = src.slice(src.indexOf('async function defaultFetch'));
    expect(defaultFetchBody.slice(0, 800)).not.toContain('as unknown as');
  });
});

describe('network is part of the identity (§4.4)', () => {
  it('the same agentId on two networks yields two DIFFERENT identity keys', () => {
    const sep = normalizeAgentIdentity({ agentId: '7866', network: 'base-sepolia' });
    const main = normalizeAgentIdentity({ agentId: '7866', network: 'base-mainnet' });
    expect(sep.ok && main.ok).toBe(true);
    if (!sep.ok || !main.ok) return;
    expect(identityKey(sep.identity)).not.toBe(identityKey(main.identity));
    expect(sep.identity.chainId).toBe(84532);
    expect(main.identity.chainId).toBe(8453);
  });

  it('sameAgent() refuses to correlate across networks', () => {
    expect(sameAgent({ agentId: '0x1eba', network: 'base-sepolia' }, { agentId: '7866', network: 'base-sepolia' })).toBe(true);
    expect(sameAgent({ agentId: '0x1eba', network: 'base-sepolia' }, { agentId: '7866', network: 'base-mainnet' })).toBe(false);
  });

  it('each network carries the right REST vs Pulse selector vocabulary (§1.2 vs §3.4)', () => {
    expect(HORIZEN_NETWORK_FACTS['base-sepolia'].registrySelector).toBe('sepolia');
    expect(HORIZEN_NETWORK_FACTS['base-sepolia'].pulseSelector).toBe('base-sepolia');
    expect(HORIZEN_NETWORK_FACTS['base-mainnet'].registrySelector).toBe('mainnet');
  });
});

// ─── 3/4. Identity class — service-onboarded is not ERC-8004 ───────────────

describe('identity class preservation (§2.4.2, §2.4.3)', () => {
  it('an id at or above 10000000 is service-onboarded, never on-chain', () => {
    expect(isServiceOnboardedId(SERVICE_ONBOARDED_ID_FLOOR)).toBe(true);
    expect(isServiceOnboardedId(SERVICE_ONBOARDED_ID_FLOOR - 1n)).toBe(false);
    // Even when the row CLAIMS on-chain, the floor wins — a token cannot exist
    // above it, whatever the payload says.
    expect(classifyIdentity('on-chain', 10_000_001n)).toBe('service-onboarded');
  });

  it('catalogue sources are not promoted to on-chain', () => {
    expect(classifyIdentity('virtuals.io', 26n)).toBe('catalogue');
    expect(classifyIdentity('pulse', 5n)).toBe('catalogue');
    expect(classifyIdentity('on-chain', 7866n)).toBe('on-chain');
    // Absent source is UNKNOWN — never optimistically on-chain.
    expect(classifyIdentity(null, 7866n)).toBe('unknown');
    expect(classifyIdentity(undefined, 7866n)).toBe('unknown');
  });
});

// ─── 5/6/7. Card tolerance ─────────────────────────────────────────────────

describe('Agent Card parsing tolerates the real shapes (§2.3, §2.4.4, §7)', () => {
  it('the reference data: URI card decodes and parses', () => {
    const r = parseAgentUri(REFERENCE_CARD_DATA_URI);
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.card.name).toBe('My Pulse Test Agent');
    expect(r.card.typeConfirmed).toBe(true);
    expect(r.card.circuitMetadata?.proofSystem).toBe('Groth16');
  });

  it('an identity-only card — no services, no pricing, no trust — is ACCEPTED (§7)', () => {
    const r = parseAgentCardObject({ name: 'PnL Agent' });
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.card.services).toEqual([]);
    expect(r.card.supportedTrust).toEqual([]);
    expect(r.card.metadata).toBeNull();
  });

  it('heterogeneous supportedTrust — bare strings AND objects — both parse (§2.3(b))', () => {
    const entries = normalizeSupportedTrust([
      'zkVerify',
      'reputation',
      { type: 'zk-validation', prover: 'sp1', curve: 'bn254', validationRegistry: 'eip155:84532:0x75a7f712635D7918563659795450ddE6751D71BC' },
    ]);
    expect(entries.map((e) => e.type)).toEqual(['zkVerify', 'reputation', 'zk-validation']);
    expect(entries[2].validationRegistry).toContain('eip155:84532:');
    // The original is never discarded.
    expect(entries[0].raw).toBe('zkVerify');
  });

  it('a card with no `type` is accepted (legacy); a card with a WRONG type is rejected (§2.1)', () => {
    expect(parseAgentCardObject({ name: 'Legacy' }).status).toBe('parsed');
    const wrong = parseAgentCardObject({ type: 'https://example.com/not-erc8004', name: 'Bad' });
    expect(wrong.status).toBe('invalid');
  });

  it('unknown additive Horizen fields are preserved, not dropped (§2.3)', () => {
    const r = parseAgentCardObject({ name: 'A', someFutureHorizenField: { keep: 'me' } });
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.card.extensions.someFutureHorizenField).toEqual({ keep: 'me' });
  });

  it('unknown schemes are UNRESOLVED, not invalid (§2.3(g))', () => {
    expect(agentUriScheme('spawn://x')).toBe('unknown');
    const r = parseAgentUri('spawn://something');
    expect(r.status).toBe('unresolved');
    // https/ipfs are also unresolved here — fetched deliberately by the caller.
    expect(parseAgentUri('https://example.com/card.json').status).toBe('unresolved');
    expect(parseAgentUri('ipfs://Qm123').status).toBe('unresolved');
  });

  it('malformed and oversized cards fail SAFELY, and are distinguishable from unresolved', () => {
    expect(parseAgentUri('data:application/json,%7Bnot-json').status).toBe('invalid');
    expect(parseAgentCardObject('a string').status).toBe('invalid');
    expect(parseAgentCardObject(null).status).toBe('invalid');

    const oversized = `data:application/json;base64,${Buffer.alloc(MAX_DECODED_CARD_BYTES + 1, 0x41).toString('base64')}`;
    const r = parseAgentUri(oversized);
    expect(r.status).toBe('invalid');
    if (r.status === 'invalid') expect(r.reason).toMatch(/exceeds/);
  });
});

// ─── 8. ready:false is not an authoritative empty result ───────────────────

describe('readiness (§5.1)', () => {
  it('ready:false is refused rather than treated as an empty authoritative result', async () => {
    const res = await correlateAgent('0x1eba', 'base-sepolia', {
      fetchImpl: fakeFetch({ '/api/agents/0x1eba?': { body: { ready: false, agent: null } } }),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe('not-ready');
  });
});

// ─── 9. The end-to-end correlation ─────────────────────────────────────────

describe('end-to-end reference-agent correlation (§3)', () => {
  const routes = {
    '/api/agents/0x1eba/pulse-status': { body: { enrolled: true, commitmentRecorded: true } },
    '/api/agents/0x1eba?': { body: REGISTRY_0X1EBA },
    '/status/7866': { body: PULSE_7866 },
    '/v1/erc8004/7866': { status: 404, body: {} },
  };

  it('produces ONE normalized object joining registry, Pulse, validations and proofs', async () => {
    const res = await correlateAgent('0x1eba', 'base-sepolia', { fetchImpl: fakeFetch(routes) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const r = res.record;

    // Identity — the §3.1 join, in every rendering.
    expect(r.identity.tokenId).toBe('7866');
    expect(r.identity.registryAlias).toBe('0x1eba');
    expect(r.identity.network).toBe('base-sepolia');
    expect(r.identity.chainId).toBe(84532);
    expect(r.identity.identityClass).toBe('on-chain');

    // Registry.
    expect(r.registry.name).toBe('My Pulse Test Agent');
    expect(r.registry.validationsCount).toBe(120);
    expect(r.registry.allValidationsPassed).toBe(true);
    expect(r.registry.card.status).toBe('parsed');

    // Pulse + the on-chain proof identifiers (§3.1 secondary join keys).
    expect(r.pulse.present).toBe(true);
    if (r.pulse.present) {
      expect(r.pulse.value.commitmentRecorded).toBe(true);
      expect(r.pulse.value.slaProofs[0].zkverifyAttestationId).toBe('51708');
      expect(r.pulse.value.slaProofs[0].adapterTxHash).toMatch(/^0x9a07d6df/);
    }

    // Validation receipt, with its gateway validator and zkVerify tx.
    expect(r.validations.present).toBe(true);
    if (r.validations.present) {
      expect(r.validations.value[0].tag).toBe('pulse-sla');
      expect(r.validations.value[0].validatorAddress).toBe('0xbbdcb0C9C3B9ce60555fdF50cFB99802E7c33920');
      expect(r.validations.value[0].zkTxHash).toMatch(/^0xda75e0da/);
    }

    // No PnL for this agent — an ordinary absence, not a failure (§3.5).
    expect(r.pnl.present).toBe(false);
    if (!r.pnl.present) expect(r.pnl.reason).toBe('not-found');

    expect(r.correlationVerified).toBe(true);
    expect(r.ready).toBe(true);
  });

  it('a missing Pulse enrollment is ACCEPTED as a valid agent state (§9)', async () => {
    const res = await correlateAgent('0x1eba', 'base-sepolia', {
      fetchImpl: fakeFetch({
        '/api/agents/0x1eba/pulse-status': { body: { enrolled: false, commitmentRecorded: false } },
        '/api/agents/0x1eba?': { body: REGISTRY_0X1EBA },
        '/v1/erc8004/7866': { status: 404, body: {} },
      }),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.record.pulse.present).toBe(false);
    if (!res.record.pulse.present) expect(res.record.pulse.reason).toBe('not-enrolled');
    // The agent is still fully correlated — absence of an optional capability
    // must never degrade the record.
    expect(res.record.identity.tokenId).toBe('7866');
    expect(res.record.correlationVerified).toBe(true);
  });

  it('a Pulse record naming a DIFFERENT agent is flagged, never silently merged', async () => {
    const res = await correlateAgent('0x1eba', 'base-sepolia', {
      fetchImpl: fakeFetch({
        '/api/agents/0x1eba/pulse-status': { body: { enrolled: true, commitmentRecorded: true } },
        '/api/agents/0x1eba?': { body: REGISTRY_0X1EBA },
        '/status/7866': { body: { ...PULSE_7866, agent: { ...PULSE_7866.agent, agentId: 9999 } } },
        '/v1/erc8004/7866': { status: 404, body: {} },
      }),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.record.correlationVerified).toBe(false);
    expect(res.record.correlationNotes.join(' ')).toMatch(/9999/);
  });

  it('the Pulse read uses the DECIMAL id and an explicit network selector (§4.4)', async () => {
    const seen: string[] = [];
    const spy: HorizenFetch = async (url) => {
      seen.push(url);
      if (url.includes('/pulse-status')) return { ok: true, status: 200, json: async () => ({ enrolled: true, commitmentRecorded: true }) };
      if (url.includes('/api/agents/0x1eba?')) return { ok: true, status: 200, json: async () => REGISTRY_0X1EBA };
      if (url.includes('/status/')) return { ok: true, status: 200, json: async () => PULSE_7866 };
      return { ok: false, status: 404, json: async () => ({}) };
    };
    await correlateAgent('0x1eba', 'base-sepolia', { fetchImpl: spy });

    const pulseUrl = seen.find((u) => u.includes('pulse.horizenlabs.io/status/'));
    expect(pulseUrl, 'no Pulse status read was issued').toBeTruthy();
    // Decimal, never hex — reading Pulse with the hex alias returns nothing.
    expect(pulseUrl).toContain('/status/7866');
    expect(pulseUrl).not.toContain('0x1eba');
    // The network selector is mandatory and uses Pulse's vocabulary.
    expect(pulseUrl).toContain('network=base-sepolia');

    const registryUrl = seen.find((u) => u.includes('/api/agents/0x1eba?'));
    // …while the registry uses ITS vocabulary. Mixing them is a silent
    // wrong-network read, which is why the mapping is data, not a guess.
    expect(registryUrl).toContain('network=sepolia');
    expect(registryUrl).not.toContain('network=base-sepolia');
  });
});

// ─── metaMe constitutional evidence (operator ruling 2026-07-28 §7) ────────
//
// "Preserve every network, identity, proof and retrieval identifier in the
// emitted evidence. Do NOT flatten the Agent Registry, Pulse and PnL identity
// spaces." These canaries enforce exactly that, field by field.

describe('metaMe constitutional evidence from a correlated Horizen agent', () => {
  const routes = {
    '/api/agents/0x1eba/pulse-status': { body: { enrolled: true, commitmentRecorded: true } },
    '/api/agents/0x1eba?': { body: REGISTRY_0X1EBA },
    '/status/7866': { body: PULSE_7866 },
    '/v1/erc8004/7866': { status: 404, body: {} },
  };
  const AT = '2026-07-28T12:00:00.000Z';

  async function evidence() {
    const res = await correlateAgent('0x1eba', 'base-sepolia', { fetchImpl: fakeFetch(routes) });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('correlation failed');
    // Attribution is REQUIRED (Slice A, operator ruling 2): the binding state
    // must be explicit, never an omitted field. This agent has no binding
    // record, which is the ordinary case for a partner agent we merely observe
    // — and `unbound` is a fact we can only state because we looked.
    return buildHorizenEvidence(res.record, AT, {
      binding: resolveBinding({ identity: res.record.identity, bindings: [], at: AT }),
      ingestedAt: AT,
    });
  }

  it('carries every identifier the ruling enumerates', async () => {
    const e = await evidence();
    expect(e.chainId).toBe(84532);
    expect(e.tokenId).toBe('7866');
    expect(e.registryAlias).toBe('0x1eba');
    expect(e.pulseAlias).toBe('7866');
    expect(e.identityClass).toBe('on-chain');
    expect(e.validationTag).toBe('pulse-sla');
    expect(e.validationStatus).toBe('validated');
    expect(e.validatorAddress).toBe('0xbbdcb0C9C3B9ce60555fdF50cFB99802E7c33920');
    expect(e.zkVerifyTxHash).toMatch(/^0xda75e0da/);
    expect(e.zkVerifyAttestationId).toBe('51708');
    expect(e.adapterTxHash).toMatch(/^0x9a07d6df/);
    expect(e.pulseEnrolled).toBe(true);
    expect(e.pulseCommitmentRecorded).toBe(true);
    expect(e.correlationVerified).toBe(true);
    expect(e.retrievedAt).toBe(AT);
    expect(e.sourceEndpoints.length).toBeGreaterThan(0);
  });

  it('keeps the three identity spaces SEPARATE — never flattened (ruling §2)', async () => {
    const e = await evidence();
    // Three distinct fields must exist even when they currently agree; the
    // brief's own PnL example shows them diverging and the operator refused to
    // infer equality.
    expect(Object.keys(e)).toEqual(expect.arrayContaining([
      'registryProfileNetwork', 'erc8004IdentityChain', 'proofChain', 'pnlUuid', 'tokenId',
    ]));
    expect(e.registryProfileNetwork).toBe('base-sepolia');
    expect(e.proofChain).toBeNull(); // no PnL correlation for this agent
  });

  it('commits the Agent Card by hash rather than copying it', async () => {
    const e = await evidence();
    expect(e.agentCardStatus).toBe('parsed');
    expect(e.agentCardCommitment).toMatch(/^[0-9a-f]{64}$/);
    // Deterministic — a re-read of an unchanged card must not look like an edit.
    const again = await evidence();
    expect(again.agentCardCommitment).toBe(e.agentCardCommitment);
  });

  it('the action type is DVN-anchorable and declared on the receipt union', () => {
    const dvn = readFileSync(join(process.cwd(), 'services', 'dvn', 'activityReceiptDvnPipeline.ts'), 'utf8');
    const receipts = readFileSync(join(process.cwd(), 'services', 'receipts', 'activityReceiptService.ts'), 'utf8');
    expect(dvn).toContain(`'${HORIZEN_EVIDENCE_ACTION_TYPE}'`);
    expect(receipts).toContain(`| '${HORIZEN_EVIDENCE_ACTION_TYPE}'`);
  });

  it('the summary reports what was read and never asserts trustworthiness', async () => {
    const e = await evidence();
    const s = summariseHorizenEvidence(e);
    expect(s).toContain('0x1eba');
    expect(s).toContain('7866');
    expect(s).toContain('class=on-chain');
    expect(s).not.toMatch(/trusted|verified agent|safe/i);
  });

  it('records the operator-supplied Horizen contacts without inventing an escalation matrix', () => {
    const names = HORIZEN_PARTNERSHIP.contacts.map((c) => c.name);
    expect(names).toEqual(['John Camardo', 'Luca Cermelli']);
    expect(HORIZEN_PARTNERSHIP.pilotId).toBe('horizen-pilot-series-001');
    // metaProof is the partnership entity; metaMe is the runtime (ruling §7).
    expect(HORIZEN_PARTNERSHIP.counterparty).toBe('metaProof');
  });
});
