/**
 * Minimal Aigent Z AA-API client for thin agents.
 *
 * This is an example module intended to be copied or adapted
 * into external projects. It assumes Node 18+ or a fetch-compatible
 * runtime (Edge functions, Deno, etc.).
 */

const AA_BASE_ENV = process.env.AIGENT_Z_AA_BASE ?? process.env.AIGENT_Z_API_BASE;

if (!AA_BASE_ENV) {
  // Intentionally do not throw at import time in case this is used
  // in build steps; individual calls will validate.
  console.warn('[AigentZClient] AIGENT_Z_AA_BASE or AIGENT_Z_API_BASE is not set.');
}

const aaBaseUrl = AA_BASE_ENV ? new URL(AA_BASE_ENV) : undefined;

function ensureBase(): URL {
  if (!aaBaseUrl) {
    throw new Error('Aigent Z base URL not configured. Set AIGENT_Z_AA_BASE or AIGENT_Z_API_BASE.');
  }
  return aaBaseUrl;
}

function aaUrl(path: string): string {
  const base = ensureBase();

  // If base already includes /aa/v1, callers should pass relative paths
  // like 'auth/challenge'. If base is just the host, callers should
  // pass absolute paths like '/aa/v1/auth/challenge'.
  return new URL(path, base).toString();
}

export interface AigentZChallengeResponse {
  nonce: string;
}

export interface AigentZVerifyResponse {
  aa_token: string;
  tenant_id: string;
}

export interface AigentZClientOptions {
  /**
   * Agent DID, e.g. did:example:aigent-z
   */
  did: string;
  /**
   * Function that signs the nonce and returns a signature string.
   * In Phase 1 the server accepts any non-empty signature, but
   * this will harden over time.
   */
  signNonce: (nonce: string) => Promise<string> | string;
}

export class AigentZClient {
  private did: string;
  private signNonce: (nonce: string) => Promise<string>;
  private aaToken: string | null = null;

  constructor(opts: AigentZClientOptions) {
    this.did = opts.did;
    this.signNonce = async (nonce: string) => Promise.resolve(opts.signNonce(nonce));
  }

  /**
   * Perform the challenge/verify flow and cache the aa_token.
   */
  async authenticate(): Promise<string> {
    const challengeRes = await fetch(aaUrl('auth/challenge'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ did: this.did }),
    });

    if (!challengeRes.ok) {
      const text = await challengeRes.text();
      throw new Error(`Aigent Z challenge failed: ${challengeRes.status} ${text}`);
    }

    const { nonce } = (await challengeRes.json()) as AigentZChallengeResponse;

    const signature = await this.signNonce(nonce);

    const verifyRes = await fetch(aaUrl('auth/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ did: this.did, signature }),
    });

    if (!verifyRes.ok) {
      const text = await verifyRes.text();
      throw new Error(`Aigent Z verify failed: ${verifyRes.status} ${text}`);
    }

    const { aa_token } = (await verifyRes.json()) as AigentZVerifyResponse;
    this.aaToken = aa_token;
    return aa_token;
  }

  /**
   * Get a valid aa_token, authenticating if needed.
   */
  async getToken(): Promise<string> {
    if (this.aaToken) return this.aaToken;
    return this.authenticate();
  }

  /**
   * Generic helper to call an AA-API endpoint with Bearer auth.
   *
   * @param path Relative path under /aa/v1 when AIGENT_Z_AA_BASE includes /aa/v1,
   *             e.g. 'payments/transfer'; or absolute path when only host is set.
   * @param init Fetch options (method, headers, body, etc.).
   */
  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getToken();

    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    };

    return fetch(aaUrl(path), { ...init, headers });
  }

  // Convenience wrappers for common operations can be added as needed.

  /** Example: call payments transfer endpoint. */
  async transferQct(params: {
    fromAgentId: string;
    toAgentId: string;
    amountQct: number;
  }): Promise<Response> {
    return this.fetch('payments/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  }
}

// --- DiDQube reputation helpers (via Aigent Z app routes) ---

const APP_BASE_ENV = process.env.AIGENT_Z_APP_BASE ?? process.env.AIGENT_Z_API_BASE;

const appBaseUrl = APP_BASE_ENV ? new URL(APP_BASE_ENV) : undefined;

function ensureAppBase(): URL {
  if (!appBaseUrl) {
    throw new Error(
      'Aigent Z app base URL not configured. Set AIGENT_Z_APP_BASE (e.g. https://dev-beta.aigentz.me).',
    );
  }
  return appBaseUrl;
}

function appUrl(path: string): string {
  const base = ensureAppBase();
  return new URL(path, base).toString();
}

export interface DiDQubeReputationBucket {
  id?: string;
  partition_id: string;
  bucket: number;
  score: number;
  skill_category: string;
  evidence_count: number;
  last_updated: number;
  created_at: number;
}

export interface DiDQubeReputationResponse {
  ok: boolean;
  data?: DiDQubeReputationBucket;
  error?: string | string[];
}

export interface CreateReputationBucketRequest {
  partitionId: string;
  skillCategory: string;
  initialScore: number;
}

/**
 * Fetch a reputation bucket for a given partitionId via Aigent Z HTTP API.
 */
export async function getReputationBucket(partitionId: string): Promise<DiDQubeReputationResponse> {
  const res = await fetch(
    appUrl(`/api/identity/reputation/bucket?partitionId=${encodeURIComponent(partitionId)}`),
    {
      method: 'GET',
    },
  );

  const body = (await res.json()) as DiDQubeReputationResponse;
  return body;
}

/**
 * Create an initial reputation bucket for a partition via Aigent Z HTTP API.
 */
export async function createReputationBucket(
  req: CreateReputationBucketRequest,
): Promise<DiDQubeReputationResponse> {
  const res = await fetch(appUrl('/api/identity/reputation/bucket'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partitionId: req.partitionId,
      skillCategory: req.skillCategory,
      initialScore: req.initialScore,
    }),
  });

  const body = (await res.json()) as DiDQubeReputationResponse;
  return body;
}
