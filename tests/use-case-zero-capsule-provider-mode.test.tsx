// @vitest-environment jsdom
/**
 * Item 4/7 behavioral tests (2026-09-06 closure round) —
 *   Item 4: the launch-spec button's "simulated"/"live" wording must be
 *   DERIVED from the Bankr adapter's own reported mode (the bankrBinding
 *   leg's `mode`), never a hardcoded literal.
 *   Item 7: "Create and establish an agent" must not be offered as a
 *   second, functioning operational path — it is disabled/relabeled
 *   "Coming next" rather than executing identically to "Bring my own agent".
 *
 * Exercises the REAL UseCaseZeroReadinessCapsule component, stubbing only
 * its controller hook (useUseCaseZeroReadiness) — never source-string
 * assertions.
 */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({
  useUseCaseZeroReadiness: vi.fn(),
}));

vi.mock('@/services/factor/useUseCaseZeroReadiness', () => ({
  useUseCaseZeroReadiness: mocks.useUseCaseZeroReadiness,
}));

import { UseCaseZeroReadinessCapsule } from '@/components/moneypenny/useCaseZero/UseCaseZeroReadinessCapsule';

function baseLeg(overrides: Record<string, unknown>) {
  return {
    key: 'x', label: 'x', state: 'missing', mode: 'n/a', reason: '', evidenceRefs: [], source: '',
    required: true, conditions: [], verified: false,
    ...overrides,
  };
}

function readinessWithBankrMode(bankrMode: 'live' | 'simulated') {
  return {
    path: 'bring_own_agent',
    agentSlug: 'factor',
    legs: [
      baseLeg({ key: 'bankrBinding', label: 'Bankr/provider binding', state: 'established', mode: bankrMode }),
      baseLeg({ key: 'governedOperationRehearsal', label: 'Governed financial-operation rehearsal', state: 'missing', mode: 'n/a' }),
    ],
    completedSteps: ['bankrBinding'],
    requiredStepsComplete: false,
    presentlyActionableStep: 'governedOperationRehearsal',
    blockers: [],
    nextAction: { handlerId: 'factor:ucz-rehearse-governed-operation', label: 'Rehearse a governed token-launch preparation' },
    requiresApproval: true,
    requiredAuthority: [],
  };
}

beforeEach(() => {
  mocks.useUseCaseZeroReadiness.mockReset();
});
afterEach(() => {
  cleanup();
});

