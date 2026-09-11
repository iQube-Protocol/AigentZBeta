// @vitest-environment jsdom
/**
 * Live Journey state projection — Journey 0 closure item 2 (2026-09-06
 * closeout doc, item 2: "completed stages should turn green immediately,
 * not require leave/re-enter").
 *
 * Root cause (confirmed by direct read of PilotJourneyTab.tsx,
 * RegisterAgentPanel.tsx, AgreementRatifyPanel.tsx): `JourneyRunSurface`
 * already exposes a `requestStateRefresh` callback to every mounted stage
 * surface (via `resolveSurfaceProps`, JourneyRunSurface.tsx:1626) — the SAME
 * `refresh()` used by mount/manual-refresh/personaSpine-transition — but
 * `PilotJourneyTab.tsx`'s own `resolveSurfaceProps` never destructured or
 * forwarded it to ANY surface (unlike `IanJourneyTab.tsx`, which already
 * threads it to `PassportBureauApplyTab`). `RegisterAgentPanel` and
 * `AgreementRatifyPanel` had no way to ask the journey to re-read canonical
 * state after their own successful mutation, so the stage stepper's
 * green/complete indicator stayed stale until the whole `JourneyRunSurface`
 * remounted (leaving and re-entering the journey) and ran its mount-effect
 * refresh.
 *
 * Fixed by (1) threading `requestStateRefresh` uniformly into every surface
 * PilotJourneyTab resolves, and (2) calling it from RegisterAgentPanel and
 * AgreementRatifyPanel at the exact moment EACH ALREADY DETECTS a real,
 * server-confirmed transition — never optimistically, never unconditionally
 * on every poll tick (which would be a refresh storm, not a fix).
 *
 * These tests render the REAL `RegisterAgentPanel` (the register→claim
 * ceremony's real observer-refresh path — pollStatus is exercised
 * end-to-end by tests/register-ceremony.test.ts and is not re-driven here)
 * and prove the delayed-receipt / idempotent-resume / refresh-parity
 * behavior of its periodic re-read. AgreementRatifyPanel's and
 * PilotJourneyTab's wiring are proven by source-level assertion, matching
 * this repo's own stated convention for large stateful panels with no
 * render harness precedent (see tests/pnl-evidence-wiring.test.ts's header).
 */
import React from 'react';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import fs from 'fs';
import path from 'path';

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function fakeJsonResponse(body: Record<string, unknown>, status = 200) {
  const raw = JSON.stringify(body);
  return { ok: status < 400, status, json: async () => body, text: async () => raw } as unknown as Response;
}

vi.mock('@/services/wallet/walletSurfaceRequest', () => ({
  requestWalletSurface: vi.fn(() => 1),
  subscribeWalletSurfaceCompletion: vi.fn(() => () => {}),
  subscribeWalletSurfaceAck: vi.fn(() => () => {}),
}));

// AgentCardSurface renders its own card fetch — irrelevant to this file's
// invalidation assertions, stubbed to keep the harness focused.
vi.mock('@/components/journey/AgentCardSurface', () => ({
  AgentCardSurface: () => <div data-testid="agent-card-surface" />,
}));

// Mutable receipts fixture, keyed by runtimeAgentId — flipped mid-test to
// simulate a delayed receipt landing between polls, or a different agent
// becoming registered after an agent switch, without remounting the
// component. Value is the confirmed tokenId, or null while unregistered.
const registeredTokenIdByAgent = new Map<string, string | null>([
  ['aigent-moneypenny', null],
  ['aigent-nakamoto', null],
]);

const personaFetchMock = vi.fn(async (url: string) => {
  const u = String(url);
  if (u.includes('/api/wallet/signing-requests')) {
    return fakeJsonResponse({ ok: true, requests: [] });
  }
  if (u.includes('/api/assistant/receipts')) {
    const receipts = [...registeredTokenIdByAgent.entries()]
      .filter(([, tokenId]) => tokenId)
      .map(([runtimeAgentId, tokenId]) => ({
        actionType: 'horizen_agent_registered',
        agentsInvoked: [runtimeAgentId],
        actionInput: { txHash: `0xtx-${runtimeAgentId}`, network: 'base-sepolia', registration: { tokenId } },
      }));
    return fakeJsonResponse({ ok: true, receipts });
  }
  if (u.includes('/api/wallet/principal/status')) {
    return fakeJsonResponse({ ok: true, ready: false, capability: 'LEGACY_EVIDENCE_ONLY', controlProven: false });
  }
  if (u.includes('/api/persona/sponsored-agents')) {
    return fakeJsonResponse({ ok: true, agents: [] });
  }
  return fakeJsonResponse({ ok: true });
});

