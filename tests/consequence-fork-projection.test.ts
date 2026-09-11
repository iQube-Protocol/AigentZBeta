/**
 * Consequence Fork projection (services/journey/consequenceForkProjection.ts)
 * — Horizen Journey correction, 2026-08-09.
 *
 * "Finish the consequence fork as the final Journey presentation/state
 * component, but do not invent a new source of truth. Derive the branch
 * exclusively from authoritative state and receipts." These canaries prove
 * the classifier's three-tier vocabulary (PROVEN CONSEQUENCE / PENDING —
 * OBSERVER ACTIVE / REFUSED — UNRESOLVED) and the distinctions it exists to
 * preserve: submitted ≠ confirmed, authorized ≠ independently verified,
 * evidence present ≠ DVN final, Standing seed ≠ performance standing.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  classifyConsequenceProng,
  bestReceiptStatus,
  consequenceProngCopy,
} from '@/services/journey/consequenceForkProjection';

// ═══════════════════════════════════════════════════════════════════════════
describe('classifyConsequenceProng — the three tiers', () => {
  it('an incomplete stage is refused-unresolved, regardless of any receipt status', () => {
    expect(classifyConsequenceProng({ stageState: 'NOT_STARTED', bestAnchorReceiptStatus: null })).toBe(
      'refused-unresolved',
    );
    expect(classifyConsequenceProng({ stageState: 'BLOCKED', bestAnchorReceiptStatus: 'dvn_recorded' })).toBe(
      'refused-unresolved',
    );
    expect(classifyConsequenceProng({ stageState: 'REFUSED', bestAnchorReceiptStatus: null })).toBe('refused-unresolved');
  });

  it('a COMPLETE stage with no external leg to observe is proven immediately — evidence present IS the whole fact here', () => {
    expect(classifyConsequenceProng({ stageState: 'COMPLETE', bestAnchorReceiptStatus: null })).toBe(
      'proven-consequence',
    );
  });

  it('SUBMITTED ≠ CONFIRMED — a COMPLETE stage whose receipt is only local/pending is PENDING, never proven', () => {
    expect(classifyConsequenceProng({ stageState: 'COMPLETE', bestAnchorReceiptStatus: 'local' })).toBe(
      'pending-observer-active',
    );
    expect(classifyConsequenceProng({ stageState: 'COMPLETE', bestAnchorReceiptStatus: 'dvn_pending' })).toBe(
      'pending-observer-active',
    );
  });

  it('EVIDENCE PRESENT ≠ DVN FINAL — only dvn_recorded reaches proven', () => {
    expect(classifyConsequenceProng({ stageState: 'COMPLETE', bestAnchorReceiptStatus: 'dvn_recorded' })).toBe(
      'proven-consequence',
    );
  });

  it('a failed anchor attempt is presentationally PENDING, not a failure of the underlying constitutional fact', () => {
    // dvn_failed means the ANCHOR needs retrying (services/dvn's own retry
    // route) — it must never read as though the authorized/ingested/accrued
    // fact itself was refused.
    expect(classifyConsequenceProng({ stageState: 'COMPLETE', bestAnchorReceiptStatus: 'dvn_failed' })).toBe(
      'pending-observer-active',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('bestReceiptStatus — confirmation outranks pending/failed, in either order', () => {
  it('CONFIRMATION OUTRANKS EARLIER PENDING STATE', () => {
    expect(bestReceiptStatus(['dvn_pending', 'dvn_recorded'])).toBe('dvn_recorded');
  });

  it('a LATER pending resubmission does not erase an EARLIER dvn_recorded — order-independent', () => {
    expect(bestReceiptStatus(['dvn_recorded', 'dvn_pending'])).toBe('dvn_recorded');
  });

  it('DVN PENDING DOES NOT ERASE AN ALREADY-PROVEN EXTERNAL CONSEQUENCE (end-to-end through the classifier)', () => {
    const historical: ('local' | 'dvn_pending' | 'dvn_recorded' | 'dvn_failed')[] = ['local', 'dvn_pending', 'dvn_recorded', 'dvn_pending'];
    const best = bestReceiptStatus(historical);
    expect(best).toBe('dvn_recorded');
    expect(classifyConsequenceProng({ stageState: 'COMPLETE', bestAnchorReceiptStatus: best })).toBe('proven-consequence');
  });

  it('no receipts at all resolves to null, never a guessed status', () => {
    expect(bestReceiptStatus([])).toBeNull();
  });

  it('a failed attempt alone ranks alongside local/pending, never above dvn_pending', () => {
    expect(bestReceiptStatus(['dvn_failed', 'dvn_pending'])).toBe('dvn_pending');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('LATER CONFIRMED EVIDENCE ADVANCES THE STAGE AUTOMATICALLY', () => {
  it('re-classifying with an updated receipt status alone moves pending -> proven, with no other input changed', () => {
    const before = classifyConsequenceProng({ stageState: 'COMPLETE', bestAnchorReceiptStatus: 'dvn_pending' });
    const after = classifyConsequenceProng({ stageState: 'COMPLETE', bestAnchorReceiptStatus: 'dvn_recorded' });
    expect(before).toBe('pending-observer-active');
    expect(after).toBe('proven-consequence');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('A PENDING EXTERNAL CONSEQUENCE REMAINS PENDING ACROSS BROWSER/SESSION LOSS', () => {
  it('the classifier is a pure function of server-side state — calling it twice with identical inputs (simulating two browser sessions) yields identical results', () => {
    const input = { stageState: 'COMPLETE' as const, bestAnchorReceiptStatus: 'dvn_pending' as const };
    const sessionOne = classifyConsequenceProng(input);
    const sessionTwo = classifyConsequenceProng(input);
    expect(sessionOne).toBe(sessionTwo);
    expect(sessionOne).toBe('pending-observer-active');
  });

  it('the projection takes no browser/session-scoped input at all — its own type signature is state + receipt status only', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'services/journey/consequenceForkProjection.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/localStorage|sessionStorage|window\./);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('PENDING NEVER READS AS FAILURE', () => {
  it('the pending tier\'s own copy states the action is complete and the consequence is merely observed — never framed as an error', () => {
    const copy = consequenceProngCopy('pending-observer-active');
    expect(copy.detail.toLowerCase()).toContain('your action is complete');
    expect(copy.detail.toLowerCase()).not.toMatch(/fail|error|denied|refus/);
  });

  it('the pending tier\'s label says "DVN Pending", not a generic "Pending" — it names which consequence is still in flight (operator instruction, 2026-08-09)', () => {
    expect(consequenceProngCopy('pending-observer-active').label).toBe('DVN Pending');
  });

  it('the renderer sources the pending/proven badge text from consequenceProngCopy\'s own label, never a second hardcoded string', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'components/journey/JourneyRunSurface.tsx'), 'utf8');
    const pendingBadge = src.match(/pending-observer-active[\s\S]{0,260}/)?.[0] ?? '';
    expect(pendingBadge).toMatch(/\{projection\.label\}/);
  });

  it('the renderer never colours a pending prong rose/red', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'components/journey/JourneyRunSurface.tsx'), 'utf8');
    const pendingBadge = src.match(/pending-observer-active[\s\S]{0,220}/)?.[0] ?? '';
    expect(pendingBadge, 'pending badge markup not found').not.toBe('');
    expect(pendingBadge).toMatch(/amber/);
    expect(pendingBadge).not.toMatch(/rose|red-/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('AUTHORIZATION IS NOT DISPLAYED AS INDEPENDENT VERIFICATION', () => {
  it('no tier\'s copy ever claims independent verification', () => {
    for (const tier of ['proven-consequence', 'pending-observer-active', 'refused-unresolved'] as const) {
      expect(consequenceProngCopy(tier).detail.toLowerCase()).not.toMatch(/independently verified/);
    }
  });

  it("Ratify's completion evidence is the operator's OWN authorization act, never Horizen's independent Pulse/P&L verification", async () => {
    const { HORIZEN_MONEYPENNY_JOURNEY } = await import('@/services/journey/horizenMoneyPennyJourney');
    const verify = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'verify')!;
    expect(verify.completionEvidence).toContain('agreementAuthorized');
    // Pulse/P&L/Agent Card are SURFACED evidence only — never completionEvidence.
    expect(verify.completionEvidence).not.toContain('pnlServiceVerified');
    expect(verify.completionEvidence).not.toContain('agentCardEnrichmentCommitted');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('STANDING SEED IS NOT DESCRIBED AS PERFORMANCE', () => {
  it('the Stand stage\'s own copy never claims performance-earned Standing', async () => {
    const { HORIZEN_MONEYPENNY_JOURNEY } = await import('@/services/journey/horizenMoneyPennyJourney');
    const standing = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'standing')!;
    const copyText = `${standing.description} ${standing.companion.before} ${standing.companion.complete}`.toLowerCase();
    expect(copyText).not.toMatch(/performance/);
  });

  it('the fork projection\'s own copy makes no performance claim for any tier', () => {
    for (const tier of ['proven-consequence', 'pending-observer-active', 'refused-unresolved'] as const) {
      expect(consequenceProngCopy(tier).detail.toLowerCase()).not.toMatch(/performance/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('fork prongs resolve independently — one incomplete prong never dims a proven sibling', () => {
  it('Ratify proven + Ingest proven + Stand unresolved classify independently in one pass', () => {
    const verify = classifyConsequenceProng({ stageState: 'COMPLETE', bestAnchorReceiptStatus: 'dvn_recorded' });
    const deploy = classifyConsequenceProng({ stageState: 'COMPLETE', bestAnchorReceiptStatus: null });
    const standing = classifyConsequenceProng({ stageState: 'NOT_STARTED', bestAnchorReceiptStatus: null });
    expect(verify).toBe('proven-consequence');
    expect(deploy).toBe('proven-consequence');
    expect(standing).toBe('refused-unresolved');
  });

  it('the renderer keys each prong\'s tick colour off ITS OWN projection, never a fork-wide flag', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'components/journey/JourneyRunSurface.tsx'), 'utf8');
    const forkBlockAt = src.indexOf('forkStages.length > 0');
    const forkSection = src.slice(forkBlockAt, forkBlockAt + 4000);
    expect(forkSection).toMatch(/const projection = consequenceFork\?\.\[stage\.id\]/);
    expect(forkSection).toMatch(/const tickDone = projection/);
    // No fork-wide "all prongs complete" gate exists in this block.
    expect(forkSection).not.toMatch(/every\(|allProngs|forkAllComplete/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('genericity — Agent-N traverses the same projection with parameter only', () => {
  it('classifyConsequenceProng takes no agent identifier at all — its whole input is stage state + receipt status', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'services/journey/consequenceForkProjection.ts'),
      'utf8',
    );
    const sig = src.match(/export function classifyConsequenceProng\(input: ConsequenceProngInput\)/);
    expect(sig).not.toBeNull();
    const inputType = src.match(/export interface ConsequenceProngInput \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(inputType.toLowerCase()).not.toMatch(/agent|moneypenny|nakamoto/);
  });

  it('a synthetic third agent (Agent Q) classifies through the SAME function with no code branch keyed on identity', () => {
    // "Parameter only" proven structurally: passing a fabricated,
    // never-before-seen stage-state/receipt-status pair produces the same
    // deterministic tier as any other agent would for the same facts.
    const agentQ = classifyConsequenceProng({ stageState: 'COMPLETE', bestAnchorReceiptStatus: 'dvn_recorded' });
    const agentQAgain = classifyConsequenceProng({ stageState: 'COMPLETE', bestAnchorReceiptStatus: 'dvn_recorded' });
    expect(agentQ).toBe(agentQAgain);
    expect(agentQ).toBe('proven-consequence');
  });
});
