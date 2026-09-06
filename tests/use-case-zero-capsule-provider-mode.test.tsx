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
    });
    render(<UseCaseZeroReadinessCapsule agentSlug="factor" presentation="panel" />);
    expect(screen.getByRole('button', { name: /prepare \+ preflight \(simulated/i })).toBeInTheDocument();
  });
});

describe('item 7 — "Create and establish an agent" is not offered as a second, functioning path', () => {
  it('is rendered disabled and labeled "Coming next" rather than choosing a real path', () => {
    mocks.useUseCaseZeroReadiness.mockReturnValue({
      path: null,
      readiness: null,
      lastAdvance: null,
      loading: false,
      error: null,
      choosePath: vi.fn(),
      advance: vi.fn(),
      reset: vi.fn(),
    });
    render(<UseCaseZeroReadinessCapsule agentSlug="factor" presentation="panel" />);
    const createButton = screen.getByRole('button', { name: /create and establish an agent/i });
    expect(createButton).toBeDisabled();
    expect(createButton.textContent).toMatch(/coming next/i);
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
