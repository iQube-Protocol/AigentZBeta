/**
 * Bankr provider — shared types (Factor + Aegis Bankr PRD, Phase 2).
 *
 * Bankr (docs.bankr.bot) exposes three surfaces: a prompt-based Agent API
 * (x402-metered, one web request per prompt), a structured Wallet API
 * (`/wallet/transfer|swap|sign|submit`, gated behind `walletApiEnabled` on a
 * key), and Token Launching (`/token-launches`, Partner-Key launches sell
 * 100% into the pool with no creator vesting). This module's types are
 * shaped from the publicly documented surfaces; the PRD's own instruction
 * governs how they're used: "Prefer direct Bankr APIs for known write
 * operations. Do not use a free-form Agent API prompt to perform an
 * irreversible token launch" — so every WRITE operation this codebase
 * performs against Bankr goes through the structured Partner/Wallet API
 * shape below, never a prompt string.
 *
 * Server-side only. Never imported by a client component — credentials
 * (`BankrCredentialSet`) must never reach a browser bundle, a log line, or a
 * receipt payload (see `redactBankrLogPayload` in bankrProviderAdapter.ts).
 */

/** Which key class a request needs — enforces least privilege at the call
 *  site, not just at credential-provisioning time. A request declaring
 *  `keyClass: 'read-only'` can never be routed through a write-capable key,
 *  and vice versa; `resolveCredentialForKeyClass` (bankrProviderAdapter.ts)
 *  refuses rather than silently falling back to a broader key. */
export type BankrKeyClass = 'read-only' | 'write' | 'wallet';

/**
 * Least-privilege credential split (Phase 2 requirement). Any of the three
 * may be absent — `configured` reflects whichever subset is actually
 * present, never assumes all three are required for every deployment.
 * NEVER logged, NEVER returned to a client, NEVER placed in a receipt.
 */
export interface BankrCredentialSet {
  /** Reads only — balances, status, discovery, token-launch listing. */
  readOnlyApiKey: string | null;
  /** Write-capable Partner API key — token-launch submission, fee claims. */
  writeApiKey: string | null;
  /** Wallet API key (`walletApiEnabled`) — direct wallet transfer/swap/sign/submit. Distinct from the write key: a deployment may enable Partner write access without also enabling raw wallet operations. */
  walletApiKey: string | null;
}

export interface BankrProviderConfig {
  apiBaseUrl: string;
  credentials: BankrCredentialSet;
  /** Per-request timeout. */
  timeoutMs: number;
  /** Bounded retries — only ever applied to safe/idempotent calls (GET, or a
   *  POST carrying an idempotency key) on a retryable failure class. */
  maxRetries: number;
  retryBackoffMs: number;
  /**
   * Documented only — IP allowlisting is enforced by deployment
   * infrastructure (a firewall rule, an edge/proxy allowlist, or Bankr's own
   * dashboard-side IP restriction on the key), never by this application
   * code pretending to filter its own outbound traffic. Carried here so
   * `getStatus()` can honestly report whether the deployment claims to have
   * one configured, for operator visibility only.
   */
  ipAllowlist: string[];
  /**
   * A SEPARATE, deliberate opt-in required in addition to a correctly-
   * prefixed credential before `createBankrProviderAdapter` will ever
   * resolve the live transport (2026-09-08 correction — `BANKR_LIVE_MODE_
   * ENABLED`). Credentials existing is not, by itself, permission to go
   * live: this flag is the operator's explicit "yes, actually use them."
   */
  liveModeEnabled: boolean;
}

/** Which HTTP header a resolved key must be sent under — derived from the
 *  key's OWN class (2026-09-08 live-contract alignment, docs.bankr.bot):
 *  Partner API keys (`bk_ptr_...`, read-only/write) go in `X-Partner-Key`;
 *  provisioned-wallet user keys (`bk_usr_...`, wallet) go in `X-API-Key`.
 *  Never `Authorization: Bearer` — that was this codebase's own prior
 *  guess, not Bankr's documented contract. */
export type BankrAuthHeader = 'X-Partner-Key' | 'X-API-Key';

export interface BankrRateLimitInfo {
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
}

/** Normalized Bankr provider error — every transport failure (live or fake)
 *  surfaces as one of these, never a raw fetch/axios error leaking upstream
 *  response shape into caller code. */
export type BankrErrorCode =
  | 'not-configured'
  | 'wrong-key-class'
  | 'unauthorized'
  | 'rate-limited'
  | 'invalid-request'
  | 'upstream-error'
  | 'timeout'
  | 'network-error';

export class BankrProviderError extends Error {
  constructor(
    public readonly code: BankrErrorCode,
    message: string,
    public readonly httpStatus?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'BankrProviderError';
  }
}

