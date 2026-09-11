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

// ─── The 2026-07-28 cross-domain contamination regression ──────────────────
//
// Operator: "Commercialisation docs are now showing FS docs." Two defects
// compounded, and BOTH are guarded here because either alone reproduces it:
//
//  1. The GET projection carried every evidence row's FULL content. Acquired
//     institutional documents run to 200k chars each and a 1.3M-char report
//     chunks into several rows, so a real corpus blew the Lambda 6MB cap and
//     the response arrived EMPTY.
//  2. `load()` only wrote state on success, so the failed parse left the
//     PREVIOUS domain's rows rendering under the NEW domain's heading. The
//     domain read model was correct throughout — the transport was too large
//     to arrive, and the surface displayed stale data as current.

describe('discovery GET payload is bounded, and stale scope data never renders as current', () => {
  const ROUTE = readFileSync(join(process.cwd(), 'app', 'api', 'invariants', 'discovery', 'route.ts'), 'utf8');
  const TAB = readFileSync(join(process.cwd(), 'components', 'composer', 'InvariantDiscoveryTab.tsx'), 'utf8');

  it('the route sends evidence LENGTHS, never full document text', () => {
    expect(ROUTE).toMatch(/evidence:\s*evidence\.map\(/);
    expect(ROUTE).toMatch(/contentChars:\s*content\.length/);
    // The content itself must be emptied — mapping it through unchanged is the
    // regression, and a canary that only checked for `contentChars` would pass.
    expect(ROUTE).toMatch(/content:\s*''/);
  });

  it('extraction still receives FULL content — the truncation is confined to the route projection', () => {
    // listDomainEvidence feeds extraction/compare/compression, which genuinely
    // need the text. Bounding THAT would silently degrade discovery quality
    // rather than merely the payload.
    const ENGINE = readFileSync(join(process.cwd(), 'services', 'invariants', 'discoveryEngine.ts'), 'utf8');
    expect(ENGINE).toMatch(/content:\s*String\(r\.content\)/);
  });

  it('load() clears the previous scope BEFORE fetching, so a failure cannot leave another domain on screen', () => {
    const loadBody = /const load = useCallback\(async \(\) => \{([\s\S]*?)try \{/.exec(TAB)?.[1] ?? '';
    expect(loadBody).toMatch(/setEvidence\(\[\]\)/);
    expect(loadBody).toMatch(/setCandidates\(\[\]\)/);
    expect(loadBody).toMatch(/setQueue\(\[\]\)/);
  });

  it('an empty response body is reported, never fed to JSON.parse', () => {
    // `res.json()` on an empty body throws a raw parser error ("unexpected end
    // of data at line 1 column 1") that tells the operator nothing about the
    // real cause.
    expect(TAB).toMatch(/const raw = await res\.text\(\)/);
    expect(TAB).toMatch(/if \(!raw\)/);
    expect(TAB).not.toMatch(/const data = await res\.json\(\);/);
  });
});
