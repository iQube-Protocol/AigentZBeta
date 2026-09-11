/**
 * Horizen agent identity — the canonical normalization layer.
 *
 * Source of truth: "Horizen Agentic Services — Partner Integration Brief"
 * (verified live against production 2026-07-28). Nothing here is invented;
 * every rule below cites the section of the brief that mandates it.
 *
 * ── WHY THIS MODULE EXISTS ─────────────────────────────────────────────────
 *
 * §2.4.1: "agentId rendering differs across our own surfaces. The registry
 * renders hex (0x1eba); Pulse and the Verifiable-PnL service use decimal
 * (7866). Same number. Normalise via BigInt on ingest."
 *
 * And a third space again: §3.5 — the PnL portal is keyed on an internal UUID
 * (`2e859489-…`), bridged to the tokenId by `/v1/erc8004/{tokenId}`.
 *
 * So ONE agent can arrive as three different strings. Correlating them by
 * string comparison is wrong in every direction: `'0x1eba' !== '7866'`, and
 * `parseInt` on a large tokenId loses precision above 2^53. BigInt is the
 * brief's own prescription and is used here without exception.
 *
 * ── NETWORK IS PART OF THE IDENTITY, NOT A QUALIFIER ───────────────────────
 *
 * §4.4: "agentId is unique PER NETWORK, not globally. Always pass ?network=
 * when reading Pulse by on-chain id, or you will read the wrong chain's
 * agent."
 *
 * This is the single most dangerous property in the integration: tokenId 7866
 * exists on both Base Sepolia and Base Mainnet and means DIFFERENT AGENTS.
 * `HorizenAgentIdentity` therefore has no constructor path that omits the
 * network, and `identityKey()` always includes it. A caller cannot accidentally
 * build a network-less identity, because the type does not permit one.
 */

/**
 * The two networks Horizen serves (§1.3, §4 `GET /networks`).
 *
 * Two SELECTOR VOCABULARIES exist for the same chains and the brief uses both:
 * the Registry REST API takes `?network=sepolia|mainnet` (§1.2), while Pulse
 * and the MCP `chain` argument take `base-sepolia|base-mainnet` (§3.4, §1.1).
 * Sending the wrong vocabulary to the wrong surface is a silent
 * wrong-network read, so the mapping is data here, never a caller's guess.
 */
export type HorizenNetwork = 'base-sepolia' | 'base-mainnet';

export const HORIZEN_NETWORKS: readonly HorizenNetwork[] = ['base-sepolia', 'base-mainnet'];

interface NetworkFacts {
  /** EVM chainId (§1.3). */
  chainId: number;
  /** The Registry REST `?network=` selector (§1.2). */
  registrySelector: 'sepolia' | 'mainnet';
  /** The Pulse `?network=` selector and MCP `chain` argument (§3.4, §1.1). */
  pulseSelector: HorizenNetwork;
  /** IdentityRegistry contract (§2.2). Recorded for Phase 2; unused by reads. */
  identityRegistry: string;
}

/**
 * §1.3 + §2.2, verbatim. Addresses are recorded but NOT used by the read path —
 * they exist so Phase 2 (registration) does not have to re-derive them from a
 * document.
 */
export const HORIZEN_NETWORK_FACTS: Readonly<Record<HorizenNetwork, NetworkFacts>> = {
  'base-sepolia': {
    chainId: 84532,
    registrySelector: 'sepolia',
    pulseSelector: 'base-sepolia',
    identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  },
  'base-mainnet': {
    chainId: 8453,
    registrySelector: 'mainnet',
    pulseSelector: 'base-mainnet',
    identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  },
};

/**
 * WHAT KIND OF THING THIS ROW IS (§2.4.2).
 *
 * "Not every row in /api/agents is an ERC-8004 token. Our listing merges the
 * on-chain index with a curated off-chain catalog. Filter on `source`:
 * on-chain is a real ERC-8004 identity; pulse / virtuals.io / antseed.com are
 * catalog or service-onboarded rows, some with synthetic ids like
 * `virtuals:26` or `0xPulse`."
 *
 * Collapsing these would let a catalogue row be treated as a chain-verified
 * identity — the integration's worst failure mode, because everything
 * downstream (proofs, SLA, PnL) assumes an on-chain token underneath.
 */
