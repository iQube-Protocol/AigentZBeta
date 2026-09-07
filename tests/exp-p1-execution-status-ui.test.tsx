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

// jsdom's `navigator.clipboard` getter returns a REAL, singleton Clipboard
// object (its own async `writeText` implementation) that is not reliably
// present until AFTER a component has rendered (replacing the whole
// `navigator`/`navigator.clipboard` reference beforehand, via
// `Object.defineProperty` or `vi.stubGlobal`, does not reach the component —
// it reads the SAME lazily-installed getter and gets a DIFFERENT object
// back). `spyOnClipboardWriteText()` spies on the singleton's own method —
// call it AFTER `render(...)`, once the real object exists — which is what
// both the test and the component actually resolve to.
function spyOnClipboardWriteText() {
  return vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
}

beforeEach(() => {
  mockPersonaFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
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

const JUST_COMPLETED_TASK_RESULTS = [
  {
    taskId: 'rehearsal-001',
    taskKind: 'recall',
    groundTruthInvariantIds: ['inv-1'],
    scorable: true,
    unscorableReason: null,
    armResults: [
      { armId: 'A', armLabel: 'Cold', availableInvariantIds: [], selectedInvariantIds: [], actuallyGroundedInvariantIds: null, scoreMetric: 'invariant-id-recall', score: 0 },
      { armId: 'B', armLabel: 'Full Runtime', availableInvariantIds: ['inv-1', 'inv-2'], selectedInvariantIds: ['inv-1'], actuallyGroundedInvariantIds: null, scoreMetric: 'invariant-id-recall', score: 1 },
      { armId: 'C', armLabel: 'Flattened Invariants', availableInvariantIds: ['inv-1'], selectedInvariantIds: ['inv-1'], actuallyGroundedInvariantIds: null, scoreMetric: 'invariant-id-recall', score: 1 },
      { armId: 'D', armLabel: 'Expert Prose', availableInvariantIds: [], selectedInvariantIds: [], actuallyGroundedInvariantIds: null, scoreMetric: 'keyword-substring-coverage', score: 0.5 },
    ],
  },
  {
    taskId: 'rehearsal-002',
    taskKind: 'recall',
    groundTruthInvariantIds: [],
    scorable: false,
    unscorableReason: "no frozen invariant matched this task's keyword set",
    armResults: [],
  },
];

const JUST_COMPLETED_SUMMARY = {
  taskCounts: { total: 2, scored: 1, unscorable: 1 },
  unscorableTaskIds: ['rehearsal-002'],
  perArm: [
    { armId: 'A', armLabel: 'Cold', scoreMetric: 'invariant-id-recall', meanScoreOverall: 0, meanScoreRecall: 0, meanScoreDerivation: null },
    { armId: 'B', armLabel: 'Full Runtime', scoreMetric: 'invariant-id-recall', meanScoreOverall: 1, meanScoreRecall: 1, meanScoreDerivation: null },
    { armId: 'C', armLabel: 'Flattened Invariants', scoreMetric: 'invariant-id-recall', meanScoreOverall: 1, meanScoreRecall: 1, meanScoreDerivation: null },
    { armId: 'D', armLabel: 'Expert Prose', scoreMetric: 'keyword-substring-coverage', meanScoreOverall: 0.5, meanScoreRecall: 0.5, meanScoreDerivation: null },
  ],
  frozenPopulationSize: 1,
  armBAvailableSetSize: 2,
  armBSelectedSetSize: 1,
  armCFixedSliceSize: 1,
  instrumentCaveat: 'INTERNAL REHEARSAL — INSTRUMENT VALIDATION ONLY, NOT A SCIENTIFIC RESULT.',
};

describe('ExpP1ExecutionStatus — eligible internal rehearsal, frozen substrate resolved server-side', () => {
  function mockEligible() {
    mockPersonaFetch.mockImplementation((url: string, opts?: any) => {
      if (opts?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(200, {
            requestSucceeded: true,
            runId: 'EXP-P1/execution-run/internal-rehearsal/x',
            receiptId: 'receipt-run-1',
            taskResults: JUST_COMPLETED_TASK_RESULTS,
            run: {
              id: 'EXP-P1/execution-run/internal-rehearsal/x',
              runExecutionDesignation: 'internal-rehearsal',
              confirmatoryEligible: false,
              taskResults: JUST_COMPLETED_TASK_RESULTS,
            },
            summary: JUST_COMPLETED_SUMMARY,
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

  it('shows the just-completed run\'s results immediately — task-by-task, arm-by-arm — with no extra fetch', async () => {
    mockEligible();
    const user = userEvent.setup();
    render(<ExpP1ExecutionStatus experimentId="EXP-P1" />);
    const button = await screen.findByRole('button', { name: /Run EXP-P1 internal rehearsal/ });
    await user.click(button);
    expect(await screen.findByText('rehearsal-001')).toBeInTheDocument();
    expect(screen.getByText(/B Full Runtime:/)).toBeInTheDocument();
    // Arm D's unique score — appears once in the per-task row and once in the
    // summary block's per-arm mean (the mean of one task IS that task's score).
    expect(screen.getAllByText('50%').length).toBeGreaterThanOrEqual(1);
    // The POST response already carried taskResults — no ?runId= fetch was needed.
    expect(mockPersonaFetch.mock.calls.some(([url]) => /\?runId=/.test(url))).toBe(false);
  });

  it('flags an unscorable task distinctly and shows its reason as a diagnostic, never as a real score', async () => {
    mockEligible();
    const user = userEvent.setup();
    render(<ExpP1ExecutionStatus experimentId="EXP-P1" />);
    const button = await screen.findByRole('button', { name: /Run EXP-P1 internal rehearsal/ });
    await user.click(button);
    await screen.findByText('rehearsal-001');
    expect(screen.getByText('rehearsal-002')).toBeInTheDocument();
    expect(screen.getByText('unscorable — diagnostics only')).toBeInTheDocument();
    expect(screen.getByText(/no frozen invariant matched this task's keyword set/)).toBeInTheDocument();
  });

  it('shows the proper rehearsal summary — scored/unscorable counts, per-arm means split recall/derivation, and B/C set sizes', async () => {
    mockEligible();
    const user = userEvent.setup();
    render(<ExpP1ExecutionStatus experimentId="EXP-P1" />);
    const button = await screen.findByRole('button', { name: /Run EXP-P1 internal rehearsal/ });
    await user.click(button);
    await screen.findByText('rehearsal-001');
    expect(screen.getByText(/1\/2 task\(s\) scored/)).toBeInTheDocument();
    expect(screen.getByText(/1 unscorable \(rehearsal-002\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 selected of 2 available/)).toBeInTheDocument();
    expect(screen.getByText(/Arm C: 1 fixed/)).toBeInTheDocument();
  });

  it('"Copy JSON" on the just-completed run copies the FULL run record to the clipboard, and shows a transient "Copied" confirmation', async () => {
    mockEligible();
    const user = userEvent.setup();
    render(<ExpP1ExecutionStatus experimentId="EXP-P1" />);
    const runButton = await screen.findByRole('button', { name: /Run EXP-P1 internal rehearsal/ });
    await user.click(runButton);
    await screen.findByText('rehearsal-001');

    const clipboardSpy = spyOnClipboardWriteText();
    const copyButton = screen.getByRole('button', { name: 'Copy JSON' });
    await user.click(copyButton);

    expect(clipboardSpy).toHaveBeenCalledTimes(1);
    const copied = JSON.parse(clipboardSpy.mock.calls[0][0]);
    expect(copied.id).toBe('EXP-P1/execution-run/internal-rehearsal/x');
    expect(copied.confirmatoryEligible).toBe(false);
    expect(copied.taskResults).toEqual(JUST_COMPLETED_TASK_RESULTS);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});

describe('ExpP1ExecutionStatus — "View results" on a PAST run', () => {
  const PAST_RUN = {
    id: 'EXP-P1/execution-run/internal-rehearsal/past-1',
    frozenAt: '2026-09-06T17:00:00.000Z',
    taskSetId: 'EXP-P1/rehearsal-task-set-provisional-v1',
    taskSetProvenance: 'provisional',
    armIds: ['A', 'B', 'C', 'D'],
    taskCount: 1,
    receiptId: 'receipt-past-1',
  };

  function mockWithPastRun() {
    mockPersonaFetch.mockImplementation((url: string) => {
      if (/\?runId=/.test(url)) {
        return Promise.resolve(
          jsonResponse(200, {
            requestSucceeded: true,
            run: {
              id: PAST_RUN.id,
              taskResults: [
                {
                  taskId: 'rehearsal-past',
                  taskKind: 'recall',
                  groundTruthInvariantIds: ['inv-9'],
                  scorable: true,
                  unscorableReason: null,
                  armResults: [
                    { armId: 'A', armLabel: 'Cold', availableInvariantIds: [], selectedInvariantIds: [], actuallyGroundedInvariantIds: null, scoreMetric: 'invariant-id-recall', score: 0 },
                    { armId: 'C', armLabel: 'Flattened Invariants', availableInvariantIds: ['inv-9'], selectedInvariantIds: ['inv-9'], actuallyGroundedInvariantIds: null, scoreMetric: 'invariant-id-recall', score: 1 },
                  ],
                },
              ],
            },
            summary: {
              taskCounts: { total: 1, scored: 1, unscorable: 0 },
              unscorableTaskIds: [],
              perArm: [
                { armId: 'A', armLabel: 'Cold', scoreMetric: 'invariant-id-recall', meanScoreOverall: 0, meanScoreRecall: 0, meanScoreDerivation: null },
                { armId: 'C', armLabel: 'Flattened Invariants', scoreMetric: 'invariant-id-recall', meanScoreOverall: 1, meanScoreRecall: 1, meanScoreDerivation: null },
              ],
              frozenPopulationSize: 1,
              armBAvailableSetSize: null,
              armBSelectedSetSize: null,
              armCFixedSliceSize: 1,
              instrumentCaveat: 'INTERNAL REHEARSAL — INSTRUMENT VALIDATION ONLY, NOT A SCIENTIFIC RESULT.',
            },
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          requestSucceeded: true,
          eligibility: { eligible: true, frozenCrystalArtifactId: 'EXP-P1/crystal-vP2', frozenCrystalContentHash: 'hash-abc' },
          frozenSubstrateLabel: 'Crystal vP2 · internal/pilot',
          confirmatoryBlockers: CONFIRMATORY_BLOCKERS,
          pastRehearsalRuns: [PAST_RUN],
        }),
      );
    });
  }

  it('clicking "View results" fetches ?runId= and shows the detail; clicking again hides it', async () => {
    mockWithPastRun();
    const user = userEvent.setup();
    render(<ExpP1ExecutionStatus experimentId="EXP-P1" />);
    const viewButton = await screen.findByRole('button', { name: 'View results' });
    await user.click(viewButton);
    expect(await screen.findByText('rehearsal-past')).toBeInTheDocument();
    expect(screen.getByText(/C Flattened Invariants:/)).toBeInTheDocument();
    const runIdCall = mockPersonaFetch.mock.calls.find(([url]) => /\?runId=/.test(url));
    expect(runIdCall![0]).toContain(encodeURIComponent(PAST_RUN.id));

    const hideButton = screen.getByRole('button', { name: 'Hide results' });
    await user.click(hideButton);
    expect(screen.queryByText('rehearsal-past')).not.toBeInTheDocument();
  });

  it('re-expanding an already-viewed run never re-fetches (cached by run id)', async () => {
    mockWithPastRun();
    const user = userEvent.setup();
    render(<ExpP1ExecutionStatus experimentId="EXP-P1" />);
    const viewButton = await screen.findByRole('button', { name: 'View results' });
    await user.click(viewButton);
    await screen.findByText('rehearsal-past');
    await user.click(screen.getByRole('button', { name: 'Hide results' }));
    const fetchCountAfterFirstView = mockPersonaFetch.mock.calls.filter(([url]) => /\?runId=/.test(url)).length;

    await user.click(screen.getByRole('button', { name: 'View results' }));
    await screen.findByText('rehearsal-past');
    const fetchCountAfterSecondView = mockPersonaFetch.mock.calls.filter(([url]) => /\?runId=/.test(url)).length;
    expect(fetchCountAfterSecondView).toBe(fetchCountAfterFirstView);
  });

  it('"Copy JSON" on an expanded past run copies the full fetched run record verbatim', async () => {
    mockWithPastRun();
    const user = userEvent.setup();
    render(<ExpP1ExecutionStatus experimentId="EXP-P1" />);
    const viewButton = await screen.findByRole('button', { name: 'View results' });
    await user.click(viewButton);
    await screen.findByText('rehearsal-past');

    const clipboardSpy = spyOnClipboardWriteText();
    const copyButton = screen.getByRole('button', { name: 'Copy JSON' });
    await user.click(copyButton);

    expect(clipboardSpy).toHaveBeenCalledTimes(1);
    const copied = JSON.parse(clipboardSpy.mock.calls[0][0]);
    expect(copied.id).toBe(PAST_RUN.id);
    expect(copied.taskResults[0].taskId).toBe('rehearsal-past');
  });

  it('"Copy JSON" is not offered before results have ever been viewed', async () => {
    mockWithPastRun();
    render(<ExpP1ExecutionStatus experimentId="EXP-P1" />);
    await screen.findByRole('button', { name: 'View results' });
    expect(screen.queryByRole('button', { name: 'Copy JSON' })).not.toBeInTheDocument();
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
