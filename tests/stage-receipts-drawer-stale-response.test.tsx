// @vitest-environment jsdom
/**
 * StageReceiptsDrawer — stale-response race + error-vs-empty distinction
 * (GJR audit, 2026-09-05).
 *
 * Prior bug (confirmed by direct read of the pre-fix component): `load()`
 * and `loadCanonical()` had no generation/abort check at resolve time —
 * they called `setReceipts`/`setCanonicalReceipts` unconditionally whenever
 * their promise settled. The scope-change effect reset state and fired
 * FRESH requests on a prop change, but never cancelled the OLD one, so an
 * older, slower request for a PREVIOUS scope (e.g. MoneyPenny's) could
 * resolve after a newer one (Factor's) and silently overwrite the correct,
 * just-rendered evidence with stale data for the wrong agent.
 *
 * This test drives the REAL component with deferred, manually-resolvable
 * promises standing in for `personaFetch`, exactly reproducing that race.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const personaFetchMock = vi.fn();
vi.mock('@/utils/personaSpine', () => ({
  personaFetch: (...args: unknown[]) => personaFetchMock(...args),
}));

vi.mock('@/components/metame/cards/ActivityReceiptCard', () => ({
  ActivityReceiptCard: ({ data }: { data: { id: string; summary?: string } }) => (
    <div data-testid={`receipt-${data.id}`}>{data.summary ?? data.id}</div>
  ),
}));

import { StageReceiptsDrawer } from '@/components/journey/StageReceiptsDrawer';

afterEach(() => {
  cleanup();
  personaFetchMock.mockReset();
});

function fakeOkResponse(body: Record<string, unknown>) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
}
function fakeFailResponse(status: number) {
  return { ok: false, status, text: async () => '', json: async () => ({ ok: false }) };
}

describe('StageReceiptsDrawer — stale response never overwrites current selection', () => {
  it('discards an older (MoneyPenny) response that resolves AFTER a newer (Factor) one', async () => {
    // 1) MoneyPenny's request — deferred, resolves LAST.
    const moneypennyDeferred = deferred<unknown>();
    // 2) Factor's request — deferred, resolves FIRST.
    const factorDeferred = deferred<unknown>();

    let callIndex = 0;
    personaFetchMock.mockImplementation(() => {
      callIndex += 1;
      return callIndex === 1 ? moneypennyDeferred.promise : factorDeferred.promise;
    });

    const { rerender } = render(
      <StageReceiptsDrawer
        receiptTypes={['horizen_agent_registered']}
        agentsInvoked={['aigent-moneypenny']}
      />,
    );

    // Open the drawer — fires MoneyPenny's request (call #1), left pending.
    fireEvent.click(screen.getByRole('button', { name: /Evidence/i }));
    expect(personaFetchMock).toHaveBeenCalledTimes(1);

    // Switch to Factor mid-flight — new scope (agentsInvoked prop changes).
    // The drawer stays open (React state persists across re-render), which
    // re-fires a FRESH request for the new scope (call #2).
    rerender(
      <StageReceiptsDrawer
        receiptTypes={['horizen_agent_registered']}
        agentsInvoked={['aigent-factor']}
      />,
    );

    await waitFor(() => expect(personaFetchMock).toHaveBeenCalledTimes(2));

    // The scope switch must carry FACTOR's own runtimeAgentId to the
    // server, never MoneyPenny's — a MoneyPenny-scoped receipt must never
    // be accepted as Factor evidence (GJR audit, 2026-09-05).
    const factorRequestUrl = String(personaFetchMock.mock.calls[1][0]);
    expect(factorRequestUrl).toContain('agentsInvoked=aigent-factor');
    expect(factorRequestUrl).not.toContain('aigent-moneypenny');

    // Factor's (newer) request resolves FIRST.
    factorDeferred.resolve(
      fakeOkResponse({
        receipts: [{ id: 'r-factor-1', summary: 'Factor registered' }],
        personaDisplayLabel: 'Operator',
      }),
    );
    await waitFor(() => expect(screen.getByTestId('receipt-r-factor-1')).toBeInTheDocument());

    // MoneyPenny's (older, superseded) request resolves AFTER Factor's.
    moneypennyDeferred.resolve(
      fakeOkResponse({
        receipts: [{ id: 'r-moneypenny-STALE', summary: 'MoneyPenny registered (STALE)' }],
        personaDisplayLabel: 'Operator',
      }),
    );

    // Give the stale promise's .then chain a chance to run, if it were
    // going to corrupt state.
    await new Promise((r) => setTimeout(r, 20));

    // Factor's evidence must still be the only thing rendered — the stale
    // MoneyPenny response must never have overwritten it.
    expect(screen.getByTestId('receipt-r-factor-1')).toBeInTheDocument();
    expect(screen.queryByTestId('receipt-r-moneypenny-STALE')).not.toBeInTheDocument();
  });

  it('distinguishes a failed fetch from a genuinely empty result — never renders a network failure as "no receipts"', async () => {
    personaFetchMock.mockResolvedValue(fakeFailResponse(500));

    render(<StageReceiptsDrawer receiptTypes={['horizen_agent_registered']} agentsInvoked={['aigent-moneypenny']} />);
    fireEvent.click(screen.getByRole('button', { name: /Evidence/i }));

    await waitFor(() => expect(screen.getByText(/Evidence search failed/i)).toBeInTheDocument());
    expect(screen.queryByText('No additional receipts found in this search.')).not.toBeInTheDocument();
  });

  it('renders "no additional receipts" only on a genuinely successful, empty result', async () => {
    personaFetchMock.mockResolvedValue(fakeOkResponse({ receipts: [], personaDisplayLabel: 'Operator' }));

    render(<StageReceiptsDrawer receiptTypes={['horizen_agent_registered']} agentsInvoked={['aigent-moneypenny']} />);
    fireEvent.click(screen.getByRole('button', { name: /Evidence/i }));

    await waitFor(() => expect(screen.getByText('No additional receipts found in this search.')).toBeInTheDocument());
    expect(screen.queryByText(/Evidence search failed/i)).not.toBeInTheDocument();
  });
});
