// @vitest-environment jsdom
/**
 * Persisted operator context inheritance — Journey 0 closure item 1
 * (2026-09-06 closeout doc, item 1: "an established aigentMe/metaMe
 * persona should persist into FS and Horizen; Operate should not require
 * reopening [onboarding] through MoneyPenny").
 *
 * Root cause (see FinancialServicesBridgeFrontDoor.tsx's own doc comment,
 * added alongside this fix): the bare `/bridge/fs` /
 * `/bridge/financial-services` front door sits outside both
 * `app/(shell)/layout.tsx` and `app/(embed)/layout.tsx` — the only two
 * places that mount `PersonaProvider` — so it hand-rolled a ONE-SHOT
 * `localStorage.getItem('currentPersonaId')` read on mount instead of using
 * the canonical persona-selection system (`app/contexts/PersonaContext.tsx`).
 * That one-shot read never re-fired on a `storage` event (cross-tab/window
 * persona switch) or on a wallet-driven persona switch propagated through
 * `ActivePersonaControl`'s `onPersonaChange` — so an operator who already
 * held an established persona, but whose localStorage write landed after
 * this component's mount effect ran, was never recognised: the journey
 * observer read an undefined/stale persona, and Operate fell back to the
 * pre-Passport path instead of resolving directly to MoneyPenny Orchestration
 * even though a valid Passport already existed.
 *
 * Fixed by mounting the SAME `PersonaProvider`/`usePersona()` seam every
 * other surface in the platform shares — never a second persona store. These
 * tests prove the inheritance behaviourally, against the REAL
 * `FinancialServicesBridgeFrontDoor` and REAL `PersonaContext`, stubbing
 * only the heavy leaf surfaces (`PilotJourneyTab`, `PassportConnectPanel`,
 * `MetaAvatarHost`) that are already covered by their own test suites
 * (tests/knyts-bridge-ci-parity.test.ts's "mounts the real PilotJourneyTab"
 * assertion, tests/register-ceremony.test.ts's quarantine-behaviour suite).
 */
import React from 'react';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

const LS_KEY = 'currentPersonaId';

// ── Heavy leaf surfaces stubbed — none of them is what this file tests ──

let lastPilotJourneyTabProps: { personaId?: string; onPersonaChange?: (id: string) => void } | null = null;

