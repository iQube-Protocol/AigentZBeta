/**
 * SPEC-CDR-001 P5 — presentation policy canaries.
 *
 * The behaviour under test is the one that decides whether a citizen is
 * interrupted. Its most important property is what it does when it is
 * MISCONFIGURED: it must abstain, not default to zero and not show everything.
 * That failure mode is silent in production, so it is pinned here.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  decidePresentation,
  configuredPresentationThreshold,
} from '../services/resolution/presentationPolicy';

const KEY = 'CDR_PRESENTATION_THRESHOLD';
const original = process.env[KEY];

afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

describe('SPEC-CDR-001 P5 — presentation threshold (operator P5-2)', () => {
  it('fails SAFE: no configuration means silent abstention, never zero', () => {
    delete process.env[KEY];
    const d = decidePresentation(0.99, null);
    expect(d.eligible, 'a 0.99-confidence profile was shown with NO threshold configured').toBe(
      false,
    );
    expect(d.reason).toBe('threshold-unconfigured');
    expect(d.appliedThreshold).toBeNull();
    expect(d.thresholdSource).toBe('none');
  });

  it('fails SAFE on an invalid value rather than coercing it into range', () => {
    // Coercion would silently change policy. Each of these must abstain.
    for (const bad of ['', '  ', 'high', '-0.1', '1.5', 'NaN', 'Infinity']) {
      process.env[KEY] = bad;
      expect(configuredPresentationThreshold(), `"${bad}" was accepted`).toBeNull();
      expect(decidePresentation(0.99, null).eligible, `"${bad}" allowed an offer`).toBe(false);
    }
  });

  it('applies the environment default when the profile has no override', () => {
    process.env[KEY] = '0.80';
    expect(decidePresentation(0.85, null)).toMatchObject({
      eligible: true,
      reason: 'eligible',
      appliedThreshold: 0.8,
      thresholdSource: 'environment',
    });
    expect(decidePresentation(0.75, null)).toMatchObject({
      eligible: false,
      reason: 'below-threshold',
      appliedThreshold: 0.8,
    });
    // Boundary: >= is the rule, so exactly-at-threshold is eligible.
    expect(decidePresentation(0.8, null).eligible).toBe(true);
  });

  it('a row-level override wins over the environment default, in both directions', () => {
    process.env[KEY] = '0.80';
    // Stricter for this profile.
    expect(decidePresentation(0.85, 0.95)).toMatchObject({
      eligible: false,
      appliedThreshold: 0.95,
      thresholdSource: 'profile',
    });
    // Looser for this profile — the calibratability the operator asked for,
    // without a deployment split.
    expect(decidePresentation(0.55, 0.5)).toMatchObject({
      eligible: true,
      appliedThreshold: 0.5,
      thresholdSource: 'profile',
    });
  });

  it('an invalid row override falls back to the environment, not to nothing', () => {
    process.env[KEY] = '0.80';
    for (const bad of [-1, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const d = decidePresentation(0.85, bad);
      expect(d.thresholdSource, `override ${bad} was accepted`).toBe('environment');
      expect(d.appliedThreshold).toBe(0.8);
    }
  });

  it('abstains when there is no confidence to compare (never treats absent as 0 or 1)', () => {
    process.env[KEY] = '0.80';
    for (const missing of [null, undefined, Number.NaN]) {
      const d = decidePresentation(missing as number | null, null);
      expect(d.eligible).toBe(false);
      expect(d.reason).toBe('no-confidence');
      // The threshold is still reported, so the event records what WOULD have
      // applied -- an abstention with no threshold recorded is uncalibratable.
      expect(d.appliedThreshold).toBe(0.8);
    }
  });

  it('records the threshold ACTUALLY applied on every decision (operator P5-2)', () => {
    process.env[KEY] = '0.80';
    // Every non-unconfigured outcome carries a number, so a later change to
    // the row value or the env default cannot make history uninterpretable.
    for (const [confidence, override] of [
      [0.9, null],
      [0.1, null],
      [0.9, 0.95],
      [0.4, 0.3],
    ] as const) {
      expect(typeof decidePresentation(confidence, override).appliedThreshold).toBe('number');
    }
  });

  it('the threshold is not hardcoded anywhere in the policy module', () => {
    // It is an operational value subject to calibration, not a constitutional
    // constant. A literal here would make it un-tunable and imply permanence.
    const src = readFileSync(
      join(__dirname, '../services/resolution/presentationPolicy.ts'),
      'utf8',
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/0\.[0-9]+/);
  });
});

