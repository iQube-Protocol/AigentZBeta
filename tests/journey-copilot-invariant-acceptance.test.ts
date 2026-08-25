/**
 * Journey Runtime copilot invariant — item 9 acceptance canaries
 * (semantic repair, 2026-08-25).
 *
 * Consolidates the specific cross-journey proofs item 9 named for item 1,
 * beyond what the required `JourneyDefinition.copilot` TypeScript field and
 * the per-surface tests (tests/journey-principal-context-moneypenny-copilot.test.ts,
 * tests/knyts-bridge-*.test.ts, tests/ci-personify-*.test.ts) already cover:
 *
 *   1. Every production JourneyDefinition supplies a copilot reference that
 *      ACTUALLY RESOLVES (not just type-shape valid) — proven by calling
 *      resolveJourneyCopilot() for real, not by regexing source text.
 *   2. OCSGA (Ian Boundary Research) and the Validation Programme resolve to
 *      the existing IRL OS `aigent-researcher` / "IRL Guide" copilot.
 *   3. KNYTS resolves to the existing KNYT/Kn0w1 copilot.
 *   4. CI (Constitutional Internet) resolves to canonical aigentMe.
 *   5. Horizen/FS resolves to MoneyPenny.
 *   6. Every bare-page Journey host (KNYTS, CI, FS Bridge) mounts NO
 *      <CodexCopilotLayer> of its own — JourneyCopilotHost (mounted once,
 *      inside the shared JourneyRunSurface) is the only floating copilot on
 *      any Journey spine, regardless of which journey is running.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { resolveJourneyCopilot } from '@/services/journey/journeyCopilotResolver';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { KNYTS_BRIDGE_CROSSING_JOURNEY } from '@/services/journey/knytsBridgeCrossingJourney';
import { CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY } from '@/services/journey/constitutionalInternetBridgeJourney';
import { VALIDATION_PROGRAMME_JOURNEY } from '@/services/journey/validationProgrammeJourney';
import { IAN_BOUNDARY_RESEARCH_JOURNEY } from '@/services/journey/ianBoundaryResearchJourney';
import type { JourneyDefinition } from '@/types/journey';

const PRODUCTION_JOURNEYS: Array<{ label: string; journey: JourneyDefinition }> = [
  { label: 'Horizen MoneyPenny (Financial Services Bridge)', journey: HORIZEN_MONEYPENNY_JOURNEY },
  { label: 'KNYTS Bridge Crossing', journey: KNYTS_BRIDGE_CROSSING_JOURNEY },
  { label: 'Constitutional Internet Bridge', journey: CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY },
  { label: 'Validation Programme', journey: VALIDATION_PROGRAMME_JOURNEY },
  { label: 'Ian Boundary Research (OCSGA)', journey: IAN_BOUNDARY_RESEARCH_JOURNEY },
];

const BARE_PAGE_JOURNEY_HOSTS = [
  'app/bridge/knyts/page.tsx',
  'app/bridge/ci/page.tsx',
  'components/journey/FinancialServicesBridgeFrontDoor.tsx',
];

describe('item 9 — every JourneyDefinition supplies a copilot reference that actually resolves', () => {
  for (const { label, journey } of PRODUCTION_JOURNEYS) {
    it(`${label} (journey id '${journey.id}') resolves without throwing`, () => {
      expect(() => resolveJourneyCopilot(journey)).not.toThrow();
      const resolved = resolveJourneyCopilot(journey);
      expect(resolved.agent.id).toBeTruthy();
      expect(resolved.agent.name).toBeTruthy();
    });
  }
});

describe('item 9 — OCSGA and Validation Programme resolve to the existing IRL OS guide', () => {
  it('Ian Boundary Research (OCSGA) resolves to aigent-researcher / "IRL Guide"', () => {
    const resolved = resolveJourneyCopilot(IAN_BOUNDARY_RESEARCH_JOURNEY);
    expect(resolved.agent).toEqual({ id: 'aigent-researcher', name: 'IRL Guide' });
  });

  it('Validation Programme resolves to the SAME aigent-researcher / "IRL Guide"', () => {
    const resolved = resolveJourneyCopilot(VALIDATION_PROGRAMME_JOURNEY);
    expect(resolved.agent).toEqual({ id: 'aigent-researcher', name: 'IRL Guide' });
  });
});

describe('item 9 — KNYTS resolves to the existing KNYT/Kn0w1 copilot', () => {
  it('resolves to aigent-kn0w1 / "KNYT Copilot"', () => {
    const resolved = resolveJourneyCopilot(KNYTS_BRIDGE_CROSSING_JOURNEY);
    expect(resolved.agent).toEqual({ id: 'aigent-kn0w1', name: 'KNYT Copilot' });
  });
});

describe('item 9 — CI resolves to canonical aigentMe', () => {
  it('resolves to aigent-me / "aigentMe"', () => {
    const resolved = resolveJourneyCopilot(CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY);
    expect(resolved.agent).toEqual({ id: 'aigent-me', name: 'aigentMe' });
  });
});

describe('item 9 — Horizen/FS resolves to MoneyPenny', () => {
  it('resolves to aigent-moneypenny / "MoneyPenny"', () => {
    const resolved = resolveJourneyCopilot(HORIZEN_MONEYPENNY_JOURNEY);
    expect(resolved.agent).toEqual({ id: 'aigent-moneypenny', name: 'MoneyPenny' });
  });
});

describe('item 9 — every Journey spine has exactly one floating copilot', () => {
  it('JourneyRunSurface mounts exactly one JourneyCopilotHost', () => {
    const code = stripComments(readSource('components/journey/JourneyRunSurface.tsx'));
    const count = (code.match(/<JourneyCopilotHost\b/g) ?? []).length;
    expect(count).toBe(1);
  });

  for (const path of BARE_PAGE_JOURNEY_HOSTS) {
    it(`${path} mounts NO CodexCopilotLayer of its own`, () => {
      const code = stripComments(readSource(path));
      const count = (code.match(/<CodexCopilotLayer\b/g) ?? []).length;
      expect(count, `${path} must defer entirely to the shared JourneyCopilotHost`).toBe(0);
    });
  }
});

describe('item 9 — Passport UI carries no public "Delegate Passport" wording', () => {
  const PASSPORT_SURFACES = [
    'app/triad/components/codex/tabs/PassportBureauApplyTab.tsx',
    'app/triad/components/codex/tabs/PassportDoctrineTab.tsx',
    'app/triad/components/codex/tabs/PassportClaimModal.tsx',
    'app/triad/components/codex/tabs/AgentBenchTab.tsx',
    'components/composer/HomecomingTestTab.tsx',
  ];

  for (const path of PASSPORT_SURFACES) {
    it(`${path} contains no "Polity Delegate Passport"`, () => {
      const code = stripComments(readSource(path));
      expect(code).not.toMatch(/Polity Delegate Passport/);
    });
  }
});

describe('item 9 — Agent Passport sponsorship emits no delegation grant; the delegation stage still does', () => {
  it('PassportBureauApplyTab never calls the delegation grant endpoint or delegation grant store', () => {
    const code = stripComments(readSource('app/triad/components/codex/tabs/PassportBureauApplyTab.tsx'));
    expect(code).not.toContain('/api/codex/chat/agentiq-os/delegation"');
    expect(code).not.toContain("/api/codex/chat/agentiq-os/delegation'");
    expect(code).not.toMatch(/fetch\(\s*`\/api\/codex\/chat\/agentiq-os\/delegation/);
    expect(code).not.toContain('delegationGrantStore');
    expect(code).not.toContain('handleDelegationBind');
  });

  it('the canonical BoundedDelegationTab (the delegation-establish stage) still calls the delegation grant endpoint', () => {
    const code = stripComments(readSource('app/triad/components/codex/tabs/BoundedDelegationTab.tsx'));
    expect(code).toContain('/api/codex/chat/agentiq-os/delegation');
  });
});