vi.mock('@/utils/personaSpine', () => ({
  personaFetch: (url: string, init?: unknown) => personaFetchMock(url, init),
}));

// RegisterAgentPanel's own agent-card confirmation read uses plain fetch(),
// never personaFetch (it's a public GET) — mirrors the same fixture, keyed
// by the agentSlug embedded in the requested card path.
vi.stubGlobal(
  'fetch',
  vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    const match = u.match(/\/api\/agents\/([^/]+)\/agent-card\.json/);
    if (match) {
      const runtimeAgentId = `aigent-${match[1]}`;
      const tokenId = registeredTokenIdByAgent.get(runtimeAgentId) ?? null;
      return fakeJsonResponse({
        metadata: { horizen: tokenId ? { tokenId, network: 'base-sepolia' } : { tokenId: null, network: null } },
      });
    }
    return fakeJsonResponse({});
  }),
);

import { RegisterAgentPanel } from '@/components/journey/RegisterAgentPanel';

beforeEach(() => {
  registeredTokenIdByAgent.set('aigent-moneypenny', null);
  registeredTokenIdByAgent.set('aigent-nakamoto', null);
  personaFetchMock.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('RegisterAgentPanel — live invalidation of the journey observer (no leave/re-enter required)', () => {
  it('does not call requestStateRefresh while the agent is not yet registered', async () => {
    const requestStateRefresh = vi.fn();
    render(<RegisterAgentPanel personaId="persona-1" agentSlug="moneypenny" requestStateRefresh={requestStateRefresh} />);

    await waitFor(() => expect(personaFetchMock).toHaveBeenCalled());
    expect(requestStateRefresh).not.toHaveBeenCalled();
  });

  it('a delayed receipt landing between polls triggers exactly one canonical refresh, the instant the periodic re-read notices it', async () => {
    const requestStateRefresh = vi.fn();
    render(<RegisterAgentPanel personaId="persona-1" agentSlug="moneypenny" requestStateRefresh={requestStateRefresh} />);

    await waitFor(() => expect(personaFetchMock).toHaveBeenCalled());
    expect(requestStateRefresh).not.toHaveBeenCalled();

    // The receipt lands (e.g. a DVN-anchored horizen_agent_registered row
    // appears) WITHOUT this component remounting — simulated by flipping the
    // fixture and firing the SAME 'focus' re-read this panel already
    // performs "on window focus... exactly when the state has most likely
    // changed" (its own comment).
    registeredTokenIdByAgent.set('aigent-moneypenny', '9999');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(requestStateRefresh).toHaveBeenCalledTimes(1));
  });

  it('idempotent resume: repeated re-reads of an ALREADY-registered agent never re-fire the refresh a second time', async () => {
    const requestStateRefresh = vi.fn();
    render(<RegisterAgentPanel personaId="persona-1" agentSlug="moneypenny" requestStateRefresh={requestStateRefresh} />);
    await waitFor(() => expect(personaFetchMock).toHaveBeenCalled());

    registeredTokenIdByAgent.set('aigent-moneypenny', '9999');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(requestStateRefresh).toHaveBeenCalledTimes(1));

    // Two more re-reads of the SAME already-registered state (window focus
    // again, e.g. the operator tabbing away and back repeatedly) — the
    // transition already happened, so no further refresh is warranted; a
    // refresh call per tick regardless of state change would be a refresh
    // storm, not a fix.
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(personaFetchMock.mock.calls.length).toBeGreaterThan(0));
    expect(requestStateRefresh).toHaveBeenCalledTimes(1);
  });

  it('refresh/re-entry parity: a fresh mount (the pre-existing leave-and-re-enter path) that finds the agent ALREADY registered still asks the journey to project it — the new live path is additive, not a replacement that could regress the old one', async () => {
    registeredTokenIdByAgent.set('aigent-moneypenny', '9999');
    const requestStateRefresh = vi.fn();
    render(<RegisterAgentPanel personaId="persona-1" agentSlug="moneypenny" requestStateRefresh={requestStateRefresh} />);

    await waitFor(() => expect(requestStateRefresh).toHaveBeenCalledTimes(1));
  });

  it('an agent switch does not suppress the newly-selected agent\'s own later confirmation (operator review, 2026-09-06 — the dedup key must be scoped per agent, never a bare tokenId/seen-flag)', async () => {
    // moneypenny starts already registered, so mount fires refresh #1 for it.
    registeredTokenIdByAgent.set('aigent-moneypenny', '9999');
    const requestStateRefresh = vi.fn();
    const { rerender } = render(
      <RegisterAgentPanel personaId="persona-1" agentSlug="moneypenny" requestStateRefresh={requestStateRefresh} />,
    );
    await waitFor(() => expect(requestStateRefresh).toHaveBeenCalledTimes(1));

    /*
     * Switch to nakamoto — RegisterAgentPanel's agentSlug is now a
     * CONTROLLED prop (fixed 2026-09-06: stale-subject-agent race), so the
     * canonical way a parent changes the selection is by re-rendering with
     * a new prop value, exactly as PilotJourneyTab does. Still unregistered,
     * so no additional refresh fires yet.
     */
    rerender(
      <RegisterAgentPanel personaId="persona-1" agentSlug="nakamoto" requestStateRefresh={requestStateRefresh} />,
    );
    const select = screen.getByLabelText(/Agent to register/i) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('nakamoto'));
    expect(requestStateRefresh).toHaveBeenCalledTimes(1);

    // nakamoto's OWN confirmation lands. A dedup keyed on tokenId alone (or
    // on "have we ever refreshed once this session") would wrongly treat
    // this as already-seen and swallow it — it must fire its own refresh.
    registeredTokenIdByAgent.set('aigent-nakamoto', '8888');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(requestStateRefresh).toHaveBeenCalledTimes(2));
  });
});

