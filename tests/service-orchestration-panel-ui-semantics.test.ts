/**
 * Horizen / MoneyPenny Phase 3 — final closeout UI semantics (2026-08-24).
 *
 * The underlying Standing and Runtime behavior was already correct; this
 * closeout is UI-only — no threshold, accrual, gate, or DVN change. These
 * canaries prove the four acceptance requirements the operator's directive
 * named, over the SAME pure helper functions `ServiceOrchestrationPanel.tsx`
 * renders from (exported for exactly this reason — this repo's vitest
 * environment is `node`, no jsdom/RTL, so a real behavioural proof requires
 * callable, assertable functions rather than a rendered tree).
 *
 * 1. Selected-agent qualification never reads as a Runtime-health failure.
 * 2. The two Runtime variants (Constitutional / Confidential) are visually
 *    explicit and always read READY / PRE-VELA READY, never "not-ready".
 * 3. MoneyPenny's real Standing numbers (Personal 3.0, overall 2.1) render
 *    through the qualification copy without alteration.
 * 4. The raw machine reason code stays available (tooltip `title`), never
 *    deleted — only de-emphasized from the primary badge text.
 */
import { describe, it, expect } from 'vitest';
import {
  qualificationBadge,
  runtimeSystemFields,
  confidentialAssuranceLabel,
  readinessLabel,
  eligibilityLabel,
} from '@/app/(shell)/moneypenny/components/ServiceOrchestrationPanel';
import type { EligibilityResult, RuntimeReadinessProjection } from '@/app/(shell)/moneypenny/components/serviceOrchestrationPanelState';

function readiness(overrides: Partial<RuntimeReadinessProjection> = {}): RuntimeReadinessProjection {
  return {
    systemReady: 'ready',
    eligibility: 'ready',
    standing: 'not-ready',
    authority: 'pending',
    confidentialExecution: 'not-required',
    ...overrides,
  };
}

describe('qualificationBadge — Selected agent qualification is never a Runtime-health failure', () => {
  it('renders the exact operator-specified copy for STANDING_BELOW_THRESHOLD using the live MoneyPenny/Nakamoto numbers', () => {
    const eligibility: EligibilityResult = {
      eligible: false,
      code: 'STANDING_BELOW_THRESHOLD',
      reason: 'Standing score 2.1 is below the required 25',
    };
    const badge = qualificationBadge(eligibility);
    expect(badge.text).toBe('Selected agent Standing: 2.1 / 25 — not yet qualified');
    // Never alarming red — this is a policy outcome, not a Runtime failure.
    expect(badge.tone).not.toMatch(/rose/);
    expect(badge.tone).toMatch(/amber/);
  });

  it('never names "Runtime" in the qualification copy — it identifies the selected consumer, not the Runtime pipeline', () => {
    const eligibility: EligibilityResult = {
      eligible: false,
      code: 'STANDING_BELOW_THRESHOLD',
      reason: 'Standing score 12 is below the required 25',
    };
    expect(qualificationBadge(eligibility).text).not.toMatch(/Runtime/i);
  });

  it('keeps the raw machine reason code available (tooltip), never deletes it', () => {
    const eligibility: EligibilityResult = {
      eligible: false,
      code: 'STANDING_BELOW_THRESHOLD',
      reason: 'Standing score 2.1 is below the required 25',
    };
    const badge = qualificationBadge(eligibility);
    expect(badge.title).toContain('STANDING_BELOW_THRESHOLD');
    expect(badge.title).toContain('Standing score 2.1 is below the required 25');
  });

  it('falls back to the generic label+code when the reason string does not match the expected shape (defensive, never throws)', () => {
    const eligibility: EligibilityResult = {
      eligible: false,
      code: 'STANDING_BELOW_THRESHOLD',
      reason: 'an unexpected reason shape',
    };
    const badge = qualificationBadge(eligibility);
    expect(badge.text).toBe('not eligible — STANDING_BELOW_THRESHOLD');
  });

  it('leaves every other eligibility code exactly as before (no scope creep beyond STANDING_BELOW_THRESHOLD)', () => {
    const eligibility: EligibilityResult = {
      eligible: false,
      code: 'NOT_ADMITTED',
      reason: "'aigent-nakamoto' is not constitutionally admitted",
    };
    const badge = qualificationBadge(eligibility);
    expect(badge.text).toBe('not eligible — NOT_ADMITTED');
  });

  it('renders the eligible=true case unchanged', () => {
    const eligibility: EligibilityResult = { eligible: true, code: 'ELIGIBLE', reason: 'eligibility policy satisfied' };
    expect(qualificationBadge(eligibility).text).toBe('eligible — ELIGIBLE');
  });
});

