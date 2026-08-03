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

describe('PilotJourneyTab — the selected agent, never MoneyPenny, reaches Claim (2026-08-03)', () => {
  /*
   * Aigent Nakamoto's live registration hit this directly: "Prove wallet
   * control" answered `no registry_assets row for "aigentqube-moneypenny"`
   * while the operator was claiming Nakamoto. MarketaEligibilityView's props
   * were declared and never read (`_props`), and both its requests to
   * claim/prove-control omitted agentSlug — the same shape of bug
   * PulseTransparencyToggle had before the 2026-08-02 fix above.
   */
  const tabSource = read('app/triad/components/codex/tabs/PilotJourneyTab.tsx');
  const viewSource = read('components/journey/MarketaEligibilityView.tsx');

  it('PilotJourneyTab passes agentSlug: selectedAgentSlug into MarketaEligibilityView', () => {
    const match = tabSource.match(/descriptor\.component === 'MarketaEligibilityView'\s*\?\s*\{([^}]*)\}/);
    expect(match, 'MarketaEligibilityView never receives a props override').not.toBeNull();
    expect(match![1]).toContain('agentSlug: selectedAgentSlug');
    expect(match![1]).not.toMatch(/agentSlug:\s*'(moneypenny|nakamoto)'/);
  });

  it('MarketaEligibilityView requires agentSlug — props are read, not discarded', () => {
    expect(viewSource).not.toMatch(/function MarketaEligibilityView\(_props/);
    expect(viewSource).toMatch(/function MarketaEligibilityView\(\{\s*agentSlug\s*\}/);
  });

  it('both the GET refresh and the POST prove-control call send agentSlug — neither can fall back to the server default', () => {
    const getCallAt = viewSource.indexOf('personaFetch(\n        `/api/journey/moneypenny-horizen/claim/prove-control');
    expect(getCallAt, 'GET refresh call not found').toBeGreaterThan(-1);
    expect(viewSource.slice(getCallAt, getCallAt + 200)).toMatch(/agentSlug=\$\{encodeURIComponent\(agentSlug\)\}/);

    const postCallAt = viewSource.indexOf('const proveControl');
    const postBlock = viewSource.slice(postCallAt, postCallAt + 600);
    expect(postBlock).toMatch(/JSON\.stringify\(\{\s*agentSlug\s*\}\)/);
  });
});

describe('RegisterAgentPanel — one screen, one answer about whether registration happened (2026-08-03)', () => {
  /*
   * The pilot's 21:10 screenshot showed THREE mutually exclusive claims at
   * once: the ladder said "Awaiting confirmation from Horizen", the Agent
   * Card row said "HORIZEN TOKENID: not yet registered", and the banner
   * below both said "Aigent Nakamoto is registered — Horizen tokenId 8798".
   * The panel held the tokenId in three places and fed its ladder from the
   * weakest one.
   */
  const source = read('components/journey/RegisterAgentPanel.tsx');

  it('the ladder tokenId falls back through card → receipt → this session’s own confirmation', () => {
    expect(source).toMatch(/const tokenId =\s*cardTokenId \?\? receiptTokenId \?\? flowTokenIdRef\.current/);
  });

  it('reads the confirmation receipt’s structured registration.tokenId, not just the Agent Card', () => {
    expect(source).toContain('r.actionInput?.registration?.tokenId');
  });

  it('a confirmed tokenId is never cleared by a later poll that fails to see it', () => {
    // The ref is only ever ASSIGNED on a confirmation — no reset-to-null path,
    // or a confirmed registration would flip back to "awaiting" on one bad read.
    expect(source).toMatch(/if \(flow\.step === 'confirmed' && flow\.tokenId\) flowTokenIdRef\.current = flow\.tokenId/);
    expect(source).not.toMatch(/flowTokenIdRef\.current = null/);
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

describe('JourneyRunSurface — the pilot can see WHICH evidence is missing, without a SQL console (2026-08-03)', () => {
  /*
   * Register stayed un-emerald and the only way to learn why was a Supabase
   * query against activity_receipts. The surface already received
   * evidencePresent / evidenceMissing / receiptRefs per stage and collapsed
   * them into one comma-separated "Awaiting:" list of raw camelCase signal
   * names — discarding the met/unmet split it had been handed.
   */
  const source = read('components/journey/JourneyRunSurface.tsx');

  it('renders both the satisfied and the missing evidence, not only what is missing', () => {
    expect(source).toContain('activeStageRuntime.evidencePresent.map');
    expect(source).toContain('activeStageRuntime.evidenceMissing.map');
  });

  it('surfaces the receipt count so a stage backed by receipts says so', () => {
    expect(source).toMatch(/activeStageRuntime\.receiptRefs\.length/);
  });

  it('humanises signal names mechanically — no hand-written label map to go stale', () => {
    expect(source).toContain('function humaniseSignal');
    // A curated map would silently fall back to the raw key for any signal the
    // server adds later; the transformation cannot.
    expect(source).not.toMatch(/const SIGNAL_LABELS\s*[:=]/);
  });

  it('computes no stage state of its own — the checklist can never disagree with the server', () => {
    // It may only READ the runtime arrays; it must not re-derive completeness.
    const block = source.slice(source.indexOf('EVIDENCE CHECKLIST'), source.indexOf('EVIDENCE CHECKLIST') + 2200);
    expect(block).not.toMatch(/state\s*===\s*'COMPLETE'/);
    expect(block).not.toContain('hasReceipt');
  });
});
