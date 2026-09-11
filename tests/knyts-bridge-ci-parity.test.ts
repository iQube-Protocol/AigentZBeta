/**
 * KNYTS Bridge ↔ CI Bridge parity pass (2026-08-12) — structural canaries.
 *
 * Covers the surgical parity operation: journey prerequisites, stepper
 * gating, the generalized BridgePassportGate/BridgeOrientSurface/
 * BridgeActionModeQuestion extractions, the KnytsBridgeMediaStage HOME-only
 * rewrite, the KnytsBridgePassportRoom rewrite off the auto-aigentMe-iframe,
 * the bridge-embedded-return navigation mechanism, the KnytQuestsTab wallet
 * Tasks buttons, and the FS Bridge public routes. Mirrors
 * tests/ci-bridge-gating-polish.test.ts's structural-canary style.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('KNYTS journey — Stand is gated on Passport, not Remix', () => {
  const JOURNEY = 'services/journey/knytsBridgeCrossingJourney.ts';

  it("stand.prerequisites is ['passport'], not ['remix']", () => {
    const code = stripComments(readSource(JOURNEY));
    const standIdx = code.indexOf("id: 'stand'");
    expect(standIdx, 'stand stage not found').toBeGreaterThan(-1);
    const nextStageIdx = code.indexOf("id: 'buy'", standIdx);
    const standBlock = code.slice(standIdx, nextStageIdx === -1 ? undefined : nextStageIdx);
    expect(standBlock).toMatch(/prerequisites:\s*\['passport'\]/);
    expect(standBlock, 'remix must not gate entry to Stand').not.toMatch(/prerequisites:\s*\['remix'\]/);
  });

  it('stand keeps its own completionEvidence (crossingHasConsequence) unchanged', () => {
    const code = stripComments(readSource(JOURNEY));
    const standIdx = code.indexOf("id: 'stand'");
    const nextStageIdx = code.indexOf("id: 'buy'", standIdx);
    const standBlock = code.slice(standIdx, nextStageIdx === -1 ? undefined : nextStageIdx);
    expect(standBlock).toMatch(/completionEvidence:\s*\['crossingHasConsequence'\]/);
  });

  it("passport's nextStageId is remix", () => {
    const code = stripComments(readSource(JOURNEY));
    const passportIdx = code.indexOf("id: 'passport'");
    const remixIdx = code.indexOf("id: 'remix'", passportIdx);
    const passportBlock = code.slice(passportIdx, remixIdx);
    expect(passportBlock).toMatch(/nextStageId:\s*'remix'/);
  });
});

describe('KNYTS stepper — Remix/Stand gated on citizenPassportUsable, mirroring CI', () => {
  const PAGE = 'app/bridge/knyts/page.tsx';

  it('emphasizeAvailableStage gates remix and stand on citizenPassportUsable', () => {
    const code = stripComments(readSource(PAGE));
    const idx = code.indexOf('emphasizeAvailableStage={(stageId)');
    expect(idx, 'emphasizeAvailableStage callback not found').toBeGreaterThan(-1);
    const end = code.indexOf('}}', idx);
    const callback = code.slice(idx, end);
    expect(callback).toMatch(/stageId === 'remix' \|\| stageId === 'stand'/);
    expect(callback).toContain('citizenPassportUsable');
  });

  it('distinguishAvailableStages is enabled on the KNYTS JourneyRunSurface', () => {
    const code = stripComments(readSource(PAGE));
    expect(code).toContain('distinguishAvailableStages');
  });

  it('resolveSurfaceProps threads citizenPassportUsable into the passport room and remix surface', () => {
    const code = stripComments(readSource(PAGE));
    // CFS-055 coherence pass (2026-08-12): citizenPassportUsable is now
    // derived from the WHOLE runtimeState via onRuntimeStateChange, never
    // discovered as a resolveSurfaceProps side effect — see the dedicated
    // state-coherence test file for the full canary set.
    expect(code).toContain('onRuntimeStateChange={handleRuntimeStateChange}');
    expect(code).not.toContain('setCitizenPassportUsable(isPassportUsable)');
  });
});

describe('BridgePassportGate — bridge-neutral, both bridges compose the SAME component', () => {
  const GATE = 'components/journey/BridgePassportGate.tsx';
  const CI_WRAPPER = 'components/journey/ConstitutionalInternetBridgePassportGate.tsx';
  const KNYTS_PAGE = 'app/bridge/knyts/page.tsx';
  const KNYTS_REMIX = 'components/journey/KnytsBridgeRemixSurface.tsx';

  it('the shared gate supports an accent prop (amber for KNYTS, indigo for CI)', () => {
    const code = stripComments(readSource(GATE));
    expect(code).toMatch(/'indigo'\s*\|\s*'amber'/);
    expect(code).toContain('accent?: BridgePassportGateAccent');
  });

  it("CI's wrapper is a thin pass-through with accent=indigo", () => {
    const code = stripComments(readSource(CI_WRAPPER));
    expect(code).toContain('BridgePassportGate');
    expect(code).toContain('accent="indigo"');
  });

  it('the KNYTS page mounts BridgePassportGate directly with accent=amber and dismissLabel="Later"', () => {
    const code = stripComments(readSource(KNYTS_PAGE));
    expect(code).toContain('BridgePassportGate');
    expect(code).toMatch(/accent="amber"/);
    expect(code).toMatch(/dismissLabel=["']Later["']/);
  });

  it('KnytsBridgeRemixSurface fails closed on citizenPassportUsable via the shared gate, not a fork', () => {
    const code = stripComments(readSource(KNYTS_REMIX));
    expect(code).toContain('BridgePassportGate');
    expect(code).toContain('citizenPassportUsable');
  });
});

describe('BridgeOrientSurface — bridge-neutral, both bridges compose the SAME questionnaire', () => {
  const SURFACE = 'components/journey/BridgeOrientSurface.tsx';
  const CI_WRAPPER = 'components/journey/ConstitutionalInternetBridgeOrientIntro.tsx';
  const KNYTS_WRAPPER = 'components/journey/KnytsBridgeOrientIntro.tsx';
  const REGISTRY = 'services/journey/journeySurfaceRegistry.ts';
  const KNYTS_PAGE = 'app/bridge/knyts/page.tsx';

  it('BridgeOrientSurface composes ConstitutionalFrontierOrientSurface — never a second questionnaire', () => {
    const code = stripComments(readSource(SURFACE));
    expect(code).toContain('ConstitutionalFrontierOrientSurface');
  });

  it("CI's own wrapper delegates to BridgeOrientSurface with its real canonical plates", () => {
    const code = stripComments(readSource(CI_WRAPPER));
    expect(code).toContain('BridgeOrientSurface');
    expect(code).toContain("section=\"ci-orient\"");
  });

  it('KNYTS wraps the SAME BridgeOrientSurface, honestly with no fabricated second plate', () => {
    const code = stripComments(readSource(KNYTS_WRAPPER));
    expect(code).toContain('BridgeOrientSurface');
    expect(code).toContain('section="orient"');
    expect(code, 'must not invent a carouselPlates asset for KNYTS').not.toMatch(/carouselPlates=\{?\[/);
  });

  it('the registry points knyts-bridge-orient at KnytsBridgeOrientIntro, not the old media stage', () => {
    const code = stripComments(readSource(REGISTRY));
    const idx = code.indexOf("'knyts-bridge-orient':");
    expect(idx, 'knyts-bridge-orient descriptor not found').toBeGreaterThan(-1);
    const end = code.indexOf('},', idx);
    const block = code.slice(idx, end);
    expect(block).toContain("component: 'KnytsBridgeOrientIntro'");
  });

  it('the KNYTS page wires KnytsBridgeOrientIntro into its component map', () => {
    const code = stripComments(readSource(KNYTS_PAGE));
    expect(code).toContain('KnytsBridgeOrientIntro');
    const mapIdx = code.indexOf('KNYTS_BRIDGE_COMPONENTS');
    const mapEnd = code.indexOf('};', mapIdx);
    expect(code.slice(mapIdx, mapEnd)).toContain('KnytsBridgeOrientIntro');
  });
});

describe('KnytsBridgeMediaStage — HOME-only, thin BridgeMediaStage(cinematic, amber) wrapper', () => {
  const MEDIA_STAGE = 'components/journey/KnytsBridgeMediaStage.tsx';

  it('composes the shared BridgeMediaStage in cinematic/amber, never a bespoke hero', () => {
    const code = stripComments(readSource(MEDIA_STAGE));
    expect(code).toContain('BridgeMediaStage');
    expect(code).toContain('layout="cinematic"');
    expect(code).toContain('accent="amber"');
  });

  it('no longer branches on an orient section — ORIENT moved to KnytsBridgeOrientIntro', () => {
    const code = stripComments(readSource(MEDIA_STAGE));
    expect(code, "KnytsBridgeMediaStage must not accept a 'home' | 'orient' section prop anymore").not.toMatch(
      /'home'\s*\|\s*'orient'/,
    );
  });
});

describe('BridgeActionModeQuestion — the shared Polity-intent question, one implementation', () => {
  const SHARED = 'components/journey/BridgeActionModeQuestion.tsx';
  const CI_ROOM = 'components/journey/ConstitutionalInternetBridgePassportRoom.tsx';
  const KNYTS_ROOM = 'components/journey/KnytsBridgePassportRoom.tsx';

  it('the shared component takes a postUrl and renders the five action modes', () => {
    const code = stripComments(readSource(SHARED));
    expect(code).toContain('postUrl');
    for (const mode of ['create', 'build', 'develop', 'research', 'safeguard']) {
      expect(code).toContain(`'${mode}'`);
    }
  });

  it("CI's passport room composes the shared component, no local PolityIntentQuestion left", () => {
    const code = stripComments(readSource(CI_ROOM));
    expect(code).toContain('BridgeActionModeQuestion');
    expect(code, 'a second, local copy of the question must not remain').not.toContain('function PolityIntentQuestion');
  });

  it("KNYTS's passport room composes the SAME shared component, posting to its own campaign-scoped route", () => {
    const code = stripComments(readSource(KNYTS_ROOM));
    expect(code).toContain('BridgeActionModeQuestion');
    expect(code).toContain('/api/journey/knyts-bridge/passport/intent');
  });
});

describe('KnytsBridgePassportRoom — reconstituted onto the CI framework, no auto aigentMe iframe', () => {
  const ROOM = 'components/journey/KnytsBridgePassportRoom.tsx';

  it('no longer auto-embeds the aigentMe dashboard iframe', () => {
    const code = stripComments(readSource(ROOM));
    expect(code, 'the old unconditional aigentMe iframe embed must be gone').not.toMatch(/aigentMeSrc/);
    expect(code).not.toContain("tab: 'aigent-me'");
  });

  it('renders a dismissible "you have crossed" banner and advances to remix', () => {
    const code = stripComments(readSource(ROOM));
    expect(code).toContain('noticeDismissed');
    expect(code).toMatch(/selectStage\('remix'\)/);
  });

  it('mounts the parchment-matte plate pane via ArtifactMattedFrame', () => {
    const code = stripComments(readSource(ROOM));
    expect(code).toContain('ArtifactMattedFrame');
  });
});

describe('Passport intent routes — one shared question, two campaign-scoped endpoints', () => {
  it('the KNYTS intent route exists and posts to the KNYTS campaign, never the CI one', () => {
    const code = stripComments(readSource('app/api/journey/knyts-bridge/passport/intent/route.ts'));
    expect(code).toContain('KNYTS_BRIDGE_CAMPAIGN_ID');
    expect(code).not.toContain('CI_BRIDGE_CAMPAIGN_ID');
  });

  it('the CI intent route is unchanged — still posts to the CI campaign', () => {
    const code = stripComments(readSource('app/api/journey/constitutional-internet-bridge/passport/intent/route.ts'));
    expect(code).toContain('CI_BRIDGE_CAMPAIGN_ID');
  });
});

describe('Bridge embedded-return mechanism — generic, additive, one implementation', () => {
  const NAV = 'services/journey/bridgeEmbedNav.ts';
  const RUNNER = 'components/journey/JourneyRunSurface.tsx';
  const REGISTRY = 'services/journey/journeySurfaceRegistry.ts';
  const CODEX_PANEL = 'app/triad/components/CodexPanelDynamic.tsx';

  it('bridgeEmbedNav exposes a request/subscribe pair, serializable, mirroring walletSurfaceRequest', () => {
    const code = stripComments(readSource(NAV));
    expect(code).toContain('export function requestBridgeEmbedReturn');
    expect(code).toContain('export function subscribeBridgeEmbedReturn');
    expect(code).toContain('BRIDGE_EMBED_RETURN_TYPE');
  });

  it('JourneyRunSurface renders a return-to-root toolbar for descriptors declaring rootTab', () => {
    const code = stripComments(readSource(RUNNER));
    expect(code).toContain('requestBridgeEmbedReturn');
    expect(code).toContain('descriptor.rootTab');
    expect(code).toContain('descriptor.returnLabel');
  });

  it('the embed descriptor type carries optional rootTab/returnLabel fields', () => {
    const code = stripComments(readSource(REGISTRY));
    expect(code).toMatch(/rootTab\?:\s*string/);
    expect(code).toMatch(/returnLabel\?:\s*string/);
  });

  it('knyts-bridge-stand declares rootTab=quests so Living Canon can return to it', () => {
    const code = stripComments(readSource(REGISTRY));
    const idx = code.indexOf("'knyts-bridge-stand':");
    expect(idx, 'knyts-bridge-stand descriptor not found').toBeGreaterThan(-1);
    const end = code.indexOf('note:', idx);
    const block = code.slice(idx, end);
    expect(block).toMatch(/rootTab:\s*'quests'/);
    expect(block).toMatch(/returnLabel:\s*'Back to Quests'/);
  });

  it('CodexPanelDynamic subscribes and resets its OWN tab only, never an unrelated cartridge', () => {
    const code = stripComments(readSource(CODEX_PANEL));
    expect(code).toContain('subscribeBridgeEmbedReturn');
    expect(code).toMatch(/command\.cartridgeId\s*!==\s*codexId/);
  });
});

describe('KnytQuestsTab — Open Wallet Tasks buttons, no new wallet/drawer/Tasks implementation', () => {
  const TAB = 'app/triad/components/codex/tabs/KnytQuestsTab.tsx';
  const REQUEST_BUS = 'services/wallet/walletSurfaceRequest.ts';
  const DRAWER = 'app/components/content/SmartWalletDrawer.tsx';

  it('Bring a Knight and Herald of the Order each get an explicit wallet-tasks button', () => {
    const code = stripComments(readSource(TAB));
    const matches = code.match(/openWalletTasks\(/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(code).toContain('requestWalletSurface');
    expect(code).toContain('"TASKS_TAB"');
  });

  it('TASKS_TAB is a real RequestableWalletSurface value on the existing bus', () => {
    const code = stripComments(readSource(REQUEST_BUS));
    expect(code).toContain("'TASKS_TAB'");
  });

  it('SmartWalletDrawer converts TASKS_TAB into switching to the EXISTING tasks DrawerTab, not a new overlay', () => {
    const code = stripComments(readSource(DRAWER));
    expect(code).toContain('"TASKS_TAB"');
    const idx = code.indexOf("walletSurface !== 'TASKS_TAB'");
    expect(idx, 'the TASKS_TAB -> tab-switch converter effect was not found').toBeGreaterThan(-1);
    const nearby = code.slice(idx, idx + 200);
    expect(nearby).toContain("setActiveTab('tasks')");
  });
});

describe('FS Bridge — public routes render the SAME PilotJourneyTab, no fork', () => {
  const FRONT_DOOR = 'components/journey/FinancialServicesBridgeFrontDoor.tsx';
  const FS_PAGE = 'app/bridge/fs/page.tsx';
  const LONG_PAGE = 'app/bridge/financial-services/page.tsx';

  it('both route files mount the SAME FinancialServicesBridgeFrontDoor component', () => {
    const fs = stripComments(readSource(FS_PAGE));
    const long = stripComments(readSource(LONG_PAGE));
    expect(fs).toContain('FinancialServicesBridgeFrontDoor');
    expect(long).toContain('FinancialServicesBridgeFrontDoor');
  });

  it('the front door mounts the real PilotJourneyTab — never a cloned component or a second Horizen state route', () => {
    const code = stripComments(readSource(FRONT_DOOR));
    expect(code).toContain('PilotJourneyTab');
    expect(code, 'must import the real PilotJourneyTab, not a copy').toMatch(
      /from ['"]@\/app\/triad\/components\/codex\/tabs\/PilotJourneyTab['"]/,
    );
    expect(code, 'must not declare a second Horizen state route').not.toMatch(/moneypenny-horizen\/state.*route/);
  });

  it('neither route file contains its own journey logic — thin adapters only', () => {
    const fs = stripComments(readSource(FS_PAGE));
    const long = stripComments(readSource(LONG_PAGE));
    expect(fs).not.toContain('HORIZEN_MONEYPENNY_JOURNEY');
    expect(long).not.toContain('HORIZEN_MONEYPENNY_JOURNEY');
  });
});
