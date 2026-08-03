/**
 * Administrator sponsorship-capacity override (operator-authorised 2026-08-03).
 *
 *   > "Administrative authority may override ordinary sponsorship capacity, but
 *   >  it does not bypass Passport ownership, authentication, agent-control, or
 *   >  personhood requirements."
 *
 * The override relieves ONE constraint — the numeric cap — and is receipted AS
 * an override rather than shown as ordinary headroom. These canaries pin both
 * halves: that it works for a canonical admin, and that it widens nothing else.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(path.join(__dirname, '..', 'services/agents/sponsorPolityAgent.ts'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** The capacity block, isolated — from the `remaining` computation to its close. */
function capacityBlock(): string {
  const start = code.indexOf('const remaining = base + earned - used;');
  expect(start, 'capacity computation not found — the module moved').toBeGreaterThan(-1);
  return code.slice(start, start + 1400);
}

describe('the admin override relieves the capacity cap, and nothing else', () => {
  it('an exhausted ordinary holder is still refused', () => {
    const block = capacityBlock();
    expect(block).toContain('sponsorship_capacity_exhausted');
    // THE ASSERTION THAT FAILS IF THE REFUSAL IS DROPPED FOR EVERYONE: the
    // refusal must be reached when the caller is NOT a canonical admin.
    expect(block).toMatch(/if \(!callerIsAdmin\)/);
  });

  it('authority comes from the spine-resolved flag, never a client hint or label', () => {
    /*
     * `callerIsAdmin` is resolved server-side by getActivePersona
     * (`isAdmin || adminGrants.isGlobalAdmin`). A second admin check invented
     * here would be the parallel-implementation defect (inv.engineering.037)
     * applied to an authority gate — the most dangerous place for it.
     */
    expect(code).toMatch(/callerIsAdmin\s*=\s*false/); // defaults closed
    const block = capacityBlock();
    expect(block, 'an admin claim must not be read from request input here').not.toMatch(
      /body\.|searchParams|headers\.get|isAdminHeader/,
    );
  });

  it('the override defaults CLOSED — absent flag means ordinary rules', () => {
    // `callerIsAdmin = false` in the destructure: a caller that never supplies
    // it cannot accidentally acquire the exception.
    expect(code).toMatch(/callerIsAdmin\s*=\s*false,/);
  });

  it('ordinary capacity is reported honestly, never rewritten as positive', () => {
    const block = capacityBlock();
    // The override records what capacity ACTUALLY was — remaining: 0.
    expect(block).toMatch(/ordinaryCapacityAtOverride:\s*\{[^}]*remaining:\s*0/);
    expect(block, 'capacity must not be inflated to manufacture headroom').not.toMatch(
      /remaining:\s*(base|earned|[1-9])/,
    );
  });

  it('the override is surfaced as its own field, distinguishable from headroom', () => {
    expect(code).toMatch(/capacityOverride\?:\s*SponsorshipCapacityOverride \| null/);
    // Present on the success outcome so the act can be receipted as an override.
    expect(code).toMatch(/createdAt: rootRow\.created_at,[\s\S]{0,60}\},[\s\S]{0,40}capacityOverride,/);
  });

  it('the override records the authority and basis it relied on', () => {
    expect(code).toMatch(/authority:\s*'administrator'/);
    const block = capacityBlock();
    expect(block).toMatch(/basis:/);
  });

  /*
   * THE NARROWNESS CANARIES. Every gate BEFORE the capacity block must still
   * run for an admin. Asserting by POSITION: if any of these moved below the
   * override, an admin would skip it.
   */
  it.each([
    ['sponsor passport ownership', 'Caller does not own the sponsor passport'],
    ['citizen-class sponsorship', 'Only citizen passports may sponsor agent genesis'],
    ['sponsor passport exists', 'Sponsor passport not found'],
  ])('%s is checked BEFORE the override and is never skipped', (_label, marker) => {
    const gateAt = code.indexOf(marker);
    const overrideAt = code.indexOf('capacityOverride = {');
    expect(gateAt, `gate "${marker}" not found — the module moved`).toBeGreaterThan(-1);
    expect(overrideAt, 'override not found').toBeGreaterThan(-1);
    expect(gateAt, `an admin must not be able to skip: ${marker}`).toBeLessThan(overrideAt);
  });

  it('the override never touches the autonomous-agent admin gate', () => {
    // A separate, pre-existing admin gate. The capacity override must not be
    // conflated with it — different authority question, different consequence.
    expect(code).toContain('autonomous_requires_admin');
    const autonomousAt = code.indexOf('autonomous_requires_admin');
    const overrideAt = code.indexOf('capacityOverride = {');
    expect(autonomousAt).toBeLessThan(overrideAt);
  });
});
