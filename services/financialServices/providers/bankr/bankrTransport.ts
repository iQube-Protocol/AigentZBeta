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
 * Server-side only. `resolvedApiKey`/`authHeader` are passed in by the
 * adapter (never read from env inside the transport) so a transport
 * implementation never needs its own credential-resolution logic — one
 * place resolves which key + header a request needs (`BankrProviderAdapter`'s
 * key-class routing), one place sends the request.
 */

import type { BankrAuthHeader, BankrProviderConfig, BankrRateLimitInfo, BankrTransport, BankrTransportRequest, BankrTransportResponse } from './bankrTypes';
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
 *
 * Auth header (2026-09-08 correction, docs.bankr.bot): never `Authorization:
 * Bearer` — a Partner API key (`X-Partner-Key`) or a provisioned-wallet user
 * key (`X-API-Key`), per `authHeader` (resolved by the adapter from the
 * request's own keyClass, never guessed here).
 */
export class BankrLiveTransport implements BankrTransport {
  readonly mode = 'live' as const;

  constructor(private readonly config: BankrProviderConfig) {}

  async send<T>(request: BankrTransportRequest, resolvedApiKey: string, authHeader: BankrAuthHeader): Promise<BankrTransportResponse<T>> {
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
          [authHeader]: resolvedApiKey,
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
 * in-memory (a Map keyed by a deterministic activity-id counter), reset on
 * construction — good enough for a request/response round trip within one
 * process lifetime, never a substitute for a real persisted job store.
 *
 * `/token-launches/deploy` (2026-09-08 correction, docs.bankr.bot) is the
 * ONE real endpoint — mirrors the live contract's own `simulateOnly`
 * semantics exactly: `simulateOnly: true` returns a predicted
 * tokenAddress/poolId/feeDistribution with NO txHash/activityId (never
 * broadcasts, never reserves quota); `simulateOnly: false` additionally
 * returns both.
 */
export class BankrFakeTransport implements BankrTransport {
  readonly mode = 'fake' as const;
  private activityCounter = 0;
  private readonly deploys = new Map<string, Record<string, unknown>>();

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

    if (request.path === '/token-launches/deploy' && request.method === 'POST') {
      const body = request.body ?? {};
      const simulateOnly = body.simulateOnly !== false;
      const chain = String(body.chain ?? 'base');
      const feeDistribution = { creator: 9000, bankr: 1000 }; // deterministic, illustrative bps split
      const tokenAddress = `0xSIMULATED${String(body.tokenSymbol ?? 'TOKEN').toUpperCase().padEnd(6, '0')}`;
      const poolId = `sim-pool-${chain}-${String(body.tokenSymbol ?? 'token').toLowerCase()}`;

      if (simulateOnly) {
        // Bankr's own contract: a simulation never broadcasts a transaction
        // and never reserves launch quota — no txHash, no activityId, no
        // idempotency-key requirement (nothing is written), status 200.
        return {
          status: 200,
          data: { simulated: true, tokenAddress, poolId, chain, feeDistribution, txHash: null, activityId: null } as T,
          rateLimit,
        };
      }

      // A real deploy requires an idempotency key (the adapter always
      // supplies one for simulateOnly:false; this transport enforces it too
      // so a caller that somehow bypassed the adapter still can't submit
      // without one).
      if (!request.idempotencyKey) {
        throw new BankrProviderError('invalid-request', 'A token-launch deploy requires an idempotency key.', 400, false);
      }
      const existing = this.deploys.get(request.idempotencyKey);
      if (existing) return { status: 201, data: existing as T, rateLimit };
      this.activityCounter += 1;
      const activityId = `sim-activity-${this.activityCounter}`;
      const txHash = `0xSIMULATEDTX${String(this.activityCounter).padStart(4, '0')}`;
      const deploy = { simulated: true, tokenAddress, poolId, chain, feeDistribution, txHash, activityId };
      this.deploys.set(request.idempotencyKey, deploy);
      return { status: 201, data: deploy as T, rateLimit };
    }

    if (request.path.startsWith('/token-launches/') && request.method === 'GET') {
      const jobId = request.path.split('/').pop();
      const found = [...this.deploys.values()].find((j) => j.activityId === jobId);
      if (!found) throw new BankrProviderError('invalid-request', `No simulated deploy ${jobId}`, 404, false);
      return {
        status: 200,
        data: { ...found, jobId: found.activityId, status: 'confirmed', tokenAddress: found.tokenAddress, poolAddress: found.poolId, transactionHash: found.txHash, explorerUrl: null } as T,
        rateLimit,
      };
    }

    throw new BankrProviderError('invalid-request', `Fake Bankr transport has no simulated response for ${request.method} ${request.path}`, 404, false);
  }
}
