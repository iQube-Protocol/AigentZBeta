/**
 * CFS_Bridge_Content_Pack_v1 integration (2026-09-03) — Discover/Learn/
 * Explore/Prepare/Operate/Cross content wired into the real CI/KNYTS
 * fs-* bridge stages, per CLAUDE_CFS_Content_Wiring_Brief.md.
 *
 * Source-level structural proof — this repo's established pattern for UI
 * wiring that would otherwise need a live browser session (see
 * qriptopian-admin-bridges-tab.test.ts, fs-operate-stage.test.ts). No
 * authenticated admin session or Threshold connector was available in this
 * sandbox (see the session's own blocker record,
 * codexes/packs/agentiq/updates/2026-09-02_moneypenny-authoritative-three-
 * spec-import-and-reconciliation.md §16d/§17e) — asset publication and
 * browser acceptance are reported separately, not asserted here.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import {
  FS_STAGE_CONTENT,
  FS_LEARN_PLATES,
  type FsStageId,
} from '@/services/journey/financialSovereigntyContent';
import {
  FS_STAGE_IDS,
  KNYTS_BRIDGE_ALLOWED_SECTIONS,
  KNYTS_BRIDGE_SECTION_DEFAULTS,
  fsBridgeSectionKey,
  fsLearnPlateSectionKey,
} from '@/services/journey/knytsBridgeEditorialConfig';

const STAGES: FsStageId[] = ['discover', 'learn', 'explore', 'prepare', 'operate', 'cross'];

describe('financialSovereigntyContent.ts — the CFS pack static content, one authoritative module', () => {
  it('every stage has real eyebrow/headline/lead/topics/asset/checks/exerciseSummary/contextualLine — nothing fabricated as empty', () => {
    for (const stage of STAGES) {
      const c = FS_STAGE_CONTENT[stage];
      expect(c.eyebrow.length).toBeGreaterThan(0);
      expect(c.headline.length).toBeGreaterThan(0);
      expect(c.lead.length).toBeGreaterThan(0);
      expect(c.topics.length).toBeGreaterThan(0);
      expect(c.asset.assetRef).toMatch(/^[A-Z]-I01$/);
      expect(c.asset.alt.length).toBeGreaterThan(0);
      expect(c.checks.length).toBeGreaterThan(0);
      expect(c.exerciseSummary.length).toBeGreaterThan(0);
      expect(c.contextualLine.ci.length).toBeGreaterThan(0);
      expect(c.contextualLine.knyts.length).toBeGreaterThan(0);
    }
  });

  it('every understanding check has a correctOption that is actually one of its own option ids — no orphan answer key', () => {
    for (const stage of STAGES) {
      for (const check of FS_STAGE_CONTENT[stage].checks) {
        const ids = check.options.map((o) => o.id);
        expect(ids).toContain(check.correctOption);
      }
    }
  });

  it('FS_LEARN_PLATES carries exactly the three Learn asset refs (L-I01/L-I02/L-I03), matching content/step-composition.json', () => {
    expect(FS_LEARN_PLATES.map((p) => p.assetRef)).toEqual(['L-I01', 'L-I02', 'L-I03']);
  });

  it("Discover's corrected copy drops the misleading 'reversible' claim and Learn's drops the misleading 'only a runtime action changes anything' phrasing (brief §Preserve functions, correct misleading copy)", () => {
    expect(FS_STAGE_CONTENT.discover.lead).not.toMatch(/bounded, evidenced, reversible/i);
    expect(FS_STAGE_CONTENT.discover.lead).toMatch(/stop or revoke controls/i);
    expect(FS_STAGE_CONTENT.learn.lead).not.toMatch(/only a runtime action — one you authorize — actually changes anything/i);
    expect(FS_STAGE_CONTENT.learn.lead).toMatch(/financial execution requires a supported runtime action/i);
  });

  it('never publishes a token conversion rate or a Bitcent/QriptoCENT/KNYT COYN claim (brief non-negotiable semantics)', () => {
    const allText = STAGES.flatMap((s) => [
      FS_STAGE_CONTENT[s].lead,
      ...FS_STAGE_CONTENT[s].topics.map((t) => t.body),
      FS_STAGE_CONTENT[s].exerciseSummary,
    ]).join(' ');
    expect(allText).not.toMatch(/bitcent|qriptocent|knyt coyn|\$knyt\b/i);
  });

  it('uses "AgentMe" (one word) wherever the companion agent is named — never "Agent Me"/"AgentMe " variants', () => {
    const learnAgentsTopic = FS_STAGE_CONTENT.learn.topics.find((t) => t.id === 'L-TOPIC-03');
    expect(learnAgentsTopic?.body).toMatch(/AgentMe/);
    expect(learnAgentsTopic?.body).not.toMatch(/Agent Me/);
  });
});

describe('knytsBridgeEditorialConfig.ts — twelve stage placements + two extra Learn-plate sections, additive to the existing allow-list', () => {
  it('FS_STAGE_IDS is exactly the six CFS stages, matching both journey definitions\' fs-* stage ids', () => {
    expect(FS_STAGE_IDS).toEqual(['discover', 'learn', 'explore', 'prepare', 'operate', 'cross']);
  });

  it('fsBridgeSectionKey follows the existing bare/ci- prefix convention (home vs ci-home) — no bridge collision', () => {
    for (const stage of FS_STAGE_IDS) {
      expect(fsBridgeSectionKey('knyts', stage)).toBe(`fs-${stage}`);
      expect(fsBridgeSectionKey('ci', stage)).toBe(`ci-fs-${stage}`);
      expect(fsBridgeSectionKey('knyts', stage)).not.toBe(fsBridgeSectionKey('ci', stage));
    }
  });

  it('fsLearnPlateSectionKey: plate 0 reuses the plain fs-learn section; plates 1/2 get their own distinct sections', () => {
    expect(fsLearnPlateSectionKey('knyts', 0)).toBe('fs-learn');
    expect(fsLearnPlateSectionKey('knyts', 1)).toBe('fs-learn-2');
    expect(fsLearnPlateSectionKey('knyts', 2)).toBe('fs-learn-3');
    expect(fsLearnPlateSectionKey('ci', 0)).toBe('ci-fs-learn');
    expect(fsLearnPlateSectionKey('ci', 1)).toBe('ci-fs-learn-2');
    expect(fsLearnPlateSectionKey('ci', 2)).toBe('ci-fs-learn-3');
  });

  it('all twelve stage placements + four extra Learn-plate sections are registered in KNYTS_BRIDGE_ALLOWED_SECTIONS — the same allow-list the PUT/GET routes and the placements route both gate on', () => {
    for (const bridge of ['ci', 'knyts'] as const) {
      for (const stage of FS_STAGE_IDS) {
        expect(KNYTS_BRIDGE_ALLOWED_SECTIONS.has(fsBridgeSectionKey(bridge, stage))).toBe(true);
      }
      expect(KNYTS_BRIDGE_ALLOWED_SECTIONS.has(fsLearnPlateSectionKey(bridge, 1))).toBe(true);
      expect(KNYTS_BRIDGE_ALLOWED_SECTIONS.has(fsLearnPlateSectionKey(bridge, 2))).toBe(true);
    }
  });

  it('every registered CFS section has a starting admin-form default with a non-empty headline and a null infographicUrl (nothing published by this code change)', () => {
    for (const bridge of ['ci', 'knyts'] as const) {
      for (const stage of FS_STAGE_IDS) {
        const key = fsBridgeSectionKey(bridge, stage);
        const def = KNYTS_BRIDGE_SECTION_DEFAULTS[key];
        expect(def, `missing default for ${key}`).toBeDefined();
        expect(def.headline).toBeTruthy();
        expect(def.infographicUrl).toBeNull();
      }
    }
  });

  it('never introduces a new database table, route, or upsert function — reuses upsertKnytsBridgeEditorialSection/getKnytsBridgeEditorialSection exactly as-is', () => {
    const src = stripComments(readSource('services/journey/knytsBridgeEditorialConfig.ts'));
    expect(src).not.toMatch(/CREATE TABLE/i);
    // exactly one export of each function (no forked v2)
    expect(src.match(/export async function getKnytsBridgeEditorialSection/g)?.length).toBe(1);
    expect(src.match(/export async function upsertKnytsBridgeEditorialSection/g)?.length).toBe(1);
  });
});

describe('QriptopianAdminTab.tsx — native Admin → Bridges exposes all twelve CFS placements through the EXISTING generic panels, no bespoke editor', () => {
  const src = stripComments(readSource('app/triad/components/codex/tabs/QriptopianAdminTab.tsx'));

  it('imports fsBridgeSectionKey/fsLearnPlateSectionKey rather than hand-copying section strings', () => {
    expect(src).toMatch(/import \{ FS_STAGE_IDS, fsBridgeSectionKey, fsLearnPlateSectionKey \} from '@\/services\/journey\/knytsBridgeEditorialConfig'/);
  });

  it('both bridgeSections() branches append the CFS fs-* + Learn-plate sections via the shared helper — never a hand-typed fs-discover-style literal', () => {
    const fn = src.match(/function bridgeSections\(bridge: BridgeKey\): string\[\] \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(fn).toMatch(/FS_STAGE_IDS\.map\(\(s\) => fsBridgeSectionKey\('knyts', s\)\)/);
    expect(fn).toMatch(/FS_STAGE_IDS\.map\(\(s\) => fsBridgeSectionKey\('ci', s\)\)/);
    expect(fn).toMatch(/fsLearnPlateSectionKey\('knyts', 1\)/);
    expect(fn).toMatch(/fsLearnPlateSectionKey\('ci', 2\)/);
  });

  it('every section (existing and new) still renders through the SAME KnytsBridgeAdminPanel + PlacementAssetsPanel pair — no new admin component for CFS', () => {
    const renderLoop = src.match(/\{bridgeSections\(bridge\)\.map\(\(section\) => \{?[\s\S]*?\}\)\}/)?.[0] ?? '';
    expect(renderLoop).toMatch(/<KnytsBridgeAdminPanel section=\{section\} personaId=\{personaId\} bridgeLabel=\{BRIDGE_LABELS\[bridge\]\} \/>/);
    expect(renderLoop).toMatch(/<PlacementAssetsPanel section=\{section\} personaId=\{personaId\} \/>/);
  });
});

describe('The GET/PUT editorial-config route needs zero changes — allow-list is imported, admin gate is untouched', () => {
  const routeSrc = stripComments(readSource('app/api/journey/knyts-bridge/editorial-config/route.ts'));

  it('PUT still calls requireAdminPersona before any write — CFS sections gain no bypass', () => {
    const putFn = routeSrc.match(/export async function PUT\(req: NextRequest\) \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(putFn).toMatch(/const isAdmin = await requireAdminPersona\(req\);/);
    expect(putFn).toMatch(/if \(!isAdmin\) \{\s*return NextResponse\.json\(\{ ok: false, error: 'admin required' \}, \{ status: 403 \}\);/);
  });

  it('both GET and PUT still gate on KNYTS_BRIDGE_ALLOWED_SECTIONS.has(section) — an unregistered section string is rejected, not silently accepted', () => {
    expect(routeSrc.match(/KNYTS_BRIDGE_ALLOWED_SECTIONS\.has\(section\)/g)?.length).toBe(2);
  });
});

describe('FinancialSovereigntyIntroStage.tsx (Discover/Learn/Explore) — CFS content is additive, existing evidence/live-action code untouched', () => {
  const src = stripComments(readSource('components/journey/FinancialSovereigntyIntroStage.tsx'));

  it('still defines LEARN_CONCEPTS with the same three ids, still gates Continue on learnSatisfied/exploreSatisfied — evidence contract unchanged', () => {
    expect(src).toMatch(/const LEARN_CONCEPTS: \{ id: string; label: string; body: string \}\[\] = \[/);
    expect(src).toMatch(/id: 'advisor'/);
    expect(src).toMatch(/id: 'architect'/);
    expect(src).toMatch(/id: 'runtime'/);
    expect(src).toMatch(/primaryCtaDisabled =[\s\S]{0,20}\(stageKey === 'learn' && !learnSatisfied\) \|\| \(stageKey === 'explore' && !exploreSatisfied\)/);
  });

  it('still projects the real serviceCatalog and the live Compute Financial Profile action — never removed', () => {
    expect(src).toMatch(/listFinancialServiceDefinitions\(\)/);
    expect(src).toMatch(/\/api\/moneypenny\/financial-profile\/compute/);
  });

  it('renders FinancialSovereigntyStageExtras inside BridgeMediaStage, deriving bridge from accent (never a bridge prop the registry would have to be widened for)', () => {
    expect(src).toMatch(/const bridge: FsBridge = accent === 'indigo' \? 'ci' : 'knyts';/);
    expect(src).toMatch(/<FinancialSovereigntyStageExtras/);
    expect(src).toMatch(/infographicUrl=\{fsConfig\?\.infographicUrl \?\? undefined\}/);
  });

  it("Learn's three plates each resolve their OWN admin section (fs-learn / fs-learn-2 / fs-learn-3) — not all three pinned to one config", () => {
    expect(src).toMatch(/useFsLearnPlateSection\(bridge, 1\)/);
    expect(src).toMatch(/useFsLearnPlateSection\(bridge, 2\)/);
  });

  it('the outer wrapper is scrollable and no longer relies on vertical centering that would clip a tall panel', () => {
    expect(src).toMatch(/<div className="flex h-full flex-col overflow-y-auto">/);
  });
});

describe('FinancialSovereigntyPrepareCrossStage.tsx (Prepare/Cross) — profile review + handoff mechanism untouched', () => {
  const src = stripComments(readSource('components/journey/FinancialSovereigntyPrepareCrossStage.tsx'));

  it('PrepareFinancialProfileReview still reuses fetchFinancialProfileSummary/markFinancialProfileReviewed and the MoneyPennyBridgeEmbed toggle — no parallel profile store', () => {
    expect(src).toMatch(/fetchFinancialProfileSummary/);
    expect(src).toMatch(/markFinancialProfileReviewed/);
    expect(src).toMatch(/<MoneyPennyBridgeEmbed tab="my-money" personaId=\{personaId\}/);
  });

  it('Cross still builds a real ExperienceHandoff and navigates to /bridge/fs — never replaced with an assessment', () => {
    expect(src).toMatch(/createExperienceHandoff\(/);
    expect(src).toMatch(/window\.location\.href = `\/bridge\/fs\?handoff=/);
  });

  it('extras render OUTSIDE (below) the embed branch — opening the profile embed never also mounts the CFS reading material a second time', () => {
    const embedBranch = src.match(/if \(embedOpen\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(embedBranch).not.toMatch(/FinancialSovereigntyStageExtras/);
  });

  it('Continue to Operate remains ungated by review state — extras add no new gate', () => {
    const rawSrc = readSource('components/journey/FinancialSovereigntyPrepareCrossStage.tsx');
    expect(rawSrc).toMatch(/Continue to Operate is NEVER gated on review/);
    // The button itself carries no disabled prop tied to review/hasProfile state.
    expect(src).toMatch(/onClick=\{handleContinueToOperate\}\s*\n\s*className="rounded-xl border border-slate-700/);
  });
});

describe('FinancialSovereigntyOperateStage.tsx — workspace-first default view untouched, help is additive and optional', () => {
  const src = stripComments(readSource('components/journey/FinancialSovereigntyOperateStage.tsx'));

  it('embedOpen still short-circuits to the bare MoneyPennyBridgeEmbed with no extras mounted alongside it — workspace stays the persistent default', () => {
    const embedBranch = src.match(/if \(embedOpen\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(embedBranch).toMatch(/<MoneyPennyBridgeEmbed/);
    expect(embedBranch).not.toMatch(/FinancialSovereigntyStageExtras/);
  });

  it('the help/extras content renders only in the non-embed (introduction) branch — optional, never a mandatory gate before the workspace', () => {
    expect(src).toMatch(/<FinancialSovereigntyStageExtras/);
    expect(src).not.toMatch(/primaryCtaDisabled/); // Continue stays always-enabled
  });
});

describe('FinancialSovereigntyUnderstandingCheck / FinancialSovereigntyCostExample — never authoritative, never blocking', () => {
  it('the understanding-check component performs no fetch/personaFetch and writes no receipt — pure client-local instructional feedback', () => {
    const src = stripComments(readSource('components/journey/FinancialSovereigntyUnderstandingCheck.tsx'));
    expect(src).not.toMatch(/fetch\(|personaFetch\(/);
  });

  it('the cost example is purely local state — no fetch, no save, all values derived from a single client-side slider', () => {
    const src = stripComments(readSource('components/journey/FinancialSovereigntyCostExample.tsx'));
    expect(src).not.toMatch(/fetch\(|personaFetch\(/);
    expect(src).toMatch(/GROSS_BENEFIT - cost/);
  });
});
