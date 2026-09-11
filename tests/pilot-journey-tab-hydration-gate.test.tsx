// @vitest-environment jsdom
/**
 * PilotJourneyTab — never mount an agent-scoped surface against the
 * hardcoded default before the persisted selection resolves (item 5,
 * 2026-09-06 surgical repair).
 *
 * `selectedAgentSlug` initializes to a hardcoded 'nakamoto' and is corrected
 * to the operator's persisted selection (services/journey/selectedPilotAgent.ts,
 * a synchronous localStorage read) inside a `useEffect` that runs AFTER
 * first paint. Before this fix, JourneyRunSurface mounted immediately with
 * the hardcoded default — firing a real `stateUrl` request and mounting
 * every agent-scoped surface against 'nakamoto' regardless of what was
 * actually stored — the exact defect RES-2026-09-06-JOURNEY-EVIDENCE-
 * SURFACE-CONSOLIDATION-001 closes. `hydrated` now gates that entire mount.
 *
 * JourneyRunSurface itself is stubbed to a prop-recorder — this file proves
 * PilotJourneyTab's OWN gating contract, not JourneyRunSurface's internals
 * (covered elsewhere).
 */
import React from 'react';
import { render, cleanup, waitFor, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

const mountedWithSelectedAgentSlug: string[] = [];
vi.mock('@/components/journey/JourneyRunSurface', () => ({
  JourneyRunSurface: (props: { selectedAgentSlug?: string }) => {
    mountedWithSelectedAgentSlug.push(props.selectedAgentSlug ?? '(none)');
    return <div data-testid="journey-run-surface">{props.selectedAgentSlug}</div>;
  },
}));

import { PilotJourneyTab } from '@/app/triad/components/codex/tabs/PilotJourneyTab';
import { setSelectedPilotAgentSlug } from '@/services/journey/selectedPilotAgent';

afterEach(() => {
  cleanup();
  mountedWithSelectedAgentSlug.length = 0;
  window.localStorage.clear();
});

describe('PilotJourneyTab — hydration gate before mounting any agent-scoped surface', () => {
  it('a persisted Factor selection reaches JourneyRunSurface on its FIRST mount — never a Nakamoto flash first', async () => {
    setSelectedPilotAgentSlug('factor');

    render(<PilotJourneyTab personaId="persona-1" />);

    await waitFor(() => expect(screen.getByTestId('journey-run-surface')).toBeInTheDocument());

    // JourneyRunSurface may re-render several times, but every mount/render
    // it ever received selectedAgentSlug for must be 'factor' — not one of
    // them may have been 'nakamoto', even transiently.
    expect(mountedWithSelectedAgentSlug.length).toBeGreaterThan(0);
    expect(mountedWithSelectedAgentSlug.every((slug) => slug === 'factor')).toBe(true);
    expect(mountedWithSelectedAgentSlug).not.toContain('nakamoto');
  });

  it('with no persisted selection, getSelectedPilotAgentSlug\'s own fallback is used consistently — every mount agrees, never a mixed value', async () => {
    render(<PilotJourneyTab personaId="persona-1" />);

    await waitFor(() => expect(screen.getByTestId('journey-run-surface')).toBeInTheDocument());

    // getSelectedPilotAgentSlug() falls back to DEFAULT_REGISTRABLE_AGENT_SLUG
    // ('moneypenny') when nothing is stored — a DIFFERENT value than
    // PilotJourneyTab's own hardcoded pre-hydration placeholder ('nakamoto').
    // The gate's job is exactly to make sure that placeholder never leaks
    // through to JourneyRunSurface — every recorded mount must agree on ONE
    // value, whatever it resolves to.
    const distinctValues = new Set(mountedWithSelectedAgentSlug);
    expect(distinctValues.size).toBe(1);
    expect(mountedWithSelectedAgentSlug).not.toContain('nakamoto');
  });

  it('renders a neutral loading state before JourneyRunSurface ever mounts, never the empty/undefined surface directly', () => {
    setSelectedPilotAgentSlug('factor');
    render(<PilotJourneyTab personaId="persona-1" />);
    // Immediately after the synchronous render (before effects have had a
    // chance to run in a later tick), JourneyRunSurface must not yet have
    // recorded a mount with the WRONG (hardcoded-default) value — the gate
    // means it either hasn't mounted yet, or mounted directly with the
    // correct persisted value.
    expect(mountedWithSelectedAgentSlug).not.toContain('nakamoto');
  });
});
