// @vitest-environment jsdom
/**
 * Factor Operate blocker (2026-09-06) — the aigentme ceremony must never be
 * replaced before its own two completion receipts exist.
 *
 * Root cause (confirmed by direct read of FinancialServicesBridgeFrontDoor.tsx
 * and horizenMoneyPennyJourney.ts): the `aigentme` stage's completionEvidence
 * is `['aigentMeActive', 'focusDispositionRecorded']`, recordable ONLY inside
 * the canonical `aigentme-welcome` surface (AigentMeWelcomeSplitTab's Welcome
 * Capsule). The front door's `foregroundSurfaceRefByStage` override used to
 * swap that surface for `moneypenny-orchestration-focused` the instant the
 * operator's Passport was valid — before the ceremony could ever run — which
 * made Operate permanently uncompletable for a Passport-holding operator
 * (Factor's own live case). Fixed by gating the override on the aigentme
 * stage's OWN completion evidence, never on Passport validity alone.
 *
 * These tests render the REAL FinancialServicesBridgeFrontDoor and drive its
 * `onRuntimeStateChange` callback (the same one JourneyRunSurface calls with
 * the observer's real response) with fabricated JourneyRuntimeState payloads
 * — the standard technique this repo already uses for this exact seam (see
 * financial-services-bridge-frontend-operate-projection.test.ts's own header).
 */
import React from 'react';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { JourneyRuntimeState } from '@/types/journey';

let lastPilotJourneyTabProps: {
  personaId?: string;
  foregroundSurfaceRefByStage?: Record<string, string>;
  onRuntimeStateChange?: (state: JourneyRuntimeState) => void;
} | null = null;

vi.mock('@/app/triad/components/codex/tabs/PilotJourneyTab', () => ({
  PilotJourneyTab: (props: {
    personaId?: string;
    foregroundSurfaceRefByStage?: Record<string, string>;
    onRuntimeStateChange?: (state: JourneyRuntimeState) => void;
  }) => {
    lastPilotJourneyTabProps = props;
    return (
      <div
        data-testid="pilot-journey-tab"
        data-foreground-aigentme={props.foregroundSurfaceRefByStage?.aigentme ?? ''}
      />
    );
  },
}));

vi.mock('@/components/companion/PassportConnectPanel', () => ({
  PassportConnectPanel: () => <div data-testid="passport-connect-panel" />,
}));

vi.mock('@/app/components/metaVatar/MetaAvatarHost', () => ({
  MetaAvatarHost: () => null,
}));

vi.mock('@/utils/personaSpine', () => ({
  usePersonaSpine: () => ({ status: 'idle' }),
}));

vi.mock('@/app/hooks/usePassportSignInHost', () => ({
  usePassportSignInHost: () => ({
    showPassportSignIn: false,
    completeSignIn: () => {},
    dismissSignIn: () => {},
  }),
}));

vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => '' } as unknown as Response)),
);

import { FinancialServicesBridgeFrontDoor } from '@/components/journey/FinancialServicesBridgeFrontDoor';

function makeState(opts: { passportValid: boolean; aigentmeEvidence: string[] }): JourneyRuntimeState {
  return {
    journeyId: 'horizen-moneypenny',
    journeyVersion: '1',
    subjectRef: 'factor',
    currentStageId: 'aigentme',
    complete: false,
    stages: [
      {
        stageId: 'passport',
        state: opts.passportValid ? 'COMPLETE' : 'IN_PROGRESS',
        evidencePresent: opts.passportValid ? ['operatorPolityCitizenPassportValid'] : [],
        evidenceMissing: opts.passportValid ? [] : ['operatorPolityCitizenPassportValid'],
        receiptRefs: [],
      },
      {
        stageId: 'aigentme',
        state: opts.aigentmeEvidence.length === 2 ? 'COMPLETE' : 'IN_PROGRESS',
        evidencePresent: opts.aigentmeEvidence,
        evidenceMissing: ['aigentMeActive', 'focusDispositionRecorded'].filter(
          (e) => !opts.aigentmeEvidence.includes(e),
        ),
        receiptRefs: [],
      },
    ],
  } as unknown as JourneyRuntimeState;
}

