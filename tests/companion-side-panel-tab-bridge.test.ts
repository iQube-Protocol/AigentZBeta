/**
 * services/companion/sidePanelTabBridge.ts — canary (regression fix, 2026-08-01).
 *
 * THE DEFECT: Quick Links and the Passport connect handoff both used to call
 * plain `window.open(url, "_blank", ...)` from inside the Companion embed's
 * iframe — a browsing context nested under the extension's side panel, not a
 * tab. That does not reliably land in the side panel's own host window
 * (operator-reported 2026-08-01: a Quick Link opened in a completely
 * different, non-incognito browser window while testing from an incognito
 * one), and the same shape explains why "Pull Across" kept dying with a red
 * ✗ even after the Companion reported a successful Passport connect.
 *
 * `openInSidePanelHostWindow` is the shared fix: ask the extension side panel
 * (`sidepanel.js`, exercised directly against the real shipped file in
 * `tests/companion-observer.test.ts`) to open the tab via `chrome.tabs.create`
 * instead. This file locks the CLIENT half of that bridge:
 *   - degrades to `false` (caller falls back to its prior `window.open`)
 *     when there is no nesting parent to ask at all;
 *   - resolves a RELATIVE url to an ABSOLUTE one before posting, since the
 *     receiving document is a `chrome-extension://` page that would
 *     otherwise resolve a relative path against its own origin;
 *   - resolves `true` only once the expected ack arrives from `window.parent`
 *     specifically (never trusting an ack from anywhere else); and
 *   - resolves `false` (never hangs, never rejects) when nothing answers in
 *     time, so a caller always has a safe fallback path.
 *
 * No jsdom dependency — this repo runs the default `environment: "node"`
 * suite, so `window` is stubbed by hand per test, mirroring the OWN module's
 * `typeof window === "undefined"` guard.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';

type FakeWindow = {
  location: { origin: string };
  parent: FakeWindow | { postMessage: (data: unknown, targetOrigin: string) => void };
  addEventListener: (type: string, fn: (event: unknown) => void) => void;
  removeEventListener: (type: string, fn: (event: unknown) => void) => void;
};

describe('services/companion/sidePanelTabBridge — openInSidePanelHostWindow', () => {
  const hadWindow = 'window' in globalThis;
  const originalWindow = (globalThis as Record<string, unknown>).window;

  afterEach(() => {
    if (hadWindow) {
      (globalThis as Record<string, unknown>).window = originalWindow;
    } else {
      delete (globalThis as Record<string, unknown>).window;
    }
    vi.resetModules();
  });

  it("resolves false immediately when not nested (window.parent === window) — the plain web-embed case", async () => {
    const win: Partial<FakeWindow> = {
      location: { origin: 'https://dev-beta.aigentz.me' },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    (win as FakeWindow).parent = win as FakeWindow; // top-level — not nested
    (globalThis as Record<string, unknown>).window = win;

    const { openInSidePanelHostWindow } = await import('@/services/companion/sidePanelTabBridge');
    await expect(openInSidePanelHostWindow('/triad/embed/codex/knyt-codex')).resolves.toBe(false);
  });

  it('posts an ABSOLUTE url (resolved against window.location.origin) to window.parent when nested', async () => {
    const posted: Array<{ data: unknown; targetOrigin: string }> = [];
    let messageHandler: ((event: unknown) => void) | null = null;
    const parent = { postMessage: (data: unknown, targetOrigin: string) => posted.push({ data, targetOrigin }) };
    const win: FakeWindow = {
      location: { origin: 'https://dev-beta.aigentz.me' },
      parent,
      addEventListener: (type, fn) => {
        if (type === 'message') messageHandler = fn;
      },
      removeEventListener: () => {},
    };
    (globalThis as Record<string, unknown>).window = win;

    const { openInSidePanelHostWindow, OPEN_TAB_REQUEST, OPEN_TAB_DONE } = await import(
      '@/services/companion/sidePanelTabBridge'
    );
    const promise = openInSidePanelHostWindow('/triad/embed/codex/knyt-codex?tab=knyt-alpha');

    expect(posted).toHaveLength(1);
    expect(posted[0].data).toEqual({
      type: OPEN_TAB_REQUEST,
      url: 'https://dev-beta.aigentz.me/triad/embed/codex/knyt-codex?tab=knyt-alpha',
    });

    // sidepanel.js's ack — must come from window.parent specifically.
    expect(messageHandler).toBeTruthy();
    messageHandler!({ source: parent, data: { type: OPEN_TAB_DONE, ok: true } });

    await expect(promise).resolves.toBe(true);
  });

  it('resolves false (never hangs) when nothing acknowledges within the timeout', async () => {
    const win: FakeWindow = {
      location: { origin: 'https://dev-beta.aigentz.me' },
      parent: { postMessage: () => {} },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    (globalThis as Record<string, unknown>).window = win;

    const { openInSidePanelHostWindow } = await import('@/services/companion/sidePanelTabBridge');
    await expect(openInSidePanelHostWindow('/never-acked')).resolves.toBe(false);
  });

  it('ignores an ack that is not sourced from window.parent — never trusts a spoofed reply', async () => {
    let messageHandler: ((event: unknown) => void) | null = null;
    const parent = { postMessage: () => {} };
    const win: FakeWindow = {
      location: { origin: 'https://dev-beta.aigentz.me' },
      parent,
      addEventListener: (type, fn) => {
        if (type === 'message') messageHandler = fn;
      },
      removeEventListener: () => {},
    };
    (globalThis as Record<string, unknown>).window = win;

    const { openInSidePanelHostWindow, OPEN_TAB_DONE } = await import('@/services/companion/sidePanelTabBridge');
    const promise = openInSidePanelHostWindow('/x');

    const impostor = { postMessage: () => {} };
    messageHandler!({ source: impostor, data: { type: OPEN_TAB_DONE, ok: true } });

    // The spoofed ack must not resolve the promise; it falls through to the
    // timeout and resolves false, same as no answer at all.
    await expect(promise).resolves.toBe(false);
  });
});
