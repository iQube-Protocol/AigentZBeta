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
    liveModeEnabled: true,
  };
}

const FEE_RECIPIENT = { type: 'wallet' as const, value: '0xE478E454b8c97682CACabe0345bb01AF30900ac1' };

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
    await expect(adapter.request({ method: 'POST', path: '/token-launches/deploy', keyClass: 'write', idempotencyKey: 'idem-1' })).rejects.toMatchObject({
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

describe('correction (2026-09-08): auth header selection — X-Partner-Key vs X-API-Key, never Authorization: Bearer', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a read-only/write (Partner API) request sends the key under X-Partner-Key', async () => {
    const config = baseConfig({ readOnlyApiKey: 'bk_ptr_test123' });
    const adapter = new BankrProviderAdapter(config, new BankrLiveTransport(config));
    await adapter.getCapabilities();
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['X-Partner-Key']).toBe('bk_ptr_test123');
    expect(headers['X-API-Key']).toBeUndefined();
    expect(headers['authorization']).toBeUndefined();
  });

  it('a wallet request sends the key under X-API-Key, never X-Partner-Key or Bearer', async () => {
    const config = baseConfig({ walletApiKey: 'bk_usr_test456' });
    const adapter = new BankrProviderAdapter(config, new BankrLiveTransport(config));
    await adapter.getWalletBalance('0xabc', 'base');
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['X-API-Key']).toBe('bk_usr_test456');
    expect(headers['X-Partner-Key']).toBeUndefined();
    expect(headers['authorization']).toBeUndefined();
  });
});

describe('correction (2026-09-08): key-prefix validation — resolveBankrProviderConfig fails closed on a wrong-class prefix', () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('a write key without the bk_ptr_ prefix is treated as absent, never sent under the wrong auth style', async () => {
    for (const k of Object.keys(process.env)) if (k.startsWith('BANKR_')) delete process.env[k];
    process.env.BANKR_WRITE_API_KEY = 'not-a-real-prefix-12345';
    const { resolveBankrProviderConfig, isBankrConfigured } = await import('@/services/financialServices/providers/bankr/bankrConfig');
    const config = resolveBankrProviderConfig();
    expect(config.credentials.writeApiKey).toBeNull();
    expect(isBankrConfigured(config)).toBe(false);
  });

  it('a correctly-prefixed bk_ptr_ write key IS accepted', async () => {
    for (const k of Object.keys(process.env)) if (k.startsWith('BANKR_')) delete process.env[k];
    process.env.BANKR_WRITE_API_KEY = 'bk_ptr_real12345';
    const { resolveBankrProviderConfig, isBankrConfigured } = await import('@/services/financialServices/providers/bankr/bankrConfig');
    const config = resolveBankrProviderConfig();
    expect(config.credentials.writeApiKey).toBe('bk_ptr_real12345');
    expect(isBankrConfigured(config)).toBe(true);
  });

  it('a wallet key must carry the bk_usr_ prefix, never bk_ptr_', async () => {
    for (const k of Object.keys(process.env)) if (k.startsWith('BANKR_')) delete process.env[k];
    process.env.BANKR_WALLET_API_KEY = 'bk_ptr_wrong_class';
    const { resolveBankrProviderConfig } = await import('@/services/financialServices/providers/bankr/bankrConfig');
    const config = resolveBankrProviderConfig();
    expect(config.credentials.walletApiKey).toBeNull();
  });
});