describe('item 4 — provider mode truthfulness: the launch-spec button never hardcodes "simulated"', () => {
  it('renders "live" when the bankrBinding leg reports mode "live" (a real adapter response)', () => {
    mocks.useUseCaseZeroReadiness.mockReturnValue({
      path: 'bring_own_agent',
      readiness: readinessWithBankrMode('live'),
      lastAdvance: null,
      loading: false,
      error: null,
      choosePath: vi.fn(),
      advance: vi.fn(),
      reset: vi.fn(),
      journeyProfile: 'standard',
      setJourneyProfile: vi.fn(),
    });
    render(<UseCaseZeroReadinessCapsule agentSlug="factor" presentation="panel" />);
    expect(screen.getByRole('button', { name: /prepare \+ preflight \(live/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /prepare \+ preflight \(simulated/i })).not.toBeInTheDocument();
  });

  it('renders "simulated" when the bankrBinding leg reports mode "simulated" (no live credentials configured)', () => {
    mocks.useUseCaseZeroReadiness.mockReturnValue({
      path: 'bring_own_agent',
      readiness: readinessWithBankrMode('simulated'),
      lastAdvance: null,
      loading: false,
      error: null,
      choosePath: vi.fn(),
      advance: vi.fn(),
      reset: vi.fn(),
      journeyProfile: 'standard',
      setJourneyProfile: vi.fn(),
    });
    render(<UseCaseZeroReadinessCapsule agentSlug="factor" presentation="panel" />);
    expect(screen.getByRole('button', { name: /prepare \+ preflight \(simulated/i })).toBeInTheDocument();
  });
});

describe('item 5 — completion badge uses requiredStepsComplete, never an equality between required+optional leg counts', () => {
  it('shows "Every required step established" when requiredStepsComplete is true, even though an OPTIONAL leg (pulsePnl) stays unestablished', () => {
    mocks.useUseCaseZeroReadiness.mockReturnValue({
      path: 'bring_own_agent',
      readiness: {
        path: 'bring_own_agent',
        agentSlug: 'factor',
        legs: [
          baseLeg({ key: 'bankrBinding', label: 'Bankr/provider binding', state: 'established', mode: 'live' }),
          baseLeg({ key: 'governedOperationRehearsal', label: 'Governed financial-operation rehearsal', state: 'established', mode: 'simulated' }),
          // Optional, unestablished — must NEVER suppress the completion badge.
          baseLeg({ key: 'pulsePnl', label: 'Pulse/P&L status', state: 'missing', mode: 'n/a', required: false }),
        ],
        completedSteps: ['bankrBinding', 'governedOperationRehearsal'],
        requiredStepsComplete: true,
        presentlyActionableStep: null,
        blockers: [],
        nextAction: null,
        requiresApproval: false,
        requiredAuthority: [],
      },
      lastAdvance: null,
      loading: false,
      error: null,
      choosePath: vi.fn(),
      advance: vi.fn(),
      reset: vi.fn(),
      journeyProfile: 'standard',
      setJourneyProfile: vi.fn(),
    });
    render(<UseCaseZeroReadinessCapsule agentSlug="factor" presentation="panel" />);
    expect(screen.getByText(/every required step established/i)).toBeInTheDocument();
  });

  it('does NOT show the completion badge when a REQUIRED leg remains outstanding', () => {
    mocks.useUseCaseZeroReadiness.mockReturnValue({
      path: 'bring_own_agent',
      readiness: {
        path: 'bring_own_agent',
        agentSlug: 'factor',
        legs: [
          baseLeg({ key: 'bankrBinding', label: 'Bankr/provider binding', state: 'missing', mode: 'n/a' }),
        ],
        completedSteps: [],
        requiredStepsComplete: false,
        presentlyActionableStep: 'bankrBinding',
        blockers: ['not established'],
        nextAction: { handlerId: 'factor:ucz-bankr-binding', label: 'Inspect or provision the Bankr provider-wallet binding' },
        requiresApproval: false,
        requiredAuthority: [],
      },
      lastAdvance: null,
      loading: false,
      error: null,
      choosePath: vi.fn(),
      advance: vi.fn(),
      reset: vi.fn(),
      journeyProfile: 'standard',
      setJourneyProfile: vi.fn(),
    });
    render(<UseCaseZeroReadinessCapsule agentSlug="factor" presentation="panel" />);
    expect(screen.queryByText(/every required step established/i)).not.toBeInTheDocument();
  });
});

describe('RootDID minting primitive (2026-09-06) — "Create and establish an agent" is now a real, functioning second path', () => {
  it('is rendered enabled and invokes choosePath("create_and_establish") — sponsors a new agent\'s RootDID genesis', () => {
    const choosePath = vi.fn();
    mocks.useUseCaseZeroReadiness.mockReturnValue({
      path: null,
      readiness: null,
      lastAdvance: null,
      loading: false,
      error: null,
      choosePath,
      advance: vi.fn(),
      reset: vi.fn(),
      journeyProfile: 'standard',
      setJourneyProfile: vi.fn(),
    });
    render(<UseCaseZeroReadinessCapsule agentSlug="factor" presentation="panel" />);
    const createButton = screen.getByRole('button', { name: /create and establish an agent/i });
    expect(createButton).not.toBeDisabled();
    createButton.click();
    expect(choosePath).toHaveBeenCalledWith('create_and_establish');
  });

  it('clicking "Bring my own agent" still invokes choosePath("bring_own_agent") — the one real functioning path', () => {
    const choosePath = vi.fn();
    mocks.useUseCaseZeroReadiness.mockReturnValue({
      path: null,
      readiness: null,
      lastAdvance: null,
      loading: false,
      error: null,
      choosePath,
      advance: vi.fn(),
      reset: vi.fn(),
    });
    render(<UseCaseZeroReadinessCapsule agentSlug="factor" presentation="panel" />);
    screen.getByRole('button', { name: /^bring my own agent$/i }).click();
    expect(choosePath).toHaveBeenCalledWith('bring_own_agent');
  });
});
