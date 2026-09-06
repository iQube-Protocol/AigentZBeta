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
}

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
 * the configured transport decides.
 */
export interface BankrTransport {
  readonly mode: 'live' | 'fake';
  send<T>(request: BankrTransportRequest, resolvedApiKey: string): Promise<BankrTransportResponse<T>>;
}

// ── Domain shapes (Token Launching + Wallet API) ────────────────────────

export interface BankrTokenLaunchQuoteRequest {
  chain: string;
  tokenName: string;
  tokenSymbol: string;
  pairedAsset?: string;
}

/** Fee/economic terms Bankr's own API returns at quote/preparation time —
 *  NEVER hardcoded by this codebase (Phase 4 requirement). Captured
 *  verbatim, with retrieval provenance, and bound into the launch spec. */
export interface BankrTokenLaunchTerms {
  chain: string;
  feeBps: number | null;
  creatorVestingSupported: boolean;
  partnerKeySellsFullSupply: boolean;
  pairedAssetOptions: string[];
  raw: Record<string, unknown>;
  /** Where these terms came from and when — required for Phase 4's "source
   *  URL and retrieval timestamp" field. */
  sourceUrl: string;
  retrievedAt: string;
}

export interface BankrTokenLaunchSubmission {
  jobId: string;
  status: string;
  raw: Record<string, unknown>;
}

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
