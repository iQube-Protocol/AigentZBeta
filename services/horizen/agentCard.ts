/**
 * ERC-8004 Agent Card parser — Horizen flavour.
 *
 * Source of truth: "Horizen Agentic Services — Partner Integration Brief"
 * (2026-07-28), §2.3 and §2.4.4.
 *
 * ── THE GOVERNING RULE ─────────────────────────────────────────────────────
 *
 * §2.4.4: "Card fields are user-authored JSON. Treat every optional field as
 * possibly absent or differently-shaped; `name` may be null on unresolved
 * cards."
 *
 * So this parser is written for HOSTILE INPUT, not for the happy-path example
 * in §3.2. Two failure modes it must never exhibit:
 *
 *   1. REJECTING A VALID AGENT. The brief is emphatic that Pulse, services,
 *      pricing and zkVerify trust are all OPTIONAL (§9 note: "A perfectly
 *      valid registry agent has neither, and most on-chain agents today have
 *      neither. Do not treat their absence as malformed."). §7 adds that PnL
 *      agents publish IDENTITY-ONLY cards — no services, no pricing — and
 *      "your ingestion must tolerate a card with no services and no pricing".
 *      A parser that requires any of them silently erases a whole agent class.
 *
 *   2. TRUSTING WHAT IT PARSED. The card is arbitrary third-party JSON reached
 *      over `data:`/`https:`/`ipfs:`. Nothing here is executed, no field is
 *      used to construct a request, and decoded payloads are size-capped
 *      (§2.3(g): the registration wizard caps data: URIs at 256 KB).
 *
 * ── UNRECOGNISED ≠ INVALID ─────────────────────────────────────────────────
 *
 * §2.3(g): "Unknown schemes (spawn://, antseed:) are left UNRESOLVED rather
 * than erroring." That distinction is load-bearing and is modelled explicitly
 * as `unresolved` vs `invalid` — conflating them would either discard live
 * agents or mark broken ones as fine.
 *
 * Unknown ADDITIVE fields are preserved verbatim in `extensions` (§2.3: "All
 * are additive and optional. A strict base-ERC-8004 parser will read our cards
 * correctly and simply ignore these"), so a Horizen field added after this
 * file was written survives ingestion instead of being dropped.
 */

/** §2.3(g) — the URI transports Horizen resolves. */
export type AgentUriScheme = 'data' | 'https' | 'ipfs' | 'unknown';

/**
 * §2.3(g): the registration wizard caps data: URIs at 256 KB. Applied to every
 * decoded payload, not just data: URIs — an https: card is equally untrusted
 * and equally capable of being enormous.
 */
export const MAX_DECODED_CARD_BYTES = 256 * 1024;

/**
 * §2.1: "The card's top-level `type`, when present, must be exactly
 * [this]. We treat it as optional-but-validated: a card without it is accepted
 * (legacy agents predate our stamping it), a card with a WRONG value is
 * rejected."
 */
export const ERC_8004_REGISTRATION_TYPE = 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';

/**
 * §2.3(b): "supportedTrust[] — heterogeneous. Entries are EITHER a bare string
 * or an object. Handle both." Both shapes are normalized to one, with the
 * original preserved so nothing is lost.
 */
export interface SupportedTrustEntry {
  /** `"zkVerify"` / `"reputation"` for bare strings; the object's `type` otherwise. */
  type: string;
  prover?: string;
  curve?: string;
  verifier?: string;
  /** CAIP-style, e.g. `eip155:84532:0x75a7…` (§2.3(b)). */
  validationRegistry?: string;
  /** The entry exactly as authored — never discarded. */
  raw: unknown;
}

/** §2.3(a). Every field optional — the whole object is an extension. */
export interface CircuitMetadata {
  proofSystem?: string;
  curve?: string;
  library?: string;
  verifier?: string;
  constraintCount?: number;
  publicSignals?: number;
  proves?: string[];
  /** §2.3(a): "explicit limitations ← deliberate: buyers see the boundary of the claim". */
  doesNotProve?: string[];
  assertions?: unknown[];
  proofType?: string;
  vkHash?: string;
  /** §2.3(a): "true when the owner claimed its own proofType (trust root = owner, not us)". */
  selfAttested?: boolean;
  registrar?: string;
  name?: string;
  description?: string;
}

export interface ParsedAgentCard {
  /** §2.4.4: "name may be null on unresolved cards". */
  name: string | null;
  description: string | null;
  /** Absent `active` is NOT false — absence is unknown (§9: retirement is `active:false`). */
  active: boolean | null;
  /** §7: identity-only cards are valid. Empty array is a legitimate state. */
  services: unknown[];
  supportedTrust: SupportedTrustEntry[];
  circuitMetadata: CircuitMetadata | null;
  metadata: Record<string, unknown> | null;
  /** Unknown top-level fields, preserved verbatim (§2.3 additive-and-optional). */
  extensions: Record<string, unknown>;
  /** True when a `type` was present AND matched. Absent type ⇒ false, not a failure. */
  typeConfirmed: boolean;
}

export type AgentCardResult =
  | { status: 'parsed'; card: ParsedAgentCard }
  /** §2.3(g) — a transport we do not resolve. NOT an error. */
  | { status: 'unresolved'; scheme: AgentUriScheme; reason: string }
  /** Genuinely broken: bad JSON, wrong `type`, oversized. */
  | { status: 'invalid'; reason: string };

