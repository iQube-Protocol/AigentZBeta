/**
 * Bankr provider adapter — the ONE class every caller (MoneyPenny's
 * financial-services orchestrator, Factor's Bankr capability handler, the
 * token-launch domain service) uses to talk to Bankr. Owns: key-class
 * routing (least privilege), auth-header selection, bounded retries for
 * safe/idempotent calls, redacted structured logging, and normalized errors
 * (bankrTypes.ts). Never calls `fetch` itself — that's the transport's job
 * (bankrTransport.ts); this class is transport-agnostic by construction
 * (Phase 9's "same request envelope, live provider later" requirement).
 *
 * LIVE-CONTRACT ALIGNMENT (2026-09-08, docs.bankr.bot) — this file
 * previously called two UNDOCUMENTED endpoints this codebase invented
 * (`/token-launches/quote`, plain `/token-launches` POST) and always sent
 * `Authorization: Bearer`. Both are corrected here to Bankr's own
 * documented contract:
 *   - ONE real endpoint, `POST /token-launches/deploy`, distinguished only
 *     by `simulateOnly` (true = preflight, false = real deploy).
 *   - Partner API keys (`bk_ptr_...`) go in `X-Partner-Key`; provisioned-
 *     wallet user keys (`bk_usr_...`) go in `X-API-Key` — never Bearer.
 *   - Partner-key deploys (the ONLY kind this codebase performs — see
 *     BankrCredentialSet's own doc, walletApiKey is a separate, disjoint
 *     capability) are Base-only, require `feeRecipient`, and reject
 *     `degenMode` outright.
 *
 * Server-side only.
 */

