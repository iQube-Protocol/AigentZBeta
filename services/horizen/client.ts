/**
 * Horizen read client — Registry, Pulse, Verifiable-PnL correlation.
 *
 * Source of truth: "Horizen Agentic Services — Partner Integration Brief"
 * (2026-07-28). Every endpoint below is quoted from §1.2, §3 and §4.1. No URL
 * is constructed from a pattern the brief does not state.
 *
 * ── WHY THIS IS READ-ONLY ──────────────────────────────────────────────────
 *
 * Kickoff scope: reads and correlation only. No registration, no wallet
 * signing, no Pulse enablement, no PnL registration, no private keys. §1.4 is
 * unambiguous that every mutation is authenticated by a wallet signature — so
 * a read client that cannot sign cannot accidentally mutate.
 *
 * §1.4 also settles credentials: "There is no API key, and none can be issued
 * — all reads and the MCP endpoint are public." This module therefore takes no
 * secret, reads no env var for auth, and has nowhere to leak one.
 *
 * ── TRANSPORT REUSE, NOT A NEW HTTP STACK ──────────────────────────────────
 *
 * Retries come from `services/corpusScout/retrieval.ts` — the repo's existing
 * bounded-retry policy (3 attempts, exponential backoff, ONLY on genuinely
 * transient statuses). Writing a second retry policy here would be the
 * parallel-implementation defect this codebase fails builds over
 * (inv.engineering.036/037).
 *
 * ── POLLING POSTURE (§5.1) ─────────────────────────────────────────────────
 *
 * "Polling every 60 s is already faster than the data changes." The floor is
 * enforced as a constant here rather than left to each caller's discretion, and
 * `ready` is surfaced rather than swallowed: §5.1 — "every payload carries
 * `ready`. On a cold start ready:false means the cache is still warming; RETRY
 * rather than treating an empty list as truth." An empty list with
 * `ready:false` is NOT an authoritative empty result, and this module refuses
 * to present it as one.
 */

import {
  HORIZEN_NETWORK_FACTS,
  parseAgentId,
  serializeForSurfaces,
  type HorizenNetwork,
} from './identity';

/** §1.2 / §3 — production hosts, verbatim. */
export const HORIZEN_REGISTRY_API = 'https://agent-registry.horizenlabs.io/api';
export const HORIZEN_REGISTRY_MCP = 'https://agent-registry.horizenlabs.io/api/mcp';
export const HORIZEN_PULSE_BASE = 'https://pulse.horizenlabs.io';
export const HORIZEN_PNL_BASE = 'https://agent-registry.horizenlabs.io/verifiable-pnl';

/**
 * §5.1: "do not poll faster than ~1 minute; you will not see newer data."
 * Registry indexers refresh on a 5-minute cycle; responses are max-age=15.
 */
export const MIN_POLL_INTERVAL_MS = 60_000;

/** §1.5 rate limits, recorded so a scheduler can budget rather than guess. */
export const HORIZEN_RATE_LIMITS = {
  registryPerMinute: 60,
  mcpPerMinute: 240,
  pulsePerRoutePerMinute: 30,
  pulseGlobalPerMinute: 120,
} as const;

export type HorizenFetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  headers?: { get(name: string): string | null };
}>;

export interface HorizenClientOptions {
  /**
   * Injected transport. Defaults to the repo's bounded-retry fetch so this
   * module inherits one retry policy instead of forking a second. Injectable
   * so tests NEVER touch the network (kickoff requirement 8).
   */
  fetchImpl?: HorizenFetch;
}

/**
 * §5.1 responses are `max-age=15` and the registry indexer refreshes on a
 * 5-minute cycle, so a read that has not answered in 20s is not about to.
 * The same budget `retrieval.ts` uses for its own fetches.
 */
const HORIZEN_FETCH_TIMEOUT_MS = 20_000;

