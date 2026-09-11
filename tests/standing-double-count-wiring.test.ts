/**
 * Source-wiring canary: the journey `/state` route must consume the
 * canonical `standingEvidenceProjection`, never a raw
 * `receiptRefs['standing_accrued']` scan, for every Standing-related fact
 * (Horizen Pilot Closure — Final Standing + DVN Closure, 2026-08-09, part
 * A1/A2). This is what prevents the nominal seed from being counted once as
 * `initialAccrued` and again as `contributionAccrued`, and what makes a
 * governed correction's supersession actually stop a receipt from
 * re-completing Stand.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

const src = read('app/api/journey/moneypenny-horizen/state/route.ts');

describe('journey /state route — Standing facts all read the canonical, correction-aware projection', () => {
  it('imports resolveStandingEvidence/hasEffectiveStandingEvidence/effectiveStandingReceiptStatuses', () => {
    expect(src).toMatch(/from ['"]@\/services\/journey\/standingEvidenceProjection['"]/);
    expect(src).toContain('resolveStandingEvidence');
    expect(src).toContain('hasEffectiveStandingEvidence');
    expect(src).toContain('effectiveStandingReceiptStatuses');
  });

  it('standingGatewayEnabled reads the projection, never bare hasReceipt(\'standing_accrued\')', () => {
    const line = src.match(/standingGatewayEnabled:[^\n]+/)?.[0] ?? '';
    expect(line).toContain('hasEffectiveStandingEvidence(standingEvidence)');
    expect(line).not.toContain("hasReceipt('standing_accrued')");
  });

  it('the axis\'s standingReceipts input is the EFFECTIVE CONTRIBUTION set only, never the raw receiptRefs scan', () => {
    const line = src.match(/standingReceipts:[^\n]+/)?.[0] ?? '';
    expect(line).toContain('effectiveContributionReceipts');
    expect(line).not.toContain("receiptRefs['standing_accrued']");
  });

  it('initialStandingAwarded additionally requires an effective initial receipt to exist, not the settled fact alone', () => {
    const block = src.slice(src.indexOf('initialStandingAwarded:'), src.indexOf('initialStandingAwarded:') + 300);
    expect(block).toContain('effectiveInitialReceipts.length > 0');
  });

  it('the consequence fork\'s standing prong reads the effective receipt-status set, never the raw receiptStatuses map', () => {
    const block = src.slice(src.indexOf("standing: consequenceProngCopy"), src.indexOf("standing: consequenceProngCopy") + 700);
    expect(block).toContain('effectiveStandingReceiptStatuses(standingEvidence)');
    // Code lines only — the explanatory comment legitimately quotes the OLD
    // formula in prose while documenting why it changed.
    const codeLines = block.split('\n').filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'));
    for (const line of codeLines) {
      expect(line, `live code line must not still read receiptStatuses['standing_accrued']: "${line.trim()}"`).not.toContain("receiptStatuses['standing_accrued']");
    }
  });

  it('a single receipt cannot double-count: the initial-tier and contribution sets are drawn from DISJOINT projection fields', () => {
    // Structural proof, not a behavioral one (that's standing-evidence-projection.test.ts's
    // job): the two consumers below must never read the SAME projection field.
    const standingReceiptsLine = src.match(/standingReceipts:[^\n]+/)?.[0] ?? '';
    const initialAwardedBlock = src.slice(src.indexOf('initialStandingAwarded:'), src.indexOf('initialStandingAwarded:') + 300);
    expect(standingReceiptsLine).toContain('effectiveContributionReceipts');
    expect(initialAwardedBlock).toContain('effectiveInitialReceipts');
    expect(standingReceiptsLine).not.toContain('effectiveInitialReceipts');
    expect(initialAwardedBlock).not.toContain('effectiveContributionReceipts');
  });
});