describe('correction (2026-09-08): live-mode enablement is a SECOND, separate gate — credentials alone are never sufficient', () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('a correctly-prefixed, configured credential WITHOUT BANKR_LIVE_MODE_ENABLED still resolves the FAKE transport', async () => {
    for (const k of Object.keys(process.env)) if (k.startsWith('BANKR_')) delete process.env[k];
    process.env.BANKR_WRITE_API_KEY = 'bk_ptr_real12345';
    // deliberately NOT setting BANKR_LIVE_MODE_ENABLED
    const { createBankrProviderAdapter } = await import('@/services/financialServices/providers/bankr/bankrProviderAdapter');
    const adapter = createBankrProviderAdapter();
    expect(adapter.getStatus().mode).toBe('fake');
  });

  it('a correctly-prefixed credential WITH BANKR_LIVE_MODE_ENABLED=true resolves the LIVE transport', async () => {
    for (const k of Object.keys(process.env)) if (k.startsWith('BANKR_')) delete process.env[k];
    process.env.BANKR_WRITE_API_KEY = 'bk_ptr_real12345';
    process.env.BANKR_LIVE_MODE_ENABLED = 'true';
    const { createBankrProviderAdapter } = await import('@/services/financialServices/providers/bankr/bankrProviderAdapter');
    const adapter = createBankrProviderAdapter();
    expect(adapter.getStatus().mode).toBe('live');
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
    const quote = await adapter.getTokenLaunchQuote({ chain: 'base', tokenName: 'Test', tokenSymbol: 'TST', feeRecipient: FEE_RECIPIENT }) as any;
    expect(quote.raw.simulated).toBe(true);
    expect(quote.txHash).toBeNull(); // simulateOnly never returns a txHash (docs.bankr.bot)
  });

  it('a live-transport adapter reports mode: "live"', () => {
    const config = baseConfig({ readOnlyApiKey: 'ro-key' });
    const adapter = new BankrProviderAdapter(config, new BankrLiveTransport(config));
    expect(adapter.getStatus().mode).toBe('live');
  });

  it('correction (2026-09-08): a live quote is stamped simulated:false EVEN THOUGH Bankr\'s own real response never includes a simulated field at all', async () => {
    // A real Bankr response has no reason to ever send a "simulated" key —
    // that is our own bookkeeping field, not theirs. Without the adapter
    // stamping it explicitly, a genuine live quote would store
    // `simulated: undefined` — indistinguishable from "unknown" rather than
    // the honest, explicit `false` every downstream consumer (the readiness
    // projection's rehearsal-mode display, submitApprovedLaunch's
    // mode-mismatch refusal) requires to ever treat a launch as real.
    const config = baseConfig({ writeApiKey: 'bk_ptr_test-key' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        tokenAddress: '0xPredictedTokenAddress',
        poolId: 'pool-abc123',
        chain: 'base',
        feeDistribution: { creator: 9000, bankr: 1000 },
        // deliberately NO `simulated` field and NO `txHash` — a real
        // Bankr simulateOnly response shape (docs.bankr.bot: txHash is
        // omitted when simulating)
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new BankrProviderAdapter(config, new BankrLiveTransport(config));
    const quote = await adapter.getTokenLaunchQuote({ chain: 'base', tokenName: 'Test', tokenSymbol: 'TST', feeRecipient: FEE_RECIPIENT });
    expect(quote.raw.simulated).toBe(false);
    expect(quote.tokenAddress).toBe('0xPredictedTokenAddress'); // the real response's own fields pass through untouched
    expect(quote.txHash).toBeNull();
    vi.unstubAllGlobals();
  });

  it('correction (2026-09-08): partner-key deploys are Base-only — refuses any other chain before ever calling the transport', async () => {
    const adapter = new BankrProviderAdapter(baseConfig(), new BankrFakeTransport());
    await expect(
      adapter.getTokenLaunchQuote({ chain: 'arbitrum', tokenName: 'Test', tokenSymbol: 'TST', feeRecipient: FEE_RECIPIENT }),
    ).rejects.toMatchObject({ code: 'invalid-request' });
  });

  it('correction (2026-09-08): a partner-key deploy requires feeRecipient — refuses rather than send an incomplete request', async () => {
    const adapter = new BankrProviderAdapter(baseConfig(), new BankrFakeTransport());
    await expect(
      adapter.getTokenLaunchQuote({ chain: 'base', tokenName: 'Test', tokenSymbol: 'TST' }),
    ).rejects.toMatchObject({ code: 'invalid-request' });
  });

  it('correction (2026-09-08): degenMode is rejected outright for a partner-key deploy', async () => {
    const adapter = new BankrProviderAdapter(baseConfig(), new BankrFakeTransport());
    await expect(
      adapter.submitTokenLaunch({ chain: 'base', tokenName: 'Test', tokenSymbol: 'TST', feeRecipient: FEE_RECIPIENT, degenMode: true }, 'idem-degen-1'),
    ).rejects.toMatchObject({ code: 'invalid-request' });
  });
});

describe('token-launch submission — idempotency', () => {
  it('refuses a real deploy with no idempotency key', async () => {
    const adapter = new BankrProviderAdapter(baseConfig(), new BankrFakeTransport());
    await expect(
      adapter.request({ method: 'POST', path: '/token-launches/deploy', keyClass: 'write', body: { chain: 'base', tokenName: 'Test', tokenSymbol: 'TST', feeRecipient: FEE_RECIPIENT, simulateOnly: false } }),
    ).rejects.toMatchObject({ code: 'invalid-request' });
  });

  it('a duplicate submission with the same idempotency key returns the SAME activity, never a second one', async () => {
    const adapter = new BankrProviderAdapter(baseConfig(), new BankrFakeTransport());
    const first = await adapter.submitTokenLaunch({ chain: 'base', tokenName: 'Test', tokenSymbol: 'TST', feeRecipient: FEE_RECIPIENT }, 'idem-launch-1');
    const second = await adapter.submitTokenLaunch({ chain: 'base', tokenName: 'Test', tokenSymbol: 'TST', feeRecipient: FEE_RECIPIENT }, 'idem-launch-1');
    expect(second.activityId).toBe(first.activityId);
    expect(second.txHash).toBe(first.txHash);
  });

  it('two DIFFERENT idempotency keys produce two distinct activities', async () => {
    const adapter = new BankrProviderAdapter(baseConfig(), new BankrFakeTransport());
    const first = await adapter.submitTokenLaunch({ chain: 'base', tokenName: 'A', tokenSymbol: 'AAA', feeRecipient: FEE_RECIPIENT }, 'idem-a');
    const second = await adapter.submitTokenLaunch({ chain: 'base', tokenName: 'B', tokenSymbol: 'BBB', feeRecipient: FEE_RECIPIENT }, 'idem-b');
    expect(second.activityId).not.toBe(first.activityId);
  });

  it('a real deploy returns a non-null txHash/activityId — never simulateOnly\'s null shape', async () => {
    const adapter = new BankrProviderAdapter(baseConfig(), new BankrFakeTransport());
    const submission = await adapter.submitTokenLaunch({ chain: 'base', tokenName: 'Test', tokenSymbol: 'TST', feeRecipient: FEE_RECIPIENT }, 'idem-real-1');
    expect(submission.txHash).not.toBeNull();
    expect(submission.activityId).not.toBeNull();
    expect(submission.tokenAddress).not.toBeNull();
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
    await expect(adapter.request({ method: 'POST', path: '/token-launches/deploy', keyClass: 'write', body: {} })).rejects.toMatchObject({
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
    await expect(transport.send({ method: 'GET', path: '/v1/capabilities', keyClass: 'read-only' }, 'ro-key', 'X-Partner-Key')).rejects.toMatchObject({
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