describe('RegisterAgentPanel — one refresh per (agent, registration), from whichever path notices it first', () => {
  const src = readSrc('components/journey/RegisterAgentPanel.tsx');

  it('both requestStateRefresh call sites (pollStatus live confirmation, readProgress periodic re-read) route through the SAME requestRegistrationRefresh helper — never a bare requestStateRefresh?.() call that a second path could double-fire', () => {
    // The ONLY bare `requestStateRefresh?.();` call left in the file is
    // inside requestRegistrationRefresh's own body — every OTHER call site
    // (pollStatus, readProgress) must go through the helper, never around it.
    const bareCalls = [...src.matchAll(/requestStateRefresh\?\.\(\);/g)];
    expect(bareCalls.length, 'expected exactly one bare call, inside the helper').toBe(1);
    const callSites = [...src.matchAll(/requestRegistrationRefresh\([^)]*\);/g)];
    expect(callSites.length, 'expected exactly the pollStatus and readProgress call sites').toBe(2);
  });

  it('the dedup key is agentSlug:tokenId — never tokenId alone, which would suppress a later agent\'s own confirmation after a switch', () => {
    expect(src).toMatch(/const key = `\$\{agentSlug\}:\$\{tokenId\}`;/);
  });
});

describe('AgreementRatifyPanel — requestStateRefresh only after a server-CONFIRMED authorization (never optimistic)', () => {
  const src = readSrc('components/journey/AgreementRatifyPanel.tsx');

  it('accepts requestStateRefresh as a prop', () => {
    expect(src).toMatch(/requestStateRefresh\?:\s*\(\)\s*=>\s*void;/);
  });

  it('calls requestStateRefresh only INSIDE the try block, AFTER authorized.ok is checked — never in catch/finally, never before the authorize call resolves', () => {
    const tryStart = src.indexOf('const verifyAndSign = useCallback(async () => {');
    const catchStart = src.indexOf('} catch (e) {', tryStart);
    const finallyStart = src.indexOf('} finally {', tryStart);
    const tryBody = src.slice(tryStart, catchStart);
    const catchBody = src.slice(catchStart, finallyStart);

    const authorizedCheckIdx = tryBody.indexOf("if (!authorized.ok) throw new Error");
    const refreshIdx = tryBody.indexOf('requestStateRefresh?.();');
    expect(authorizedCheckIdx, 'authorized.ok gate not found').toBeGreaterThan(-1);
    expect(refreshIdx, 'requestStateRefresh call not found in the try block').toBeGreaterThan(-1);
    expect(refreshIdx).toBeGreaterThan(authorizedCheckIdx);
    expect(catchBody).not.toContain('requestStateRefresh');
  });
});

describe('PilotJourneyTab — requestStateRefresh threaded to every stage surface (no entry surface left stale)', () => {
  const src = readSrc('app/triad/components/codex/tabs/PilotJourneyTab.tsx');

  it('destructures requestStateRefresh from resolveSurfaceProps args', () => {
    expect(src).toMatch(/registerCeremony,\s*requestStateRefresh\s*\}/);
  });

  it('merges requestStateRefresh into EVERY branch\'s returned props at the single return point — never per-branch, never omitted for a subset', () => {
    expect(src).toMatch(/return \{ \.\.\.props, requestStateRefresh \};/);
  });
});
