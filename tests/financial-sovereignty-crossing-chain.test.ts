/**
 * The Financial Sovereignty PREPARE → CROSS → ExperienceHandoff → /bridge/fs
 * → REGISTER chain (AEE-XP-001 §4.3, §5), live-verification pass (2026-09-01).
 *
 * Source-level structural proof (this repo's established pattern for wiring
 * that would otherwise need a live browser to exercise — see
 * tests/journey-copilot-assigned-companion-wiring.test.ts,
 * tests/experience-observation-promotion-loop.test.ts).
 *
 * REAL DEFECT FOUND AND FIXED by this pass: experienceHandoffService.ts used
 * `Buffer.from(...)` for its base64url encode/decode. Both of its ONLY live
 * callers (FinancialSovereigntyPrepareCrossStage.tsx,
 * FinancialServicesBridgeFrontDoor.tsx) are `'use client'`, and `Buffer` has
 * no browser equivalent and no polyfill configured anywhere in this repo
 * (next.config.js has no ProvidePlugin/fallback for it, and grep confirms
 * `Buffer.from` appears nowhere else outside `app/api/**` server routes).
 * This silently threw `ReferenceError: Buffer is not defined` in the actual
 * browser — Cross's onClick handler failed before its navigation line ever
 * ran, and /bridge/fs's decode effect failed silently into its own catch
 * block. Every other seam in the chain (prop-threading parity, surface
 * registry, decode→register wiring, agent-candidate validation) was already
 * correct on inspection — this file pins that finding.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { createExperienceHandoff, encodeExperienceHandoff, decodeExperienceHandoff } from '@/services/journey/experienceHandoffService';
import { KNYTS_BRIDGE_CROSSING_JOURNEY } from '@/services/journey/knytsBridgeCrossingJourney';
import { CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY } from '@/services/journey/constitutionalInternetBridgeJourney';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';

describe('experienceHandoffService.ts stays CLIENT-BUNDLE-SAFE (2026-09-01 fix)', () => {
  const src = stripComments(readSource('services/journey/experienceHandoffService.ts'));

  it('never references Buffer — the Node global with no browser equivalent that broke the live crossing flow', () => {
    expect(src).not.toMatch(/\bBuffer\b/);
  });

  it('uses only standard Web APIs (btoa/atob/TextEncoder/TextDecoder), global in both browser and Node 18+', () => {
    expect(src).toMatch(/\bbtoa\(/);
    expect(src).toMatch(/\batob\(/);
    expect(src).toMatch(/new TextEncoder\(\)/);
    expect(src).toMatch(/new TextDecoder\(\)/);
  });

  it('produces a URL-safe token: no +, /, or = padding characters', () => {
    const handoff = createExperienceHandoff({ sourceJourneyId: 'a', targetJourneyId: 'b' });
    const token = encodeExperienceHandoff(handoff);
    expect(token).not.toMatch(/[+/=]/);
  });

  it('round-trips non-ASCII content correctly (proves TextEncoder/TextDecoder UTF-8 handling matches the old Buffer utf8 behavior)', () => {
    const handoff = createExperienceHandoff({
      sourceJourneyId: 'a',
      targetJourneyId: 'b',
      rationale: 'Progressive Financial Sovereignty — café, 日本語, emoji 🚀',
    });
    const decoded = decodeExperienceHandoff(encodeExperienceHandoff(handoff));
    expect(decoded?.rationale).toBe(handoff.rationale);
  });
});

describe.each([
  ['KNYTS Bridge', 'app/bridge/knyts/page.tsx', 'knyts-bridge-crossing', 'amber'],
  ['Constitutional Internet Bridge', 'app/bridge/ci/page.tsx', 'constitutional-internet-bridge', 'indigo'],
])('%s — PREPARE/CROSS prop-threading', (_label, pagePath, journeyId, accent) => {
  const src = stripComments(readSource(pagePath));
  const refPrefix = journeyId === 'knyts-bridge-crossing' ? 'knyts-bridge' : 'ci-bridge';

  it('fs-prepare resolves mode="prepare" with the correct sourceJourneyId/sourceStageId/nextStageId', () => {
    const at = src.indexOf(`'${refPrefix}-fs-prepare'`);
    expect(at, `${refPrefix}-fs-prepare not wired in ${pagePath}`).toBeGreaterThan(-1);
    const section = src.slice(at, at + 250);
    expect(section).toMatch(/mode: 'prepare'/);
    expect(section).toMatch(new RegExp(`accent: '${accent}'`));
    expect(section).toMatch(new RegExp(`sourceJourneyId: '${journeyId}'`));
    expect(section).toMatch(/sourceStageId: 'fs-prepare'/);
    // B1 (2026-09-02): fs-prepare now advances to fs-operate (the new
    // intermediary Operate stage), never straight to fs-cross.
    expect(section).toMatch(/nextStageId: 'fs-operate'/);
  });

  it('fs-cross resolves mode="cross" with the correct sourceJourneyId/sourceStageId/returnStageId', () => {
    const at = src.indexOf(`'${refPrefix}-fs-cross'`);
    expect(at, `${refPrefix}-fs-cross not wired in ${pagePath}`).toBeGreaterThan(-1);
    const section = src.slice(at, at + 250);
    expect(section).toMatch(/mode: 'cross'/);
    expect(section).toMatch(new RegExp(`accent: '${accent}'`));
    expect(section).toMatch(new RegExp(`sourceJourneyId: '${journeyId}'`));
    expect(section).toMatch(/sourceStageId: 'fs-cross'/);
    expect(section).toMatch(/returnStageId: 'choose'/);
  });
});

describe.each([
  ['KNYTS Bridge', KNYTS_BRIDGE_CROSSING_JOURNEY, 'knyts-bridge'],
  ['Constitutional Internet Bridge', CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY, 'ci-bridge'],
])('%s — journey definition + surface registry parity', (_label, journey, refPrefix) => {
  it('fs-prepare/fs-operate/fs-cross stages exist, are part of the financial-services branch, and chain fs-prepare -> fs-operate -> fs-cross (B1, 2026-09-02)', () => {
    const prepare = journey.stages.find((s) => s.id === 'fs-prepare');
    const operate = journey.stages.find((s) => s.id === 'fs-operate');
    const cross = journey.stages.find((s) => s.id === 'fs-cross');
    expect(prepare, 'fs-prepare stage missing').toBeTruthy();
    expect(operate, 'fs-operate stage missing').toBeTruthy();
    expect(cross, 'fs-cross stage missing').toBeTruthy();
    expect(prepare!.activationBranch).toBe('financial-services');
    expect(operate!.activationBranch).toBe('financial-services');
    expect(cross!.activationBranch).toBe('financial-services');
    expect(prepare!.nextStageId).toBe('fs-operate');
    expect(operate!.nextStageId).toBe('fs-cross');
    // fs-operate must be a DISTINCT identity from the advanced Horizen
    // aigentme stage (which also carries the visible label "Operate") —
    // never the same id, per the operator's naming decision.
    expect(operate!.id).not.toBe('aigentme');
  });

  it('both stages resolve to the same surface ref prefix declared in the journey (no drift between journey def and page wiring)', () => {
    const prepare = journey.stages.find((s) => s.id === 'fs-prepare')!;
    const cross = journey.stages.find((s) => s.id === 'fs-cross')!;
    expect(prepare.surfaces[0].ref).toBe(`${refPrefix}-fs-prepare`);
    expect(cross.surfaces[0].ref).toBe(`${refPrefix}-fs-cross`);
  });

  it('journeySurfaceRegistry maps both refs to FinancialSovereigntyPrepareCrossStage — one shared implementation, never a second mechanism', () => {
    const src = stripComments(readSource('services/journey/journeySurfaceRegistry.ts'));
    for (const ref of [`${refPrefix}-fs-prepare`, `${refPrefix}-fs-cross`]) {
      const at = src.indexOf(`'${ref}':`);
      expect(at, `${ref} missing from journeySurfaceRegistry`).toBeGreaterThan(-1);
      const section = src.slice(at, at + 200);
      expect(section).toMatch(/component: 'FinancialSovereigntyPrepareCrossStage'/);
    }
  });
});

describe('FinancialSovereigntyPrepareCrossStage.tsx — CROSS builds the handoff and navigates, never fabricates authority', () => {
  const src = stripComments(readSource('components/journey/FinancialSovereigntyPrepareCrossStage.tsx'));

  it('PREPARE no longer offers its own agent-candidate catalog (retired 2026-09-02 — see tests/moneypenny-b2-prepare.test.ts); CROSS only ever READS a pre-selected value from sessionStorage, so retiring the picker does not touch CROSS\'s own contract', () => {
    expect(src).not.toMatch(/import \{ listRegistrableAgents \} from '@\/services\/horizen\/registrableAgents'/);
    expect(src).toMatch(/window\.sessionStorage\.getItem\(sessionKey\)/);
  });

  it('CROSS builds a real ExperienceHandoff and navigates to /bridge/fs with it encoded', () => {
    expect(src).toMatch(/const handoff = createExperienceHandoff\(/);
    expect(src).toMatch(/const token = encodeExperienceHandoff\(handoff\);/);
    expect(src).toMatch(/window\.location\.href = `\/bridge\/fs\?handoff=\$\{encodeURIComponent\(token\)\}`;/);
  });

  it('never asserts registration/delegation/authority fields on the handoff it builds', () => {
    const handoffCallStart = src.indexOf('const handoff = createExperienceHandoff(');
    const handoffCallEnd = src.indexOf('});', handoffCallStart);
    const section = src.slice(handoffCallStart, handoffCallEnd).toLowerCase();
    for (const forbidden of ['delegation', 'registered:', 'passport:', 'authority:']) {
      expect(section).not.toContain(forbidden);
    }
  });

  it('crossing without a chosen candidate is explicitly supported — agentCandidateRef is optional', () => {
    expect(src).toMatch(/agentCandidateRef: selected \?\? undefined,/);
  });
});

describe('FinancialServicesBridgeFrontDoor.tsx — decodes the handoff, pre-selects a VALIDATED candidate, selects REGISTER', () => {
  const src = stripComments(readSource('components/journey/FinancialServicesBridgeFrontDoor.tsx'));

  it('decodes the handoff from the URL query param, never trusting an unvalidated token', () => {
    expect(src).toMatch(/const token = new URL\(window\.location\.href\)\.searchParams\.get\('handoff'\);/);
    expect(src).toMatch(/const handoff = decodeExperienceHandoff\(token\);/);
  });

  it('validates agentCandidateRef against the REAL registrable-agent registry before applying it — never trusts the token blindly', () => {
    expect(src).toMatch(/import \{ resolveRegistrableAgent \} from '@\/services\/horizen\/registrableAgents'/);
    expect(src).toMatch(/if \(handoff\.agentCandidateRef && resolveRegistrableAgent\(handoff\.agentCandidateRef\)\)/);
    expect(src).toMatch(/setSelectedPilotAgentSlug\(handoff\.agentCandidateRef\);/);
  });

  it("selects the REGISTER stage unconditionally once a handoff decodes (whether or not a candidate came with it)", () => {
    const effectStart = src.indexOf("const token = new URL(window.location.href)");
    const effectEnd = src.indexOf('}, []);', effectStart);
    const section = src.slice(effectStart, effectEnd);
    expect(section).toMatch(/selectStage\('register'\);/);
  });

  it('a malformed/absent handoff fails open — the catch block is empty (no rethrow, no error UI), so the page proceeds exactly like a direct visit', () => {
    const effectStart = src.indexOf("const token = new URL(window.location.href)");
    const effectEnd = src.indexOf('}, []);', effectStart);
    const catchAt = src.indexOf('} catch {', effectStart);
    expect(catchAt).toBeGreaterThan(effectStart);
    expect(catchAt).toBeLessThan(effectEnd);
    const catchBody = src.slice(catchAt, effectEnd);
    // No rethrow, no setError/setState call inside the catch — a caught
    // failure here does nothing observable, which is the fail-open contract.
    expect(catchBody).not.toMatch(/throw |set[A-Z]\w*\(/);
  });

  it('never sets Passport/delegation/registration state directly from the handoff — only a candidate ref and return context', () => {
    const effectStart = src.indexOf("const token = new URL(window.location.href)");
    const effectEnd = src.indexOf('}, []);', effectStart);
    const section = src.slice(effectStart, effectEnd).toLowerCase();
    for (const forbidden of ['setpassport', 'setdelegation', 'setregistered', 'setauthority']) {
      expect(section).not.toContain(forbidden);
    }
  });
});

describe('HORIZEN_MONEYPENNY_JOURNEY — the crossing lands on a REAL register stage', () => {
  it("declares a stage literally id 'register' — the exact id FinancialServicesBridgeFrontDoor selects", () => {
    expect(HORIZEN_MONEYPENNY_JOURNEY.stages.some((s) => s.id === 'register')).toBe(true);
  });
});

describe('Direct /bridge/fs visits without a handoff remain unaffected (negative case)', () => {
  it('a missing token short-circuits via an early return before any decode/select side effect runs', () => {
    const src = stripComments(readSource('components/journey/FinancialServicesBridgeFrontDoor.tsx'));
    const effectStart = src.indexOf("const token = new URL(window.location.href)");
    const section = src.slice(effectStart, effectStart + 200);
    expect(section).toMatch(/if \(!token\) return;/);
  });
});
