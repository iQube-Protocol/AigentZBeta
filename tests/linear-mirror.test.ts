/**
 * Linear lifecycle-mirror canary (operator-ratified 2026-07-12).
 *
 * Pins the PURE half of services/linear/lifecycleMirror.ts — the deterministic
 * issue keying, the phase → Linear state-type map (the portable vocabulary),
 * state picking with its fallback chain, and the T2-safe body builders — plus
 * the soft-fail contract of the mirror itself when no LINEAR_API_KEY is set
 * (the pipeline must be untouched; the reason must be honest).
 *
 * TIER CANARY: the mirror crosses an EXTERNAL-service boundary, so this suite
 * asserts no forbidden T0 key can appear in what the builders emit.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PHASE_TO_STATE_TYPE,
  mirrorKeyFor,
  markerFor,
  issueTitleFor,
  issueBodyFor,
  transitionCommentFor,
  pickStateId,
  mirrorLifecycleToLinear,
  type LifecyclePhase,
} from '@/services/linear/lifecycleMirror';

describe('phase → Linear state-type map (the portable cycle)', () => {
  it('covers the five phases with the ratified mapping', () => {
    expect(PHASE_TO_STATE_TYPE).toEqual({
      intent_declared: 'backlog',
      pack_generated: 'unstarted',
      artifact_produced: 'started',
      deployment_proposed: 'started',
      published: 'completed',
    });
  });
});

describe('deterministic issue keying', () => {
  it('same (delegate, profile, brief) always converges on the same key', () => {
    const a = mirrorKeyFor('aletheon', 'documentation', 'Draft the charter');
    const b = mirrorKeyFor('aletheon', 'documentation', '  Draft the charter  ');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });

  it('any component change changes the key (no cross-production collisions)', () => {
    const base = mirrorKeyFor('operator', 'software', 'ship the widget');
    expect(mirrorKeyFor('aletheon', 'software', 'ship the widget')).not.toBe(base);
    expect(mirrorKeyFor('operator', 'documentation', 'ship the widget')).not.toBe(base);
    expect(mirrorKeyFor('operator', 'software', 'ship the gadget')).not.toBe(base);
  });

  it('the marker embeds the key and the title carries the marker', () => {
    const key = mirrorKeyFor('operator', 'software', 'ship the widget');
    expect(markerFor(key)).toBe(`[AR:${key}]`);
    expect(issueTitleFor('ship the widget', key)).toContain(`[AR:${key}]`);
    expect(issueTitleFor('ship the widget', key)).toContain('ship the widget');
  });
});

describe('state picking (portable across team configurations)', () => {
  const states = [
    { id: 'st-backlog', type: 'backlog', position: 0 },
    { id: 'st-todo', type: 'unstarted', position: 1 },
    { id: 'st-progress', type: 'started', position: 2 },
    { id: 'st-review', type: 'started', position: 3 },
    { id: 'st-done', type: 'completed', position: 4 },
  ];

  it('maps each phase to the lowest-position state of its type', () => {
    expect(pickStateId(states, 'intent_declared')).toBe('st-backlog');
    expect(pickStateId(states, 'pack_generated')).toBe('st-todo');
    expect(pickStateId(states, 'artifact_produced')).toBe('st-progress');
    expect(pickStateId(states, 'deployment_proposed')).toBe('st-progress');
    expect(pickStateId(states, 'published')).toBe('st-done');
  });

  it('falls back honestly when a team lacks a type, and returns null when nothing fits', () => {
    const noBacklog = states.filter((s) => s.type !== 'backlog');
    expect(pickStateId(noBacklog, 'intent_declared')).toBe('st-todo'); // backlog → unstarted fallback
    expect(pickStateId([], 'published')).toBeNull();
  });
});

describe('T2-safe body builders (external-service boundary)', () => {
  const event = {
    delegate: 'aletheon',
    profile: 'documentation',
    brief: 'Draft the constitutional charter',
    phase: 'artifact_produced' as LifecyclePhase,
    note: 'record `rec-1` — receipt `rcp-1`',
  };

  it('the description carries delegate/profile/brief and the mirror disclaimer', () => {
    const body = issueBodyFor(event);
    expect(body).toContain('aletheon');
    expect(body).toContain('documentation');
    expect(body).toContain('Draft the constitutional charter');
    expect(body).toContain('receipts are the source of truth');
  });

  it('transition comments label the phase and carry the note', () => {
    expect(transitionCommentFor('published')).toContain('Published');
    expect(transitionCommentFor('deployment_proposed')).toContain('execution stays human');
    expect(transitionCommentFor('artifact_produced', 'record `rec-1`')).toContain('record `rec-1`');
  });

  it('no forbidden T0 key is expressible through the builders', () => {
    const emitted = JSON.stringify({
      title: issueTitleFor(event.brief, mirrorKeyFor(event.delegate, event.profile, event.brief)),
      body: issueBodyFor(event),
      comment: transitionCommentFor(event.phase, event.note),
    });
    for (const forbidden of ['personaId', 'authProfileId', 'rootDid', 'kybeAttestation']) {
      expect(emitted).not.toContain(forbidden);
    }
  });
});

describe('soft-fail contract (the pipeline is never held hostage)', () => {
  const saved = { key: process.env.LINEAR_API_KEY, team: process.env.LINEAR_TEAM_KEY };
  beforeEach(() => {
    delete process.env.LINEAR_API_KEY;
    delete process.env.LINEAR_TEAM_KEY;
  });
  afterEach(() => {
    if (saved.key !== undefined) process.env.LINEAR_API_KEY = saved.key;
    if (saved.team !== undefined) process.env.LINEAR_TEAM_KEY = saved.team;
  });

  it('no key ⇒ { mirrored: false } with an honest reason — never a throw', async () => {
    const result = await mirrorLifecycleToLinear({
      delegate: 'operator',
      profile: 'software',
      brief: 'ship the widget',
      phase: 'artifact_produced',
    });
    expect(result.mirrored).toBe(false);
    expect(result.reason).toContain('LINEAR_API_KEY');
  });
});