/** Classify an agentURI's transport without resolving it (§2.3(g)). */
export function agentUriScheme(uri: string): AgentUriScheme {
  const u = uri.trim().toLowerCase();
  if (u.startsWith('data:')) return 'data';
  if (u.startsWith('https:')) return 'https';
  if (u.startsWith('ipfs:')) return 'ipfs';
  return 'unknown';
}

function asStringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

/** Normalize §2.3(b)'s two shapes into one, keeping the original. */
export function normalizeSupportedTrust(raw: unknown): SupportedTrustEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SupportedTrustEntry[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string' && entry.trim()) {
      out.push({ type: entry, raw: entry });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const o = entry as Record<string, unknown>;
      const type = asStringOrNull(o.type);
      // An object with no usable `type` is skipped rather than fabricated —
      // but it never fails the whole card (§2.4.4).
      if (!type) continue;
      out.push({
        type,
        ...(asStringOrNull(o.prover) ? { prover: o.prover as string } : {}),
        ...(asStringOrNull(o.curve) ? { curve: o.curve as string } : {}),
        ...(asStringOrNull(o.verifier) ? { verifier: o.verifier as string } : {}),
        ...(asStringOrNull(o.validationRegistry) ? { validationRegistry: o.validationRegistry as string } : {}),
        raw: entry,
      });
    }
  }
  return out;
}

const KNOWN_TOP_LEVEL = new Set([
  'type', 'name', 'description', 'active', 'services',
  'supportedTrust', 'circuitMetadata', 'metadata',
]);

/**
 * Parse an already-decoded card object. Separated from transport decoding so
 * the parsing rules are testable against fixtures with no I/O.
 */
export function parseAgentCardObject(value: unknown): AgentCardResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { status: 'invalid', reason: 'agent card is not a JSON object' };
  }
  const o = value as Record<string, unknown>;

  // §2.1 — optional, but a WRONG value is rejected.
  const rawType = o.type;
  let typeConfirmed = false;
  if (rawType !== undefined && rawType !== null) {
    if (typeof rawType !== 'string' || rawType !== ERC_8004_REGISTRATION_TYPE) {
      return { status: 'invalid', reason: `card 'type' is present but not the ERC-8004 registration type` };
    }
    typeConfirmed = true;
  }

  const extensions: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (!KNOWN_TOP_LEVEL.has(k)) extensions[k] = v;
  }

  const cm = o.circuitMetadata;
  const circuitMetadata =
    cm && typeof cm === 'object' && !Array.isArray(cm) ? (cm as CircuitMetadata) : null;

  const md = o.metadata;
  const metadata = md && typeof md === 'object' && !Array.isArray(md) ? (md as Record<string, unknown>) : null;

  return {
    status: 'parsed',
    card: {
      name: asStringOrNull(o.name),
      description: asStringOrNull(o.description),
      active: typeof o.active === 'boolean' ? o.active : null,
      // §7 — an identity-only card has none. Empty is valid, never an error.
      services: Array.isArray(o.services) ? o.services : [],
      supportedTrust: normalizeSupportedTrust(o.supportedTrust),
      circuitMetadata,
      metadata,
      extensions,
      typeConfirmed,
    },
  };
}

/**
 * Decode + parse an `agentURI`.
 *
 * Only `data:` is decoded in-process — it needs no network. `https:` and
 * `ipfs:` are reported as `unresolved` WITH their scheme, so a caller that
 * wants them fetches them deliberately through its own bounded HTTP path
 * rather than this module opening sockets implicitly.
 */
export function parseAgentUri(uri: string): AgentCardResult {
  const scheme = agentUriScheme(uri);
  if (scheme === 'unknown') {
    // §2.3(g): "Unknown schemes are left unresolved rather than erroring."
    return { status: 'unresolved', scheme, reason: 'unrecognised agentURI scheme' };
  }
  if (scheme !== 'data') {
    return { status: 'unresolved', scheme, reason: `${scheme}: cards are fetched by the caller, not decoded in-process` };
  }

  const comma = uri.indexOf(',');
  if (comma < 0) return { status: 'invalid', reason: 'data: URI has no payload separator' };
  const meta = uri.slice(5, comma).toLowerCase();
  const payload = uri.slice(comma + 1);

  let text: string;
  try {
    if (meta.includes(';base64')) {
      const buf = Buffer.from(payload, 'base64');
      // Size-cap BEFORE stringifying — the cap exists to stop a huge decode,
      // so checking after would defeat it.
      if (buf.byteLength > MAX_DECODED_CARD_BYTES) {
        return { status: 'invalid', reason: `decoded card exceeds ${MAX_DECODED_CARD_BYTES} bytes` };
      }
      text = buf.toString('utf8');
    } else {
      text = decodeURIComponent(payload);
      if (Buffer.byteLength(text, 'utf8') > MAX_DECODED_CARD_BYTES) {
        return { status: 'invalid', reason: `decoded card exceeds ${MAX_DECODED_CARD_BYTES} bytes` };
      }
    }
  } catch {
    return { status: 'invalid', reason: 'data: payload could not be decoded' };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { status: 'invalid', reason: 'card payload is not valid JSON' };
  }
  return parseAgentCardObject(json);
}
