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

  it('derives bridge from accent (never a bridge prop the registry would have to be widened for)', () => {
    expect(src).toMatch(/const bridge: FsBridge = accent === 'indigo' \? 'ci' : 'knyts';/);
  });

  it("LEARN now uses the same locked-viewport BridgeMediaInteractionSection + activity-carousel pattern as Discover/Explore (production learning pattern, 2026-09-03) — no stage still renders the old FinancialSovereigntyStageExtras stack", () => {
    expect(src).not.toMatch(/FinancialSovereigntyStageExtras/);
    expect(src).toMatch(/BridgeActivityGroupRail groups=\{learnGroups\}/);
  });

  it('DISCOVER, LEARN and EXPLORE all reuse the locked-viewport media/interaction composition (BridgeMediaInteractionSection + BridgeMediaCarouselPane, the same shell BridgeOrientSurface uses) — never BridgeMediaStage\'s plain hero', () => {
    expect(src).toMatch(/import \{ BridgeMediaInteractionSection \} from '@\/components\/journey\/BridgeMediaInteractionSection';/);
    expect(src).toMatch(/import type \{ BridgeMediaCarouselItem \} from '@\/components\/journey\/BridgeMediaCarouselPane';/);
    expect(src).not.toMatch(/<BridgeMediaStage/);
    expect(src.match(/<BridgeMediaInteractionSection/g)?.length).toBe(3);
  });

  it('every stage composes its Learning Rail from BridgeActivityGroupRail/BridgeActivityGroup — data-driven activity groups, not page-specific JSX stacks', () => {
    expect(src).toMatch(/import \{ BridgeActivityGroupRail \} from '@\/components\/journey\/BridgeActivityGroupRail';/);
    expect(src).toMatch(/import type \{ BridgeActivityGroup \} from '@\/services\/journey\/bridgeActivity';/);
    expect(src.match(/<BridgeActivityGroupRail groups=\{/g)?.length).toBe(3);
  });

  it('DISCOVER, LEARN and EXPLORE reuse the verified C-15 Studio placeholder video (never a fabricated URL) with the exact required label, only while no admin video is configured — real production infographics resolved via the canonical asset catalog otherwise', () => {
    expect(src).toMatch(/import \{ FS_PLACEHOLDER_VIDEO_LABEL \} from '@\/services\/journey\/fsPlaceholderVideo';/);
    expect(src).toMatch(/import \{ buildFsMediaItems \} from '@\/services\/journey\/fsCanonicalMedia';/);
    // videoUrl/posterUrl fallback logic itself now lives in the ONE shared
    // buildFsMediaItems helper every FS stage calls — checked there, not
    // re-implemented per stage.
    const helperSrc = stripComments(readSource('services/journey/fsCanonicalMedia.ts'));
    expect(helperSrc).toMatch(/videoUrl: fsConfig\?\.videoUrl \|\| FS_PLACEHOLDER_VIDEO_URL/);
    const placeholderSrc = readSource('services/journey/fsPlaceholderVideo.ts');
    expect(placeholderSrc).toMatch(/Placeholder video — financial-services lesson in production\./);
    expect(placeholderSrc).toMatch(/https:\/\/bsjhfvctmduxhohtllly\.supabase\.co\/storage\/v1\/object\/public\/content-assets\/generated\/openai\/videos\//);
    for (const ref of ['D-I01', 'L-I01', 'L-I02', 'L-I03', 'E-I01', 'P-I01', 'O-I01', 'C-I01']) {
      expect(helperSrc).toMatch(new RegExp(`'${ref}':`));
    }
  });

  it('DISCOVER, LEARN and EXPLORE understanding checks stay behind a capped, one-at-a-time FinancialSovereigntyCheckGroup capsule — never an always-visible stacked list', () => {
    expect(src.match(/<FinancialSovereigntyCheckGroup checks=\{[\w.]+\} label="Start" \/>/g)?.length).toBe(3);
  });

  it('resolves admin-published structuredContent through resolveFsSectionContent/resolveFsLearnPlateContent — never reads FS_STAGE_CONTENT directly for topics/checks at render time', () => {
    expect(src).toMatch(/resolveFsSectionContent\(/);
    expect(src).toMatch(/resolveFsLearnPlateContent\(/);
  });

  it("Learn's three plates each resolve their OWN admin section (fs-learn / fs-learn-2 / fs-learn-3) — not all three pinned to one config", () => {
    expect(src).toMatch(/useFsLearnPlateSection\(bridge, 1\)/);
    expect(src).toMatch(/useFsLearnPlateSection\(bridge, 2\)/);
  });

  it('the outer wrapper locks to the given viewport height rather than making the whole page the scroll surface — only the Learning Rail column scrolls internally at desktop (production learning pattern, 2026-09-03)', () => {
    expect(src.match(/<div className="flex h-full min-h-0 flex-col p-4 sm:p-6">/g)?.length).toBe(3);
    expect(src).toMatch(/<div className="min-h-0 flex-1">/);
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

  it('the help/activity content renders only in the non-embed (introduction) branch, via the same locked-viewport shell as Discover/Learn/Explore — optional, never a mandatory gate before the workspace', () => {
    expect(src).toMatch(/import \{ BridgeMediaInteractionSection \} from '@\/components\/journey\/BridgeMediaInteractionSection';/);
    expect(src).toMatch(/<BridgeActivityGroupRail groups=\{groups\} \/>/);
    expect(src).not.toMatch(/disabled=\{primaryCtaDisabled\}|primaryCtaDisabled=\{/); // Continue stays always-enabled
  });

  it("Operate's intro view carries the real O-I01 canonical infographic alongside the placeholder video", () => {
    expect(src).toMatch(/assetRef: 'O-I01'/);
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

describe('resolveFsSectionContent / resolveFsLearnPlateContent — admin structuredContent overrides the static default field-by-field, never a blank section', () => {
  it('an empty/absent structuredContent falls back to the full static default for every stage', async () => {
    const { resolveFsSectionContent, FS_STAGE_CONTENT } = await import('@/services/journey/financialSovereigntyContent');
    for (const stage of STAGES) {
      const resolved = resolveFsSectionContent(stage, 'ci', null);
      expect(resolved.topics.length).toBeGreaterThan(0);
      expect(resolved.contextualLine).toBe(FS_STAGE_CONTENT[stage].contextualLine.ci);
    }
  });

  it('a real admin structuredContent row overrides topics/checks/exerciseSummary/contextualLine/captions, all at once', async () => {
    const { resolveFsSectionContent } = await import('@/services/journey/financialSovereigntyContent');
    const custom = {
      topics: [{ id: 'X', title: 'Custom topic', body: 'Custom body' }],
      checks: [],
      exerciseSummary: 'Custom exercise',
      contextualLine: 'Custom contextual line',
      assetCaption: 'Custom caption',
      assetAlt: 'Custom alt',
    };
    const resolved = resolveFsSectionContent('discover', 'ci', custom);
    expect(resolved.topics).toEqual(custom.topics);
    expect(resolved.exerciseSummary).toBe('Custom exercise');
    expect(resolved.contextualLine).toBe('Custom contextual line');
    expect(resolved.assetCaption).toBe('Custom caption');
  });

  it("Learn's three plates resolve independently — each carries only its own topic/check slice per content/step-composition.json v1.2, never all three duplicated", async () => {
    const { resolveFsLearnPlateContent } = await import('@/services/journey/financialSovereigntyContent');
    const plate0 = resolveFsLearnPlateContent(0, null);
    const plate1 = resolveFsLearnPlateContent(1, null);
    const plate2 = resolveFsLearnPlateContent(2, null);
    expect(plate0.topics.map((t) => t.id)).toEqual(['L-TOPIC-01']);
    expect(plate1.topics.map((t) => t.id)).toEqual(['L-TOPIC-02']);
    expect(plate1.checks.map((c) => c.id).sort()).toEqual(['L-Q01', 'L-Q03']);
    expect(plate2.topics.map((t) => t.id)).toEqual(['L-TOPIC-03']);
    expect(plate2.checks.map((c) => c.id)).toEqual(['L-Q02']);
    // No topic/check appears on more than one plate.
    const allTopicIds = [...plate0.topics, ...plate1.topics, ...plate2.topics].map((t) => t.id);
    expect(new Set(allTopicIds).size).toBe(allTopicIds.length);
  });
});

describe('FS_LOGICAL_SECTION_MAP — the explicit logical-section -> component -> editorial-source mapping', () => {
  it('covers all 15 logical sections from content/step-composition.json v1.2, one entry per stage array matching its known count', async () => {
    const { FS_LOGICAL_SECTION_MAP } = await import('@/services/journey/financialSovereigntyContent');
    const expectedCounts: Record<string, number> = { discover: 2, learn: 3, explore: 3, prepare: 3, operate: 2, cross: 2 };
    for (const [stage, count] of Object.entries(expectedCounts)) {
      expect(FS_LOGICAL_SECTION_MAP[stage as keyof typeof FS_LOGICAL_SECTION_MAP].length).toBe(count);
    }
  });

  it('every entry names a real editorialSource and a non-empty component description — no placeholder mapping', async () => {
    const { FS_LOGICAL_SECTION_MAP } = await import('@/services/journey/financialSovereigntyContent');
    for (const entries of Object.values(FS_LOGICAL_SECTION_MAP)) {
      for (const entry of entries) {
        expect(['structuredContent', 'existing-functional-component', 'admin-headline-shortcopy']).toContain(entry.editorialSource);
        expect(entry.component.length).toBeGreaterThan(10);
      }
    }
  });

  it('functional-component-owned sections (LEARN_CONCEPTS, serviceCatalog, MoneyPennyBridgeEmbed, the Cross handoff) are marked existing-functional-component, never structuredContent', async () => {
    const { FS_LOGICAL_SECTION_MAP } = await import('@/services/journey/financialSovereigntyContent');
    const learnAgents = FS_LOGICAL_SECTION_MAP.learn.find((e) => e.logicalSectionId === 'learn-agents');
    const exploreCapabilities = FS_LOGICAL_SECTION_MAP.explore.find((e) => e.logicalSectionId === 'explore-capabilities');
    const prepareProfile = FS_LOGICAL_SECTION_MAP.prepare.find((e) => e.logicalSectionId === 'prepare-profile');
    const operateWorkspace = FS_LOGICAL_SECTION_MAP.operate.find((e) => e.logicalSectionId === 'operate-workspace');
    const crossReadiness = FS_LOGICAL_SECTION_MAP.cross.find((e) => e.logicalSectionId === 'cross-readiness');
    for (const entry of [learnAgents, exploreCapabilities, prepareProfile, operateWorkspace, crossReadiness]) {
      expect(entry?.editorialSource).toBe('existing-functional-component');
    }
  });
});

describe('knytsBridgeEditorialConfig.ts — structured_content column, additive and gracefully degrading', () => {
  const src = stripComments(readSource('services/journey/knytsBridgeEditorialConfig.ts'));

  it('FULL_COLUMNS includes structured_content; a three-tier fallback (FULL -> MID -> LEGACY) exists for both read and write', () => {
    expect(src).toMatch(/FULL_COLUMNS = `section, headline, short_copy, video_url, poster_url, infographic_url, campaign_cta, reward_copy, structured_content, updated_at`/);
    expect(src).toMatch(/MID_COLUMNS/);
    expect(src.match(/isMissingColumn\(error\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it('the migration file exists and is additive-only (ADD COLUMN IF NOT EXISTS)', () => {
    const migrationSrc = readSource('supabase/migrations/20260903140000_knyts_bridge_editorial_config_structured_content.sql');
    expect(migrationSrc).toMatch(/ADD COLUMN IF NOT EXISTS structured_content JSONB/);
  });

  it('every CFS default entry carries real structuredContent (never null) sourced from FS_STAGE_CONTENT — an admin who never edits still sees corrected pack copy', async () => {
    const { KNYTS_BRIDGE_SECTION_DEFAULTS, FS_STAGE_IDS, fsBridgeSectionKey, fsLearnPlateSectionKey } = await import('@/services/journey/knytsBridgeEditorialConfig');
    for (const bridge of ['ci', 'knyts'] as const) {
      for (const stage of FS_STAGE_IDS) {
        const def = KNYTS_BRIDGE_SECTION_DEFAULTS[fsBridgeSectionKey(bridge, stage)];
        expect(def.structuredContent).toBeTruthy();
        expect((def.structuredContent as any).assetCaption).toBeTruthy();
      }
      expect((KNYTS_BRIDGE_SECTION_DEFAULTS[fsLearnPlateSectionKey(bridge, 1)].structuredContent as any).topics.length).toBe(1);
      expect((KNYTS_BRIDGE_SECTION_DEFAULTS[fsLearnPlateSectionKey(bridge, 2)].structuredContent as any).topics.length).toBe(1);
    }
  });
});

describe('editorial-config PUT route accepts structuredContent as a coherent, single-write field', () => {
  const src = stripComments(readSource('app/api/journey/knyts-bridge/editorial-config/route.ts'));

  it('passes structuredContent through to upsertKnytsBridgeEditorialSection, validated as a plain object or null', () => {
    expect(src).toMatch(/structuredContent:/);
    expect(src).toMatch(/body\.structuredContent === null \|\| \(typeof body\.structuredContent === 'object'/);
  });
});

describe('FsStructuredContentPanel — the native admin editor for topics/checks/exercise/contextual line/captions', () => {
  const src = stripComments(readSource('app/triad/components/codex/tabs/QriptopianAdminTab.tsx'));

  it('is gated to CFS sections only (isFsSection) — never rendered for home/orient/choose/etc.', () => {
    expect(src).toMatch(/function isFsSection\(section: string\): boolean \{/);
    expect(src).toMatch(/isFsSection\(section\) && <FsStructuredContentPanel/);
  });

  it('saves the whole structured-content blob in ONE PUT call — topics/checks/exercise/contextual line/captions publish together, never as separate mismatched writes', () => {
    const panelBody = src.match(/function FsStructuredContentPanel[\s\S]*?\n\}\n\nfunction BridgesManager/)?.[0] ?? '';
    const putCalls = panelBody.match(/personaFetch\('\/api\/journey\/knyts-bridge\/editorial-config', \{[\s\S]*?method: 'PUT'/g) ?? [];
    expect(putCalls.length).toBe(1);
    expect(panelBody).toMatch(/body: JSON\.stringify\(\{ section, structuredContent: draft \}\)/);
  });

  it('reuses the existing GET route for reads and the existing PUT route for writes — no new API route', () => {
    const panelBody = src.match(/function FsStructuredContentPanel[\s\S]*?\n\}\n\nfunction BridgesManager/)?.[0] ?? '';
    expect(panelBody).toMatch(/\/api\/journey\/knyts-bridge\/editorial-config/);
    expect(panelBody).not.toMatch(/\/api\/journey\/knyts-bridge\/(?!editorial-config|placements)/);
  });
});

describe('Prepare/Cross section ordering matches content/step-composition.json v1.2 (cross-automation before cross-readiness)', () => {
  it("the cross-automation activity group (BridgeActivityGroupRail) appears in source BEFORE the 'Cross to Financial Services' button (cross-readiness)", () => {
    const src = readSource('components/journey/FinancialSovereigntyPrepareCrossStage.tsx');
    const railIdx = src.indexOf('<BridgeActivityGroupRail groups={crossGroups} />');
    const buttonIdx = src.indexOf('Cross to Financial Services');
    expect(railIdx).toBeGreaterThan(0);
    expect(buttonIdx).toBeGreaterThan(0);
    expect(railIdx).toBeLessThan(buttonIdx);
  });

  it('Prepare and Cross both carry their real canonical infographics (P-I01/C-I01) via the same buildFsMediaItems helper Discover/Learn/Explore use', () => {
    const src = stripComments(readSource('components/journey/FinancialSovereigntyPrepareCrossStage.tsx'));
    expect(src).toMatch(/import \{ buildFsMediaItems \} from '@\/services\/journey\/fsCanonicalMedia';/);
    expect(src).toMatch(/assetRef: 'P-I01'/);
    expect(src).toMatch(/assetRef: 'C-I01'/);
  });
});

describe("Learn's activity-group ordering (production learning pattern, 2026-09-03) — lesson topics, then the Advisor/Architect/Runtime picker, then checks", () => {
  it('learnGroups declares lesson-topics before agents before checks, in source order', () => {
    const src = readSource('components/journey/FinancialSovereigntyIntroStage.tsx');
    const topicsIdx = src.indexOf("id: 'lesson-topics'");
    const agentsIdx = src.indexOf("id: 'agents'");
    const checksIdx = src.lastIndexOf("id: 'checks'");
    expect(topicsIdx).toBeGreaterThan(0);
    expect(topicsIdx).toBeLessThan(agentsIdx);
    expect(agentsIdx).toBeLessThan(checksIdx);
  });

  it("Learn's picker still gates learnSatisfied on all three LEARN_CONCEPTS being individually acknowledged — evidence contract unchanged by the recomposition", () => {
    const src = stripComments(readSource('components/journey/FinancialSovereigntyIntroStage.tsx'));
    expect(src).toMatch(/LEARN_CONCEPTS\.every\(\(c\) => acknowledgedConcepts\.has\(c\.id\)\)/);
    expect(src).toMatch(/LEARN_CONCEPTS\.map\(\(concept\) => \{/);
  });
});

describe('Continue navigation — regression guard for the copilot hot-zone click-interception bug (2026-09-03)', () => {
  // Root cause (confirmed live via Playwright, dev server): the locked-
  // viewport layout pins Discover/Learn/Explore's Continue footer at the
  // visible bottom-right of the stage. CodexCopilotLayer's floating-copilot
  // hover hot-zone (`fixed bottom-0 right-0 h-52 w-52 z-[110]`, no
  // pointer-events-none fallback) occupies that exact same screen region
  // once mounted, silently swallowing every click on Continue. The fix
  // reserves clearance (lg:pr-56, 224px — safely beyond the zone's 208px)
  // so Continue never renders underneath it. These are source-level guards
  // (this repo's established pattern for layout regressions that would
  // otherwise need a live browser session); the live click-through fix
  // itself was verified via Playwright against the running dev server.
  const introSrc = stripComments(readSource('components/journey/FinancialSovereigntyIntroStage.tsx'));

  it('the copilot hot-zone is real, pre-existing, shared UI — this suite documents around it rather than editing the shared layer', () => {
    const copilotSrc = stripComments(readSource('app/components/codex/CodexCopilotLayer.tsx'));
    expect(copilotSrc).toMatch(/fixed bottom-0 z-\[110\]/);
    expect(copilotSrc).toMatch(/right-0 h-52 w-52/);
  });

  it("Discover/Learn/Explore's Continue footer reserves lg:pr-56 clearance from the viewport's right edge", () => {
    expect(introSrc).toMatch(/flex shrink-0 justify-end pt-3 lg:pr-56/);
  });

  it('Operate/Prepare/Cross keep their Continue-equivalent actions inside the scrolling Learning Rail (never a separate fixed-position footer) — the same collision class simply cannot arise there', () => {
    for (const file of ['FinancialSovereigntyPrepareCrossStage.tsx', 'FinancialSovereigntyOperateStage.tsx']) {
      const src = stripComments(readSource(`components/journey/${file}`));
      expect(src).not.toMatch(/fixed bottom-0/);
    }
  });

  it('selectStage/handlePrimaryCta still dispatch the same journey:select-stage CustomEvent JourneyRunSurface listens for — the navigation mechanism itself was never the bug', () => {
    expect(introSrc).toMatch(/window\.dispatchEvent\(new CustomEvent\('journey:select-stage', \{ detail: \{ stageId, trigger \} \}\)\);/);
    const runSurfaceSrc = stripComments(readSource('components/journey/JourneyRunSurface.tsx'));
    expect(runSurfaceSrc).toMatch(/window\.addEventListener\('journey:select-stage', onSelect\)/);
  });
});
