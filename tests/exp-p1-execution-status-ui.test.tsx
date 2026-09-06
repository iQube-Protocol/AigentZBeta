// @vitest-environment jsdom
/**
 * components/research/ExpP1ExecutionStatus.tsx — genuine component-level
 * tests (2026-09-07 two-mode execution model).
 *
 * Pins:
 *   1. Renders nothing before any crystal generation has ever been frozen.
 *   2. Shows the ACTUAL frozen substrate label (server-resolved, never
 *      hardcoded) + "Internal rehearsal — READY" with a run button when
 *      eligible.
 *   3. ALWAYS shows "Confirmatory execution — BLOCKED" with the server's own
 *      blocker list — never invented client-side.
 *   4. Launching a rehearsal POSTs and surfaces the INTERNAL / NON-
 *      CONFIRMATORY / NOT VALID SCIENTIFIC EVIDENCE note.
 *   5. A failed first read surfaces an explicit, retryable error — never a
 *      perpetual spinner (mirrors FreezeVP2InternalPilotAction's own fix).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPersonaFetch = vi.fn();
vi.mock('@/utils/personaSpine', () => ({
  personaFetch: (...args: any[]) => mockPersonaFetch(...args),
}));

const { ExpP1ExecutionStatus } = await import('@/components/research/ExpP1ExecutionStatus');

function jsonResponse(status: number, body: unknown) {
  return { status, json: async () => body } as Response;
}

const CONFIRMATORY_BLOCKERS = [
  'awaiting external countersignature',
  'awaiting sealed held-out task set',
  'awaiting external Arm D prose',
];

beforeEach(() => {
  mockPersonaFetch.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('ExpP1ExecutionStatus — no crystal generation has ever been frozen', () => {
  it('renders nothing', async () => {
    mockPersonaFetch.mockResolvedValue(
      jsonResponse(200, {
        requestSucceeded: true,
        eligibility: { eligible: false, frozenCrystalArtifactId: null, frozenCrystalContentHash: null },
        frozenSubstrateLabel: null,
        confirmatoryBlockers: CONFIRMATORY_BLOCKERS,
        pastRehearsalRuns: [],
      }),
    );
    const { container } = render(<ExpP1ExecutionStatus experimentId="EXP-P1" />);
    await screen.findByText((_, el) => el?.tagName === 'BODY'); // let effects flush
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ExpP1ExecutionStatus — eligible internal rehearsal, frozen substrate resolved server-side', () => {
  function mockEligible() {
    mockPersonaFetch.mockImplementation((url: string, opts?: any) => {
      if (opts?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(200, {
            requestSucceeded: true,
            runId: 'EXP-P1/execution-run/internal-rehearsal/x',
            receiptId: 'receipt-run-1',
            taskResults: [{ taskId: 'rehearsal-001' }, { taskId: 'rehearsal-002' }],
            note: 'INTERNAL / NON-CONFIRMATORY / NOT VALID SCIENTIFIC EVIDENCE — this run may never be promoted.',
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          requestSucceeded: true,
          eligibility: { eligible: true, frozenCrystalArtifactId: 'EXP-P1/crystal-vP2', frozenCrystalContentHash: 'hash-abc' },
          frozenSubstrateLabel: 'Crystal vP2 · internal/pilot',
          confirmatoryBlockers: CONFIRMATORY_BLOCKERS,
          pastRehearsalRuns: [],
        }),
      );
    });
  }

  it('shows the frozen substrate label and "Internal rehearsal — READY"', async () => {
    mockEligible();
    render(<ExpP1ExecutionStatus experimentId="EXP-P1" />);
    expect(await screen.findByText('Crystal vP2 · internal/pilot')).toBeInTheDocument();
    expect(screen.getByText(/Internal rehearsal — READY/)).toBeInTheDocument();
    expect(screen.getByText(/NOT VALID SCIENTIFIC EVIDENCE/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run EXP-P1 internal rehearsal/ })).toBeInTheDocument();
  });

  it('ALWAYS shows Confirmatory execution — BLOCKED with the server-provided blocker list', async () => {
    mockEligible();
    render(<ExpP1ExecutionStatus experimentId="EXP-P1" />);
    await screen.findByText(/Confirmatory execution — BLOCKED/);
    for (const blocker of CONFIRMATORY_BLOCKERS) {
      expect(screen.getByText(new RegExp(blocker))).toBeInTheDocument();
    }
  });

  it('launching a rehearsal POSTs and surfaces the completion note', async () => {
    mockEligible();
    const user = userEvent.setup();
    render(<ExpP1ExecutionStatus experimentId="EXP-P1" />);
    const button = await screen.findByRole('button', { name: /Run EXP-P1 internal rehearsal/ });
    await user.click(button);
    expect(await screen.findByText(/Rehearsal complete — 2 task/)).toBeInTheDocument();
    const postCall = mockPersonaFetch.mock.calls.find(([, opts]) => opts?.method === 'POST');
    expect(postCall).toBeTruthy();
    expect(postCall![0]).toMatch(/\/rehearsal$/);
  });
});

describe('ExpP1ExecutionStatus — not eligible (e.g. confirmatory-designated freeze)', () => {
  it('shows the reason and still shows Confirmatory execution — BLOCKED', async () => {
    mockPersonaFetch.mockResolvedValue(
      jsonResponse(200, {
        requestSucceeded: true,
        eligibility: {
          eligible: false,
          reason: "'EXP-P1/crystal-vP2' is frozen as 'confirmatory' — internal rehearsal requires an 'internal-pilot' designated freeze",
          frozenCrystalArtifactId: 'EXP-P1/crystal-vP2',
          frozenCrystalContentHash: 'hash-abc',
        },
        frozenSubstrateLabel: 'Crystal vP2 · internal/pilot',
        confirmatoryBlockers: CONFIRMATORY_BLOCKERS,
        pastRehearsalRuns: [],
      }),
    );
    render(<ExpP1ExecutionStatus experimentId="EXP-P1" />);
    expect(await screen.findByText(/Internal rehearsal — not eligible/)).toBeInTheDocument();
    expect(screen.getByText(/requires an 'internal-pilot' designated freeze/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run EXP-P1 internal rehearsal/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Confirmatory execution — BLOCKED/)).toBeInTheDocument();
  });
});

describe('ExpP1ExecutionStatus — a failed FIRST read shows an explicit, retryable error, never a perpetual spinner', () => {
  it('surfaces an honest, retryable error', async () => {
    mockPersonaFetch.mockResolvedValue(jsonResponse(500, { requestSucceeded: false, error: 'boom' }));
    render(<ExpP1ExecutionStatus experimentId="EXP-P1" />);
    expect(await screen.findByText(/Could not read the EXP-P1 execution status — boom/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('ExpP1ExecutionStatus — personaId threading', () => {
  it('passes personaIdHint on every fetch when a personaId prop is supplied', async () => {
    mockPersonaFetch.mockResolvedValue(
      jsonResponse(200, {
        requestSucceeded: true,
        eligibility: { eligible: true, frozenCrystalArtifactId: 'EXP-P1/crystal-vP2', frozenCrystalContentHash: 'hash-abc' },
        frozenSubstrateLabel: 'Crystal vP2 · internal/pilot',
        confirmatoryBlockers: CONFIRMATORY_BLOCKERS,
        pastRehearsalRuns: [],
      }),
    );
    render(<ExpP1ExecutionStatus experimentId="EXP-P1" personaId="persona-42" />);
    await screen.findByText('Crystal vP2 · internal/pilot');
    const [, opts] = mockPersonaFetch.mock.calls[0];
    expect(opts).toMatchObject({ personaIdHint: 'persona-42' });
  });
});
