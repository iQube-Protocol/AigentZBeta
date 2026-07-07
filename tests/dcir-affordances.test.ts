/**
 * DCIR D3 — dynamic affordance service canaries (CFS-020 §3, operator policy
 * 2026-07-07). These pin the ratified affordance policy so a silent change
 * cannot widen the auto-act boundary, flip the suggest-only default, or
 * resurrect a "pulsating done action".
 *
 *   1. AUTO_ACTABLE_CLASSES is exactly ['navigation'] — the whole boundary.
 *   2. resolveAutoActable is the choke-point: a non-navigation affordance is
 *      NEVER auto-actable even with the policy enabled (caveat 3 holds).
 *   3. A navigation affordance is NOT auto-actable when the policy is off
 *      (suggest-only default, caveat 1).
 *   4. generateAffordances does NOT emit an affordance for an action whose
 *      completion is present in the event stream (no pulsating done actions).
 *   5. generateAffordances is pure: same input → same output; empty inputs
 *      never throw.
 */

import { describe, it, expect } from 'vitest';
import {
  AUTO_ACTABLE_CLASSES,
  DEFAULT_AUTO_ACT_POLICY,
  disableAutoAct,
  resolveAutoActable,
  autoActNotice,
  autoActPolicyChangeNotice,
  generateAffordances,
  isAffordanceLive,
  type Affordance,
} from '@/services/dcir/affordances';
import {
  emitDcirEvent,
  devStageProposalReceivedEvent,
  devProposalApprovedEvent,
  devImplementationPackGeneratedEvent,
  devDeploymentProposedEvent,
} from '@/services/dcir/eventStream';
import { buildStateSnapshot } from '@/services/dcir/stateEngine';
import type { ConstitutionalStateSnapshot, DcirEvent } from '@/types/dcir';

const SURFACE = { surface: 'dev-command-center' } as const;

function snapshotFor(events: DcirEvent[], overrides?: { stage?: string; activeCapsule?: string }) {
  return buildStateSnapshot(events, {
    surface: SURFACE.surface,
    workflowStage: overrides?.stage ?? null,
    activeCapsule: overrides?.activeCapsule ?? null,
  });
}

/** A hand-built non-navigation affordance for the boundary canary. */
const deploymentAff: Affordance = {
  id: 'aff-record-deployment',
  class: 'deployment',
  label: 'Record a deployment proposal',
  rationale: 'test',
  autoActable: false,
  relevance: 0.6,
  capsuleScope: 'implementation',
};

/** A hand-built navigation affordance for the boundary canary. */
const navAff: Affordance = {
  id: 'aff-open-capsule-intent',
  class: 'navigation',
  label: 'Open the intent capsule',
  rationale: 'test',
  autoActable: true,
  relevance: 0.8,
  capsuleScope: 'intent',
};

describe('DCIR D3 — auto-act boundary (canaries)', () => {
  it('pins AUTO_ACTABLE_CLASSES to exactly ["navigation"]', () => {
    expect([...AUTO_ACTABLE_CLASSES]).toEqual(['navigation']);
  });

  it('ships suggest-only by default (auto-act OFF)', () => {
    expect(DEFAULT_AUTO_ACT_POLICY.enabled).toBe(false);
  });

  it('kill switch is trivial + synchronous — disableAutoAct() returns a disabled policy', () => {
    expect(disableAutoAct()).toEqual({ enabled: false });
  });

  it('resolveAutoActable is FALSE for a non-navigation affordance even when the policy is enabled', () => {
    expect(resolveAutoActable(deploymentAff, { enabled: true })).toBe(false);
    // even if a caller wrongly set autoActable=true on a non-nav class, the
    // class allow-list still blocks it — the boundary holds in code.
    const spoofed: Affordance = { ...deploymentAff, autoActable: true };
    expect(resolveAutoActable(spoofed, { enabled: true })).toBe(false);
  });

  it('resolveAutoActable is FALSE for a navigation affordance when the policy is disabled', () => {
    expect(resolveAutoActable(navAff, { enabled: false })).toBe(false);
    expect(resolveAutoActable(navAff, DEFAULT_AUTO_ACT_POLICY)).toBe(false);
  });

  it('resolveAutoActable is TRUE only for a navigation affordance with the policy enabled', () => {
    expect(resolveAutoActable(navAff, { enabled: true })).toBe(true);
  });

  it('emits both required auto-act notifications (caveat 2b)', () => {
    expect(autoActNotice(navAff)).toContain('auto-acted');
    expect(autoActNotice(navAff)).toContain('disable');
    expect(autoActPolicyChangeNotice({ enabled: true })).toContain('ENABLED');
    expect(autoActPolicyChangeNotice({ enabled: false })).toContain('DISABLED');
  });
});

