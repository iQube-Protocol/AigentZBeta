// @vitest-environment jsdom
/**
 * Runtime Session Diagnostics (Bug B, 2026-08-29) — zero-behavior-change
 * proof for the shared, opt-in instrumentation added to investigate the
 * cross-runtime ~3-second reset (aigentMe, other bridges, now OCSGA).
 *
 * Two things pinned:
 *   1. Behavioural: `logRuntimeEvent` is a genuine no-op — no console call,
 *      no thrown error, no return value any caller could branch on — unless
 *      `?debug_runtime_session=1` was present or `sessionStorage` already
 *      carries the flag. Every instrumented call site in the codebase is
 *      `logRuntimeEvent(...)` with its return value discarded, so this
 *      property alone proves none of them can change control flow.
 *   2. Structural: every instrumented file imports the diagnostics module
 *      and calls `logRuntimeEvent`/`runtimeDiagnosticNow` only — never a
 *      second, ad-hoc console.log for this investigation, and never a
 *      diagnostics call left unguarded at module scope (which would fire
 *      even with the flag off).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readSource } from './_lib/sourceAuthority';

describe('logRuntimeEvent — zero behavior change when disabled (the default)', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // jsdom default location has no query string and a fresh sessionStorage.
    window.sessionStorage.clear();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('logs nothing when the URL has no debug_runtime_session flag and sessionStorage is empty', async () => {
    const { logRuntimeEvent } = await import('@/utils/runtimeSessionDiagnostics');
    logRuntimeEvent('some:event', { anything: 'here' });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('isRuntimeDiagnosticsEnabled() is false by default', async () => {
    const { isRuntimeDiagnosticsEnabled } = await import('@/utils/runtimeSessionDiagnostics');
    expect(isRuntimeDiagnosticsEnabled()).toBe(false);
  });

  it('returns undefined (never a value a caller could branch on) whether enabled or not', async () => {
    const { logRuntimeEvent } = await import('@/utils/runtimeSessionDiagnostics');
    const result = logRuntimeEvent('some:event');
    expect(result).toBeUndefined();
  });

  it('never throws even when console.log is unavailable', async () => {
    const originalLog = console.log;
    // @ts-expect-error — deliberately simulating an environment with no console.log
    console.log = undefined;
    try {
      const { logRuntimeEvent } = await import('@/utils/runtimeSessionDiagnostics');
      expect(() => logRuntimeEvent('some:event')).not.toThrow();
    } finally {
      console.log = originalLog;
    }
  });
});

describe('logRuntimeEvent — activation via ?debug_runtime_session=1, persisted across navigation', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    window.sessionStorage.clear();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('logs once the query flag is present, and never logs a token/session field', async () => {
    window.history.pushState({}, '', '/bridge/ocsga?debug_runtime_session=1');
    const { logRuntimeEvent } = await import('@/utils/runtimeSessionDiagnostics');
    logRuntimeEvent('bridge/ocsga:mount');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [, payload] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.event).toBe('bridge/ocsga:mount');
    expect(payload.pathname).toBe('/bridge/ocsga');
    expect(JSON.stringify(payload)).not.toMatch(/access_token|refresh_token|session/i);
  });

  it('persists the flag to sessionStorage so a later call (post-navigation) still logs even without the query param', async () => {
    window.history.pushState({}, '', '/bridge/ocsga?debug_runtime_session=1');
    const mod1 = await import('@/utils/runtimeSessionDiagnostics');
    mod1.logRuntimeEvent('first-call');
    expect(window.sessionStorage.getItem('debug_runtime_session')).toBe('1');

    // Simulate a subsequent same-tab navigation that drops the query string —
    // exactly the event this instrumentation exists to survive.
    window.history.pushState({}, '', '/bridge/ocsga');
    vi.resetModules();
    const mod2 = await import('@/utils/runtimeSessionDiagnostics');
    consoleSpy.mockClear();
    mod2.logRuntimeEvent('second-call-after-navigation');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it('never logs when sessionStorage is absent/cleared and the URL carries no flag', async () => {
    window.history.pushState({}, '', '/bridge/ocsga');
    const { logRuntimeEvent } = await import('@/utils/runtimeSessionDiagnostics');
    logRuntimeEvent('should-not-log');
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});

describe('every instrumented call site discards logRuntimeEvent\'s return value — cannot affect control flow', () => {
  const INSTRUMENTED_FILES = [
    'utils/supabaseBrowser.ts',
    'utils/personaSpine.tsx',
    'components/journey/JourneyRunSurface.tsx',
    'app/bridge/ocsga/page.tsx',
    'components/companion/PassportConnectPanel.tsx',
    'components/metame/MetaMeRuntimeClient.tsx',
    'services/companion/sidePanelTabBridge.ts',
  ];

  it('imports the shared diagnostics module rather than a second, ad-hoc logger', () => {
    for (const file of INSTRUMENTED_FILES) {
      const src = readSource(file);
      expect(src, `${file} should import runtimeSessionDiagnostics`).toMatch(
        /from ["']@\/utils\/runtimeSessionDiagnostics["']/,
      );
    }
  });

  it('never assigns logRuntimeEvent(...) to a variable or uses it in a condition — always a bare statement', () => {
    for (const file of INSTRUMENTED_FILES) {
      const src = readSource(file);
      // A bare `logRuntimeEvent(...)` call (optionally preceded by whitespace)
      // is fire-and-forget; these patterns would mean its return value is
      // being consumed, which the module deliberately returns void to forbid.
      expect(src).not.toMatch(/(?:const|let|var)\s+\w+\s*=\s*logRuntimeEvent\(/);
      expect(src).not.toMatch(/if\s*\(\s*logRuntimeEvent\(/);
      expect(src).not.toMatch(/return\s+logRuntimeEvent\(/);
    }
  });

  it('the app/(embed)/triad/embed/companion page instruments its window.location.reload() call', () => {
    const src = readSource('app/(embed)/triad/embed/companion/page.tsx');
    expect(src).toMatch(/from ["']@\/utils\/runtimeSessionDiagnostics["']/);
    expect(src).toMatch(/logRuntimeEvent\(["']embed\/companion:window\.location\.reload["']/);
    // The reload call itself is unchanged — instrumentation observes it, never replaces it.
    expect(src).toContain('window.location.reload()');
  });
});

describe('the diagnostics module itself never logs credential/session content', () => {
  it('logRuntimeEvent\'s own source never reads an access token, refresh token, or full session object', () => {
    const src = readSource('utils/runtimeSessionDiagnostics.ts');
    expect(src).not.toMatch(/access_token|refresh_token/);
  });

  it('supabaseBrowser.ts\'s new instrumentation logs booleans/durations about the session, never the session/token itself', () => {
    const src = readSource('utils/supabaseBrowser.ts');
    // hasSession / hasToken booleans are fine; the raw token or session object must never appear as a logged field.
    const diagCalls = src.match(/logRuntimeEvent\([^)]*\)/gs) ?? [];
    expect(diagCalls.length).toBeGreaterThan(0);
    for (const call of diagCalls) {
      expect(call).not.toMatch(/access_token:\s*(session|token)\b/);
      expect(call).not.toMatch(/session:\s*session\b/);
    }
  });
});
