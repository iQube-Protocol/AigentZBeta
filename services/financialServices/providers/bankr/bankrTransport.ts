/**
 * Bankr transports — live (real `fetch` against the Partner API) and fake
 * (deterministic, in-memory, always `simulated: true`). Both implement the
 * SAME `BankrTransport` interface (bankrTypes.ts) so `BankrProviderAdapter`
 * — and everything above it (Factor's capability handler, MoneyPenny's
 * orchestrator, the token-launch domain) — never branches on live-vs-fake.
 * This is the one seam Phase 9 requires: "the same request envelope can
 * later be sent to the live provider without changing application logic" —
 * mirrors `services/vela/velaTestTransport.ts`'s own live/test split
 * exactly, never a second simulator convention invented here.
 *
 * Server-side only. `resolvedApiKey` is passed in by the adapter (never
 * read from env inside the transport) so a transport implementation never
 * needs its own credential-resolution logic — one place resolves which key
 * a request needs (`BankrProviderAdapter`'s key-class routing), one place
 * sends the request.
 */

import type { BankrProviderConfig, BankrRateLimitInfo, BankrTransport, BankrTransportRequest, BankrTransportResponse } from './bankrTypes';
import { BankrProviderError } from './bankrTypes';

function parseRateLimit(headers: Headers): BankrRateLimitInfo {
  const limit = headers.get('x-ratelimit-limit');
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  return {
    limit: limit ? Number.parseInt(limit, 10) : null,
    remaining: remaining ? Number.parseInt(remaining, 10) : null,
    // Bankr's docs do not (as of this writing) specify whether reset is a
    // unix timestamp or a delta-seconds value — reported as the RAW header
    // string rather than guessed-and-converted, so a caller never silently
    // misreads one format as the other.
    resetAt: reset,
  };
}

/**
 * Real Partner API calls. Every non-2xx/network failure is normalized into
 * `BankrProviderError` with a `retryable` flag the adapter's retry loop
 * reads directly — this transport never retries itself (single attempt per
 * call; the adapter owns the retry loop so it can also enforce "only
 * safe/idempotent calls retry" uniformly across both transports).
 */
export class BankrLiveTransport implements BankrTransport {
  readonly mode = 'live' as const;

  constructor(private readonly config: BankrProviderConfig) {}

  async send<T>(request: BankrTransportRequest, resolvedApiKey: string): Promise<BankrTransportResponse<T>> {
    const url = `${this.config.apiBaseUrl.replace(/\/+$/, '')}${request.path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: request.method,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${resolvedApiKey}`,
          ...(request.idempotencyKey ? { 'idempotency-key': request.idempotencyKey } : {}),
        },
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BankrProviderError('timeout', `Bankr request to ${request.path} timed out after ${this.config.timeoutMs}ms`, undefined, true);
      }
      throw new BankrProviderError('network-error', `Bankr request to ${request.path} failed: ${err instanceof Error ? err.message : String(err)}`, undefined, true);
    } finally {
      clearTimeout(timeout);
    }

    const rateLimit = parseRateLimit(response.headers);

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      if (response.status === 401 || response.status === 403) {
        throw new BankrProviderError('unauthorized', `Bankr refused the request (${response.status}): ${bodyText || response.statusText}`, response.status, false);
      }
      if (response.status === 429) {
        throw new BankrProviderError('rate-limited', `Bankr rate-limited the request: ${bodyText || response.statusText}`, response.status, true);
      }
      if (response.status >= 500) {
        throw new BankrProviderError('upstream-error', `Bankr upstream error (${response.status}): ${bodyText || response.statusText}`, response.status, true);
      }
      throw new BankrProviderError('invalid-request', `Bankr rejected the request (${response.status}): ${bodyText || response.statusText}`, response.status, false);
    }

    const data = (response.status === 204 ? {} : await response.json().catch(() => ({}))) as T;
    return { status: response.status, data, rateLimit };
  }
}

/**
 * Deterministic fake transport — no network call, ever. Every response
 * carries `simulated: true` so nothing downstream can mistake it for a live
 * result (tests/bankr-provider-adapter.test.ts asserts this on every
 * response shape this transport can produce). State is per-instance
 * in-memory (a Map keyed by a deterministic job-id counter), reset on
 * construction — good enough for a request/response round trip within one
 * process lifetime, never a substitute for a real persisted job store.
 */
export class BankrFakeTransport implements BankrTransport {
  readonly mode = 'fake' as const;
  private jobCounter = 0;
  private readonly jobs = new Map<string, Record<string, unknown>>();

  async send<T>(request: BankrTransportRequest): Promise<BankrTransportResponse<T>> {
    const rateLimit: BankrRateLimitInfo = { limit: 1000, remaining: 999, resetAt: null };

    if (request.path === '/health' || request.path === '/v1/health') {
      return { status: 200, data: { simulated: true, ok: true } as T, rateLimit };
    }

    if (request.path === '/v1/capabilities') {
      return {
        status: 200,
        data: {
          simulated: true,
          agentApiEnabled: true,
          walletApiEnabled: Boolean(request.keyClass === 'wallet'),
          tokenLaunchEnabled: true,
          supportedChains: ['base'],
        } as T,
        rateLimit,
      };
    }

    if (request.path === '/token-launches' && request.method === 'GET') {
      return { status: 200, data: { simulated: true, items: [] } as T, rateLimit };
    }

    if (request.path === '/token-launches/quote' && request.method === 'POST') {
      return {
        status: 200,
        data: {
          simulated: true,
          chain: (request.body?.chain as string) ?? 'base',
          feeBps: 100,
          creatorVestingSupported: false,
          partnerKeySellsFullSupply: true,
          pairedAssetOptions: ['WETH', 'USDC'],
          sourceUrl: 'https://docs.bankr.bot/token-launching/overview/',
        } as T,
        rateLimit,
      };
    }

    if (request.path === '/token-launches' && request.method === 'POST') {
      if (!request.idempotencyKey) {
        throw new BankrProviderError('invalid-request', 'A token-launch submission requires an idempotency key.', 400, false);
      }
      const existing = this.jobs.get(request.idempotencyKey);
      if (existing) return { status: 200, data: existing as T, rateLimit };
      this.jobCounter += 1;
      const jobId = `sim-job-${this.jobCounter}`;
      const job = { simulated: true, jobId, status: 'submitted' };
      this.jobs.set(request.idempotencyKey, job);
      return { status: 200, data: job as T, rateLimit };
    }

    if (request.path.startsWith('/token-launches/') && request.method === 'GET') {
      const jobId = request.path.split('/').pop();
      const found = [...this.jobs.values()].find((j) => j.jobId === jobId);
      if (!found) throw new BankrProviderError('invalid-request', `No simulated job ${jobId}`, 404, false);
      return {
        status: 200,
        data: { ...found, tokenAddress: null, poolAddress: null, transactionHash: null, explorerUrl: null } as T,
        rateLimit,
      };
    }

    throw new BankrProviderError('invalid-request', `Fake Bankr transport has no simulated response for ${request.method} ${request.path}`, 404, false);
  }
}
