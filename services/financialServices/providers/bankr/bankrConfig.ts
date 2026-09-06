/**
 * Bankr provider configuration — server-only env resolution.
 *
 * No `BANKR_*` env var exists anywhere in this deployment today (verified,
 * 2026-09-05 reconciliation: `.env.example`, the env-allowlist script, and
 * every Amplify env reference were checked — none exist). This function
 * therefore returns `configured: false` honestly whenever a key is absent —
 * it NEVER fabricates a live connection, per the PRD's own Phase 0
 * instruction. Adding real credentials later requires no code change here:
 * only the env vars need to be set, and the operator must add them to
 * `scripts/create-env-production.js`'s allowlist per this repo's own
 * multi-agent-coordination convention (CLAUDE.md, "high-collision files").
 */

import type { BankrProviderConfig } from './bankrTypes';

const DEFAULT_API_BASE_URL = 'https://api.bankr.bot';
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BACKOFF_MS = 500;

function envString(name: string): string | null {
  const raw = process.env[name];
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function envList(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Pure, side-effect-free — reads `process.env` fresh on every call so a
 *  test can set/unset env vars per-case without needing a module reset. */
export function resolveBankrProviderConfig(): BankrProviderConfig {
  return {
    apiBaseUrl: envString('BANKR_API_BASE_URL') ?? DEFAULT_API_BASE_URL,
    credentials: {
      readOnlyApiKey: envString('BANKR_READ_ONLY_API_KEY'),
      writeApiKey: envString('BANKR_WRITE_API_KEY'),
      walletApiKey: envString('BANKR_WALLET_API_KEY'),
    },
    timeoutMs: envInt('BANKR_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
    maxRetries: envInt('BANKR_MAX_RETRIES', DEFAULT_MAX_RETRIES),
    retryBackoffMs: envInt('BANKR_RETRY_BACKOFF_MS', DEFAULT_RETRY_BACKOFF_MS),
    ipAllowlist: envList('BANKR_IP_ALLOWLIST'),
  };
}

/** At least a read-only key is required to consider Bankr "configured" at
 *  all — a deployment with zero keys is unconfigured, full stop, regardless
 *  of what apiBaseUrl/timeouts say. */
export function isBankrConfigured(config: BankrProviderConfig): boolean {
  return Boolean(config.credentials.readOnlyApiKey || config.credentials.writeApiKey || config.credentials.walletApiKey);
}
