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
 *
 * KEY PREFIX VALIDATION (2026-09-08, live-contract alignment) — Bankr's own
 * documented key formats (docs.bankr.bot): a Partner API key is prefixed
 * `bk_ptr_` (organization-level, sent via `X-Partner-Key`); a provisioned-
 * wallet user key is prefixed `bk_usr_` (sent via `X-API-Key`). A configured
 * value that does NOT carry its expected prefix is treated as absent — never
 * silently accepted and sent under the wrong header/auth style. This is a
 * fail-closed validation, not a lenient warning: a malformed or
 * wrong-class credential must never be mistaken for a working one.
 *
 * LIVE-MODE ENABLEMENT — credentials alone are NOT sufficient to ever
 * resolve the live transport (see createBankrProviderAdapter). `BANKR_LIVE_
 * MODE_ENABLED=true` is a SEPARATE, deliberate opt-in required in addition
 * to a correctly-prefixed key — the operator's own explicit instruction:
 * "Do not install a real credential until these contract tests pass," and
 * even once installed, live mode must still be a second, distinct switch.
 */

import type { BankrProviderConfig } from './bankrTypes';

const DEFAULT_API_BASE_URL = 'https://api.bankr.bot';
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BACKOFF_MS = 500;

const PARTNER_KEY_PREFIX = 'bk_ptr_';
const USER_KEY_PREFIX = 'bk_usr_';

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

function envBool(name: string): boolean {
  return (process.env[name] ?? '').trim().toLowerCase() === 'true';
}

/** A key that doesn't carry its class's documented prefix is treated as
 *  absent (never sent under the wrong header/auth style). */
function partnerKey(name: string): string | null {
  const value = envString(name);
  return value && value.startsWith(PARTNER_KEY_PREFIX) ? value : null;
}
function userKey(name: string): string | null {
  const value = envString(name);
  return value && value.startsWith(USER_KEY_PREFIX) ? value : null;
}

/** Pure, side-effect-free — reads `process.env` fresh on every call so a
 *  test can set/unset env vars per-case without needing a module reset. */
export function resolveBankrProviderConfig(): BankrProviderConfig {
  return {
    apiBaseUrl: envString('BANKR_API_BASE_URL') ?? DEFAULT_API_BASE_URL,
    credentials: {
      readOnlyApiKey: partnerKey('BANKR_READ_ONLY_API_KEY'),
      writeApiKey: partnerKey('BANKR_WRITE_API_KEY'),
      walletApiKey: userKey('BANKR_WALLET_API_KEY'),
    },
    timeoutMs: envInt('BANKR_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
    maxRetries: envInt('BANKR_MAX_RETRIES', DEFAULT_MAX_RETRIES),
    retryBackoffMs: envInt('BANKR_RETRY_BACKOFF_MS', DEFAULT_RETRY_BACKOFF_MS),
    ipAllowlist: envList('BANKR_IP_ALLOWLIST'),
    liveModeEnabled: envBool('BANKR_LIVE_MODE_ENABLED'),
  };
}

/** At least a correctly-prefixed key is required to consider Bankr
 *  "configured" at all — a deployment with zero valid keys is unconfigured,
 *  full stop, regardless of what apiBaseUrl/timeouts say. Does NOT by
 *  itself mean the live transport will be used — see `liveModeEnabled`. */
export function isBankrConfigured(config: BankrProviderConfig): boolean {
  return Boolean(config.credentials.readOnlyApiKey || config.credentials.writeApiKey || config.credentials.walletApiKey);
}
