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

describe('a missing page URL is not a missing registration (2026-08-03)', () => {
  /*
   * ── THE OPERATOR'S REPORT ────────────────────────────────────────────────
   *
   *   > "The UI still says 'Awaiting Horizen registration for Aigent
   *   >  Nakamoto' even though Nakamoto's ERC-8004 registration and token ID
   *   >  are already known. That is an observer-state failure on our side,
   *   >  not a Horizen registration failure."
   *
   * ── WHY IT HAPPENED, AND WHY IT IS A RECURRENCE ─────────────────────────
   *
   * `HorizenAgentPageSurface` gated purely on `humanReadableUrl` and reported
   * its absence as absence of REGISTRATION. Nakamoto is the case that
   * separates the two: her registration was recovered from the chain, and
   * `registrationClient.ts`'s recovery branch writes `humanReadableUrl: null`
   * BY DESIGN, because Horizen's page identifier is a distinct field only a
   * confirmed partner reread yields and the 2026-07-31 ruling forbids
   * defaulting it from the tokenId. A fully registered agent can therefore
   * have no page URL indefinitely.
   *
   * This is the FIFTH observer of "is Nakamoto registered", reading a SIXTH
   * source — precisely what `RES-2026-08-03-HORIZEN-OBSERVER-RECONCILIATION-001`
   * and `CI-2026-08-03-CANONICAL-READER-OWNERSHIP-001` were recorded to stop.
   * The lesson existed and was not carried into this component.
   */
  const SURFACE = path.join(__dirname, '..', 'components/journey/HorizenAgentPageSurface.tsx');
  const source = fs.readFileSync(SURFACE, 'utf8');

  it('reads the canonical registration fact, not only the page URL', () => {
    // THE ASSERTION THAT FAILS ON THE DEFECT: pre-fix the component never
    // referenced tokenId at all, and had exactly one !resolved branch.
    expect(source).toMatch(/horizen\?\.tokenId/);
    expect(source).toMatch(/!resolved && registeredTokenId/);
  });

  it('never renders "Awaiting Horizen registration" when a token id exists', () => {
    /*
     * The operator's own acceptance condition, verbatim: "the UI displays
     * 'awaiting registration' alongside a non-null token ID" must be
     * impossible. Structural check — the registered branch must RETURN before
     * the awaiting branch is reachable.
     */
    /*
     * ANCHORED ON THE RENDER SITE, NOT ON PROSE. First written as a plain
     * `indexOf('Awaiting Horizen registration for')`, it matched the source
     * comment quoting the operator's report — which appears ABOVE the fix —
     * and failed against correct code. A canary that can be tripped by a
     * comment is measuring the wrong thing.
     */
    const registeredAt = source.indexOf('!resolved && registeredTokenId');
    const awaitingAt = source.search(/<p className="text-slate-300">Awaiting Horizen registration for/);
    expect(registeredAt, 'the registered branch is missing').toBeGreaterThan(-1);
    expect(awaitingAt, 'the awaiting branch is missing').toBeGreaterThan(-1);
    expect(registeredAt, 'a token id must be answered BEFORE the awaiting state').toBeLessThan(awaitingAt);
  });

  it('says which fact is missing — the page identifier, not the registration', () => {
    expect(source).toMatch(/is registered — token/);
    expect(source).toMatch(/page identifier is a\s*\n?\s*\* separate field|separate field from the token id/);
  });

  it('still refuses to guess a URL: the middle state renders no iframe', () => {
    // The 2026-07-31 ruling stands — agentIdentifier is never defaulted from
    // tokenId. Being honest about registration must not become fabricating
    // an embed target.
    const middle = source.slice(
      source.indexOf('!resolved && registeredTokenId'),
      source.search(/<p className="text-slate-300">Awaiting Horizen registration for/),
    );
    expect(middle).not.toContain('IframeTab');
    expect(middle).not.toContain('buildHorizenAgentPageUrl');
  });
});

describe('a local prerequisite is checked locally, before any partner call (2026-08-03)', () => {
  /*
   * The operator saw the Verify ceremony fail with:
   *
   *   createPartnerAuthorizationRequest failed: Could not find the table
   *   'public.partner_authorization_requests' in the schema cache
   *
   * …AFTER Horizen had already been asked to build an authorization message,
   * because `prepareHorizenTransparencyAuthorization` called listTools and
   * the build tool BEFORE it tried to persist. We must not ask an external
   * party for work we cannot record.
   */
  const CLIENT = path.join(__dirname, '..', 'services/horizen/authorizationClient.ts');
  const source = fs.readFileSync(CLIENT, 'utf8');

  it('checks the authorization store before the MCP client is constructed', () => {
    const storeCheck = source.indexOf('checkStoreAvailable');
    const mcp = source.indexOf('deps.mcpClient ?? (await defaultMcpClient())');
    expect(storeCheck).toBeGreaterThan(-1);
    expect(storeCheck, 'the store must be probed BEFORE Horizen is contacted').toBeLessThan(mcp);
  });

  it('the refusal states plainly that Horizen was never called', () => {
    expect(source).toContain('AUTHORIZATION_STORE_UNAVAILABLE');
    expect(source).toMatch(/Horizen was NOT called/);
    expect(source).toMatch(/nothing was authorized and nothing needs undoing/);
  });

  it('the store distinguishes its failure kinds, because they have different remedies', async () => {
    const store = fs.readFileSync(path.join(__dirname, '..', 'services/horizen/partnerAuthorizationStore.ts'), 'utf8');
    for (const kind of ['no-client', 'table-absent', 'permission-denied', 'unknown']) {
      expect(store, `missing failure kind: ${kind}`).toContain(`'${kind}'`);
    }
    // A remedy is an executable act, not "check the database".
    expect(store).toContain("NOTIFY pgrst, 'reload schema'");
    expect(store).toContain('20260930000500_partner_authorization_requests.sql');
  });

  it('a Verify-stage failure cannot be a statement about Register', () => {
    // Stage independence: the store refusal names only the authorization, and
    // never claims anything about registration state.
    const refusal = source.slice(source.indexOf("refusalCode: 'AUTHORIZATION_STORE_UNAVAILABLE'"), source.indexOf("refusalCode: 'AUTHORIZATION_STORE_UNAVAILABLE'") + 700);
    expect(refusal).not.toMatch(/register|registration/i);
  });
});
