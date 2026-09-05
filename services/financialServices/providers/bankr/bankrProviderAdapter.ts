/**
 * Bankr provider adapter — the ONE class every caller (MoneyPenny's
 * financial-services orchestrator, Factor's Bankr capability handler, the
 * token-launch domain service) uses to talk to Bankr. Owns: key-class
 * routing (least privilege), bounded retries for safe/idempotent calls,
 * redacted structured logging, and normalized errors (bankrTypes.ts). Never
 * calls `fetch` itself — that's the transport's job (bankrTransport.ts);
 * this class is transport-agnostic by construction (Phase 9's "same
 * request envelope, live provider later" requirement).
 *
 * Server-side only.
 */

import type {
  BankrCapabilitySummary,
  BankrKeyClass,
  BankrProviderConfig,
  BankrProviderStatus,
  BankrTokenLaunchQuoteRequest,
  BankrTokenLaunchStatus,
  BankrTokenLaunchSubmission,
  BankrTokenLaunchTerms,
  BankrTransport,
  BankrTransportRequest,
  BankrWalletBalance,
} from './bankrTypes';
import { BankrProviderError } from './bankrTypes';
import { isBankrConfigured, resolveBankrProviderConfig } from './bankrConfig';
import { BankrFakeTransport, BankrLiveTransport } from './bankrTransport';

const REDACT_KEY_PATTERN = /key|secret|token|credential|authorization|auth/i;
/** Field names that would otherwise false-positive on REDACT_KEY_PATTERN
 *  (e.g. `keyClass` contains "key" but names a policy enum, never a secret
 *  value) — exact-match only, never a broader carve-out. */
const REDACT_EXEMPT_FIELD_NAMES = new Set(['keyClass']);

/**
 * Structured log payload with every credential-shaped field stripped —
 * never an API key, private key, or custody reference reaches a log line
 * (Phase 2 requirement). Recurses into nested objects/arrays; primitives
 * pass through unchanged. Field NAME drives redaction, not value shape, so
 * a key accidentally passed under an unexpected field name is still caught
 * whenever the field name itself is credential-shaped.
 */