export interface BankrTransportRequest {
  method: 'GET' | 'POST';
  path: string;
  keyClass: BankrKeyClass;
  body?: Record<string, unknown>;
  /** Required for every non-GET call this adapter makes — see
   *  bankrProviderAdapter.ts's own idempotency-key enforcement. */
  idempotencyKey?: string;
}

export interface BankrTransportResponse<T> {
  status: number;
  data: T;
  rateLimit: BankrRateLimitInfo;
}

/**
 * The one seam Phase 9's "same request envelope, live provider later"
 * requirement depends on (mirrors the Vela adapter's own live/test-transport
 * split, services/vela/velaTestTransport.ts) — application code never
 * branches on live-vs-fake; it calls `BankrProviderAdapter.request()` and
 * the configured transport decides. `authHeader` names which header the
 * resolved key belongs in (2026-09-08 correction) — the fake transport
 * ignores it (it never sends real HTTP); the live transport uses it instead
 * of a hardcoded `Authorization: Bearer`.
 */
export interface BankrTransport {
  readonly mode: 'live' | 'fake';
  send<T>(request: BankrTransportRequest, resolvedApiKey: string, authHeader: BankrAuthHeader): Promise<BankrTransportResponse<T>>;
}

// ── Domain shapes (Token Launching + Wallet API) ────────────────────────

/** `feeRecipient.type` per Bankr's documented deploy contract — required
 *  for a partner-key deploy, optional for a user-key one. */
export interface BankrFeeRecipient {
  type: 'wallet' | 'x' | 'farcaster' | 'ens';
  value: string;
}

export interface BankrTokenLaunchQuoteRequest {
  chain: string;
  tokenName: string;
  tokenSymbol: string;
  feeRecipient?: BankrFeeRecipient;
  /** Base-only, user-key deploys only (docs.bankr.bot) — never sent on a
   *  partner-key deploy; the adapter enforces this, never merely documents it. */
  pairedTokenAddress?: string;
  quoteOnlyFees?: boolean;
  /** Rejected by Bankr for partner-key deploys — the adapter refuses to
   *  even send it under a partner key rather than let Bankr's own 4xx be
   *  the first place this is caught. */
  degenMode?: boolean;
}

/**
 * The immediate result of `POST /token-launches/deploy` (2026-09-08
 * live-contract alignment — replaces the prior, undocumented
 * `/token-launches/quote` + `/token-launches` submission pair with the
 * ONE real, documented endpoint, distinguished only by `simulateOnly`).
 * `simulateOnly: true` (this codebase's "preflight") returns a PREDICTED
 * `tokenAddress`/`poolId`/`feeDistribution` with `txHash: null` — Bankr's
 * own docs: "get the predicted token address and fee distribution without
 * broadcasting a transaction or reserving launch quota." A real deploy
 * (`simulateOnly: false`) additionally returns `txHash`/`activityId`.
 * `simulated` is stamped by the ADAPTER from the transport's own mode
 * (bankrProviderAdapter.ts), never trusted from the raw response.
 */
export interface BankrTokenLaunchDeployResult {
  tokenAddress: string | null;
  poolId: string | null;
  txHash: string | null;
  activityId: string | null;
  chain: string;
  feeDistribution: Record<string, unknown> | null;
  simulated: boolean;
  raw: Record<string, unknown>;
  sourceUrl: string;
  retrievedAt: string;
}

/** @deprecated Alias kept for the many existing callers ("terms" = the
 *  preflight/`simulateOnly:true` deploy result) — same shape as
 *  `BankrTokenLaunchDeployResult`, named for its historical call site
 *  (`getTokenLaunchQuote`) rather than duplicated. */
export type BankrTokenLaunchTerms = BankrTokenLaunchDeployResult;

/** The result of a REAL (`simulateOnly: false`) deploy — same fields as the
 *  preflight result, but `txHash`/`activityId` are populated. */
export type BankrTokenLaunchSubmission = BankrTokenLaunchDeployResult;

export interface BankrTokenLaunchStatus {
  jobId: string;
  status: string;
  tokenAddress: string | null;
  poolAddress: string | null;
  transactionHash: string | null;
  explorerUrl: string | null;
  raw: Record<string, unknown>;
}

export interface BankrWalletBalance {
  address: string;
  chain: string;
  balances: Array<{ asset: string; amount: string }>;
}

export interface BankrCapabilitySummary {
  agentApiEnabled: boolean;
  walletApiEnabled: boolean;
  tokenLaunchEnabled: boolean;
  supportedChains: string[];
}

export interface BankrProviderStatus {
  configured: boolean;
  mode: 'live' | 'fake';
  apiBaseUrl: string;
  hasReadOnlyKey: boolean;
  hasWriteKey: boolean;
  hasWalletKey: boolean;
  ipAllowlistConfigured: boolean;
  reason?: string;
}