describe('runtimeSystemFields — the two Runtime variants are visually explicit and always read ready', () => {
  it('Constitutional Runtime: System Ready, Execution path Constitutional Service Pipeline, Vela not required, Attestation not required', () => {
    const fields = runtimeSystemFields('CONSTITUTIONAL_SERVICE_PIPELINE', readiness(), 'NOT_REQUIRED');
    expect(fields).toEqual([
      { label: 'Constitutional Runtime', text: 'READY', tone: expect.stringContaining('emerald') },
      { label: 'Execution path', text: 'Constitutional Service Pipeline', tone: expect.any(String) },
      { label: 'Vela', text: 'Not required', tone: expect.any(String) },
      { label: 'Attestation', text: 'Not required', tone: expect.any(String) },
    ]);
  });

  it('Confidential Runtime pre-Vela: System PRE-VELA READY, Execution path Constitutional Commerce, Vela Live attestation Pending', () => {
    const fields = runtimeSystemFields('CONSTITUTIONAL_COMMERCE', readiness({ confidentialExecution: 'pending' }), 'REQUIRED');
    expect(fields).toEqual([
      { label: 'Confidential Runtime', text: 'PRE-VELA READY', tone: expect.stringContaining('emerald') },
      { label: 'Execution path', text: 'Constitutional Commerce', tone: expect.any(String) },
      { label: 'Vela Live attestation', text: 'Pending', tone: expect.stringContaining('amber') },
    ]);
  });

  it('never renders a "not-ready"/failing word for the Runtime system layer regardless of the selected consumer state', () => {
    // A consumer refused on Standing/authority (readiness.standing / .authority
    // not-ready/pending) must never leak into the Runtime-system fields —
    // systemReady stays 'ready' independent of those consumer-specific facts.
    const consumerRefused = readiness({ standing: 'not-ready', authority: 'pending' });
    for (const path of ['CONSTITUTIONAL_SERVICE_PIPELINE', 'CONSTITUTIONAL_COMMERCE'] as const) {
      const fields = runtimeSystemFields(path, consumerRefused, 'NOT_REQUIRED');
      const text = fields.map((f) => f.text).join(' ');
      expect(text).not.toMatch(/not-ready|unresolved|failing|broken/i);
    }
  });

  it('Confidential Runtime past pre-Vela (attestation no longer pending) reads fully READY, not "PRE-VELA READY"', () => {
    const fields = runtimeSystemFields('CONSTITUTIONAL_COMMERCE', readiness({ confidentialExecution: 'ready' }), 'REQUIRED');
    expect(fields[0]).toEqual({ label: 'Confidential Runtime', text: 'READY', tone: expect.stringContaining('emerald') });
  });
});

describe('confidentialAssuranceLabel + readinessLabel — Selected agent qualification, Standing line', () => {
  it('names Vela Live attestation specifically when pending, under the qualification (not system) heading', () => {
    expect(confidentialAssuranceLabel('pending')).toBe('Confidential assurance: Vela Live attestation pending');
  });

  it('reads plainly ready once attestation is no longer pending', () => {
    expect(confidentialAssuranceLabel('ready')).toBe('Confidential assurance: ready');
  });

  it('renders a distinct Standing line (readiness.standing) separate from the qualification badge text', () => {
    expect(readinessLabel('standing', 'not-ready')).toBe('Standing: not-ready');
  });

  it('eligibilityLabel is unchanged for the three-valued eligible field', () => {
    expect(eligibilityLabel(true)).toBe('eligible');
    expect(eligibilityLabel(false)).toBe('not eligible');
    expect(eligibilityLabel(undefined)).toBe('undetermined');
  });
});