import type {
  BankrAuthHeader,
  BankrCapabilitySummary,
  BankrKeyClass,
  BankrProviderConfig,
  BankrProviderStatus,
  BankrTokenLaunchDeployResult,
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

/** Partner-key deploys (read-only/write keyClass) are the ONLY kind this
 *  codebase performs today — see BankrCredentialSet's own doc. */
const PARTNER_DEPLOY_ALLOWED_CHAIN = 'base';

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
      ...(configured
        ? {}
        : {
            reason: this.transport.mode === 'live'
              ? 'Credentials are configured but BANKR_LIVE_MODE_ENABLED is not set — live mode requires both.'
              : 'No correctly-prefixed BANKR_*_API_KEY is set for this deployment (bk_ptr_.../bk_usr_...).',
          }),
    };
  }

  isConfigured(): boolean {
    return isBankrConfigured(this.config);
  }

  /**
   * Least-privilege key + auth-header routing (Phase 2 requirement, header
   * selection added 2026-09-08). A request declaring `keyClass: 'write'` is
   * refused outright if only a read-only key is configured; it never
   * silently falls back to a broader-scoped key it happens to have.
   * `read-only`/`write` are Partner API keys (`X-Partner-Key`); `wallet` is
   * a provisioned-wallet user key (`X-API-Key`) — never `Authorization:
   * Bearer`, which was this codebase's own prior guess, not Bankr's
   * documented contract. Fake-transport mode always resolves (a placeholder
   * value never actually sent over the network) so simulated rehearsal
   * works with zero credentials configured.
   */
  private resolveAuthForClass(keyClass: BankrKeyClass): { key: string; header: BankrAuthHeader } {
    const header: BankrAuthHeader = keyClass === 'wallet' ? 'X-API-Key' : 'X-Partner-Key';
    if (this.transport.mode === 'fake') return { key: 'simulated-key', header };
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
    return { key, header };
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
    const { key: apiKey, header: authHeader } = this.resolveAuthForClass(req.keyClass);

    let attempt = 0;
    let lastError: unknown;
    while (attempt <= (safeToRetry ? this.config.maxRetries : 0)) {
      try {
        const res = await this.transport.send<T>(req, apiKey, authHeader);
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

  /**
   * The ONE real call site for `POST /token-launches/deploy` — both the
   * preflight (`simulateOnly: true`) and real-submission (`simulateOnly:
   * false`) paths funnel through here so the partner-deploy constraints
   * (Base-only, feeRecipient required, degenMode rejected) are enforced
   * exactly once, never duplicated between the two callers.
   */
  private async deployTokenLaunch(
    input: BankrTokenLaunchQuoteRequest,
    opts: { simulateOnly: boolean; idempotencyKey?: string },
  ): Promise<BankrTokenLaunchDeployResult> {
    // Partner-key deploy constraints (docs.bankr.bot) — this codebase only
    // ever configures a Partner API key (readOnlyApiKey/writeApiKey) for
    // token-launch deploys; walletApiKey is a separate, disjoint capability
    // (direct wallet transfer/swap/sign/submit), never used here. Enforced
    // structurally, not merely documented — the adapter refuses BEFORE
    // sending, rather than letting Bankr's own 4xx be the first place a
    // wrong-chain or degenMode request is caught.
    if (input.chain !== PARTNER_DEPLOY_ALLOWED_CHAIN) {
      throw new BankrProviderError(
        'invalid-request',
        `Partner-key token-launch deploys are Base-only — refusing chain '${input.chain}'.`,
        undefined,
        false,
      );
    }
    if (!input.feeRecipient) {
      throw new BankrProviderError(
        'invalid-request',
        'A partner-key deploy requires feeRecipient — Factor never invents one; the caller must supply the operator-confirmed value.',
        undefined,
        false,
      );
    }
    if (input.degenMode) {
      throw new BankrProviderError(
        'invalid-request',
        'degenMode is rejected for partner-key deploys (docs.bankr.bot) — refusing to send it rather than let Bankr\'s own 4xx be the first place this is caught.',
        undefined,
        false,
      );
    }

    const retrievedAt = new Date().toISOString();
    const body: Record<string, unknown> = {
      chain: input.chain,
      tokenName: input.tokenName,
      tokenSymbol: input.tokenSymbol,
      feeRecipient: input.feeRecipient,
      simulateOnly: opts.simulateOnly,
    };
    if (input.pairedTokenAddress !== undefined) body.pairedTokenAddress = input.pairedTokenAddress;
    if (input.quoteOnlyFees !== undefined) body.quoteOnlyFees = input.quoteOnlyFees;

    const rawResponse = await this.request<Record<string, unknown>>({
      method: 'POST',
      path: '/token-launches/deploy',
      keyClass: 'write',
      body,
      idempotencyKey: opts.idempotencyKey,
    });
    // `simulated` is stamped HERE, authoritatively, from the transport's own
    // mode — never trusted from the provider's raw response (2026-09-08
    // correction: Bankr's real API has no reason to ever include a
    // `simulated` field itself, so leaving it to `rawResponse` would mean a
    // genuine live deploy stores `simulated: undefined` — indistinguishable
    // from "unknown" rather than the honest, explicit `false` that
    // downstream consumers (the readiness projection's rehearsal-mode
    // display, submitApprovedLaunch's simulated-preflight refusal) both
    // require to ever treat a launch as real. The fake transport already
    // sets this itself; stamping it again here is a no-op for that path and
    // the single source of truth for every other transport, present or
    // future.
    const raw = { ...rawResponse, simulated: this.transport.mode === 'fake' };
    return {
      tokenAddress: typeof raw.tokenAddress === 'string' ? raw.tokenAddress : null,
      poolId: typeof raw.poolId === 'string' ? raw.poolId : null,
      // Bankr's own contract: txHash is OMITTED (never present) on a
      // simulateOnly call — a fake/mock transport that returned one anyway
      // would be lying about what simulation means, so this is enforced
      // here rather than trusted from the raw response when simulating.
      txHash: opts.simulateOnly ? null : typeof raw.txHash === 'string' ? raw.txHash : null,
      activityId: opts.simulateOnly ? null : typeof raw.activityId === 'string' ? raw.activityId : null,
      chain: String(raw.chain ?? input.chain),
      feeDistribution: raw.feeDistribution && typeof raw.feeDistribution === 'object' ? (raw.feeDistribution as Record<string, unknown>) : null,
      simulated: raw.simulated as boolean,
      raw,
      sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : `${this.config.apiBaseUrl}/token-launches/deploy`,
      retrievedAt,
    };
  }

  /** "Quote" = a `simulateOnly: true` deploy — Bankr's own docs: "get the
   *  predicted token address and fee distribution without broadcasting a
   *  transaction or reserving launch quota." Never requires (or accepts) an
   *  idempotency key — a simulation is never retried-as-a-write because it
   *  never writes anything. */
  async getTokenLaunchQuote(input: BankrTokenLaunchQuoteRequest): Promise<BankrTokenLaunchTerms> {
    return this.deployTokenLaunch(input, { simulateOnly: true });
  }

  /** Structured Partner API deploy — NEVER a free-form Agent API prompt
   *  (PRD Phase 2 constraint). Always requires an idempotency key; this IS
   *  the one call that can broadcast a real transaction. */
  async submitTokenLaunch(spec: BankrTokenLaunchQuoteRequest, idempotencyKey: string): Promise<BankrTokenLaunchSubmission> {
    return this.deployTokenLaunch(spec, { simulateOnly: false, idempotencyKey });
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
 * Memoized across calls with no explicit configOverride — a real Bankr
 * deployment's job state lives server-side regardless of how many adapter
 * instances a caller constructs, so the deterministic fake transport must
 * behave the same way: a job created by one createBankrProviderAdapter()
 * call (e.g. submitApprovedLaunch) must still be visible to a LATER call
 * (e.g. inspectDeploymentStatus) within the same process. A fresh
 * BankrFakeTransport per call would silently "forget" jobs it just created —
 * discovered via tests/bankr-capability-handlers.test.ts's submit-then-
 * inspect flow (Phase 5).
 */
let cachedFakeTransport: BankrFakeTransport | null = null;

/**
 * The ONE construction point — picks live vs. fake transport based on
 * whether real, correctly-prefixed credentials are configured AND live mode
 * is explicitly enabled (2026-09-08 correction: credentials alone are no
 * longer sufficient — `BANKR_LIVE_MODE_ENABLED` is a second, deliberate
 * opt-in, per the operator's own instruction not to install a real
 * credential until the live-contract tests pass). Never based on NODE_ENV
 * or any other feature flag — a deployment with real keys AND live mode
 * enabled always gets the live transport; anything short of both always
 * gets the deterministic fake.
 */
export function createBankrProviderAdapter(configOverride?: BankrProviderConfig): BankrProviderAdapter {
  const config = configOverride ?? resolveBankrProviderConfig();
  if (isBankrConfigured(config) && config.liveModeEnabled) return new BankrProviderAdapter(config, new BankrLiveTransport(config));
  if (!cachedFakeTransport) cachedFakeTransport = new BankrFakeTransport();
  return new BankrProviderAdapter(config, cachedFakeTransport);
}
