'use client';
/**
 * Runtime Session Diagnostics — opt-in, zero-behavior-change instrumentation
 * for the cross-runtime ~3-second reset investigation (Bug B, 2026-08-29).
 *
 * Tests the hypothesis: getSession() stalls -> GET_SESSION_TIMEOUT_MS (3000ms,
 * utils/supabaseBrowser.ts) fires -> caller reads token/session as absent ->
 * persona/auth state changes -> refresh/re-fetch cascade -> UI remount/reset
 * -> a later Supabase auth event restores the session. This module ONLY
 * records timestamps/labels; it decides nothing and changes no control flow
 * anywhere it is called from — every call site below is a single fire-and-
 * forget `logRuntimeEvent(...)` line with no return value consumed.
 *
 * ── ACTIVATION (zero behavior change when off) ─────────────────────────────
 *
 * Enabled ONLY by `?debug_runtime_session=1` in the URL (persisted to
 * `sessionStorage` so it survives the very navigation/remount events being
 * investigated — a query param alone would be stripped by exactly the event
 * this exists to observe). No repo-wide diagnostics flag existed before this;
 * this is the one home for it now — extend it rather than adding a second.
 *
 * `isRuntimeDiagnosticsEnabled()` is cached per page load (module-level), so
 * every call site pays only a boolean check, never a URL/storage read, once
 * resolved. `logRuntimeEvent` is a no-op in every other case: disabled, SSR
 * (`typeof window === 'undefined'`), or console unavailable.
 *
 * NEVER logs: access tokens, refresh tokens, session objects/JWTs, or any
 * other credential/session content. `personaId` (already sitting in plain
 * `localStorage.currentPersonaId` for every ordinary personaFetch call — see
 * that module's own header) is included when present because the operator
 * explicitly asked for it; nothing else identity-bearing is added.
 */

const STORAGE_KEY = 'debug_runtime_session';

let cachedEnabled: boolean | null = null;

function computeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('debug_runtime_session') === '1') {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* sessionStorage unavailable — flag still applies for this call */
      }
      return true;
    }
  } catch {
    /* malformed location — fall through to storage check */
  }
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** True once per page load after the first check; recomputed on explicit reset (tests only). */
export function isRuntimeDiagnosticsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (cachedEnabled === null) cachedEnabled = computeEnabled();
  return cachedEnabled;
}

/** Test-only: force re-evaluation of the activation flag. */
export function __resetRuntimeDiagnosticsCacheForTests(): void {
  cachedEnabled = null;
}

function safeCurrentPersonaId(): string | null {
  try {
    return (
      window.localStorage.getItem('currentPersonaId') ??
      window.sessionStorage.getItem('currentPersonaId') ??
      null
    );
  } catch {
    return null;
  }
}

function safePathname(): string | undefined {
  try {
    return window.location.pathname;
  } catch {
    return undefined;
  }
}

export interface RuntimeDiagnosticDetail {
  /** What triggered this event, e.g. 'mount', 'unmount', 'auth-state-change', 'timeout'. */
  source?: string;
  /** Auth status label at the time of this event, when the caller already knows it. */
  authStatus?: string;
  /** Elapsed duration in ms, for start/end pairs. */
  elapsedMs?: number;
  /** Free-form extra context — never a token, session object, or other secret. */
  [key: string]: unknown;
}

/**
 * Records one diagnostic line: high-resolution timestamp, event name,
 * pathname, current persona id (if available), and whatever detail the
 * caller supplies. No-op unless diagnostics are enabled for this page load.
 */
export function logRuntimeEvent(event: string, detail?: RuntimeDiagnosticDetail): void {
  if (!isRuntimeDiagnosticsEnabled()) return;
  if (typeof console === 'undefined' || typeof console.log !== 'function') return;
  const hiResMs =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? Math.round(performance.now() * 1000) / 1000
      : Date.now();
  // eslint-disable-next-line no-console
  console.log('[runtime-diag]', {
    hiResMs,
    wallClock: new Date().toISOString(),
    event,
    pathname: safePathname(),
    personaId: safeCurrentPersonaId(),
    ...detail,
  });
}

/** Convenience: returns a high-resolution "now" for measuring elapsed durations across a start/end pair. */
export function runtimeDiagnosticNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}
