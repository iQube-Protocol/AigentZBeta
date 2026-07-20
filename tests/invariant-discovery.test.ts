/**
 * Invariant Discovery Engine canaries (CFS-048 Phase 0).
 *
 * Pins the deterministic seams of the discovery pipeline:
 *   1. extractJson — the model-output tolerance layer (fences / prose wrap /
 *      bare JSON) that guards every discovery run's parse step.
 *   2. Discipline canary — the discovery service must land candidates as
 *      'proposed' with 'agent_verified' confidence basis and must NEVER
 *      contain an auto-canonisation path (inv.reasoning.337: discovery never
 *      bypasses validation). Source-level assertion, mirroring the
 *      content-separation canary pattern.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractJson } from '@/services/invariants/discoveryEngine';

describe('extractJson (model-output tolerance)', () => {
  it('passes through bare JSON', () => {
    expect(JSON.parse(extractJson('{"candidates":[]}'))).toEqual({ candidates: [] });
  });

  it('unwraps fenced JSON (```json)', () => {
    const text = 'Here you go:\n```json\n{"candidates":[{"statement":"x"}]}\n```\nDone.';
    expect(JSON.parse(extractJson(text))).toEqual({ candidates: [{ statement: 'x' }] });
  });

  it('unwraps plain fences', () => {
    const text = '```\n{"a":1}\n```';
    expect(JSON.parse(extractJson(text))).toEqual({ a: 1 });
  });

  it('extracts the outermost object from prose wrap', () => {
    const text = 'The candidates are as follows: {"candidates":[{"statement":"y","confidence":0.7}]} — end.';
    expect(JSON.parse(extractJson(text))).toEqual({ candidates: [{ statement: 'y', confidence: 0.7 }] });
  });
});

describe('discovery discipline (inv.reasoning.337 — never bypass validation)', () => {
  const src = readFileSync(
    join(__dirname, '..', 'services', 'invariants', 'discoveryEngine.ts'),
    'utf8',
  );

  it("promotion lands at status 'proposed', never 'canonical'/'validated'", () => {
    expect(src).toMatch(/status:\s*'proposed'/);
    expect(src).not.toMatch(/status:\s*'canonical'/);
    expect(src).not.toMatch(/status:\s*'validated'/);
  });

  it('discovery never calls canonizeInvariant or validateInvariant directly', () => {
    expect(src).not.toMatch(/\bcanonizeInvariant\b/);
    expect(src).not.toMatch(/\bvalidateInvariant\b/);
  });

  it("machine-discovered candidates carry the 'agent_verified' confidence rung", () => {
    expect(src).toMatch(/confidenceBasis:\s*'agent_verified'/);
  });
});
