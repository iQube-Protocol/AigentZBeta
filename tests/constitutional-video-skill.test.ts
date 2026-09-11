/**
 * Constitutional Video skill canaries (ratified grammar, 2026-07-19).
 *
 * Pins the grammar/content separation and the grammar rules at the contract
 * level:
 *   1. CONTENT SEPARATION — the skill is a blank canvas: no production copy
 *      (the Polity manifesto example) ships in the skill source. The grammar
 *      ships; the content never does.
 *   2. G1 cadence scaffold is deterministic and carries the micro-film
 *      structure (fade-in, stillness, on-screen card, fade to black).
 *   3. G2/G3 validation — identity-as-headline is rejected; every segment
 *      needs exactly one threshold statement; the CTA segment is always last.
 *   4. G5 duration model — 24/36/48 map to 2/3/4 segments by construction.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSTITUTIONAL_SEGMENT_SECONDS,
  CONSTITUTIONAL_DURATIONS,
  CONSTITUTIONAL_GRAMMAR_MANDATE,
  THRESHOLD_PHRASE,
  CADENCE,
  scaffoldSegmentPrompt,
  scaffoldCtaPrompt,
  templateTriplet,
  validateConstitutionalGrammar,
} from '@/services/skills/constitutionalVideoSkill';

describe('grammar/content separation (operator directive)', () => {
  it('ships no manifesto production copy in the skill source', () => {
    const source = readFileSync(
      join(process.cwd(), 'services/skills/constitutionalVideoSkill.ts'),
      'utf8',
    );
    // The example spec's copy — an instance, never the template.
    for (const forbidden of [
      'Agents are here',
      'Robots are coming',
      'The Polity is calling',
      'Claim Your Polity Passport',
      'Personhood Gives Continuity',
      'Action Gives Standing',
      'The Future Has Changed',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('keeps only the structural G4 phrase as a constant', () => {
    expect(THRESHOLD_PHRASE).toBe('Cross the Threshold.');
  });
});

describe('G1 cadence scaffold (deterministic)', () => {
  it('wraps the body direction in the four-beat micro-film structure', () => {
    const prompt = scaffoldSegmentPrompt('A city wakes as systems come alive.', 'Continuity Endures');
    expect(prompt).toContain(`fades in over ${CADENCE.fadeInSeconds} seconds`);
    expect(prompt).toContain('A city wakes as systems come alive.');
    expect(prompt).toContain('deliberate stillness');
    expect(prompt).toContain('"Continuity Endures"');
    expect(prompt).toContain('fade to black');
    // Deterministic: same inputs, same string.
    expect(prompt).toBe(scaffoldSegmentPrompt('A city wakes as systems come alive.', 'Continuity Endures'));
  });

  it('CTA scaffold carries the ceremony grammar and the operator CTA', () => {
    const prompt = scaffoldCtaPrompt(
      'The pace slows; light gathers at a doorway.',
      ['Line one.', 'Line two.', 'Line three.'],
      'Begin your journey.',
      'Participation Endures',
    );
    expect(prompt).toContain('slower and more intentional');
    expect(prompt).toContain('never a portal or sci-fi effect');
    expect(prompt).toContain('do not cross'); // robots as environment, never citizens
    expect(prompt).toContain('only then does the credential become clearly visible');
    expect(prompt).toContain(`"${THRESHOLD_PHRASE}"`);
    expect(prompt).toContain('"Begin your journey."');
    expect(prompt).toContain('"Line one."');
  });
});

describe('G2/G3 grammar validation', () => {
  const cta = { claimLine: 'Begin your journey.', closingTriplet: ['A.', 'B.', 'C.'] as [string, string, string] };

  it('passes a well-formed segment set', () => {
    const check = validateConstitutionalGrammar(
      [
        { index: 0, thresholdStatement: 'Continuity Endures', isCta: false },
        { index: 1, thresholdStatement: 'Participation Endures', isCta: true },
      ],
      cta,
    );
    expect(check.pass).toBe(true);
    expect(check.violations).toEqual([]);
  });

  it('rejects identity as a headline (G3 constitutional correction)', () => {
    const check = validateConstitutionalGrammar(
      [
        { index: 0, thresholdStatement: 'Identity Gives Continuity', isCta: false },
        { index: 1, thresholdStatement: 'Participation Endures', isCta: true },
      ],
      cta,
    );
    expect(check.pass).toBe(false);
    expect(check.violations.some((v) => v.includes('identity'))).toBe(true);
  });

  it('rejects a missing threshold statement (G2 one-invariant rule)', () => {
    const check = validateConstitutionalGrammar(
      [
        { index: 0, thresholdStatement: '', isCta: false },
        { index: 1, thresholdStatement: 'Participation Endures', isCta: true },
      ],
      cta,
    );
    expect(check.pass).toBe(false);
    expect(check.violations.some((v) => v.includes('missing threshold'))).toBe(true);
  });

  it('rejects a non-CTA final segment (G4/G5 CTA-always-last)', () => {
    const check = validateConstitutionalGrammar(
      [
        { index: 0, thresholdStatement: 'Continuity Endures', isCta: true },
        { index: 1, thresholdStatement: 'Participation Endures', isCta: false },
      ],
      cta,
    );
    expect(check.pass).toBe(false);
    expect(check.violations.some((v) => v.includes('CTA'))).toBe(true);
  });
});

describe('G5 duration model', () => {
  it('24/36/48 map to 2/3/4 segments by construction', () => {
    expect(CONSTITUTIONAL_DURATIONS.map((d) => d / CONSTITUTIONAL_SEGMENT_SECONDS)).toEqual([2, 3, 4]);
  });
});

describe('template fallback honesty', () => {
  it('templateTriplet derives from operator concepts, generic filler otherwise', () => {
    const fromConcepts = templateTriplet({ subject: 'S', concepts: ['One', 'Two', 'Three'] });
    expect(fromConcepts).toEqual(['One.', 'Two.', 'Three.']);
    const generic = templateTriplet({ subject: 'A new beginning' });
    expect(generic[0]).toContain('A new beginning');
  });

  it('the grammar mandate forbids identity headlines and invented statements', () => {
    expect(CONSTITUTIONAL_GRAMMAR_MANDATE).toContain('NEVER appear in a threshold statement');
    expect(CONSTITUTIONAL_GRAMMAR_MANDATE).toContain('never invented');
  });
});
