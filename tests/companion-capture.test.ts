/**
 * metaMe Companion — Capture canary (PRD-MMC-IMPL-003 Increment 1).
 *
 * Mirrors `tests/companion-observer.test.ts`'s exact shape and rigor. Locks
 * the contracts Increment 1 exists to keep:
 *
 *  1. TIER LAW — `types/companionCapture.ts` (a browser-serialisable module)
 *     declares NO forbidden T0 field.
 *
 *  2. SOURCE_KIND_TO_CAPABILITY parity canary — exactly the 4
 *     `CaptureSourceKind` values, each mapped to a real `ObserverCapability`.
 *
 *  3. CONSENT GATE — `assertCaptureRespectsGrants` throws when the mapped
 *     capability is not granted (per source kind) and passes when it is,
 *     including site-scope isolation for the two site-scoped capabilities.
 *
 * Increments 2-4 (routes, UI, extension) are not built yet — their canaries
 * land with those increments, same sequencing `tests/companion-observer.test.ts`
 * followed for Increments 2/4/etc.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CAPTURE_SOURCE_KINDS,
  SOURCE_KIND_TO_CAPABILITY,
  CAPTURED_CONTENT_MAX_CHARS,
} from '@/types/companionCapture';
import { OBSERVER_CAPABILITIES, emptyObserverGrantState } from '@/types/companionObserver';
import { grantCapability } from '@/services/companion/observerConsent';
import { assertCaptureRespectsGrants } from '@/services/companion/captureConsent';

// ─── 1. Contract source declares no T0 field ────────────────────────────────

describe('types/companionCapture.ts — no T0 field declarations', () => {
  const source = readFileSync(join(process.cwd(), 'types', 'companionCapture.ts'), 'utf8');

  for (const field of ['personaId', 'authProfileId', 'rootDid', 'kybeAttestation', 'fioHandle']) {
    it(`does not declare a "${field}" property`, () => {
      const decl = new RegExp(`^\\s*(readonly\\s+)?${field}\\??\\s*:`, 'm');
      expect(decl.test(source)).toBe(false);
    });
  }
});

// ─── 2. SOURCE_KIND_TO_CAPABILITY parity canary ─────────────────────────────

describe('CAPTURE_SOURCE_KINDS / SOURCE_KIND_TO_CAPABILITY — parity canary', () => {
  it('has exactly the 4 source kinds this pass supports', () => {
    expect(CAPTURE_SOURCE_KINDS).toHaveLength(4);
    expect([...CAPTURE_SOURCE_KINDS]).toEqual(['webpage', 'selection', 'pdf', 'image']);
  });

  it('every source kind maps to a real ObserverCapability', () => {
    for (const kind of CAPTURE_SOURCE_KINDS) {
      expect(OBSERVER_CAPABILITIES).toContain(SOURCE_KIND_TO_CAPABILITY[kind]);
    }
  });

  it('has no mapping entries outside CAPTURE_SOURCE_KINDS', () => {
    expect(new Set(Object.keys(SOURCE_KIND_TO_CAPABILITY))).toEqual(new Set(CAPTURE_SOURCE_KINDS));
  });

  it('pdf maps to the previously-unused downloads capability (PRD-MMC-IMPL-003 §0.4)', () => {
    expect(SOURCE_KIND_TO_CAPABILITY.pdf).toBe('downloads');
  });

  it('content ceiling is larger than the Observer excerpt cap but still bounded', () => {
    expect(CAPTURED_CONTENT_MAX_CHARS).toBeGreaterThan(2000);
    expect(CAPTURED_CONTENT_MAX_CHARS).toBeLessThan(1_000_000);
  });
});

// ─── 3. assertCaptureRespectsGrants — the consent-enforcement choke point ──

describe('assertCaptureRespectsGrants', () => {
  it('throws for every source kind when nothing is granted', () => {
    const state = emptyObserverGrantState();
    for (const sourceKind of CAPTURE_SOURCE_KINDS) {
      expect(() => assertCaptureRespectsGrants({ sourceKind }, state)).toThrow();
    }
  });

  it('passes for every source kind once its mapped capability is granted', () => {
    let state = emptyObserverGrantState();
    for (const kind of CAPTURE_SOURCE_KINDS) {
      state = grantCapability(state, SOURCE_KIND_TO_CAPABILITY[kind], 'global');
    }
    for (const sourceKind of CAPTURE_SOURCE_KINDS) {
      expect(() => assertCaptureRespectsGrants({ sourceKind }, state)).not.toThrow();
    }
  });

  it('does not conflate two source kinds mapped to different capabilities', () => {
    // Only 'selection' granted -- 'webpage'/'image' (page-document) and
    // 'pdf' (downloads) must still throw.
    const state = grantCapability(emptyObserverGrantState(), 'selection', 'global');
    expect(() => assertCaptureRespectsGrants({ sourceKind: 'selection' }, state)).not.toThrow();
    expect(() => assertCaptureRespectsGrants({ sourceKind: 'webpage' }, state)).toThrow();
    expect(() => assertCaptureRespectsGrants({ sourceKind: 'image' }, state)).toThrow();
    expect(() => assertCaptureRespectsGrants({ sourceKind: 'pdf' }, state)).toThrow();
  });

  it('respects site-scoped grants for webpage/image (page-document) against the capture\'s own site', () => {
    const state = grantCapability(emptyObserverGrantState(), 'page-document', 'site', 'granted.com');
    expect(() =>
      assertCaptureRespectsGrants({ sourceKind: 'webpage' }, state, 'granted.com'),
    ).not.toThrow();
    expect(() =>
      assertCaptureRespectsGrants({ sourceKind: 'webpage' }, state, 'other.com'),
    ).toThrow();
  });
});
