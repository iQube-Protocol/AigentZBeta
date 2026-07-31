/**
 * Wiring canaries for the Horizen human-readable agent page (confirmed live
 * 2026-07-31): HorizenAgentPageSurface must be reached with the SELECTED
 * journey subject, never a fixed MoneyPenny/Nakamoto constant; it must
 * validate any URL through the allowlist before rendering; it must never be
 * able to complete the Register/Verify stage merely by being open; and the
 * Register/Verify journey surfaces must both route to it (no more
 * 'external-url-unresolved' placeholder).
 *
 * Source-scan style, matching this repo's existing canary convention (e.g.
 * tests/passport-wizard-branching.test.ts) — no React rendering harness.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('journeySurfaceRegistry — Horizen agent page is resolved, not unresolved', () => {
  const source = read('services/journey/journeySurfaceRegistry.ts');

  it('the Register-stage ref routes to HorizenAgentPageSurface, not external-url-unresolved', () => {
    const match = source.match(/'horizen-registry-agent-page':\s*\{([\s\S]*?)\n {2}\},/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain("component: 'HorizenAgentPageSurface'");
    expect(match![1]).not.toContain('external-url-unresolved');
  });

  it('a distinct Verify-stage ref also routes to HorizenAgentPageSurface (Verify reuses the same page)', () => {
    const match = source.match(/'horizen-agent-page-verify':\s*\{([\s\S]*?)\n {2}\},/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain("component: 'HorizenAgentPageSurface'");
  });
});

describe('horizenMoneyPennyJourney — Verify stage actually surfaces the Horizen page', () => {
  it('the Verify stage surfaces array includes horizen-agent-page-verify', () => {
    const source = read('services/journey/horizenMoneyPennyJourney.ts');
    const verifyStageMatch = source.match(/id: 'verify',[\s\S]*?nextStageId: 'claim',/);
    expect(verifyStageMatch).not.toBeNull();
    expect(verifyStageMatch![0]).toContain('horizen-agent-page-verify');
  });
});

describe('PilotJourneyTab — the selected agent, never a hardcoded one, reaches the Horizen surface', () => {
  const source = read('app/triad/components/codex/tabs/PilotJourneyTab.tsx');

  it('passes agentSlug: selectedAgentSlug (the lifted, changeable selection) into HorizenAgentPageSurface', () => {
    const match = source.match(/descriptor\.component === 'HorizenAgentPageSurface'\s*\?\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('agentSlug: selectedAgentSlug');
    // Never a literal 'moneypenny'/'nakamoto' string hardcoded at this call site.
    expect(match![1]).not.toMatch(/agentSlug:\s*'(moneypenny|nakamoto)'/);
  });

  it('derives register-vs-verify mode from the surface ref, never a fixed literal for both', () => {
    const match = source.match(/descriptor\.component === 'HorizenAgentPageSurface'\s*\?\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain("surfaceRef.ref === 'horizen-agent-page-verify'");
  });
});

describe('HorizenAgentPageSurface — allowlist gate + no side-effecting completion', () => {
  const source = read('components/journey/HorizenAgentPageSurface.tsx');

  it('validates a resolved URL through isHorizenAgentPageUrl before ever rendering it', () => {
    expect(source).toContain('isHorizenAgentPageUrl');
    expect(source).toMatch(/isHorizenAgentPageUrl\(candidateUrl\)/);
  });

  it('renders the honest awaiting state, never a guessed URL, when unresolved', () => {
    expect(source).toMatch(/if \(!resolved\)/);
    expect(source.toLowerCase()).toContain('awaiting horizen registration');
  });

  it('never calls a receipt-writing or stage-completion endpoint — opening the page cannot complete a stage', () => {
    // The component only ever GETs the agent's own already-served card; it
    // must never POST to any journey/receipts endpoint.
    expect(source).not.toMatch(/personaFetch\(/);
    expect(source).not.toMatch(/method:\s*['"]POST['"]/);
    expect(source).not.toMatch(/\/api\/journey\//);
    expect(source).not.toMatch(/\/api\/assistant\/receipts/);
  });

  it('reuses the existing IframeTab embed mechanism rather than a second iframe implementation', () => {
    expect(source).toContain("import { IframeTab }");
    expect(source).toMatch(/<IframeTab\s/);
  });
});

describe('services/horizen/agentPageUrl.ts is the ONE place that builds this URL', () => {
  it('no other file in services/horizen hand-builds an agent-registry.horizenlabs.io URL', () => {
    const dir = path.join(__dirname, '..', 'services', 'horizen');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'agentPageUrl.ts');
    for (const f of files) {
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(content, `${f} should not hardcode the Horizen agent-page host — import from agentPageUrl.ts instead`).not.toContain('agent-registry.horizenlabs.io/agent/');
    }
  });
});
