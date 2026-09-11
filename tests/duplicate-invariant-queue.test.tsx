// @vitest-environment jsdom
/**
 * components/research/Track2ProgrammePanel.tsx::DuplicateInvariantQueue —
 * genuine component-level tests (operator ruling, 2026-08-27, "UI
 * acceptance gap" pass). React Testing Library over jsdom, rendering the
 * REAL component — not a source-text/regex proxy for its behaviour.
 *
 * `personaFetch` is the only IO seam; it is mocked per-test. `onDone` is the
 * panel's authoritative refresh sequence — mocked here so these tests stay
 * scoped to what THIS component does with it (calls it, stays busy until it
 * resolves, never calls `/advance` itself). The exact five-step advance
 * sequencing is proven separately and precisely in
 * tests/track2-duplicate-queue-settle-sequence.test.ts, with no DOM
 * involved — this file proves the operator-facing surface instead.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, within, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  DuplicatePairView,
  DuplicateSurvivalRecommendation,
} from '@/components/research/Track2ProgrammePanel';

const mockPersonaFetch = vi.fn();
vi.mock('@/utils/personaSpine', () => ({
  personaFetch: (...args: any[]) => mockPersonaFetch(...args),
}));

// Imported AFTER the mock is registered, per vitest hoisting convention.
const { DuplicateInvariantQueue } = await import('@/components/research/Track2ProgrammePanel');

function jsonResponse(status: number, body: unknown) {
  return { status, json: async () => body } as Response;
}

const HIGH_CONFIDENCE_REC: DuplicateSurvivalRecommendation = {
  recommendedId: 'inv-a',
  otherId: 'inv-b',
  confidence: 'high',
  reasons: [
    { criterion: 'external-provenance-eligibility', detail: 'inv-a eligible (Population A), inv-b not' },
  ],
};

const LOW_CONFIDENCE_TIE_REC: DuplicateSurvivalRecommendation = {
  recommendedId: 'inv-a',
  otherId: 'inv-b',
  confidence: 'low',
  reasons: [
    {
      criterion: 'deterministic-tiebreak',
      detail:
        'inv-a and inv-b are equivalent on every available criterion (provenance eligibility, lifecycle status, ' +
        'standing, live relationship count, ratified-source presence). Recommending the lexically lower id ' +
        '(inv-a) only for a stable, reproducible default — this is not a claim that either candidate is more ' +
        'correct or more authoritative than the other.',
    },
  ],
};

function makePair(overrides: Partial<DuplicatePairView> = {}): DuplicatePairView {
  return {
    aId: 'inv-a',
    bId: 'inv-b',
    aStatement: 'Liquidity is essential for market stability.',
    bStatement: 'Market stability depends on adequate liquidity.',
    recommendation: HIGH_CONFIDENCE_REC,
    ...overrides,
  };
}

async function openQueue(pairs: DuplicatePairView[], onDone: () => Promise<void>) {
  const user = userEvent.setup();
  const utils = render(<DuplicateInvariantQueue experimentId="EXP-P1" pairs={pairs} onDone={onDone} />);
  await user.click(screen.getByRole('button', { name: /Adjudicate \d+ duplicate pair/ }));
  return { user, ...utils };
}

beforeEach(() => {
  mockPersonaFetch.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('DuplicateInvariantQueue — statement-first display (point 1)', () => {
  it('renders both full invariant statements, with the id present only as secondary metadata', async () => {
    const pair = makePair();
    await openQueue([pair], vi.fn().mockResolvedValue(undefined));

    const statementA = screen.getByText(pair.aStatement);
    const statementB = screen.getByText(pair.bStatement);
    expect(statementA).toBeTruthy();
    expect(statementB).toBeTruthy();

    // Both ids are present somewhere...
    const idNodesA = screen.getAllByText(pair.aId, { exact: false });
    expect(idNodesA.length).toBeGreaterThan(0);

    // ...but the STATEMENT element carries the prominent styling and the id
    // element carries the muted/secondary styling — never the reverse.
    expect(statementA.className).not.toMatch(/text-\[10px\]/);
    expect(statementA.className).toMatch(/text-slate-200/);
    const idCaptionA = idNodesA.find((n) => n.textContent?.trim() === pair.aId);
    expect(idCaptionA?.className).toMatch(/text-\[10px\]/);
    expect(idCaptionA?.className).toMatch(/text-slate-500/);
  });
});

describe('DuplicateInvariantQueue — exactly one Recommended badge (point 2)', () => {
  it('marks exactly one candidate Recommended', async () => {
    await openQueue([makePair()], vi.fn().mockResolvedValue(undefined));
    expect(screen.getAllByText('Recommended')).toHaveLength(1);
  });

  it('the Recommended badge sits on whichever id the recommendation actually names', async () => {
    const pair = makePair({
      recommendation: { ...HIGH_CONFIDENCE_REC, recommendedId: 'inv-b', otherId: 'inv-a' },
    });
    const { container } = await openQueue([pair], vi.fn().mockResolvedValue(undefined));
    const badge = screen.getByText('Recommended');
    // The badge's own candidate card must contain inv-b's statement, not inv-a's.
    const card = badge.closest('div');
    expect(within(card as HTMLElement).queryByText(pair.bStatement)).toBeTruthy();
    void container;
  });
});

describe('DuplicateInvariantQueue — accessible disclosure, not dense always-visible text (point 3)', () => {
  it('uses a native <details>/<summary> disclosure, collapsed by default', async () => {
    const { container } = await openQueue([makePair()], vi.fn().mockResolvedValue(undefined));
    const details = container.querySelector('details');
    expect(details).toBeTruthy();
    expect(details?.open).toBe(false); // collapsed — NOT always-visible dense diagnostic text
    expect(screen.getByText('Why this recommendation?').tagName.toLowerCase()).toBe('summary');
  });

  it('expanding the disclosure (keyboard-operable, native semantics) reveals the server-derived reason text', async () => {
    const { user, container } = await openQueue([makePair()], vi.fn().mockResolvedValue(undefined));
    const details = container.querySelector('details') as HTMLDetailsElement;
    const summary = screen.getByText('Why this recommendation?');

    await user.click(summary);
    expect(details.open).toBe(true);
    expect(screen.getByText(/inv-a eligible \(Population A\), inv-b not/)).toBeTruthy();

    // And it collapses again on a second activation — genuine toggle, not a one-way reveal.
    await user.click(summary);
    expect(details.open).toBe(false);
  });
});

describe('DuplicateInvariantQueue — low-confidence deterministic tie (point 4)', () => {
  it('states plainly, even before expanding, that the candidates are equivalent on available evidence', async () => {
    await openQueue([makePair({ recommendation: LOW_CONFIDENCE_TIE_REC })], vi.fn().mockResolvedValue(undefined));
    expect(screen.getByText(/candidates equivalent on available evidence/i)).toBeTruthy();
  });

  it('the full tiebreak reasoning is available behind the disclosure', async () => {
    const { user } = await openQueue([makePair({ recommendation: LOW_CONFIDENCE_TIE_REC })], vi.fn().mockResolvedValue(undefined));
    await user.click(screen.getByText('Why this recommendation?'));
    expect(screen.getByText(/equivalent on every available criterion/)).toBeTruthy();
    expect(screen.getByText(/not a claim that either candidate is more correct/)).toBeTruthy();
  });
});

describe('DuplicateInvariantQueue — both choices remain available (point 5)', () => {
  it('renders both "Keep recommended candidate" and "Keep alternative candidate"', async () => {
    await openQueue([makePair()], vi.fn().mockResolvedValue(undefined));
    expect(screen.getByRole('button', { name: 'Keep recommended candidate' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep alternative candidate' })).toBeTruthy();
  });
});

describe('DuplicateInvariantQueue — choosing the alternative, with an optional override reason (point 6)', () => {
  it('submits the override reason to the merge route when the operator overrides the recommendation', async () => {
    mockPersonaFetch.mockResolvedValue(jsonResponse(200, { ok: true, survivorId: 'inv-b', mergedId: 'inv-a' }));
    const onDone = vi.fn().mockResolvedValue(undefined);
    const { user } = await openQueue([makePair()], onDone);

    const note = screen.getByPlaceholderText(/Optional note for this decision/);
    await user.type(note, 'inv-b carries the citation the extractor missed');
    await user.click(screen.getByRole('button', { name: 'Keep alternative candidate' }));

    expect(mockPersonaFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockPersonaFetch.mock.calls[0];
    expect(url).toBe('/api/research/track2/EXP-P1/duplicate-pairs/merge');
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      survivorId: 'inv-b', // the ALTERNATIVE (not recommended) side
      mergedId: 'inv-a',
      operatorOverrideReason: 'inv-b carries the citation the extractor missed',
    });
  });

  it('the recommended button needs no reason and sends null when none is typed', async () => {
    mockPersonaFetch.mockResolvedValue(jsonResponse(200, { ok: true, survivorId: 'inv-a', mergedId: 'inv-b' }));
    const { user } = await openQueue([makePair()], vi.fn().mockResolvedValue(undefined));
    await user.click(screen.getByRole('button', { name: 'Keep recommended candidate' }));
    const body = JSON.parse(mockPersonaFetch.mock.calls[0][1].body);
    expect(body.operatorOverrideReason).toBeNull();
  });
});

describe('DuplicateInvariantQueue — submission disables both choices; no duplicate merges (point 7)', () => {
  it('disables both buttons while a merge is in flight, and a second rapid click issues only one request', async () => {
    let resolveFetch!: (v: Response) => void;
    mockPersonaFetch.mockReturnValue(new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    const onDone = vi.fn().mockResolvedValue(undefined);
    const { user } = await openQueue([makePair()], onDone);

    const recommendedBtn = screen.getByRole('button', { name: /Keep recommended candidate/ });
    const alternativeBtn = screen.getByRole('button', { name: 'Keep alternative candidate' });

    await user.click(recommendedBtn);
    // Still mid-flight: both disabled, a second click on either is a no-op.
    expect(recommendedBtn).toBeDisabled();
    expect(alternativeBtn).toBeDisabled();
    await user.click(recommendedBtn).catch(() => undefined);
    await user.click(alternativeBtn).catch(() => undefined);
    expect(mockPersonaFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(jsonResponse(200, { ok: true, survivorId: 'inv-a', mergedId: 'inv-b' }));
    });
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });
});

describe('DuplicateInvariantQueue — non-final merge: no local resolved-pair state (point 8)', () => {
  it('never calls the canonical advance endpoint itself; the displayed pair updates only from a fresh pairs prop', async () => {
    mockPersonaFetch.mockResolvedValue(jsonResponse(200, { ok: true, survivorId: 'inv-a', mergedId: 'inv-b' }));
    const onDone = vi.fn().mockResolvedValue(undefined);
    const pairOne = makePair();
    const pairTwo = makePair({
      aId: 'inv-c',
      bId: 'inv-d',
      aStatement: 'A constraint that never fires is still a constraint.',
      bStatement: 'A constraint no execution path can trigger remains a real constraint.',
      recommendation: { ...HIGH_CONFIDENCE_REC, recommendedId: 'inv-c', otherId: 'inv-d' },
    });

    const { user, rerender } = await openQueue([pairOne, pairTwo], onDone);
    await user.click(screen.getByRole('button', { name: /Keep recommended candidate/ }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));

    // This component itself never touches /advance — that call belongs
    // entirely to the parent's authoritative settle sequence (onDone).
    for (const call of mockPersonaFetch.mock.calls) {
      expect(String(call[0])).not.toMatch(/\/advance/);
    }

    // Simulate the parent's authoritative refresh: onDone resolved, the
    // parent re-read Track 2, and now supplies the NEXT pairs prop — the
    // remaining pair, fetched fresh, not derived from anything this
    // component tracked locally.
    rerender(<DuplicateInvariantQueue experimentId="EXP-P1" pairs={[pairTwo]} onDone={onDone} />);
    expect(screen.getByText(pairTwo.aStatement)).toBeTruthy();
    expect(screen.queryByText(pairOne.aStatement)).toBeNull();
  });
});

describe('DuplicateInvariantQueue — stale-pair 409 (point 10)', () => {
  it('displays a clear refresh message and re-runs the authoritative onDone refresh, without ever calling advance itself', async () => {
    mockPersonaFetch.mockResolvedValue(
      jsonResponse(409, {
        ok: false,
        error:
          'this pair is no longer an adjudicable near-duplicate — it may already have been resolved by another ' +
          'request, or the underlying invariant data changed since it was read. Refresh and try again.',
      }),
    );
    const onDone = vi.fn().mockResolvedValue(undefined);
    const { user } = await openQueue([makePair()], onDone);

    await user.click(screen.getByRole('button', { name: /Keep recommended candidate/ }));

    expect(await screen.findByText(/no longer an adjudicable near-duplicate/)).toBeTruthy();
    expect(screen.getByText(/Refresh and try again/)).toBeTruthy();
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    for (const call of mockPersonaFetch.mock.calls) {
      expect(String(call[0])).not.toMatch(/\/advance/);
    }
  });

  it('does NOT refetch on a non-409 failure (e.g. a genuine validation error)', async () => {
    mockPersonaFetch.mockResolvedValue(jsonResponse(400, { ok: false, error: 'survivorId and mergedId are both required' }));
    const onDone = vi.fn().mockResolvedValue(undefined);
    const { user } = await openQueue([makePair()], onDone);
    await user.click(screen.getByRole('button', { name: /Keep recommended candidate/ }));
    expect(await screen.findByText('survivorId and mergedId are both required')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('DuplicateInvariantQueue — refresh/remount shows the server\'s pair, not a cached position (point 12)', () => {
  it('a remount with an entirely different pairs array displays exactly what the server returned', async () => {
    const originalPair = makePair();
    const { rerender } = await openQueue([originalPair], vi.fn().mockResolvedValue(undefined));
    expect(screen.getByText(originalPair.aStatement)).toBeTruthy();

    const freshPair = makePair({
      aId: 'inv-z',
      bId: 'inv-y',
      aStatement: 'A wholly unrelated statement the client never saw before.',
      bStatement: 'Its near-duplicate, also never previously rendered.',
      recommendation: { ...HIGH_CONFIDENCE_REC, recommendedId: 'inv-z', otherId: 'inv-y' },
    });
    // Simulate a fresh mount/refresh: brand-new props, no shared history.
    rerender(<DuplicateInvariantQueue experimentId="EXP-P1" pairs={[freshPair]} onDone={vi.fn().mockResolvedValue(undefined)} />);

    expect(screen.getByText(freshPair.aStatement)).toBeTruthy();
    expect(screen.queryByText(originalPair.aStatement)).toBeNull();
  });
});