/**
 * ── THIS NEVER MADE A REQUEST (found 2026-08-03) ──────────────────────────
 *
 * Two defects, both hidden by one `as unknown as` cast:
 *
 *   1. `fetchWithRetry` was NOT EXPORTED from `retrieval.ts`. The destructure
 *      yielded `undefined`, calling it threw `fetchWithRetry is not a
 *      function`, and `readJson`'s try/catch classified that as
 *      `reason: 'transport'`.
 *   2. Its signature is `(url, init, timeoutMs) => {ok, response}` — NOT a
 *      `Response`. Even exported, `res.status` and `res.json` would have been
 *      undefined.
 *
 * So EVERY Horizen REST read — registry profile, pulse-status, Pulse status,
 * PnL bridge — has always returned `transport` without a packet leaving the
 * process. We then read that as "the host is not answering", and even
 * contrasted it with the MCP endpoint "on the same host", concluding the REST
 * path was down. It was never dialled.
 *
 * The cast is what permitted it: `as unknown as` asserts a shape the compiler
 * had every means to check and was told not to. It is not used here now — the
 * adapter unwraps the real return value and hands back a genuine `Response`,
 * which satisfies `HorizenFetch` structurally.
 *
 * Still imported lazily, so a test supplying `fetchImpl` never loads the
 * retrieval stack and never risks a real socket.
 */
async function defaultFetch(url: string, init?: { headers?: Record<string, string> }): Promise<Response> {
  const { fetchWithRetry } = await import('@/services/corpusScout/retrieval');
  const attempt = await fetchWithRetry(url, (init ?? {}) as RequestInit, HORIZEN_FETCH_TIMEOUT_MS);
  if (!attempt.ok) {
    throw new Error(
      attempt.aborted
        ? `no response within ${HORIZEN_FETCH_TIMEOUT_MS}ms for ${url}`
        : `the request to ${url} failed before any response`,
    );
  }
  return attempt.response;
}

export type HorizenReadFailure =
  | { ok: false; reason: 'http'; status: number; detail: string }
  | { ok: false; reason: 'not-found'; detail: string }
  | { ok: false; reason: 'transport'; detail: string }
  | { ok: false; reason: 'shape'; detail: string }
  /** §5.1 — the cache is warming. Distinct from an authoritative empty result. */
  | { ok: false; reason: 'not-ready'; detail: string };

export type HorizenRead<T> = { ok: true; value: T; ready: boolean } | HorizenReadFailure;

async function readJson<T>(
  fetchImpl: HorizenFetch,
  url: string,
  opts?: { requireReady?: boolean },
): Promise<HorizenRead<T>> {
  let res: Awaited<ReturnType<HorizenFetch>>;
  try {
    res = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
    });
  } catch (e) {
    return { ok: false, reason: 'transport', detail: e instanceof Error ? e.message : String(e) };
  }
  if (res.status === 404) {
    // §3.5: "A 404 NOT_FOUND means 'this tokenId has no PnL agent'." A 404 is
    // information, not a failure — callers branch on it.
    return { ok: false, reason: 'not-found', detail: `404 for ${url}` };
  }
  if (!res.ok) {
    return { ok: false, reason: 'http', status: res.status, detail: `HTTP ${res.status} for ${url}` };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch (e) {
    return { ok: false, reason: 'shape', detail: e instanceof Error ? e.message : 'response was not JSON' };
  }
  if (!body || typeof body !== 'object') {
    return { ok: false, reason: 'shape', detail: 'response body is not a JSON object' };
  }
  // §5.1 — `ready` is a first-class signal, never dropped.
  const readyRaw = (body as Record<string, unknown>).ready;
  const ready = typeof readyRaw === 'boolean' ? readyRaw : true;
  if (opts?.requireReady && ready === false) {
    return { ok: false, reason: 'not-ready', detail: `${url} returned ready:false — cache warming, retry rather than treating as empty` };
  }
  return { ok: true, value: body as T, ready };
}