export type HorizenIdentityClass =
  /** A real ERC-8004 token. The ONLY class treatable as chain-verified. */
  | 'on-chain'
  /** §2.4.3: agentIds ≥ 10000000 — no ERC-8004 token; the proofType registrar credentials it. */
  | 'service-onboarded'
  /** Curated off-chain catalogue row (virtuals.io, antseed.com, …). */
  | 'catalogue'
  /** Present but unclassifiable from the payload. Never assumed to be on-chain. */
  | 'unknown';

/**
 * §2.4.3: "agentIds ≥ 10000000 (0x989680) are service-onboarded identities
 * with no ERC-8004 token."
 */
export const SERVICE_ONBOARDED_ID_FLOOR = 10_000_000n;

/**
 * The canonical internal identity. Built ONLY by `normalizeAgentIdentity`.
 *
 * Carries every alias the brief says the same agent appears under, so a
 * downstream consumer never has to re-derive one from another (and never has
 * to know which surface renders which base).
 */
export interface HorizenAgentIdentity {
  chainId: number;
  network: HorizenNetwork;
  /** ERC-8004 tokenId in DECIMAL string form — the canonical join key (§3.1). */
  tokenId: string;
  /** The registry's hex rendering, e.g. `0x1eba` (§2.4.1). */
  registryAlias: string;
  /** Pulse's decimal rendering, e.g. `7866` (§2.4.1). */
  pulseAlias: string;
  /** §3.5 — present only once resolved via `/v1/erc8004/{tokenId}`. */
  pnlUuid: string | null;
  identityClass: HorizenIdentityClass;
}

export type NormalizeFailure =
  | 'empty'
  | 'not-numeric'
  | 'negative'
  | 'unknown-network';

export type NormalizeResult =
  | { ok: true; identity: HorizenAgentIdentity }
  | { ok: false; reason: NormalizeFailure; detail: string };

/**
 * Parse an agentId in ANY of the renderings the brief documents, into a BigInt.
 *
 * Accepts `0x1eba` (registry hex), `7866` (Pulse decimal), and the same values
 * as numbers. REFUSES the synthetic catalogue ids §2.4.2 warns about
 * (`virtuals:26`, `0xPulse`) rather than coercing them — a synthetic id is not
 * a token id, and silently producing one would manufacture a false ERC-8004
 * identity. `parseInt`/`Number` are never used: a tokenId can exceed 2^53 and
 * would lose precision.
 */
export function parseAgentId(raw: string | number | bigint): { ok: true; value: bigint } | { ok: false; reason: NormalizeFailure; detail: string } {
  if (typeof raw === 'bigint') {
    return raw < 0n ? { ok: false, reason: 'negative', detail: `${raw} is negative` } : { ok: true, value: raw };
  }
  const text = String(raw).trim();
  if (!text) return { ok: false, reason: 'empty', detail: 'agentId is empty' };

  const isHex = /^0x[0-9a-fA-F]+$/.test(text);
  const isDec = /^[0-9]+$/.test(text);
  if (!isHex && !isDec) {
    // `0xPulse`, `virtuals:26` and friends land here — deliberately.
    return { ok: false, reason: 'not-numeric', detail: `'${text}' is not a hex or decimal agentId (synthetic catalogue ids are not token ids)` };
  }
  try {
    return { ok: true, value: BigInt(text) };
  } catch {
    return { ok: false, reason: 'not-numeric', detail: `'${text}' could not be parsed as BigInt` };
  }
}

/** §2.4.3 — a numeric id at or above the floor has no ERC-8004 token behind it. */
export function isServiceOnboardedId(value: bigint): boolean {
  return value >= SERVICE_ONBOARDED_ID_FLOOR;
}

/**
 * Classify a registry row. `source` is the brief's own discriminator (§2.4.2);
 * the id floor (§2.4.3) OVERRIDES a claimed `on-chain` source, because an id
 * above the floor cannot have a token no matter what the row says.
 */
export function classifyIdentity(source: string | null | undefined, value: bigint): HorizenIdentityClass {
  if (isServiceOnboardedId(value)) return 'service-onboarded';
  const s = (source ?? '').trim().toLowerCase();
  if (s === 'on-chain') return 'on-chain';
  if (!s) return 'unknown';
  // 'pulse', 'virtuals.io', 'antseed.com', … — catalogue/service rows.
  return 'catalogue';
}

