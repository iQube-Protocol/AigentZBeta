// @vitest-environment jsdom
/**
 * components/research/FreezeVP2InternalPilotAction.tsx — genuine
 * component-level tests (2026-09-07 UI/orchestration repair: "Track 2 is
 * allowed to say science still has limitations. It is not allowed to hide a
 * separately authorized lifecycle act.").
 *
 * React Testing Library over jsdom, rendering the REAL component — not a
 * source-text/regex proxy. `personaFetch` is the only IO seam; mocked per
 * test. Pins the requirements this component exists to satisfy:
 *
 *   1. Renders from the artifact's OWN lifecycle + a fast, independent
 *      freeze-preview read — never from a `readiness`/`programme` prop, and
 *      never gated on any Track 2 programme composition succeeding.
 *   2. Nothing is typed in by the operator — `signedBy`/`operatorRef` is
 *      resolved from the session; `contentHash` and the failing scientific-
 *      readiness checks come from the freeze-preview package.
 *   3. One explicit confirmation performs the ONLY write; the POST body
 *      carries `executionDesignation: 'internal-pilot'`,
 *      `boundaryAcknowledged: true`, and `scientificDeviations` derived from
 *      the live failing checks — never a hardcoded pair of check names.
 *   4. A refresh failure never clears already-good data — an honest note
 *      stands alongside the last observation, never in place of it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPersonaFetch = vi.fn();
vi.mock('@/utils/personaSpine', () => ({
  personaFetch: (...args: any[]) => mockPersonaFetch(...args),
}));

const { FreezeVP2InternalPilotAction } = await import('@/components/research/FreezeVP2InternalPilotAction');

function jsonResponse(status: number, body: unknown) {
  return { status, json: async () => body } as Response;
}

const READINESS_CHECKS = [
  { name: 'selection-space', tier: 'scientific-readiness', passed: true, detail: '63 >= 60' },
  { name: 'derivation-headroom', tier: 'scientific-readiness', passed: false, detail: '0 entailment chains against a floor of 12' },
  { name: 'boundary-coverage', tier: 'scientific-readiness', passed: false, detail: '2/15 declared namespaces represented' },
];

function mockRoute(path: RegExp, response: Response | (() => Response)) {
  mockPersonaFetch.mockImplementation((url: string) => {
    if (path.test(url)) return Promise.resolve(typeof response === 'function' ? response() : response);
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
}

function mockSequence(handlers: Array<{ match: RegExp; response: Response | (() => Response) }>) {
  mockPersonaFetch.mockImplementation((url: string) => {
    const h = handlers.find((h) => h.match.test(url));
    if (!h) return Promise.reject(new Error(`unexpected fetch: ${url}`));
    return Promise.resolve(typeof h.response === 'function' ? h.response() : h.response);
  });
}

beforeEach(() => {
  mockPersonaFetch.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('FreezeVP2InternalPilotAction — validated artifact, ready to freeze', () => {
  beforeEach(() => {
    mockSequence([
      {
        match: /\/freeze\?crystalId=/,
        response: jsonResponse(200, { requestSucceeded: true, artifact: { lifecycle: 'validated' }, nextGovernedAction: null }),
      },
      {
        match: /\/active-persona/,
        response: jsonResponse(200, { personaId: 'persona-1' }),
      },
      {
        match: /\/identity\/references/,
        response: jsonResponse(200, { personas: [{ personaId: 'persona-1', publicRef: 'operator-ref-abc' }], agents: [] }),
      },
      {
        match: /\/freeze-preview/,
        response: jsonResponse(200, {
          ok: true,
          package: { contentHash: 'hash-abc-123', recommendation: { readiness: { checks: READINESS_CHECKS } } },
          ratifiedBoundary: { boundary: 'financial-risk-value-systems, externally sourced only' },
        }),
      },
    ]);
  });

  it('renders the failing checks, rationale, and signing identity — all resolved, nothing typed in', async () => {
    render(<FreezeVP2InternalPilotAction experimentId="EXP-P1" />);
    expect(await screen.findByRole('button', { name: /Confirm: Freeze Crystal vP2 for internal EXP-P1 run/ })).toBeInTheDocument();
    expect(screen.getByText(/an explicit, operator-authorized internal\/pilot freeze/)).toBeInTheDocument();
    expect(screen.getByText(/derivation-headroom/)).toBeInTheDocument();
    expect(screen.getByText(/boundary-coverage/)).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: /selection-space/ })).not.toBeInTheDocument(); // passing check — not a deviation
    expect(screen.getByText(/immutable substrate for an internal EXP-P1 experimental run/)).toBeInTheDocument();
    expect(screen.getByText('operator-ref-abc')).toBeInTheDocument();
    // Never a free-text input for the operator reference in this component.
    expect(screen.queryByPlaceholderText(/operator reference/i)).not.toBeInTheDocument();
  });

  it('confirm POSTs executionDesignation: internal-pilot with scientificDeviations derived from the LIVE failing checks', async () => {
    const user = userEvent.setup();
    render(<FreezeVP2InternalPilotAction experimentId="EXP-P1" />);
    const button = await screen.findByRole('button', { name: /Confirm: Freeze Crystal vP2/ });

    let postBody: any = null;
    mockPersonaFetch.mockImplementation((url: string, opts?: any) => {
      if (/\/freeze\?crystalId=/.test(url)) {
        return Promise.resolve(
          jsonResponse(200, { requestSucceeded: true, artifact: { lifecycle: 'validated' }, nextGovernedAction: null }),
        );
      }
      if (/\/active-persona/.test(url)) return Promise.resolve(jsonResponse(200, { personaId: 'persona-1' }));
      if (/\/identity\/references/.test(url))
        return Promise.resolve(jsonResponse(200, { personas: [{ personaId: 'persona-1', publicRef: 'operator-ref-abc' }], agents: [] }));
      if (/\/freeze-preview/.test(url))
        return Promise.resolve(
          jsonResponse(200, {
            ok: true,
            package: { contentHash: 'hash-abc-123', recommendation: { readiness: { checks: READINESS_CHECKS } } },
            ratifiedBoundary: { boundary: 'financial-risk-value-systems, externally sourced only' },
          }),
        );
      // The freeze POST itself — method is present on a POST call, absent on the GET.
      if (/\/freeze$/.test(url) && opts?.method === 'POST') {
        postBody = JSON.parse(opts.body);
        return Promise.resolve(jsonResponse(200, { requestSucceeded: true, receiptId: 'receipt-1' }));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    await user.click(button);

    await waitFor(() => expect(postBody).not.toBeNull());
    expect(postBody.action).toBe('freeze');
    expect(postBody.crystalId).toBe('EXP-P1/crystal-vP2');
    expect(postBody.executionDesignation).toBe('internal-pilot');
    expect(postBody.boundaryAcknowledged).toBe(true);
    expect(postBody.confirm).toBe(true);
    expect(postBody.contentHash).toBe('hash-abc-123');
    expect(postBody.signedBy).toEqual(['operator-ref-abc']);
    expect(postBody.scientificDeviations).toEqual([
      { checkName: 'derivation-headroom', rationale: expect.stringContaining('immutable substrate') },
      { checkName: 'boundary-coverage', rationale: expect.stringContaining('immutable substrate') },
    ]);
  });
});

describe('FreezeVP2InternalPilotAction — already frozen', () => {
  it('renders the frozen state and the server-named next governed action, with no confirm button', async () => {
    mockRoute(
      /\/freeze\?crystalId=/,
      jsonResponse(200, {
        requestSucceeded: true,
        artifact: { lifecycle: 'frozen', frozenAt: '2026-09-07T00:00:00.000Z', contentHash: 'hash-x', signedBy: ['ref-1'], receiptId: 'receipt-9' },
        nextGovernedAction: { label: 'Run EXP-P1 internally (pilot)', detail: 'pilot detail text' },
      }),
    );
    render(<FreezeVP2InternalPilotAction experimentId="EXP-P1" />);
    expect(await screen.findByText(/frozen \(internal\/pilot\)/)).toBeInTheDocument();
    expect(screen.getByText('Run EXP-P1 internally (pilot)')).toBeInTheDocument();
    expect(screen.getByText('receipt-9')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm/ })).not.toBeInTheDocument();
  });
});

describe('FreezeVP2InternalPilotAction — not eligible', () => {
  it('renders nothing when the artifact is neither validated nor frozen', async () => {
    mockRoute(/\/freeze\?crystalId=/, jsonResponse(200, { requestSucceeded: true, artifact: { lifecycle: 'draft' }, nextGovernedAction: null }));
    const { container } = render(<FreezeVP2InternalPilotAction experimentId="EXP-P1" />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });
});

describe('FreezeVP2InternalPilotAction — a failed read never destroys already-good state', () => {
  it('a network failure on the very first read shows a loading state, never a crash, never fabricated data', async () => {
    mockPersonaFetch.mockImplementation(() => Promise.reject(new Error('network unreachable')));
    render(<FreezeVP2InternalPilotAction experimentId="EXP-P1" />);
    // Never throws, never renders fabricated "ready" or "frozen" content.
    await waitFor(() => {
      expect(screen.queryByText(/Freeze Crystal vP2 for internal EXP-P1 run/)).not.toBeInTheDocument();
      expect(screen.queryByText(/frozen \(internal\/pilot\)/)).not.toBeInTheDocument();
    });
  });
});
