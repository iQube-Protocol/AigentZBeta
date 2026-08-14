/**
 * P&L evidence — dead-read fix (Final Horizen Projection Reconciliation
 * part 2/3, operator directive, 2026-08-09).
 *
 * `PilotJourneyTab` used to derive `pnlServiceVerified` from
 * `runtimeState.stages.find('verify').evidencePresent.includes('pnlServiceVerified')`.
 * `evidencePresent` is built EXCLUSIVELY from a stage's own
 * `completionEvidence` list (services/journey/resolveJourneyState.ts:
 * `evidencePresence(stage.completionEvidence, evidence)`), and Pulse/P&L
 * fields are deliberately excluded from `verify.completionEvidence` (they
 * must never gate Ratify) — so that read could NEVER be true, for any
 * agent, regardless of the real receipt state. A structurally dead read
 * that always resolved to `false`/`undefined`.
 *
 * Source-scan style, matching this repo's existing convention for these
 * components (no React rendering harness in this codebase).
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('the journey /state route computes pnlEvidence from canonical receipts, OR-safe against a live corroborating reread', () => {
  const stateSrc = read('app/api/journey/moneypenny-horizen/state/route.ts');

  it('pnl_service_registered is in the observer\'s canonical receipt set', () => {
    expect(stateSrc).toMatch(/'pnl_service_registered'/);
  });

  it('pnlEvidence is built from hasReceipt(...) only, never from a live partner reread', () => {
    const block = stateSrc.slice(stateSrc.indexOf('const pnlEvidence ='), stateSrc.indexOf('const pnlEvidence =') + 400);
    expect(block).toMatch(/serviceRegistered:\s*hasReceipt\('pnl_service_registered'\)/);
    expect(block).toMatch(/serviceVerified:\s*hasReceipt\('pnl_service_verified'\)/);
    expect(block).toMatch(/serviceRegisteredDvnStatus:\s*bestReceiptStatus/);
    expect(block).toMatch(/serviceVerifiedDvnStatus:\s*bestReceiptStatus/);
  });

  it('pnlEvidence is returned in the JSON response', () => {
    // Not required to be the LAST key — ratifySubPredicates (CFS-055
    // coherence pass, 2026-08-10) legitimately follows it now.
    const returnBlock = stateSrc.slice(stateSrc.indexOf('return NextResponse.json({'));
    expect(returnBlock).toMatch(/\bpnlEvidence,/);
  });
});

describe('JourneyRunSurface threads pnlEvidence from the state response into resolveSurfaceProps', () => {
  const src = read('components/journey/JourneyRunSurface.tsx');

  it('captures json.pnlEvidence into its own state', () => {
    expect(src).toMatch(/setPnlEvidence\(\(json\.pnlEvidence/);
  });

  it('passes pnlEvidence to resolveSurfaceProps alongside runtimeState', () => {
    // ratifySubPredicates (CFS-055 coherence pass, 2026-08-10),
    // registerCeremony (Pre-recording Horizen polish part C, 2026-08-10),
    // and requestStateRefresh (CFS-055 coherence pass, 2026-08-12)
    // legitimately ride alongside pnlEvidence now — not required to be the
    // last field, and the call is now multi-line.
    const callIdx = src.indexOf('resolveSurfaceProps?.({');
    expect(callIdx, 'resolveSurfaceProps call site not found').toBeGreaterThan(-1);
    const callEnd = src.indexOf('}) ?? {};', callIdx);
    const call = src.slice(callIdx, callEnd);
    for (const field of ['surfaceRef', 'descriptor', 'stage: activeStage', 'runtimeState', 'pnlEvidence', 'ratifySubPredicates', 'registerCeremony']) {
      expect(call, `${field} missing from the ONE resolveSurfaceProps call`).toContain(field);
    }
  });
});

describe('PilotJourneyTab reads P&L facts from pnlEvidence, never from evidencePresent (the dead-read fix)', () => {
  const src = read('app/triad/components/codex/tabs/PilotJourneyTab.tsx');

  it('destructures pnlEvidence from resolveSurfaceProps args', () => {
    // ratifySubPredicates (CFS-055 coherence pass, 2026-08-10) and
    // registerCeremony (Pre-recording Horizen polish part C, 2026-08-10)
    // legitimately ride alongside pnlEvidence now — not required to be the
    // last field.
    expect(src).toMatch(/\{\s*surfaceRef,\s*descriptor,\s*runtimeState,\s*pnlEvidence,\s*ratifySubPredicates,\s*registerCeremony\s*\}/);
  });

  it('PulseTransparencyToggle props are sourced from pnlEvidence, not evidencePresent.includes', () => {
    const block = src.slice(src.indexOf("descriptor.component === 'PulseTransparencyToggle'"), src.indexOf("descriptor.component === 'PulseTransparencyToggle'") + 3000);
    expect(block).toMatch(/pnlServiceVerified:\s*pnlEvidence\?\.serviceVerified/);
    expect(block).toMatch(/pnlServiceRegistered:\s*pnlEvidence\?\.serviceRegistered/);

    // The dead read must be gone from LIVE CODE — prose in the explanatory
    // comment legitimately quotes the old formula while documenting the fix.
    const codeLines = block.split('\n').filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'));
    for (const line of codeLines) {
      expect(line, `live code line must not still read evidencePresent.includes('pnlServiceVerified'): "${line.trim()}"`).not.toContain("evidencePresent.includes('pnlServiceVerified')");
    }
  });
});

describe('PulseTransparencyToggle — service-registered precedence is receipt-first, corroborated (never solely decided) by the live reread', () => {
  const src = read('components/journey/PulseTransparencyToggle.tsx');

  it('serviceRegistered ORs the canonical pnlServiceRegistered prop with the live structured reread — receipt first', () => {
    const line = src.match(/const serviceRegistered = [^\n]+/)?.[0] ?? '';
    expect(line).toMatch(/pnlServiceRegistered === true/);
    expect(line).toMatch(/structured\?\.verifiablePnlRegistered === true/);
    // Receipt-first: the canonical prop must appear before the live reread in the OR.
    expect(line.indexOf('pnlServiceRegistered')).toBeLessThan(line.indexOf('structured?.verifiablePnlRegistered'));
  });

  it('renders a DVN finality suffix ("DVN Minted"/"DVN Pending") only when the canonical receipt itself is present', () => {
    expect(src).toMatch(/function dvnFinalityDetail/);
    expect(src).toMatch(/pnlServiceRegistered === true \? ` · \$\{dvnFinalityDetail\(pnlServiceRegisteredDvnStatus\)\}` : ''/);
  });
});
