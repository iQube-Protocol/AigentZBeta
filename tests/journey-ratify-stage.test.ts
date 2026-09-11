/**
 * The Ratify stage (services/journey/horizenMoneyPennyJourney.ts's `verify`
 * stage, reconstituted 2026-08-06 around the Constitutional Agreement
 * lifecycle).
 *
 * ── THE OPERATOR'S INSTRUCTION, VERBATIM ──────────────────────────────────
 *
 *   > "Stage completion must derive from the canonical constitutional_
 *   >  agreements record and its receipts, not from Horizen Pulse or P&L
 *   >  status... For the current pilot, unresolved or unavailable Pulse/P&L
 *   >  must not block progression once the service agreement is authorized."
 *
 * This canary pins: the stage id stays `verify` (only the label changes,
 * mirroring the `deploy`/"Ingest into Factory" precedent); completionEvidence
 * is the agreement lifecycle ONLY; Pulse/P&L/Agent Card/Marketa are surfaced
 * evidence, never gating; resolveJourneyState reaches COMPLETE on the
 * agreement alone, with Pulse/P&L entirely absent; and the primary surface
 * (AgreementRatifyPanel) is registered and reachable.
 */

import { describe, it, expect } from 'vitest';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { resolveJourneyState, type AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { resolveRatificationRefs, RATIFY_DELEGATED_AUTHORITY } from '@/services/journey/ratificationRefs';
import { JOURNEY_SURFACES } from '@/services/journey/journeySurfaceRegistry';
import fs from 'fs';
import path from 'path';

const ratify = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'verify')!;

describe('Ratify stage — identity', () => {
  it('keeps the stage id `verify` (the label changes, not the id — mirrors the deploy/"Ingest into Factory" precedent)', () => {
    expect(ratify.id).toBe('verify');
    expect(ratify.label).toBe('Ratify');
  });

  it('stays a capability branch off aigentMe — the reconstitution does not move it back onto the admission spine', () => {
    expect(ratify.branch).toBe('capability');
    expect(ratify.prerequisites).toEqual(['aigentme']);
    expect(ratify.nextStageId).toBeUndefined();
  });
});

describe('Ratify stage — completion evidence is the Constitutional Agreement lifecycle ONLY', () => {
  it('completionEvidence is exactly the five agreement-lifecycle facts the operator named', () => {
    expect(ratify.completionEvidence).toEqual([
      'agreementTermsCommitted',
      'agreementAcceptanceRecorded',
      'agreementAuthorized',
      'agreementReceiptsAnchored',
      'agreementGateRecognized',
    ]);
  });

  it('Pulse, P&L, Agent Card and Marketa fields are surfaced (receiptTypes) but never gate completion', () => {
    for (const type of [
      'horizen_pulse_authorized',
      'horizen_pnl_transparency_enabled',
      'agent_card_enriched',
      'marketa_eligibility_assessed',
      'marketa_eligibility_recommended',
      'marketa_eligibility_refused',
      'marketa_eligibility_quarantined',
    ]) {
      expect(ratify.receiptTypes).toContain(type);
    }
    for (const field of ['pulseAuthorizationVerified', 'pnlTransparencyEnabled', 'agentCardEnrichmentCommitted']) {
      expect(ratify.completionEvidence).not.toContain(field);
    }
  });

  it('the agreement receipt types are declared, so the stage receipts drawer can surface them', () => {
    expect(ratify.receiptTypes).toContain('agreement_formed');
    expect(ratify.receiptTypes).toContain('agreement_authorized');
  });
});

describe('Ratify stage — resolveJourneyState: the agreement alone drives COMPLETE', () => {
  /*
   * Isolated single-stage journey: prerequisites (aigentMe et al.) are the
   * admission spine's own concern and are already pinned by
   * journey-admission-spine.test.ts. Cloning `ratify` with `prerequisites: []`
   * tests exactly one thing — how completionEvidence/evidenceMissing behave —
   * without also having to satisfy every earlier stage's own elaborate
   * evidence shape just to reach `verify`.
   */
  const isolatedJourney = { ...HORIZEN_MONEYPENNY_JOURNEY, stages: [{ ...ratify, prerequisites: [] }] };

  const stateWith = (verify: Record<string, boolean> | undefined): AuthoritativePlatformState => ({
    stages: { verify },
  });

  it('is READY (not complete) with no agreement evidence yet', () => {
    const resolved = resolveJourneyState(isolatedJourney, stateWith({}));
    const stage = resolved.stages.find((s) => s.stageId === 'verify')!;
    expect(stage.state).not.toBe('BLOCKED');
    expect(stage.state).not.toBe('COMPLETE');
  });

  it('reaches COMPLETE on the five agreement facts ALONE — Pulse/P&L absent entirely', () => {
    const state = stateWith({
      agreementTermsCommitted: true,
      agreementAcceptanceRecorded: true,
      agreementAuthorized: true,
      agreementReceiptsAnchored: true,
      agreementGateRecognized: true,
      // Deliberately no pulseAuthorizationVerified / pnlTransparencyEnabled /
      // agentCardEnrichmentCommitted fields at all — the exact "unresolved or
      // unavailable Pulse/P&L" pilot case the operator described.
    });
    const resolved = resolveJourneyState(isolatedJourney, state);
    const stage = resolved.stages.find((s) => s.stageId === 'verify')!;
    expect(stage.state).toBe('COMPLETE');
    expect(stage.evidenceMissing).toEqual([]);
  });

  it('stays incomplete if the agreement is only accepted, not yet authorized', () => {
    const state = stateWith({
      agreementTermsCommitted: true,
      agreementAcceptanceRecorded: true,
      agreementAuthorized: false,
      agreementReceiptsAnchored: false,
      agreementGateRecognized: false,
    });
    const resolved = resolveJourneyState(isolatedJourney, state);
    const stage = resolved.stages.find((s) => s.stageId === 'verify')!;
    expect(stage.state).not.toBe('COMPLETE');
    expect(stage.evidenceMissing).toEqual(
      expect.arrayContaining(['agreementAuthorized', 'agreementReceiptsAnchored', 'agreementGateRecognized']),
    );
  });

  it('Pulse/P&L being explicitly false alongside an authorized agreement still completes the stage', () => {
    const state = stateWith({
      agreementTermsCommitted: true,
      agreementAcceptanceRecorded: true,
      agreementAuthorized: true,
      agreementReceiptsAnchored: true,
      agreementGateRecognized: true,
      pulseAuthorizationVerified: false,
      pnlTransparencyEnabled: false,
      agentCardEnrichmentCommitted: false,
    });
    const resolved = resolveJourneyState(isolatedJourney, state);
    expect(resolved.stages.find((s) => s.stageId === 'verify')?.state).toBe('COMPLETE');
  });
});