/**
 * THE normalization entry point. Every ingest path goes through this.
 *
 * `network` is REQUIRED and has no default: §4.4 makes a network-less identity
 * meaningless, and a default would silently pick a chain for the caller.
 */
export function normalizeAgentIdentity(input: {
  agentId: string | number | bigint;
  network: HorizenNetwork;
  source?: string | null;
  pnlUuid?: string | null;
}): NormalizeResult {
  const facts = HORIZEN_NETWORK_FACTS[input.network];
  if (!facts) {
    return { ok: false, reason: 'unknown-network', detail: `'${String(input.network)}' is not a Horizen network` };
  }
  const parsed = parseAgentId(input.agentId);
  if (!parsed.ok) return parsed;

  const value = parsed.value;
  return {
    ok: true,
    identity: {
      chainId: facts.chainId,
      network: input.network,
      tokenId: value.toString(10),
      // Lowercase hex — matches the registry's own rendering (`0x1eba`) and the
      // profile-URL pattern in §3.
      registryAlias: `0x${value.toString(16)}`,
      pulseAlias: value.toString(10),
      pnlUuid: input.pnlUuid ?? null,
      identityClass: classifyIdentity(input.source, value),
    },
  };
}

/**
 * How ONE agent id must be written for EACH Horizen surface.
 *
 * ── WHY THIS EXISTS AS A TYPE (operator direction, 2026-08-03) ────────────
 *
 * §2.4.1 has been quoted at the top of this file since it was written: "the
 * registry renders hex (0x1eba); Pulse and the Verifiable-PnL service use
 * decimal (7866)." `normalizeAgentIdentity` has produced BOTH renderings —
 * `registryAlias` and `pulseAlias` — from the first commit.
 *
 * And `fetchRegistryAgent` took a raw string and interpolated it into the
 * path. So we asked the Registry REST API for `/api/agents/8798` — the right
 * token, on the right network, in the WRONG REPRESENTATION — and read its
 * silence as "Horizen has no record of this agent", then as a transport
 * problem, and spent a diagnostic cycle on each.
 *
 * That is the third time in this integration that an authoritative source
 * existed in this module and a consumer bypassed it (`chain` sent as a number;
 * the diagnostic's hand-rolled args; now the registry path). A generic
 * "agentId" is what makes the mistake available: the caller has to REMEMBER
 * which base a surface wants. So the surfaces name their own serialization,
 * and there is no un-suffixed `agentId` to reach for.
 */
export interface HorizenSurfaceSerialization {
  /** Registry REST path segment — HEX, e.g. `0x225e` (§2.4.1). */
  registryAgentId: string;
  /** Registry REST `?network=` selector — `sepolia` | `mainnet` (§1.2). */
  registryNetwork: 'sepolia' | 'mainnet';
  /** Pulse / PnL identifier — DECIMAL, e.g. `8798` (§2.4.1). */
  pulseAgentId: string;
  /** Pulse `?network=` selector and MCP `chain` argument (§3.4, §1.1). */
  pulseChain: HorizenNetwork;
}

/**
 * Render one agent id for every surface at once. The ONLY place a Horizen URL
 * or tool argument should get its identifier from.
 */
export function serializeForSurfaces(value: bigint, network: HorizenNetwork): HorizenSurfaceSerialization {
  const facts = HORIZEN_NETWORK_FACTS[network];
  return {
    registryAgentId: `0x${value.toString(16)}`,
    registryNetwork: facts.registrySelector,
    pulseAgentId: value.toString(10),
    pulseChain: facts.pulseSelector,
  };
}

/**
 * The storage/dedup key. Network FIRST so the string sorts by chain and so a
 * truncated key can never collide across networks — §4.4's rule made
 * structural rather than remembered.
 */
export function identityKey(identity: HorizenAgentIdentity): string {
  return `${identity.network}:${identity.tokenId}`;
}

/**
 * Do two renderings name the SAME agent? Correlation is by (network, value),
 * never by string equality — `'0x1eba'` and `'7866'` are the same agent and
 * `'7866'` on two networks are not.
 */
export function sameAgent(
  a: { agentId: string | number | bigint; network: HorizenNetwork },
  b: { agentId: string | number | bigint; network: HorizenNetwork },
): boolean {
  if (a.network !== b.network) return false;
  const pa = parseAgentId(a.agentId);
  const pb = parseAgentId(b.agentId);
  return pa.ok && pb.ok && pa.value === pb.value;
}
