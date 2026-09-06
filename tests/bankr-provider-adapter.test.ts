/**
 * Bankr provider adapter — behavioral tests (Factor + Aegis Bankr PRD,
 * Phase 2/8). No live network calls; the live transport is exercised via a
 * stubbed `global.fetch`, never a real request to api.bankr.bot.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBankrProviderAdapter, BankrProviderAdapter, redactBankrLogPayload } from '@/services/financialServices/providers/bankr/bankrProviderAdapter';
import { BankrLiveTransport, BankrFakeTransport } from '@/services/financialServices/providers/bankr/bankrTransport';
import { BankrProviderError, type BankrProviderConfig } from '@/services/financialServices/providers/bankr/bankrTypes';

function baseConfig(overrides: Partial<BankrProviderConfig['credentials']> = {}): BankrProviderConfig {
  return {
    apiBaseUrl: 'https://api.bankr.bot',
    credentials: { readOnlyApiKey: null, writeApiKey: null, walletApiKey: null, ...overrides },
    timeoutMs: 5000,
    maxRetries: 2,
    retryBackoffMs: 1,
    ipAllowlist: [],
  };
}

describe('resolveBankrProviderConfig / configured: false honesty', () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('reports configured: false with no BANKR_* env vars set (real deployment state today)', () => {
    for (const k of Object.keys(process.env)) if (k.startsWith('BANKR_')) delete process.env[k];
    const adapter = createBankrProviderAdapter();
    const status = adapter.getStatus();
    expect(status.configured).toBe(false);
    expect(status.mode).toBe('fake');
    expect(status.reason).toBeTruthy();
  });

  it('never fabricates a live connection — createBankrProviderAdapter picks the fake transport whenever unconfigured', () => {
    for (const k of Object.keys(process.env)) if (k.startsWith('BANKR_')) delete process.env[k];
    const adapter = createBankrProviderAdapter();
    expect(adapter.getStatus().mode).toBe('fake');
  });
});

describe('least-privilege key-class routing — fails closed, never falls back to a broader key', () => {
  it('a write request is refused when only a read-only key is configured', async () => {
    const config = baseConfig({ readOnlyApiKey: 'ro-key' });
    const adapter = new BankrProviderAdapter(config, new BankrLiveTransport(config));
    await expect(adapter.request({ method: 'POST', path: '/token-launches', keyClass: 'write', idempotencyKey: 'idem-1' })).rejects.toMatchObject({
      code: 'wrong-key-class',
    });
  });

  it('a wallet request is refused when no wallet key is configured, even with read/write keys present', async () => {
    const config = baseConfig({ readOnlyApiKey: 'ro-key', writeApiKey: 'w-key' });
    const adapter = new BankrProviderAdapter(config, new BankrLiveTransport(config));
    await expect(adapter.request({ method: 'GET', path: '/wallet/0xabc/balance', keyClass: 'wallet' })).rejects.toMatchObject({
      code: 'wrong-key-class',
    });
  });

  it('a read-only-scoped request succeeds against the fake transport with zero credentials configured (simulated rehearsal)', async () => {
    const config = baseConfig();
    const adapter = new BankrProviderAdapter(config, new BankrFakeTransport());
    const caps = await adapter.getCapabilities();
    expect((caps as unknown as { simulated: boolean }).simulated).toBe(true);
  });
});

describe('redactBankrLogPayload — secrets never enter logs', () => {
  it('redacts every credential-shaped field name, recursively, leaving other fields untouched', () => {
    const input = {
      path: '/token-launches',
      apiKey: 'sk-live-abc123',
      nested: { authorization: 'Bearer xyz', walletApiKey: 'w-123', ok: true },
      arr: [{ secretToken: 'zzz', keep: 'me' }],
    };
    const out = redactBankrLogPayload(input) as any;
    expect(out.path).toBe('/token-launches');
    expect(out.apiKey).toBe('[redacted]');
    expect(out.nested.authorization).toBe('[redacted]');
    expect(out.nested.walletApiKey).toBe('[redacted]');
    expect(out.nested.ok).toBe(true);
    expect(out.arr[0].secretToken).toBe('[redacted]');
    expect(out.arr[0].keep).toBe('me');
  });

  it('does not false-positive redact keyClass (a policy enum, not a secret)', () => {
    const out = redactBankrLogPayload({ keyClass: 'write', path: '/token-launches' }) as any;
    expect(out.keyClass).toBe('write');
  });
});

describe('simulated vs live are visibly distinct', () => {
  it('every fake-transport response carries simulated: true', async () => {
    const adapter = new BankrProviderAdapter(baseConfig(), new BankrFakeTransport());
    const status = adapter.getStatus();
    expect(status.mode).toBe('fake');
    const caps = await adapter.getCapabilities() as any;
    expect(caps.simulated).toBe(true);
    const quote = await adapter.getTokenLaunchQuote({ chain: 'base', tokenName: 'Test', tokenSymbol: 'TST' }) as any;
    expect(quote.raw.simulated).toBe(true);
  });

  it('a live-transport adapter reports mode: "live"', () => {
    const config = baseConfig({ readOnlyApiKey: 'ro-key' });
    const adapter = new BankrProviderAdapter(config, new BankrLiveTransport(config));
    expect(adapter.getStatus().mode).toBe('live');
  });
});

describe('token-launch submission — idempotency', () => {
  it('refuses a submission with no idempotency key', async () => {
    const adapter = new BankrProviderAdapter(baseConfig(), new BankrFakeTransport());
    await expect(
      adapter.request({ method: 'POST', path: '/token-launches', keyClass: 'write', body: {} }),
    ).rejects.toMatchObject({ code: 'invalid-request' });
  });

  it('a duplicate submission with the same idempotency key returns the SAME job, never a second one', async () => {
    const adapter = new BankrProviderAdapter(baseConfig(), new BankrFakeTransport());
    const first = await adapter.submitTokenLaunch({ tokenName: 'Test' }, 'idem-launch-1');
    const second = await adapter.submitTokenLaunch({ tokenName: 'Test' }, 'idem-launch-1');
    expect(second.jobId).toBe(first.jobId);
  });

  it('two DIFFERENT idempotency keys produce two distinct jobs', async () => {
    const adapter = new BankrProviderAdapter(baseConfig(), new BankrFakeTransport());
    const first = await adapter.submitTokenLaunch({ tokenName: 'A' }, 'idem-a');
    const second = await adapter.submitTokenLaunch({ tokenName: 'B' }, 'idem-b');
    expect(second.jobId).not.toBe(first.jobId);
  });
});

describe('bounded retries — only for safe/idempotent calls', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: String(status),
      headers: new Headers(headers),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }

  it('retries a GET on a 503 upstream error and eventually succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { error: 'upstream down' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const config = baseConfig({ readOnlyApiKey: 'ro-key' });
    const adapter = new BankrProviderAdapter(config, new BankrLiveTransport(config));
    const result = await adapter.request<{ ok: boolean }>({ method: 'GET', path: '/v1/capabilities', keyClass: 'read-only' });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a POST with no idempotency key, even on a retryable 503', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503, { error: 'upstream down' }));
    const config = baseConfig({ writeApiKey: 'w-key' });
    const adapter = new BankrProviderAdapter(config, new BankrLiveTransport(config));
    await expect(adapter.request({ method: 'POST', path: '/token-launches', keyClass: 'write', body: {} })).rejects.toMatchObject({
      code: 'upstream-error',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never retries a 401 (not a retryable failure class)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'bad key' }));
    const config = baseConfig({ readOnlyApiKey: 'ro-key' });
    const adapter = new BankrProviderAdapter(config, new BankrLiveTransport(config));
    await expect(adapter.request({ method: 'GET', path: '/v1/capabilities', keyClass: 'read-only' })).rejects.toMatchObject({
      code: 'unauthorized',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('parses rate-limit headers from a live response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { error: 'slow down' }, { 'x-ratelimit-limit': '100', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '60' }),
    );
    const transport = new BankrLiveTransport(baseConfig({ readOnlyApiKey: 'ro-key' }));
    await expect(transport.send({ method: 'GET', path: '/v1/capabilities', keyClass: 'read-only' }, 'ro-key')).rejects.toMatchObject({
      code: 'rate-limited',
      retryable: true,
    });
  });
});

describe('BankrProviderError shape', () => {
  it('is a real Error subclass with a stable code, never a raw fetch error leaking through', () => {
    const err = new BankrProviderError('timeout', 'took too long');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('BankrProviderError');
    expect(err.code).toBe('timeout');
  });
});
