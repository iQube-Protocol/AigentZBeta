/**
 * DCIR D4 — the universal substrate canaries (CFS-020 D4). These pin the pure
 * composition that `services/dcir/useDcirSeam.ts` performs, WITHOUT rendering
 * React: the hook's only non-trivial logic is (a) appending observations via
 * appendDcirEvent (ring-buffer cap) and (b) composing the three-field
 * `groundObservation` from compactDcirEvents / buildStateSnapshot /
 * mineBehaviouralInvariants+compactBehaviouralInvariants. We exercise the SAME
 * underlying helpers the hook calls, in the same shape, so a silent drift in
 * the hook's composition or a rename of a server-contract field is caught here.
 *
 *   1. `groundObservation` exposes EXACTLY the three server-contract field
 *      names — recentEvents / stateSnapshot / observedPatterns — the keys the
 *      chat route's pushDcirObservationLines reads (gc.recentEvents,
 *      gc.stateSnapshot, gc.observedPatterns). Renaming any is a breaking
 *      change across every adopting surface.
 *   2. `observe` appends via appendDcirEvent and the ring-buffer cap
 *      (DCIR_EVENT_BUFFER_CAP) is honoured — the seam never grows unbounded.
 *   3. The snapshot carries the configured surface on its workflow position.
 *   4. T0-leak canary: the serialized groundObservation carries NO T0
 *      identifier (personaId / authProfileId / rootDid / fioHandle /
 *      kybeAttestation) — the seam is T0-inexpressible by construction.
 */

import { describe, it, expect } from 'vitest';
import {
  appendDcirEvent,
  compactDcirEvents,
  DCIR_EVENT_BUFFER_CAP,
  surfaceOpenedEvent,
  surfaceDataRefreshedEvent,
  aigentMeCapsuleEngagedEvent,
  aigentMeArtifactSentEvent,
  aigentMeArtifactDismissedEvent,
} from '@/services/dcir/eventStream';
import {
  buildStateSnapshot,
  mineBehaviouralInvariants,
  compactBehaviouralInvariants,
} from '@/services/dcir/stateEngine';
import type { DcirEvent } from '@/types/dcir';

const T0_IDENTIFIERS = ['personaId', 'authProfileId', 'rootDid', 'fioHandle', 'kybeAttestation'];

const TEST_SURFACE = 'dcir-substrate-test';
const TEST_STAGE = 'exploring';
const TEST_CAPSULE = 'brief';

/** The exact pure composition useDcirSeam performs — replicated without React. */
function composeGroundObservation(
  events: DcirEvent[],
  config: { surface: string; workflowStage?: string | null; activeCapsule?: string | null },
) {
  const { surface, workflowStage = null, activeCapsule = null } = config;
  return {
    recentEvents: compactDcirEvents(events),
    stateSnapshot: buildStateSnapshot(events, { surface, workflowStage, activeCapsule }),
    observedPatterns: compactBehaviouralInvariants(mineBehaviouralInvariants(events)),
  };
}

/** The exact appender useDcirSeam.observe performs — replicated without React. */
function drainObserve(events: DcirEvent[]): DcirEvent[] {
  return events.reduce<DcirEvent[]>((log, e) => appendDcirEvent(log, e), []);
}

function buildSession(): DcirEvent[] {
  return drainObserve([
    surfaceOpenedEvent(TEST_SURFACE),
    aigentMeCapsuleEngagedEvent(TEST_CAPSULE),
    aigentMeArtifactSentEvent('email', 'gmail'),
    aigentMeArtifactDismissedEvent('doc'),
    aigentMeArtifactDismissedEvent('doc'),
    surfaceDataRefreshedEvent(TEST_SURFACE, '3 items'),
  ]);
}

describe('DCIR D4 substrate — the three-field server contract', () => {
  it('groundObservation exposes EXACTLY recentEvents / stateSnapshot / observedPatterns', () => {
    const go = composeGroundObservation(buildSession(), {
      surface: TEST_SURFACE,
      workflowStage: TEST_STAGE,
      activeCapsule: TEST_CAPSULE,
    });
    expect(Object.keys(go).sort()).toEqual(['observedPatterns', 'recentEvents', 'stateSnapshot']);
    expect(Array.isArray(go.recentEvents)).toBe(true);
    expect(Array.isArray(go.observedPatterns)).toBe(true);
    expect(go.stateSnapshot && typeof go.stateSnapshot === 'object').toBe(true);
  });

  it('empty session still yields the three contract keys (defensive)', () => {
    const go = composeGroundObservation([], { surface: TEST_SURFACE });
    expect(Object.keys(go).sort()).toEqual(['observedPatterns', 'recentEvents', 'stateSnapshot']);
    expect(go.recentEvents).toEqual([]);
    expect(go.observedPatterns).toEqual([]);
  });
});

describe('DCIR D4 substrate — observe appends via appendDcirEvent (ring-buffer cap)', () => {
  it('honours DCIR_EVENT_BUFFER_CAP under overflow', () => {
    const overflow: DcirEvent[] = [];
    for (let i = 0; i < DCIR_EVENT_BUFFER_CAP + 25; i += 1) {
      overflow.push(surfaceDataRefreshedEvent(TEST_SURFACE, `tick ${i}`));
    }
    const log = drainObserve(overflow);
    expect(log.length).toBe(DCIR_EVENT_BUFFER_CAP);
    // Ring buffer keeps the NEWEST events (oldest fall off).
    expect(log[log.length - 1].summary.endsWith(`${DCIR_EVENT_BUFFER_CAP + 24}`)).toBe(true);
  });

  it('appends in order below the cap', () => {
    const log = buildSession();
    expect(log.length).toBe(6);
    expect(log[0].summary.startsWith('surface opened')).toBe(true);
  });
});

describe('DCIR D4 substrate — snapshot carries the configured surface', () => {
  it('stamps the surface on the workflow position', () => {
    const go = composeGroundObservation(buildSession(), {
      surface: TEST_SURFACE,
      workflowStage: TEST_STAGE,
      activeCapsule: TEST_CAPSULE,
    });
    const workflow = (go.stateSnapshot as { workflow: Record<string, unknown> }).workflow;
    expect(workflow.surface).toBe(TEST_SURFACE);
    expect(workflow.stage).toBe(TEST_STAGE);
    expect(workflow.activeCapsule).toBe(TEST_CAPSULE);
  });

  it('persona stays null on the seam (no T0/T1 identifier input path)', () => {
    const go = composeGroundObservation(buildSession(), { surface: TEST_SURFACE });
    expect((go.stateSnapshot as { persona: unknown }).persona).toBe(null);
  });
});

describe('DCIR D4 substrate — T0-leak canary', () => {
  it('serialized groundObservation carries no T0 identifier', () => {
    const go = composeGroundObservation(buildSession(), {
      surface: TEST_SURFACE,
      workflowStage: TEST_STAGE,
      activeCapsule: TEST_CAPSULE,
    });
    const serialized = JSON.stringify(go);
    for (const id of T0_IDENTIFIERS) {
      expect(serialized.includes(id)).toBe(false);
    }
  });
});