describe('DCIR D3 — completion/relevance contract (no pulsating done actions)', () => {
  it('emits an "open capsule" navigation affordance for a pending, undecided proposal', () => {
    const events = [devStageProposalReceivedEvent('intent', 'intent')];
    const affs = generateAffordances(events, snapshotFor(events));
    const open = affs.find((a) => a.id === 'aff-open-capsule-intent');
    expect(open).toBeDefined();
    expect(open?.class).toBe('navigation');
    expect(open?.autoActable).toBe(true);
    expect(open?.capsuleScope).toBe('intent');
    expect(isAffordanceLive('aff-open-capsule-intent', events, snapshotFor(events))).toBe(true);
  });

  it('does NOT emit the "open capsule" affordance once the proposal is decided (completion present)', () => {
    const events = [
      devStageProposalReceivedEvent('intent', 'intent'),
      devProposalApprovedEvent('intent', 'intent'),
    ];
    const affs = generateAffordances(events, snapshotFor(events));
    expect(affs.find((a) => a.id === 'aff-open-capsule-intent')).toBeUndefined();
    expect(isAffordanceLive('aff-open-capsule-intent', events, snapshotFor(events))).toBe(false);
  });

  it('does NOT emit "record deployment" once a deployment has been proposed (completion present)', () => {
    const withoutDeploy = [devImplementationPackGeneratedEvent()];
    expect(
      generateAffordances(withoutDeploy, snapshotFor(withoutDeploy)).some(
        (a) => a.id === 'aff-record-deployment',
      ),
    ).toBe(true);

    const withDeploy = [devImplementationPackGeneratedEvent(), devDeploymentProposedEvent()];
    expect(
      generateAffordances(withDeploy, snapshotFor(withDeploy)).some(
        (a) => a.id === 'aff-record-deployment',
      ),
    ).toBe(false);
    expect(isAffordanceLive('aff-record-deployment', withDeploy, snapshotFor(withDeploy))).toBe(false);
  });

  it('every emitted affordance is live (relevance > 0) and carries a non-empty capsuleScope', () => {
    const events = [
      devStageProposalReceivedEvent('context_pack', 'context'),
      devImplementationPackGeneratedEvent(),
    ];
    const affs = generateAffordances(events, snapshotFor(events));
    expect(affs.length).toBeGreaterThan(0);
    for (const a of affs) {
      expect(a.relevance).toBeGreaterThan(0);
      expect(a.capsuleScope.length).toBeGreaterThan(0);
      // only navigation may ever be auto-actable
      expect(a.autoActable).toBe(a.class === 'navigation');
    }
  });
});

describe('DCIR D3 — purity', () => {
  it('same input → same output (deterministic, order-stable)', () => {
    const events = [
      devStageProposalReceivedEvent('intent', 'intent'),
      devImplementationPackGeneratedEvent(),
    ];
    const snap = snapshotFor(events);
    expect(generateAffordances(events, snap)).toEqual(generateAffordances(events, snap));
  });

  it('does not throw on empty inputs', () => {
    const empty = buildStateSnapshot([], { surface: 'x' });
    expect(() => generateAffordances([], empty)).not.toThrow();
    expect(generateAffordances([], empty)).toEqual([]);
    expect(isAffordanceLive('aff-open-capsule-intent', [], empty)).toBe(false);
  });

  it('does not surface T0 identifiers in any affordance payload', () => {
    const events = [
      emitDcirEvent({ kind: 'ToolOutputProduced', runtime: 'conversational', summary: 'stage proposal received: intent', capsuleScope: 'intent' }),
    ];
    const serialized = JSON.stringify(generateAffordances(events, snapshotFor(events)));
    for (const forbidden of ['personaId', 'authProfileId', 'rootDid', 'fioHandle', 'kybeAttestation']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
