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
  aigentMeSpecialistConsultedEvent,
  aigentMeArtifactSentEvent,
  studioSkillOutputEvent,
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

describe('DCIR D3 — generic-vocabulary derivation (D4-enabling, surface-agnostic)', () => {
  it('emits a "review output" navigation affordance for a produced output on a NON-CDE surface', () => {
    // aigentMe specialist consult = ToolOutputProduced in the ask-specialists
    // capsule — NO dev summary dialect. The generic derivation must still fire.
    const events = [aigentMeSpecialistConsultedEvent('legal')];
    const affs = generateAffordances(events, snapshotFor(events));
    const review = affs.find((a) => a.id === 'aff-review-output-ask-specialists');
    expect(review).toBeDefined();
    expect(review?.class).toBe('navigation');
    expect(review?.autoActable).toBe(true);
    expect(review?.capsuleScope).toBe('ask-specialists');
    expect(isAffordanceLive('aff-review-output-ask-specialists', events, snapshotFor(events))).toBe(true);
  });

  it('fires for a studio skill output too (same generic KIND path)', () => {
    const events = [studioSkillOutputEvent('image', 'venice')];
    const affs = generateAffordances(events, snapshotFor(events));
    expect(affs.some((a) => a.id === 'aff-review-output-production')).toBe(true);
  });

  it('clears once a decision follows the output (completion-aware, no pulsating)', () => {
    // Output in the brief capsule, then an artifact sent (ArtifactApproved =
    // a decision) in the same capsule → the review affordance is no longer live.
    const events = [
      emitDcirEvent({ kind: 'DocumentCreated', runtime: 'action', summary: 'draft created', capsuleScope: 'brief' }),
      aigentMeArtifactSentEvent('email', 'gmail'), // ArtifactApproved, capsuleScope 'brief'
    ];
    expect(generateAffordances(events, snapshotFor(events)).some((a) => a.id === 'aff-review-output-brief')).toBe(false);
  });

  it('suppressed while that capsule is the active one (open == reviewing)', () => {
    const events = [studioSkillOutputEvent('copy')];
    const affs = generateAffordances(events, snapshotFor(events, { activeCapsule: 'production' }));
    expect(affs.some((a) => a.id === 'aff-review-output-production')).toBe(false);
  });

  it('does NOT double-emit for the CDE — the dev proposal-received event is excluded', () => {
    // A dev proposal-received (ToolOutputProduced "stage proposal received:") is
    // handled by derivation A only; the generic derivation must NOT also emit a
    // review affordance for the same capsule.
    const events = [devStageProposalReceivedEvent('intent', 'intent')];
    const affs = generateAffordances(events, snapshotFor(events));
    expect(affs.some((a) => a.id === 'aff-open-capsule-intent')).toBe(true);
    expect(affs.some((a) => a.id === 'aff-review-output-intent')).toBe(false);
  });
});

describe('DCIR D3 — auto-act CONTROL SURFACE (consuming-side canaries)', () => {
  // The Dev Command Center auto-act control surface selects affordances to
  // auto-execute by filtering the live set through resolveAutoActable. These
  // re-pin the choke-point from the consumer's vantage: the surface can NEVER
  // auto-act anything but a navigation affordance, and only when opted in.
  const mixedSet: Affordance[] = [
    navAff,                                              // navigation, auto-actable
    { ...navAff, id: 'aff-open-capsule-context', capsuleScope: 'context' }, // navigation
    deploymentAff,                                       // deployment — suggest-only
    { id: 'aff-produce-next', class: 'mutation', label: 'Produce next', rationale: 't', autoActable: false, relevance: 0.7, capsuleScope: 'intent' },
    { id: 'aff-info', class: 'informational', label: 'Info', rationale: 't', autoActable: false, relevance: 0.4, capsuleScope: 'context' },
  ];

  it('with policy ENABLED, selects ONLY navigation affordances for auto-act', () => {
    const enabled: AutoActPolicy = { enabled: true };
    const selected = mixedSet.filter((a) => resolveAutoActable(a, enabled));
    expect(selected.map((a) => a.id).sort()).toEqual([
      'aff-open-capsule-context',
      'aff-open-capsule-intent',
    ]);
    expect(selected.every((a) => a.class === 'navigation')).toBe(true);
  });

  it('with policy DISABLED (the shipped default), selects NOTHING for auto-act', () => {
    const selectedDefault = mixedSet.filter((a) => resolveAutoActable(a, DEFAULT_AUTO_ACT_POLICY));
    const selectedOff = mixedSet.filter((a) => resolveAutoActable(a, { enabled: false }));
    // the kill switch produces a policy that selects nothing
    const selectedKilled = mixedSet.filter((a) => resolveAutoActable(a, disableAutoAct()));
    expect(selectedDefault).toEqual([]);
    expect(selectedOff).toEqual([]);
    expect(selectedKilled).toEqual([]);
  });

  it('surfaces non-empty operator text for both required notice paths', () => {
    expect(autoActPolicyChangeNotice({ enabled: true }).length).toBeGreaterThan(0);
    expect(autoActPolicyChangeNotice({ enabled: false }).length).toBeGreaterThan(0);
    for (const a of mixedSet.filter((x) => x.class === 'navigation')) {
      expect(autoActNotice(a).length).toBeGreaterThan(0);
      expect(autoActNotice(a)).toContain(a.label);
    }
  });

  it('no auto-act notice leaks a T0 identifier', () => {
    const text = [
      autoActPolicyChangeNotice({ enabled: true }),
      autoActPolicyChangeNotice({ enabled: false }),
      ...mixedSet.map((a) => autoActNotice(a)),
    ].join(' ');
    for (const forbidden of ['personaId', 'authProfileId', 'rootDid', 'fioHandle', 'kybeAttestation']) {
      expect(text).not.toContain(forbidden);
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
