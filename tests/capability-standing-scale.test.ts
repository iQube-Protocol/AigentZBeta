/**
 * Capability Standing — scale correctness and the correction path.
 *
 * THE DEFECT THIS PROTECTS AGAINST (found 2026-07-28, operator-ruled same day).
 * `CapabilitySignals` carries inputs from two producers on two different
 * scales, and v1.0 of the scorer passed all five through one `clamp01`:
 *
 *   0–100  demandConfidence · opportunityConfidence · capabilityConfidence
 *          — VentureQube schema `z.number().min(0).max(100)`
 *   0–1    intentClarity · identityDepth — derived in the service itself
 *
 * So every percentage input ≥ 1 saturated to 1.0. Three of five weighted
 * signals pinned at maximum, collapsing the score to
 * `0.75 + intent*0.15 + identity*0.10`: a floor no citizen could fall below
 * and a 0.25 band no venture signal could move. The score stopped
 * differentiating and started inflating.
 *
 * That reached a MONOTONE, PERSONHOOD-BOUND ledger, which is why this file
 * tests two things and not one:
 *
 *   1. THE SCALE. Both directions are defects. Failing to divide a percentage
 *      saturates it; dividing an already-0–1 input zeroes it. The mirror-image
 *      bug is quieter and worse, so it gets its own canary.
 *   2. THE CORRECTION PATH. Monotone accrual means the inflated scores cannot
 *      come down through ordinary accrual — every correction reads as
 *      `delta <= 0` and is discarded. The operator's ruling:
 *
 *        "Monotone accrual protects earned history from ordinary signal
 *         fluctuation; it does not prohibit an attributable correction of a
 *         defective scoring function."
 *
 *      Correction is therefore a separate, explicitly authorized act that must
 *      name the superseded formula it corrects. The four mutations the ruling
 *      itself named are all here: removal of `/ 100`; accidental normalization
 *      of `intentClarity`; the correction path invoked through ordinary
 *      accrual; and a correction with no formula-version transition or receipt.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { stripComments } from './_lib/sourceAuthority';
import {
  computeCapabilityScore,
  computeIntentClarity,
  computeIdentityDepth,
  CAPABILITY_STANDING_FORMULA_VERSION,
  SUPERSEDED_CAPABILITY_FORMULA_VERSIONS,
  type CapabilitySignals,
} from '../services/crm/standingAccrualService';

const SERVICE = 'services/crm/standingAccrualService.ts';
const src = () => stripComments(readFileSync(SERVICE, 'utf-8'));

const signals = (over: Partial<CapabilitySignals> = {}): CapabilitySignals => ({
  demandConfidence: 0,
  opportunityConfidence: 0,
  capabilityConfidence: 0,
  intentClarity: 0,
  identityDepth: 0,
  ...over,
});

describe('the two scales are kept apart', () => {
  it('percentage signals differentiate across their real range — the v1.0 defect', () => {
    // Under v1.0 every one of these saturated to 1.0 and produced an IDENTICAL
    // score. Distinctness IS the regression test.
    const at = (v: number) =>
      computeCapabilityScore(signals({ demandConfidence: v, opportunityConfidence: v, capabilityConfidence: v }));
    const scores = [1, 25, 50, 75, 100].map(at);
    expect(new Set(scores).size, 'percentage inputs collapse to one score — /100 is missing').toBe(scores.length);
    // Strictly increasing: more confidence is never worth less.
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
  });

  it('a confidence of 1 (out of 100) is near-zero, not maximum', () => {
    const one = computeCapabilityScore(signals({ demandConfidence: 1 }));
    const hundred = computeCapabilityScore(signals({ demandConfidence: 100 }));
    // v1.0's signature: 1 and 100 scored the same.
    expect(one).not.toBe(hundred);
    expect(one).toBeLessThan(hundred * 0.05);
  });

  it('the 0–1 signals are NOT divided by 100 — the mirror-image defect', () => {
    // If normalizePercent were applied to intentClarity, a fully-clear intent
    // (1.0) would contribute 1/100th of its weight and read as almost no
    // signal. Quieter than saturation and worse: it silently erases a real one.
    const full = computeCapabilityScore(signals({ intentClarity: 1, identityDepth: 1 }));
    const none = computeCapabilityScore(signals({ intentClarity: 0, identityDepth: 0 }));
    // intent 0.15 + identity 0.10 = 0.25 of the ceiling.
    expect(full - none).toBeCloseTo(0.25 * 40, 1);
  });

  it('the weighted contribution of each signal matches its declared weight', () => {
    const base = computeCapabilityScore(signals());
    const ceil = 40; // CAPABILITY_CEILING
    const contribution = (over: Partial<CapabilitySignals>) => computeCapabilityScore(signals(over)) - base;
    expect(contribution({ demandConfidence: 100 })).toBeCloseTo(0.25 * ceil, 1);
    expect(contribution({ opportunityConfidence: 100 })).toBeCloseTo(0.2 * ceil, 1);
    expect(contribution({ capabilityConfidence: 100 })).toBeCloseTo(0.3 * ceil, 1);
    expect(contribution({ intentClarity: 1 })).toBeCloseTo(0.15 * ceil, 1);
    expect(contribution({ identityDepth: 1 })).toBeCloseTo(0.1 * ceil, 1);
  });

  it('the producers really are on the scales this file assumes', () => {
    // Not an assumption — the whole fix rests on it, so it is asserted against
    // the schema and the derivers rather than trusted from a comment.
    const schema = stripComments(readFileSync('services/iqube/ventureQubeSchema.ts', 'utf-8'));
    expect(schema, 'VentureQube confidence is no longer 0-100 — revisit normalizePercent').toMatch(
      /confidenceScore\s*=\s*z\.number\(\)\.min\(0\)\.max\(100\)/,
    );
    // The 0–1 derivers, exercised at their extremes.
    expect(computeIntentClarity(null, 0)).toBe(0);
    expect(
      computeIntentClarity(
        { mission: 'm', problemStatement: 'p', valueProposition: 'v', consequenceThesis: 'c' },
        3,
      ),
    ).toBeCloseTo(1, 5);
    expect(computeIdentityDepth(null)).toBeLessThanOrEqual(1);
    expect(computeIdentityDepth({ issued: true, worldIdVerified: true, gradeA: true })).toBe(1);
  });

  it('out-of-range and null inputs cannot escape the 0..ceiling band', () => {
    const wild = computeCapabilityScore({
      demandConfidence: 100_000,
      opportunityConfidence: -50,
      capabilityConfidence: null,
      intentClarity: 99,
      identityDepth: -1,
    });
    expect(wild).toBeGreaterThanOrEqual(0);
    expect(wild).toBeLessThanOrEqual(40);
    expect(computeCapabilityScore(signals())).toBe(0);
  });
});

describe('the correction path is separate from accrual, and attributable', () => {
  it('accrual stays monotone — only the correction path may lower', () => {
    const s = src();
    expect(s, 'accrual is no longer monotone').toMatch(/Math\.max\(existing\.capability,\s*newScore\)/);
    // The correction must NOT reuse the monotone clamp, or it can never correct
    // an inflated score downward — the defect would be permanent.
    const rebaseline = s.split('export async function rebaselineCapabilityStanding')[1]?.split(
      'export async function accrueCapabilityStanding',
    )[0];
    expect(rebaseline, 'rebaselineCapabilityStanding is missing').toBeTruthy();
    expect(
      /Math\.max\(/.test(rebaseline!),
      'the correction path applies a monotone clamp — it cannot correct an inflated score',
    ).toBe(false);
  });

  it('correction is its own function, not a flag on accrual', () => {
    // A boolean parameter would let any accrual call site lower a score, so the
    // monotone guarantee would hold only by convention.
    const accrual = src().split('export async function accrueCapabilityStanding')[1] ?? '';
    expect(/force|override|allowDecrease|correction\s*[?:]/.test(accrual)).toBe(false);
  });

  it('a correction must name a SUPERSEDED formula version', async () => {
    const svc = await import('../services/crm/standingAccrualService');
    // Naming the CURRENT version is a no-op dressed as a correction.
    await expect(
      svc.rebaselineCapabilityStanding('any', signals(), {
        fromFormulaVersion: CAPABILITY_STANDING_FORMULA_VERSION,
        reason: 'x',
      }),
    ).rejects.toThrow(/not a superseded formula/);
    // An unrecognised version cannot authorise a downward write either.
    await expect(
      svc.rebaselineCapabilityStanding('any', signals(), { fromFormulaVersion: 'made-up/v9', reason: 'x' }),
    ).rejects.toThrow(/not a superseded formula/);
  });

  it('the version history is recorded in the type, not only in prose', () => {
    expect(SUPERSEDED_CAPABILITY_FORMULA_VERSIONS.length).toBeGreaterThanOrEqual(1);
    expect(SUPERSEDED_CAPABILITY_FORMULA_VERSIONS).toContain('capability-standing/v1.0');
    expect(SUPERSEDED_CAPABILITY_FORMULA_VERSIONS).not.toContain(CAPABILITY_STANDING_FORMULA_VERSION);
    expect(CAPABILITY_STANDING_FORMULA_VERSION).toMatch(/^capability-standing\/v\d+\.\d+$/);
  });

  it('a correction emits a receipt, and that receipt is not fire-and-forget', () => {
    const rebaseline = src().split('export async function rebaselineCapabilityStanding')[1]?.split(
      'export async function accrueCapabilityStanding',
    )[0] ?? '';
    expect(rebaseline).toMatch(/createActivityReceipt\(/);
    expect(rebaseline).toMatch(/standing_corrected/);
    // The receipt must carry the transition and the reason — a correction that
    // records only the new number is unattributable.
    expect(rebaseline).toMatch(/fromFormulaVersion/);
    expect(rebaseline).toMatch(/CAPABILITY_STANDING_FORMULA_VERSION/);
    expect(rebaseline).toMatch(/correction\.reason/);
    // Accrual's receipt is deliberately `void (async () => …)`. The correction's
    // must NOT be: an unattributed downward write to a personhood ledger is
    // exactly what must never fail silently.
    expect(
      /void\s*\(async/.test(rebaseline),
      'the correction receipt is fire-and-forget — a failed correction receipt would be invisible',
    ).toBe(false);
  });

  it('standing_corrected is a real action type, anchorable, and in the DB constraint', () => {
    const receipts = readFileSync('services/receipts/activityReceiptService.ts', 'utf-8');
    expect(receipts, "'standing_corrected' is not in ActivityActionType").toMatch(/'standing_corrected'/);
    const dvn = readFileSync('services/dvn/activityReceiptDvnPipeline.ts', 'utf-8');
    expect(dvn, 'a downward write to a monotone ledger is not anchorable').toMatch(/'standing_corrected'/);
    const migration = readFileSync(
      'supabase/migrations/20260830000000_standing_corrected_receipt_type.sql',
      'utf-8',
    );
    expect(migration).toMatch(/'standing_corrected'/);
    // The constraint must be a REWRITE of the full list, not an append — and it
    // must still carry the types that already existed, or applying it silently
    // breaks every other writer. (A hand-transcribed list dropped two types
    // earlier today; this asserts the regenerated one did not.)
    for (const kept of ['standing_accrued', 'intent_queued', 'workspace_report_published']) {
      expect(migration, `${kept} was dropped from the regenerated constraint`).toMatch(
        new RegExp(`'${kept}'`),
      );
    }
  });
});