/**
 * The Registry REST path segment for an agent reference.
 *
 * ── THE DEFECT THIS CLOSES (operator direction, 2026-08-03) ───────────────
 *
 * §2.4.1: the Registry renders agent ids in HEX (`0x225e`); Pulse and PnL use
 * DECIMAL (`8798`). The same number, two representations, and the surface
 * decides which. `fetchRegistryAgent`'s own doc comment SAID hex — and then
 * interpolated whatever string the caller handed it.
 *
 * So we asked for `/api/agents/8798?network=sepolia`: right token, right
 * network, wrong representation. The registry did not answer, and we read
 * that silence first as "Horizen has no record of this agent" and then as a
 * transport fault, spending a diagnostic round on each. A documented rule that
 * a function relies on its callers to obey is not enforced; this makes it
 * structural.
 *
 * A NON-NUMERIC reference passes through unchanged: §2.4.2's catalogue rows
 * carry genuine slugs (`virtuals:26`), and hex-ifying something that is not a
 * number is not available. Only a parsed id is re-rendered.
 */
function registryPathSegment(agentRef: string, network: HorizenNetwork): string {
  const parsed = parseAgentId(agentRef);
  return parsed.ok ? serializeForSurfaces(parsed.value, network).registryAgentId : agentRef;
}

/**
 * §1.2 `GET /agents/:agentId` — full profile.
 * `agentId` is rendered in the registry's own HEX form (§2.4.1) by
 * `registryPathSegment`, whatever representation the caller holds.
 */
export async function fetchRegistryAgent(
  agentRef: string,
  network: HorizenNetwork,
  options: HorizenClientOptions = {},
): Promise<HorizenRead<Record<string, unknown>>> {
  const selector = HORIZEN_NETWORK_FACTS[network].registrySelector;
  const url = `${HORIZEN_REGISTRY_API}/agents/${encodeURIComponent(registryPathSegment(agentRef, network))}?network=${selector}`;
  return readJson(options.fetchImpl ?? defaultFetch, url, { requireReady: true });
}

/**
 * §1.2 `GET /agents/:agentId/pulse-status` →
 * `{enrolled, commitmentRecorded}`. §3.3: `commitmentRecorded:true` means the
 * on-chain commitment is registered, "which is what lets SLA proofs finalise
 * at all".
 *
 * Same host, same `/agents/` family, therefore the same HEX rendering — the
 * representation belongs to the SURFACE, not to the individual route.
 */
export async function fetchRegistryPulseStatus(
  agentRef: string,
  network: HorizenNetwork,
  options: HorizenClientOptions = {},
): Promise<HorizenRead<Record<string, unknown>>> {
  const selector = HORIZEN_NETWORK_FACTS[network].registrySelector;
  const url = `${HORIZEN_REGISTRY_API}/agents/${encodeURIComponent(registryPathSegment(agentRef, network))}/pulse-status?network=${selector}`;
  return readJson(options.fetchImpl ?? defaultFetch, url);
}

/**
 * §4.1 `GET /status/:agentId?network=` — DECIMAL id, and the network selector
 * is MANDATORY (§4.4: "Always pass ?network= when reading Pulse by on-chain
 * id, or you will read the wrong chain's agent"). The signature takes a
 * `HorizenNetwork`, so it cannot be omitted.
 */
export async function fetchPulseStatus(
  pulseAlias: string,
  network: HorizenNetwork,
  options: HorizenClientOptions = {},
): Promise<HorizenRead<Record<string, unknown>>> {
  const selector = HORIZEN_NETWORK_FACTS[network].pulseSelector;
  const url = `${HORIZEN_PULSE_BASE}/status/${encodeURIComponent(pulseAlias)}?network=${selector}`;
  return readJson(options.fetchImpl ?? defaultFetch, url);
}