describe('Ratify stage — ratificationRefs (the one formula, shared by definition/route/UI)', () => {
  it("resolves MoneyPenny's refs to the EXACT capabilityRef/agentRef her live Financial Services runtime gate checks", () => {
    const refs = resolveRatificationRefs('moneypenny');
    expect(refs.capabilityRef).toBe('cap-moneypenny-financial-services');
    expect(refs.selectedAgentRef).toBe('agent-moneypenny');
    expect(refs.agreementId).toBe('agr-cap-moneypenny-financial-services-agent-moneypenny');
  });

  it('is deterministic and agent-parameterized — a different agent never collides with another\'s agreement id', () => {
    const moneypenny = resolveRatificationRefs('moneypenny');
    const nakamoto = resolveRatificationRefs('nakamoto');
    expect(moneypenny.agreementId).not.toBe(nakamoto.agreementId);
    expect(resolveRatificationRefs('nakamoto')).toEqual(nakamoto);
  });

  it('the pre-populated delegated authority is read-only (Financial Intelligence, Domain 3) — no transfer, no unbounded ceiling', () => {
    expect(RATIFY_DELEGATED_AUTHORITY.forbiddenActions).toContain('transfer');
    expect(RATIFY_DELEGATED_AUTHORITY.valueCeiling).toBeNull();
  });
});

describe('Ratify stage — surfaces', () => {
  it('the primary surface (constitutional-agreement-ratify) is registered and built, never a placeholder', () => {
    const descriptor = JOURNEY_SURFACES['constitutional-agreement-ratify'];
    expect(descriptor).toBeDefined();
    expect(descriptor.kind).toBe('component');
  });

  it("the stage's surfaces list the agreement panel FIRST, with Pulse/P&L transparency surfaces retained after it", () => {
    const refs = ratify.surfaces.map((s) => s.ref);
    expect(refs[0]).toBe('constitutional-agreement-ratify');
    expect(refs).toContain('pulse-transparency-toggle');
    expect(refs).toContain('horizen-agent-page-verify');
  });

  it('the owner-source-conflict surface (PulseTransparencyToggle) is never removed from the stage', () => {
    const code = fs.readFileSync(
      path.join(__dirname, '..', 'components/journey/PulseTransparencyToggle.tsx'),
      'utf8',
    );
    expect(code).toContain('owner-source-conflict');
  });
});

describe('Ratify stage — AgreementRatifyPanel never fabricates or claims a wallet/blockchain signature', () => {
  it('the panel names its acts precisely: commitment for form/accept, authenticated constitutional act for authorize', () => {
    const code = fs.readFileSync(path.join(__dirname, '..', 'components/journey/AgreementRatifyPanel.tsx'), 'utf8');
    expect(code).toMatch(/commitment/i);
    expect(code).toMatch(/authenticated constitutional act/i);
    // The panel MAY name "wallet signature"/"blockchain signature" only to
    // deny one exists (e.g. "not a cryptographic wallet signature") — it must
    // never assert one occurred.
    expect(code).not.toMatch(/is a (cryptographic )?(wallet|blockchain) signature/i);
    expect(code).toMatch(/not a (cryptographic )?wallet( or blockchain)? signature/i);
  });

  it('offers exactly ONE guided action button, never separate Form/Accept/Authorize buttons', () => {
    const code = fs.readFileSync(path.join(__dirname, '..', 'components/journey/AgreementRatifyPanel.tsx'), 'utf8');
    expect(code).toContain('Verify & Sign Agreement');
    expect((code.match(/<button/g) ?? []).length).toBe(1);
  });

  it('calls the EXISTING generic /api/constitutional/agreement route — no parallel agreement endpoint', () => {
    const code = fs.readFileSync(path.join(__dirname, '..', 'components/journey/AgreementRatifyPanel.tsx'), 'utf8');
    expect(code).toContain('/api/constitutional/agreement');
    expect(code).not.toMatch(/\/api\/constitutional\/agreement\/ratify/);
  });
});
