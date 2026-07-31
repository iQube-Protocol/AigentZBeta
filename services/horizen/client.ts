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

async function defaultFetch(url: string, init?: { headers?: Record<string, string> }) {
  // Imported lazily so a test supplying `fetchImpl` never loads the retrieval
  // stack (and never risks a real socket).
  const { fetchWithRetry } = await import('@/services/corpusScout/retrieval');
  return fetchWithRetry(url, init as RequestInit) as unknown as Awaited<ReturnType<HorizenFetch>>;
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
 * §1.2 `GET /agents/:agentId` — full profile.
 * `agentId` is passed in the registry's own HEX rendering (§3: "agentId in
 * hex, matching the REST API's rendering").
 */
export async function fetchRegistryAgent(
  registryAlias: string,
  network: HorizenNetwork,
  options: HorizenClientOptions = {},
): Promise<HorizenRead<Record<string, unknown>>> {
  const selector = HORIZEN_NETWORK_FACTS[network].registrySelector;
  const url = `${HORIZEN_REGISTRY_API}/agents/${encodeURIComponent(registryAlias)}?network=${selector}`;
  return readJson(options.fetchImpl ?? defaultFetch, url, { requireReady: true });
}

/**
 * §1.2 `GET /agents/:agentId/pulse-status` →
 * `{enrolled, commitmentRecorded}`. §3.3: `commitmentRecorded:true` means the
 * on-chain commitment is registered, "which is what lets SLA proofs finalise
 * at all".
 */
export async function fetchRegistryPulseStatus(
  registryAlias: string,
  network: HorizenNetwork,
  options: HorizenClientOptions = {},
): Promise<HorizenRead<Record<string, unknown>>> {
  const selector = HORIZEN_NETWORK_FACTS[network].registrySelector;
  const url = `${HORIZEN_REGISTRY_API}/agents/${encodeURIComponent(registryAlias)}/pulse-status?network=${selector}`;
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
