/**
 * DCIR aigentMe expansion canaries (CFS-020 D1+, first expansion surface —
 * operator direction 2026-07: "once we're happy with DCIR we can then expand
 * it to aigentMe and the studio composer"). These pin the observe-mode-first
 * discipline for the aigentMe welcome surface so a silent change cannot leak a
 * T0 identifier into an event/snapshot/ground-context payload or break the
 * event vocabulary the next copilot turn reads.
 *
 *   1. Each aigentMe event constructor emits the ratified kind + a T2-safe
 *      summary (category labels only — never the artifact body/title).
 *   2. `capsule opened:` summaries feed the stateEngine revisit miner exactly
 *      as the Dev Command Center's capsule opens do.
 *   3. compaction + snapshot + mining round-trip carries NO T0 identifier.
 */

import { describe, it, expect } from 'vitest';
import {
  aigentMeCapsuleEngagedEvent,
  aigentMeArtifactSentEvent,
  aigentMeArtifactDismissedEvent,
  aigentMeSecondTierApprovedEvent,
  aigentMeSecondTierCancelledEvent,
  aigentMePillCompletedEvent,
  aigentMeSpecialistConsultedEvent,
  appendDcirEvent,
  compactDcirEvents,
} from '@/services/dcir/eventStream';
import {
  buildStateSnapshot,
  mineBehaviouralInvariants,
  compactBehaviouralInvariants,
  DCIR_MINE_REVISIT_THRESHOLD,
} from '@/services/dcir/stateEngine';
import type { DcirEvent } from '@/types/dcir';

const T0_IDENTIFIERS = ['personaId', 'authProfileId', 'rootDid', 'fioHandle', 'kybeAttestation'];

function buildSession(): DcirEvent[] {
  return [
    aigentMeCapsuleEngagedEvent('brief'),
    aigentMeArtifactSentEvent('email', 'gmail'),
    aigentMeArtifactDismissedEvent('document'),
    aigentMeSecondTierApprovedEvent('Gmail'),
    aigentMeSecondTierCancelledEvent(),
    aigentMePillCompletedEvent(),
    aigentMeSpecialistConsultedEvent('marketa'),
  ].reduce<DcirEvent[]>((log, e) => appendDcirEvent(log, e), []);
}

describe('DCIR aigentMe — event vocabulary (canaries)', () => {
  it('emits the ratified kinds for each lifecycle moment', () => {
    expect(aigentMeCapsuleEngagedEvent('brief').kind).toBe('NavigationOccurred');
    expect(aigentMeArtifactSentEvent('email', 'gmail').kind).toBe('ArtifactApproved');
    expect(aigentMeArtifactDismissedEvent('document').kind).toBe('ArtifactRejected');
    expect(aigentMeSecondTierApprovedEvent('Gmail').kind).toBe('RecommendationAccepted');
    expect(aigentMeSecondTierCancelledEvent().kind).toBe('RecommendationRejected');
    expect(aigentMePillCompletedEvent().kind).toBe('WorkflowAdvanced');
    expect(aigentMeSpecialistConsultedEvent('marketa').kind).toBe('ToolOutputProduced');
  });

  it('every event is tier-safe (t1-browser-safe or t2-network-safe, never a T0 tier)', () => {
    for (const e of buildSession()) {
      expect(['t1-browser-safe', 't2-network-safe']).toContain(e.tier);
    }
  });

  it('capsule-engaged summaries feed the stateEngine revisit miner', () => {
    const opens = Array.from({ length: DCIR_MINE_REVISIT_THRESHOLD }, () =>
      aigentMeCapsuleEngagedEvent('ask-specialists'),
    ).reduce<DcirEvent[]>((log, e) => appendDcirEvent(log, e), []);
    const mined = mineBehaviouralInvariants(opens);
    const revisit = mined.find((m) => m.id.startsWith('bi-observed-capsule-revisits-'));
    expect(revisit).toBeDefined();
    expect(revisit?.status).toBe('observed');
    expect(revisit?.evidenceCount).toBe(DCIR_MINE_REVISIT_THRESHOLD);
  });
});

describe('DCIR aigentMe — tier discipline (no T0 leakage)', () => {
  it('never carries a T0 identifier through events → snapshot → ground context', () => {
    const events = buildSession();
    const snapshot = buildStateSnapshot(events, {
      surface: 'aigentme-welcome',
      workflowStage: 'acolyte',
      activeCapsule: 'brief',
    });
    const ground = {
      recentEvents: compactDcirEvents(events),
      stateSnapshot: snapshot,
      observedPatterns: compactBehaviouralInvariants(mineBehaviouralInvariants(events)),
    };
    const serialized = JSON.stringify(ground);
    for (const forbidden of T0_IDENTIFIERS) {
      expect(serialized).not.toContain(forbidden);
    }
    // The snapshot's persona field is deliberately never populated on this seam.
    expect(snapshot.persona).toBeNull();
    expect(snapshot.workflow).toEqual({
      surface: 'aigentme-welcome',
      stage: 'acolyte',
      activeCapsule: 'brief',
    });
  });

  it('compaction is bounded and order-stable (newest last)', () => {
    const events = buildSession();
    const compact = compactDcirEvents(events);
    expect(compact.length).toBe(events.length);
    expect(compact[compact.length - 1]).toContain('specialist consulted: marketa');
    expect(compactDcirEvents(events)).toEqual(compactDcirEvents(events));
  });
});
