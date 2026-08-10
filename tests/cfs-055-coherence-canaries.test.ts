/**
 * CFS-055 coherence pass (operator directive, 2026-08-10) — generic
 * canaries, never Nakamoto/MoneyPenny-specific. Source-scan style, matching
 * this repo's existing convention (no React rendering harness is set up
 * here) — see tests/register-stage-receipt-agent-isolation.test.ts,
 * tests/pnl-evidence-wiring.test.ts for the same pattern.
 *
 * Doctrine: codexes/packs/irl/foundation/CFS-055_proof-of-state-in-time-and-
 * state-coherence.md. Diagnostic input: codexes/packs/agentiq/updates/
 * 2026-08-10_horizen-coherence-matrix-nakamoto.md.
 *
 * The seven proofs required, verbatim from the operator's spec:
 *   1. canonical COMPLETE cannot render grey in a detail surface;
 *   2. canonical evidence cannot produce an empty primary evidence drawer;
 *   3. superseded evidence cannot resurrect current state;
 *   4. Pulse/P&L disclosure/service/evidence remain separate predicates;
 *   5. live observer corroboration cannot downgrade or silently replace POSIT;
 *   6. DVN pending does not make an established predicate unresolved;
 *   7. all surfaces representing the same predicate derive from the same
 *      canonical projection.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

const journeyRunSurface = read('components/journey/JourneyRunSurface.tsx');
const stageReceiptsDrawer = read('components/journey/StageReceiptsDrawer.tsx');
const pulseToggle = read('components/journey/PulseTransparencyToggle.tsx');
const agreementPanel = read('components/journey/AgreementRatifyPanel.tsx');
const stateRoute = read('app/api/journey/moneypenny-horizen/state/route.ts');
const pilotJourneyTab = read('app/triad/components/codex/tabs/PilotJourneyTab.tsx');
const standingProjection = read('services/journey/standingEvidenceProjection.ts');

describe('1. Canonical COMPLETE cannot render grey in a detail surface', () => {
  it('the stepper node color (isDone) derives ONLY from stageState, never from the consequence-fork tier', () => {
    const isDoneAt = journeyRunSurface.indexOf('const isDone = stageState');
    expect(isDoneAt, 'isDone derivation not found').toBeGreaterThan(-1);
    expect(journeyRunSurface.slice(isDoneAt, isDoneAt + 120)).toMatch(/const isDone = stageState === 'COMPLETE';/);
    // tickDone widens FROM isDone, defensively — it may never narrow a
    // COMPLETE stage back to incomplete because a DVN tier is pending.
    expect(journeyRunSurface).toMatch(/const tickDone = projection \? projection\.tier !== 'refused-unresolved' : isDone;/);
  });
});

describe('2. Canonical evidence cannot produce an empty primary evidence drawer', () => {
  it('the drawer renders a primary block whenever canonicalEvidencePresent is non-empty — never the "not yet established" fallback', () => {
    const primaryAt = stageReceiptsDrawer.indexOf('hasCanonicalEvidence ? (');
    expect(primaryAt, 'primary evidence block not found').toBeGreaterThan(-1);
    const section = stageReceiptsDrawer.slice(primaryAt, primaryAt + 1400);
    // Established-with-no-receipt renders the canonical evidence keys —
    // never the bare absence claim the pre-fix drawer used to show.
    expect(section).toMatch(/Established from canonical record/);
    expect(section).not.toMatch(/No receipts recorded for this stage yet/);
  });

  it('the old type-only search survives ONLY as an explicitly-labeled, non-authoritative secondary section', () => {
    const secondaryAt = stageReceiptsDrawer.indexOf('Historical / supplementary receipts');
    expect(secondaryAt, 'secondary section label missing').toBeGreaterThan(-1);
    // Its own "nothing found" copy never claims the predicate is unresolved —
    // phrased as a search result, not a completion verdict.
    const section = stageReceiptsDrawer.slice(secondaryAt, secondaryAt + 400);
    expect(section).toMatch(/No additional receipts found in this search\./);
  });

  it('JourneyRunSurface threads the SAME canonical fields the checklist popover already renders — never a second computation', () => {
    const wireAt = journeyRunSurface.indexOf('canonicalEvidencePresent={activeStageRuntime?.evidencePresent}');
    expect(wireAt, 'canonical evidence wiring into the drawer missing').toBeGreaterThan(-1);
    expect(journeyRunSurface).toMatch(/canonicalReceiptRefs=\{activeStageRuntime\?\.receiptRefs\}/);
  });
});

describe('3. Superseded evidence cannot resurrect current state', () => {
  it("Stand's canonical projection excludes superseded receipts before anything else consumes it (standingEvidenceProjection.ts)", () => {
    expect(standingProjection).toMatch(/superseded\.has\(row\.id\)\) continue;/);
  });

  it("the state route's standingGatewayEnabled reads the correction-aware projection, never a bare receipt scan", () => {
    const at = stateRoute.indexOf('standingGatewayEnabled:');
    expect(at, 'standingGatewayEnabled field missing').toBeGreaterThan(-1);
    expect(stateRoute.slice(at, at + 200)).toMatch(/hasEffectiveStandingEvidence\(standingEvidence\)/);
    expect(stateRoute.slice(at, at + 200)).not.toMatch(/hasReceipt\('standing_accrued'\)/);
  });
});

describe("4. Pulse/P&L disclosure/service/evidence remain separate predicates", () => {
  it('the state route projects five DISTINCT Ratify sub-predicates, none inferred from another', () => {
    expect(stateRoute).toMatch(/agreementAuthorized:\s*\{/);
    expect(stateRoute).toMatch(/pulseAuthorized:\s*receiptBackedSubPredicate\('pulseAuthorized',\s*'horizen_pulse_authorized'\)/);
    expect(stateRoute).toMatch(/pnlDisclosureAuthorized:\s*receiptBackedSubPredicate\('pnlDisclosureAuthorized',\s*'horizen_pnl_transparency_enabled'\)/);
    expect(stateRoute).toMatch(/pnlServiceRegistered:\s*receiptBackedSubPredicate\('pnlServiceRegistered',\s*'pnl_service_registered'\)/);
    expect(stateRoute).toMatch(/pnlEvidenceVerified:\s*receiptBackedSubPredicate\('pnlEvidenceVerified',\s*'pnl_service_verified'\)/);
  });

  it('PulseTransparencyToggle keeps disclosure/service/evidence as three independent variables, never collapsed', () => {
    const at = pulseToggle.indexOf('const disclosureAuthorized =');
    expect(at, 'disclosureAuthorized not found').toBeGreaterThan(-1);
    const section = pulseToggle.slice(at, at + 1400);
    expect(section).toMatch(/const serviceRegistered = pnlServiceRegistered === true \|\| structured\?\.verifiablePnlRegistered === true;/);
    expect(section).toMatch(/const evidenceVerified = pnlServiceVerified === true;/);
    // None of the three booleans may appear on the right-hand side of
    // another's assignment — that would be exactly the collapse forbidden.
    expect(section).not.toMatch(/disclosureAuthorized[^;]*serviceRegistered/);
    expect(section).not.toMatch(/serviceRegistered[^;]*evidenceVerified/);
  });
});

describe('5. Live observer corroboration cannot downgrade or silently replace POSIT', () => {
  it('AgreementRatifyPanel: canonical-first OR own read — own read alone is never the sole authority', () => {
    expect(agreementPanel).toMatch(
      /const isAuthorized = canonicalAgreementAuthorized === true \|\| ownReadAuthorized;/,
    );
  });

  it('PulseTransparencyToggle: canonical-first OR live Agent Card read, for BOTH pulse and P&L disclosure', () => {
    expect(pulseToggle).toMatch(/if \(pulseAuthorized === true \|\| horizen\?\.pulse\?\.enabled\)/);
    expect(pulseToggle).toMatch(
      /const disclosureAuthorized = pnlDisclosureAuthorized === true \|\| Boolean\(horizen\?\.pnl\?\.disclosureAuthorized\);/,
    );
  });

  it('an unavailable live read can never regress an already-established canonical fact (OR, never AND)', () => {
    // The precedence pattern is `canonical === true || liveRead` everywhere
    // above — grep guards against the inverted (and dangerous) `liveRead &&
    // canonical` shape reappearing anywhere in these two files.
    expect(pulseToggle).not.toMatch(/horizen\?\.pulse\?\.enabled\s*&&\s*pulseAuthorized/);
    expect(agreementPanel).not.toMatch(/ownReadAuthorized\s*&&\s*canonicalAgreementAuthorized/);
  });
});

describe('6. DVN pending does not make an established predicate unresolved', () => {
  it('classifyConsequenceProng never re-decides completion — it only asks about DVN finality of an already-COMPLETE stage', () => {
    expect(stateRoute).toMatch(/classifyConsequenceProng` never re-decides completion, it only asks/);
    const forkProjection = read('services/journey/consequenceForkProjection.ts');
    // The classifier's own contract: 'proven-consequence' requires the
    // stage's act to be done — DVN finality is layered ON TOP of an
    // already-established fact, never a substitute decision for it.
    expect(forkProjection).toMatch(/if \(input\.stageState !== 'COMPLETE'\)/);
  });

  it("the fork's amber/emerald DVN pill is additive to the stepper's own emerald tick, never a replacement for it", () => {
    const at = journeyRunSurface.indexOf("projection.tier === 'pending-observer-active'");
    expect(at, 'DVN pending badge render site missing').toBeGreaterThan(-1);
    // isDone (checked above) is computed BEFORE and independently of this
    // badge — the badge is additive markup, not a gate on isDone itself.
    expect(journeyRunSurface.indexOf('const isDone = stageState')).toBeLessThan(at);
  });
});

describe('7. All surfaces representing the same predicate derive from the same canonical projection', () => {
  it('JourneyRunSurface fetches ratifySubPredicates ONCE from /state and threads it through resolveSurfaceProps — no second fetch', () => {
    expect(journeyRunSurface).toMatch(/setRatifySubPredicates\(\(json\.ratifySubPredicates as typeof ratifySubPredicates\) \?\? null\)/);
    expect(journeyRunSurface).toMatch(
      /resolveSurfaceProps\?\.\(\{ surfaceRef, descriptor, stage: activeStage, runtimeState, pnlEvidence, ratifySubPredicates \}\)/,
    );
  });

  it('PilotJourneyTab distributes the SAME ratifySubPredicates object to both AgreementRatifyPanel and PulseTransparencyToggle — never a per-component re-derivation', () => {
    const panelAt = pilotJourneyTab.indexOf("descriptor.component === 'AgreementRatifyPanel'");
    const toggleAt = pilotJourneyTab.indexOf("descriptor.component === 'PulseTransparencyToggle'");
    expect(panelAt).toBeGreaterThan(-1);
    expect(toggleAt).toBeGreaterThan(-1);
    const panelBlock = pilotJourneyTab.slice(panelAt, toggleAt);
    expect(panelBlock).toMatch(/agreementAuthorized: ratifySubPredicates\?\.agreementAuthorized\?\.established/);
    expect(panelBlock).toMatch(/pulseAuthorized: ratifySubPredicates\?\.pulseAuthorized\?\.established/);
    expect(panelBlock).toMatch(/pnlDisclosureAuthorized: ratifySubPredicates\?\.pnlDisclosureAuthorized\?\.established/);

    const toggleBlock = pilotJourneyTab.slice(toggleAt, toggleAt + 3500);
    // Same source object, same field names, same accessor shape as the
    // panel block above — a second, differently-shaped read for the toggle
    // would be exactly the parallel truth model CFS-055 forbids.
    expect(toggleBlock).toMatch(/pulseAuthorized: ratifySubPredicates\?\.pulseAuthorized\?\.established/);
    expect(toggleBlock).toMatch(/pnlDisclosureAuthorized: ratifySubPredicates\?\.pnlDisclosureAuthorized\?\.established/);
  });
});