/** §4.1 `GET /agents/by-onchain/:agentId?network=` — lightweight enrollment check. */
export async function fetchPulseEnrollment(
  pulseAlias: string,
  network: HorizenNetwork,
  options: HorizenClientOptions = {},
): Promise<HorizenRead<Record<string, unknown>>> {
  const selector = HORIZEN_NETWORK_FACTS[network].pulseSelector;
  const url = `${HORIZEN_PULSE_BASE}/agents/by-onchain/${encodeURIComponent(pulseAlias)}?network=${selector}`;
  return readJson(options.fetchImpl ?? defaultFetch, url);
}

/**
 * §3.5 `GET /v1/erc8004/{tokenId}` — "the correlation endpoint you want as an
 * external registry: it takes the on-chain tokenId you already have and
 * returns the internal PnL UUID that every other PnL read is keyed on."
 *
 * DECIMAL tokenId. A 404 means no PnL agent — surfaced as `not-found`, which
 * the correlator treats as an ordinary absence, not an error.
 */
export async function fetchPnlCorrelation(
  tokenId: string,
  options: HorizenClientOptions = {},
): Promise<HorizenRead<Record<string, unknown>>> {
  const url = `${HORIZEN_PNL_BASE}/v1/erc8004/${encodeURIComponent(tokenId)}`;
  return readJson(options.fetchImpl ?? defaultFetch, url);
}

/**
 * ── VERIFIABLE-PNL ONBOARDING READS (Horizen Pilot Closure, part C,
 *    2026-08-09) ────────────────────────────────────────────────────────────
 *
 * Read live from `${HORIZEN_PNL_BASE}/verifiable-pnl/AGENTS.md`'s current
 * runbook (fetched 2026-08-09) and cross-checked against its published
 * `openapi.json` — never inferred or hand-built. Every field name below is
 * quoted from that response; no field is invented.
 *
 * These four remain squarely within this module's READ-ONLY scope — each is
 * a plain, unauthenticated GET the onboarding flow needs BEFORE any wallet
 * ever signs anything. The mutations they feed
 * (`POST /v1/register`, `POST /v1/prove`, `POST /v1/prove/{jobId}/sign`) live
 * in the dedicated mutating boundary, `services/horizen/pnlOnboardingClient.ts`
 * — never here.
 */

/** `GET /v1/terms` — current Terms & Conditions; the returned `statement` MUST be embedded verbatim in the SIWE message or `/v1/register` rejects with `TERMS_NOT_ACCEPTED`. */
export async function fetchPnlTerms(
  options: HorizenClientOptions = {},
): Promise<HorizenRead<{ version: string; contentHash: string; statement: string; content: string }>> {
  const url = `${HORIZEN_PNL_BASE}/v1/terms`;
  return readJson(options.fetchImpl ?? defaultFetch, url);
}

/** `GET /v1/siwe/nonce` — a fresh SIWE nonce plus the server-canonical `domain`/`URI` to embed, so the SIWE message is never hand-guessed. */
export async function fetchPnlSiweNonce(
  options: HorizenClientOptions = {},
): Promise<HorizenRead<{ nonce: string; expectedDomain: string; expectedUri: string }>> {
  const url = `${HORIZEN_PNL_BASE}/v1/siwe/nonce`;
  return readJson(options.fetchImpl ?? defaultFetch, url);
}

/**
 * `GET /v1/erc8004/{tokenId}/owner` — public, unauthenticated pre-check for
 * `existing`-mode registration ("confirm ownership up front... to avoid
 * prompting the user for signatures only to fail at the final step").
 * `verifiable === false` means the registry isn't configured for this
 * deployment — not that ownership failed; the caller must fall back to
 * server-side enforcement at `/v1/register` rather than treat it as a denial.
 */
export async function fetchPnlTokenOwner(
  tokenId: string,
  options: HorizenClientOptions = {},
): Promise<HorizenRead<{ tokenId: string; owner: string | null; verifiable: boolean }>> {
  const url = `${HORIZEN_PNL_BASE}/v1/erc8004/${encodeURIComponent(tokenId)}/owner`;
  return readJson(options.fetchImpl ?? defaultFetch, url);
}
