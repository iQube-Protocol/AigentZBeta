/**
 * The admission spine is linear; enrichments are a parallel axis.
 *
 * ── THE OPERATOR'S RECONSTITUTION (2026-08-03) ───────────────────────────
 *
 *   > "Constitutional admission establishes who the agent is, whose authority
 *   >  it carries, and whether that authority is bounded. Capability
 *   >  enrichments determine what specialized services it may subsequently
 *   >  use. Those are separate axes. Collapsing them into one linear ceremony
 *   >  is what has kept turning optional partner integrations into
 *   >  existential blockers."
 *
 * ── THE DEFECT THESE REPLACE ─────────────────────────────────────────────
 *
 * Verify sat at position 2 of the spine, between Register and Claim. Because
 * `partner_authorization_requests` was missing from the deployed schema, an
 * OPTIONAL partner enrichment held personhood hostage: Claim, Passport,
 * delegation and activation were all unreachable behind a Pulse toggle that
 * could not run. A deploy step had become an existential blocker.
 *
 * The spine is now:  Register -> Claim -> Passport -> Delegate -> aigentMe
 * and the branches:  factory (participation + Standing ELIGIBILITY)
 *                    capability (Pulse/P&L -> financial-services runtime)
 */

import { describe, it, expect } from 'vitest';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import type { JourneyStageDefinition } from '@/types/journey';

const STAGES = HORIZEN_MONEYPENNY_JOURNEY.stages;
const byId = (id: string): JourneyStageDefinition => {
  const s = STAGES.find((x) => x.id === id);
  if (!s) throw new Error(`no stage "${id}"`);
  return s;
};
const orderOf = (id: string) => STAGES.findIndex((s) => s.id === id);

const SPINE = ['register', 'claim', 'passport', 'delegate', 'aigentme'] as const;

describe('the admission spine is Register -> Claim -> Passport -> Delegate -> aigentMe', () => {
  it('runs in that order, with nothing interleaved', () => {
    const positions = SPINE.map(orderOf);
    expect(positions.every((p) => p >= 0), 'a spine stage is missing').toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('each spine stage requires only its predecessor', () => {
    // THE ASSERTION THAT FAILS ON THE DEFECT: Claim used to require 'verify'.
    expect(byId('claim').prerequisites).toEqual(['register']);
    expect(byId('passport').prerequisites).toEqual(['claim']);
    expect(byId('delegate').prerequisites).toEqual(['passport']);
    expect(byId('aigentme').prerequisites).toEqual(['delegate']);
  });

  it('Verify does NOT appear before Claim', () => {
    expect(orderOf('verify')).toBeGreaterThan(orderOf('claim'));
  });

  it('no spine stage waits on Verify — an enrichment cannot gate admission', () => {
    for (const id of SPINE) {
      expect(byId(id).prerequisites, `${id} must not require verify`).not.toContain('verify');
    }
  });

  it('Register routes straight to Claim', () => {
    expect(byId('register').nextStageId).toBe('claim');
  });
});

describe('enrichments and factory ingestion are parallel branches, not steps', () => {
  it('Verify is a capability branch hanging off aigentMe', () => {
    const verify = byId('verify');
    expect(verify.branch).toBe('capability');
    // Both branches hang off aigentMe — the operator's diagram, 2026-08-03.
    expect(verify.prerequisites).toEqual(['aigentme']);
    // Nothing waits on a branch.
    expect(verify.nextStageId, 'a branch must not be a step on a line').toBeUndefined();
  });

  it('Factory ingestion is its own branch, and does not require Verify', () => {
    const deploy = byId('deploy');
    expect(deploy.branch).toBe('factory');
    expect(deploy.prerequisites).toEqual(['aigentme']);
    expect(deploy.prerequisites, 'a verification failure must not block ingestion').not.toContain('verify');
  });

  it('neither branch requires the other — completing one must not need the other', () => {
    expect(byId('verify').prerequisites).not.toContain('deploy');
    expect(byId('deploy').prerequisites).not.toContain('verify');
  });

  it('aigentMe does not point at a single next stage — two branches follow, neither privileged', () => {
    // A `nextStageId` here would render as a line and imply one gates the other.
    expect(byId('aigentme').nextStageId).toBeUndefined();
  });
});

describe('ingestion establishes eligibility, never accrual', () => {
  it('Standing follows factory ingestion, not verification', () => {
    /*
     * The operator's constitutional distinction, verbatim:
     *   "Ingested into Factory ≠ Standing accrued
     *    Ingested into Factory → Eligible to accrue Standing through
     *    qualifying action"
     */
    expect(byId('standing').prerequisites).toEqual(['deploy']);
    expect(byId('standing').prerequisites).not.toContain('verify');
  });

  it('the ingestion stage carries no Standing-accrual receipt', () => {
    // Ingestion may receipt the ingestion itself; it must not receipt an
    // accrual, which is earned only by later qualifying, validated action.
    expect(byId('deploy').receiptTypes ?? []).not.toContain('standing_accrued');
  });
});