vi.mock('@/app/triad/components/codex/tabs/PilotJourneyTab', () => ({
  PilotJourneyTab: (props: { personaId?: string; onPersonaChange?: (id: string) => void }) => {
    lastPilotJourneyTabProps = props;
    return (
      <div data-testid="pilot-journey-tab" data-persona-id={props.personaId ?? ''}>
        <button
          type="button"
          data-testid="wallet-switch-persona"
          onClick={() => props.onPersonaChange?.('persona-switched-via-wallet')}
        >
          switch persona
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/companion/PassportConnectPanel', () => ({
  PassportConnectPanel: () => <div data-testid="passport-connect-panel" />,
}));

vi.mock('@/app/components/metaVatar/MetaAvatarHost', () => ({
  MetaAvatarHost: () => null,
}));

// usePersonaSpine wires cross-frame invalidation listeners unrelated to this
// file's assertions and would otherwise issue a real fetch() on mount.
vi.mock('@/utils/personaSpine', () => ({
  usePersonaSpine: () => ({ status: 'idle' }),
}));

// No wallet-surface (PASSPORT_SIGN_IN) request is ever fired in these tests,
// so this stays inert — stubbed purely to keep the module graph light.
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

function readStored(): string | null {
  try {
    return window.localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

beforeEach(() => {
  lastPilotJourneyTabProps = null;
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('FinancialServicesBridgeFrontDoor — persisted operator context inheritance', () => {
  it('direct entry: an already-established persona in localStorage is inherited on first render, no re-onboarding required', async () => {
    window.localStorage.setItem(LS_KEY, 'persona-established-1');

    render(<FinancialServicesBridgeFrontDoor />);

    await waitFor(() =>
      expect(screen.getByTestId('pilot-journey-tab')).toHaveAttribute('data-persona-id', 'persona-established-1'),
    );
    // The front door never shows its own sign-in gate for a persona that is
    // already established — PassportConnectPanel only mounts on an explicit
    // PASSPORT_SIGN_IN wallet-surface request, never fired here.
    expect(screen.queryByTestId('passport-connect-panel')).not.toBeInTheDocument();
  });

  it('re-entry / refresh: unmounting and remounting the front door (simulating navigation away-and-back or a hard reload) resolves the SAME persisted persona again', async () => {
    window.localStorage.setItem(LS_KEY, 'persona-established-1');

    const first = render(<FinancialServicesBridgeFrontDoor />);
    await waitFor(() =>
      expect(screen.getByTestId('pilot-journey-tab')).toHaveAttribute('data-persona-id', 'persona-established-1'),
    );
    first.unmount();

    // A hard refresh tears down all in-memory React/module state but never
    // touches localStorage — re-mounting must re-hydrate the same persona
    // from the SAME canonical store, not start signed-out.
    render(<FinancialServicesBridgeFrontDoor />);
    await waitFor(() =>
      expect(screen.getByTestId('pilot-journey-tab')).toHaveAttribute('data-persona-id', 'persona-established-1'),
    );
  });

  it('persona switching: a wallet-driven switch propagates through the canonical PersonaContext seam to every consumer, and persists', async () => {
    window.localStorage.setItem(LS_KEY, 'persona-established-1');

    render(<FinancialServicesBridgeFrontDoor />);
    await waitFor(() =>
      expect(screen.getByTestId('pilot-journey-tab')).toHaveAttribute('data-persona-id', 'persona-established-1'),
    );

    act(() => {
      screen.getByTestId('wallet-switch-persona').click();
    });

    await waitFor(() =>
      expect(screen.getByTestId('pilot-journey-tab')).toHaveAttribute(
        'data-persona-id',
        'persona-switched-via-wallet',
      ),
    );
    // The switch went through app/contexts/PersonaContext.tsx's
    // setActivePersonaId — never a component-local state update that a
    // remount would lose — so the canonical store itself now reflects it.
    expect(readStored()).toBe('persona-switched-via-wallet');
  });

  it('cross-tab persona switch (native storage event) updates the front door without a page reload — the same mechanism every other surface relies on', async () => {
    window.localStorage.setItem(LS_KEY, 'persona-established-1');

    render(<FinancialServicesBridgeFrontDoor />);
    await waitFor(() =>
      expect(screen.getByTestId('pilot-journey-tab')).toHaveAttribute('data-persona-id', 'persona-established-1'),
    );

    // Another tab/window switched persona and wrote localStorage — the
    // native `storage` event only fires for OTHER documents, which is
    // exactly what we simulate here (this document's own writes never
    // trigger it, which is why the front door cannot rely on its own writes
    // alone and must listen for this event, per PersonaContext.tsx).
    act(() => {
      window.localStorage.setItem(LS_KEY, 'persona-established-2');
      window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY, newValue: 'persona-established-2' }));
    });

    await waitFor(() =>
      expect(screen.getByTestId('pilot-journey-tab')).toHaveAttribute('data-persona-id', 'persona-established-2'),
    );
  });

  it('quarantined-persona passthrough is preserved: the resolved persona flows through to the real ceremony surface completely unmodified — no client-side substitution, override, or eligibility logic here (2026-09-06 review note: this proves PASSTHROUGH only — the actual server-side REFUSAL of a quarantined/non-SIGNER_CONFIGURED wallet is proven behaviorally by tests/pilot-wallet-exception.test.ts\'s "the ceremony refuses every capability but SIGNER_CONFIGURED" suite, which exercises services/horizen/registerCeremony.ts directly and asserts the typed PRINCIPAL_WALLET_NOT_SIGNER_CONFIGURED refusal — this front door has no code path that could bypass that gate, so it is never re-proven here)', async () => {
    // A persona id that would resolve server-side to a quarantined wallet
    // (RegisterAgentPanel / getActivePersona / evaluateAccess / registerCeremony.ts
    // own that check — never this component). The front door's only job is
    // to pass whatever the canonical store resolves straight through.
    window.localStorage.setItem(LS_KEY, 'persona-quarantined-1');

    render(<FinancialServicesBridgeFrontDoor />);

    await waitFor(() =>
      expect(screen.getByTestId('pilot-journey-tab')).toHaveAttribute('data-persona-id', 'persona-quarantined-1'),
    );
    // No default/admin/bypass substitution ever occurs — the prop the real
    // PilotJourneyTab receives is byte-for-byte the persisted persona.
    expect(lastPilotJourneyTabProps?.personaId).toBe('persona-quarantined-1');
  });
});