beforeEach(() => {
  lastPilotJourneyTabProps = null;
  window.localStorage.clear();
  window.localStorage.setItem('currentPersonaId', 'persona-factor-operator');
});

afterEach(() => {
  cleanup();
});

describe('FinancialServicesBridgeFrontDoor — Operate ceremony gate', () => {
  it('a Passport-holding operator with an INCOMPLETE aigentme stage still receives the canonical aigentme-welcome ceremony — no MoneyPenny override', async () => {
    render(<FinancialServicesBridgeFrontDoor />);
    await waitFor(() => expect(lastPilotJourneyTabProps?.onRuntimeStateChange).toBeTruthy());

    act(() => {
      lastPilotJourneyTabProps!.onRuntimeStateChange!(makeState({ passportValid: true, aigentmeEvidence: [] }));
    });

    await waitFor(() =>
      expect(screen.getByTestId('pilot-journey-tab')).toHaveAttribute('data-foreground-aigentme', ''),
    );
  });

  it('MoneyPenny cannot replace the ceremony with only ONE of the two required receipts', async () => {
    render(<FinancialServicesBridgeFrontDoor />);
    await waitFor(() => expect(lastPilotJourneyTabProps?.onRuntimeStateChange).toBeTruthy());

    act(() => {
      lastPilotJourneyTabProps!.onRuntimeStateChange!(
        makeState({ passportValid: true, aigentmeEvidence: ['aigentMeActive'] }),
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId('pilot-journey-tab')).toHaveAttribute('data-foreground-aigentme', ''),
    );
  });

  it('recording the disposition (BOTH receipts present) makes Operate complete and MoneyPenny becomes the foreground — navigation into MoneyPenny is offered only now', async () => {
    render(<FinancialServicesBridgeFrontDoor />);
    await waitFor(() => expect(lastPilotJourneyTabProps?.onRuntimeStateChange).toBeTruthy());

    act(() => {
      lastPilotJourneyTabProps!.onRuntimeStateChange!(
        makeState({ passportValid: true, aigentmeEvidence: ['aigentMeActive', 'focusDispositionRecorded'] }),
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId('pilot-journey-tab')).toHaveAttribute(
        'data-foreground-aigentme',
        'moneypenny-orchestration-focused',
      ),
    );
  });

  it('never regresses once complete within a session — a later, stale-looking re-read cannot un-complete Operate and re-show the ceremony', async () => {
    render(<FinancialServicesBridgeFrontDoor />);
    await waitFor(() => expect(lastPilotJourneyTabProps?.onRuntimeStateChange).toBeTruthy());

    act(() => {
      lastPilotJourneyTabProps!.onRuntimeStateChange!(
        makeState({ passportValid: true, aigentmeEvidence: ['aigentMeActive', 'focusDispositionRecorded'] }),
      );
    });
    await waitFor(() =>
      expect(screen.getByTestId('pilot-journey-tab')).toHaveAttribute(
        'data-foreground-aigentme',
        'moneypenny-orchestration-focused',
      ),
    );

    // A slow/superseded read reporting incomplete again (e.g. a race with an
    // in-flight refresh) must never regress the override — the ceremony was
    // already genuinely completed once.
    act(() => {
      lastPilotJourneyTabProps!.onRuntimeStateChange!(makeState({ passportValid: true, aigentmeEvidence: [] }));
    });
    expect(screen.getByTestId('pilot-journey-tab')).toHaveAttribute(
      'data-foreground-aigentme',
      'moneypenny-orchestration-focused',
    );
  });

  it('no Passport yet: no MoneyPenny override regardless of aigentme evidence (defensive — aigentme cannot complete without delegate/passport prerequisites anyway)', async () => {
    render(<FinancialServicesBridgeFrontDoor />);
    await waitFor(() => expect(lastPilotJourneyTabProps?.onRuntimeStateChange).toBeTruthy());

    act(() => {
      lastPilotJourneyTabProps!.onRuntimeStateChange!(
        makeState({ passportValid: false, aigentmeEvidence: ['aigentMeActive', 'focusDispositionRecorded'] }),
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId('pilot-journey-tab')).toHaveAttribute('data-foreground-aigentme', ''),
    );
  });
});