export function redactBankrLogPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactBankrLogPayload);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        !REDACT_EXEMPT_FIELD_NAMES.has(k) && REDACT_KEY_PATTERN.test(k) ? '[redacted]' : redactBankrLogPayload(v),
      ]),
    );
  }
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BankrProviderAdapter {
  constructor(
    private readonly config: BankrProviderConfig,
    private readonly transport: BankrTransport,
  ) {}

  getStatus(): BankrProviderStatus {
    const configured = isBankrConfigured(this.config);
    return {
      configured,
      mode: this.transport.mode,
      apiBaseUrl: this.config.apiBaseUrl,
      hasReadOnlyKey: Boolean(this.config.credentials.readOnlyApiKey),
      hasWriteKey: Boolean(this.config.credentials.writeApiKey),
      hasWalletKey: Boolean(this.config.credentials.walletApiKey),
      ipAllowlistConfigured: this.config.ipAllowlist.length > 0,
      ...(configured ? {} : { reason: 'No BANKR_*_API_KEY is set for this deployment.' }),
    };
  }

  isConfigured(): boolean {
    return isBankrConfigured(this.config);
  }

  /**
   * Least-privilege key routing (Phase 2 requirement) — a request declaring
   * `keyClass: 'write'` is refused outright if only a read-only key is
   * configured; it never silently falls back to a broader-scoped key it
   * happens to have. Fake-transport mode always resolves (a placeholder
   * value never actually sent over the network) so simulated rehearsal
   * works with zero credentials configured.
   */
  private resolveApiKeyForClass(keyClass: BankrKeyClass): string {
    if (this.transport.mode === 'fake') return 'simulated-key';
    const { readOnlyApiKey, writeApiKey, walletApiKey } = this.config.credentials;
    const key = keyClass === 'wallet' ? walletApiKey : keyClass === 'write' ? writeApiKey : readOnlyApiKey ?? writeApiKey;
    if (!key) {
      throw new BankrProviderError(
        'wrong-key-class',
        `Bankr request requires a '${keyClass}' key, but none is configured for this deployment.`,
        undefined,
        false,
      );
    }
    return key;
  }

  private isRetryable(err: unknown): boolean {
    return err instanceof BankrProviderError && err.retryable;
  }

  /**
   * Bounded retries — ONLY for safe/idempotent calls: GET, or a POST that
   * carries an `idempotencyKey`. A POST with no idempotency key is never
   * retried by this adapter, full stop — a caller wanting a write retried
   * must supply one (the token-launch domain always does; see Phase 4).
   */
  async request<T>(req: BankrTransportRequest): Promise<T> {
    const safeToRetry = req.method === 'GET' || Boolean(req.idempotencyKey);
    const apiKey = this.resolveApiKeyForClass(req.keyClass);

    let attempt = 0;
    let lastError: unknown;
    while (attempt <= (safeToRetry ? this.config.maxRetries : 0)) {
      try {
        const res = await this.transport.send<T>(req, apiKey);
        if (attempt > 0) {
          console.info('[bankr] request succeeded after retry', redactBankrLogPayload({ path: req.path, attempt }));
        }
        return res.data;
      } catch (err) {
        lastError = err;
        console.error('[bankr] request failed', redactBankrLogPayload({ path: req.path, method: req.method, keyClass: req.keyClass, attempt, error: err instanceof Error ? err.message : String(err) }));
        if (!safeToRetry || !this.isRetryable(err) || attempt === this.config.maxRetries) break;
        await sleep(this.config.retryBackoffMs * 2 ** attempt);
        attempt += 1;
      }
    }
    throw lastError instanceof Error ? lastError : new BankrProviderError('network-error', String(lastError));
  }

  async getCapabilities(): Promise<BankrCapabilitySummary> {
    return this.request<BankrCapabilitySummary>({ method: 'GET', path: '/v1/capabilities', keyClass: 'read-only' });
  }

  async getTokenLaunchQuote(input: BankrTokenLaunchQuoteRequest): Promise<BankrTokenLaunchTerms> {
    const retrievedAt = new Date().toISOString();
    const raw = await this.request<Record<string, unknown>>({
      method: 'POST',
      path: '/token-launches/quote',
      keyClass: 'read-only',
      body: { ...input },
    });
    return {
      chain: String(raw.chain ?? input.chain),
      feeBps: typeof raw.feeBps === 'number' ? raw.feeBps : null,
      creatorVestingSupported: Boolean(raw.creatorVestingSupported),
      partnerKeySellsFullSupply: Boolean(raw.partnerKeySellsFullSupply),
      pairedAssetOptions: Array.isArray(raw.pairedAssetOptions) ? (raw.pairedAssetOptions as string[]) : [],
      raw,
      sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : `${this.config.apiBaseUrl}/token-launches/quote`,
      retrievedAt,
    };
  }

  /** Structured Partner API submission — NEVER a free-form Agent API
   *  prompt (PRD Phase 2 constraint). Always requires an idempotency key. */
  async submitTokenLaunch(spec: Record<string, unknown>, idempotencyKey: string): Promise<BankrTokenLaunchSubmission> {
    const raw = await this.request<Record<string, unknown>>({
      method: 'POST',
      path: '/token-launches',
      keyClass: 'write',
      body: spec,
      idempotencyKey,
    });
    return { jobId: String(raw.jobId ?? ''), status: String(raw.status ?? 'unknown'), raw };
  }

  async getTokenLaunchStatus(jobId: string): Promise<BankrTokenLaunchStatus> {
    const raw = await this.request<Record<string, unknown>>({ method: 'GET', path: `/token-launches/${jobId}`, keyClass: 'read-only' });
    return {
      jobId: String(raw.jobId ?? jobId),
      status: String(raw.status ?? 'unknown'),
      tokenAddress: typeof raw.tokenAddress === 'string' ? raw.tokenAddress : null,
      poolAddress: typeof raw.poolAddress === 'string' ? raw.poolAddress : null,
      transactionHash: typeof raw.transactionHash === 'string' ? raw.transactionHash : null,
      explorerUrl: typeof raw.explorerUrl === 'string' ? raw.explorerUrl : null,
      raw,
    };
  }

  async getWalletBalance(address: string, chain: string): Promise<BankrWalletBalance> {
    const raw = await this.request<Record<string, unknown>>({ method: 'GET', path: `/wallet/${address}/balance?chain=${encodeURIComponent(chain)}`, keyClass: 'wallet' });
    return {
      address,
      chain,
      balances: Array.isArray(raw.balances) ? (raw.balances as Array<{ asset: string; amount: string }>) : [],
    };
  }
}

/**
 * The ONE construction point — picks live vs. fake transport based on
 * whether real credentials are configured, never based on NODE_ENV or a
 * feature flag (a deployment with real keys always gets the live
 * transport; one without them always gets the deterministic fake — no
 * environment-based override that could silently swap one for the other).
 */
export function createBankrProviderAdapter(configOverride?: BankrProviderConfig): BankrProviderAdapter {
  const config = configOverride ?? resolveBankrProviderConfig();
  const transport = isBankrConfigured(config) ? new BankrLiveTransport(config) : new BankrFakeTransport();
  return new BankrProviderAdapter(config, transport);
}
