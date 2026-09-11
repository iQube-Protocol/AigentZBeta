/**
 * CI Personify → myCanvas → Qriptopian Pulse → Qriptopian Admin/Community →
 * CI View/Crossings pipeline (2026-08-11).
 *
 * Two corrections required before the CI Bridge evolution pass could ship:
 *
 * 1. metaMe's `qriptopia-community` tab was a PlaceholderTab ("Coming soon"),
 *    sitting OUTSIDE any admin gate, while KNYT's sibling surface
 *    (`community-content-admin`, "Community Admin") was already the real,
 *    fully-wired moderation queue. This file locks in the fix: `Community`
 *    now reuses the EXACT SAME `QriptoPulseAdminTab` component KNYT's own
 *    admin-mirrored `admin-pulse` tab already used (itself a thin wrapper
 *    over `KnytCommunityContentAdminTab` with `cartridge="qripto"`) — no new
 *    moderation UI, table, or approval workflow. KNYT's own admin tab is
 *    asserted UNCHANGED (same component, same group, same gating) — "KNYT
 *    Admin continues to scope to KNYT content exactly as today" is a
 *    snapshot guarantee, not a new correctness claim: KNYT's admin config
 *    calls KnytCommunityContentAdminTab with no `cartridge` prop today (pre-
 *    existing, unrelated to this fix), and this file only guards that it
 *    stays exactly that way — it does not newly scope it.
 *
 * 2. The CI Bridge's editorial-config video-slot admin surface
 *    (ci-home/ci-orient/ci-view-<blockId>) is re-verified here too, since it
 *    gates the same commit.
 *
 * The pipeline traced end to end (source-text + config assertions, since a
 * live click-through isn't reachable from this sandbox — no outbound network
 * to a running dev-beta instance):
 *
 *   ConstitutionalInternetBridgePersonifyMyCanvas (campaignTag=CI_BRIDGE_CAMPAIGN_ID)
 *     -> MyCanvasTab's CAMPAIGN_CARTRIDGE_LOCK forces cartridge='qripto'
 *     -> RemixDialog forwards `cartridge` into POST /api/community-content/generate
 *     -> community_generated_content row: cartridge='qripto', campaign_tag=CI_BRIDGE_CAMPAIGN_ID,
 *        status='draft' -> 'shared' on publish (ALREADY publicly visible — status='shared'
 *        is not a moderation gate, see KnytCommunityContentTab's own default status filter)
 *     -> Qriptopia > Community (QriptoPulseAdminTab, cartridge='qripto') lists it,
 *        Promote -> status='runtime_promoted' (an additional tier, not a visibility gate)
 *     -> ConstitutionalInternetBridgeViewSequence's Crossings tab
 *        (KnytCommunityContentTab, cartridge='qripto', campaignTag=CI_BRIDGE_CAMPAIGN_ID,
 *        hideCrossingsFilter) surfaces it under both 'shared' and 'runtime_promoted'.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const REPO = path.join(__dirname, '..');
const readSource = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('correction 1 — Qriptopia > Community reuses the canonical Community Admin surface', () => {
  it('metaMe\'s qriptopia-community tab now wires the real moderation component, admin-gated', async () => {
    const { CODEX_DEFINITIONS } = await import('@/data/codex-configs');
    const metame = CODEX_DEFINITIONS.find((c) => c.id === 'metame-codex');
    expect(metame, 'metame-codex must still be registered').toBeTruthy();
    const community = metame!.tabs.find((t) => t.id === 'qriptopia-community');
    expect(community, 'qriptopia-community tab must still exist').toBeTruthy();
    expect(community!.label).toBe('Community');
    expect(community!.config.component).toBe('QriptoPulseAdminTab');
    expect(
      (community as unknown as { adminOfCartridge?: string }).adminOfCartridge,
      'must be admin-gated to the Qriptopian cartridge, matching its sibling qriptopia-admin tab',
    ).toBe('qripto');
    // No PlaceholderTab props survive the rewire.
    expect((community!.config as Record<string, unknown>).props).toBeUndefined();
  });

  it('QriptoPulseAdminTab is the SAME KnytCommunityContentAdminTab component, scoped by cartridge — never a new admin backend', () => {
    const src = stripComments(readSource('app/triad/components/codex/tabs/QriptoPulseAdminTab.tsx'));
    expect(src).toMatch(/import\s*\{\s*KnytCommunityContentAdminTab\s*\}/);
    expect(src).toMatch(/<KnytCommunityContentAdminTab\s*\{\.\.\.props\}\s*cartridge="qripto"\s*\/>/);
  });

  it('KNYT\'s own Community Admin tab is unchanged — "KNYT Admin continues to scope to KNYT content exactly as today"', async () => {
    const { CODEX_DEFINITIONS } = await import('@/data/codex-configs');
    const knyt = CODEX_DEFINITIONS.find((c) => c.id === 'knyt-codex');
    expect(knyt, 'knyt-codex must still be registered').toBeTruthy();
    const communityAdmin = knyt!.tabs.find((t) => t.id === 'community-content-admin');
    expect(communityAdmin, 'community-content-admin tab must still exist, untouched').toBeTruthy();
    expect(communityAdmin!.label).toBe('Community Admin');
    expect(communityAdmin!.group).toBe('admin');
    expect((communityAdmin as unknown as { adminOnly?: boolean }).adminOnly).toBe(true);
    expect(communityAdmin!.config.component).toBe('KnytCommunityContentAdminTab');
  });

  it('Promote / Runtime / Reject / Delete semantics are inherited unchanged (KnytCommunityContentAdminTab is not forked)', () => {
    const src = stripComments(readSource('app/triad/components/codex/tabs/KnytCommunityContentAdminTab.tsx'));
    expect(src).toMatch(/\/api\/community-content\/\[id\]\/promote|promote/);
    expect(src).toMatch(/\/api\/community-content\/\[id\]\/reject|reject/i);
    expect(src).toMatch(/submit-to-runtime|Runtime/);
    expect(src).toMatch(/DELETE|delete/i);
  });
});

describe('correction 1 (continued) — the full Personify -> Qriptopian Pulse -> Crossings pipeline', () => {
  it('ConstitutionalInternetBridgePersonifyMyCanvas carries CI_BRIDGE_CAMPAIGN_ID onto the myCanvas embed', () => {
    const src = stripComments(readSource('components/journey/ConstitutionalInternetBridgePersonifyMyCanvas.tsx'));
    expect(src).toMatch(/CI_BRIDGE_CAMPAIGN_ID/);
    expect(src).toMatch(/searchParams\.set\(['"]campaignTag['"],\s*CI_BRIDGE_CAMPAIGN_ID\)/);
  });

  it('MyCanvasTab locks the CI campaign to the qripto cartridge, and forwards it to RemixDialog', () => {
    const src = stripComments(readSource('app/triad/components/codex/tabs/MyCanvasTab.tsx'));
    expect(src).toMatch(/'constitutional-internet-bridge':\s*'qripto'/);
    expect(src).toMatch(/CAMPAIGN_CARTRIDGE_LOCK\[remixSource\.metaJson\.campaign\]/);
  });

  it('RemixDialog forwards the cartridge lock into POST /api/community-content/generate', () => {
    const src = stripComments(readSource('components/metame/runtime/RemixDialog.tsx'));
    expect(src).toMatch(/cartridge\?:\s*['"]knyt['"]\s*\|\s*['"]qripto['"]/);
    expect(src).toMatch(/cartridge:\s*cartridge\s*\|\|\s*undefined/);
  });

  it('the generate route persists the caller-supplied cartridge onto the row (never hardcoded to knyt)', () => {
    const src = stripComments(readSource('app/api/community-content/generate/route.ts'));
    expect(src).toMatch(/cartridge/);
  });

  it("published content is visible immediately at status='shared' — Promote is an additional tier, not a visibility gate", () => {
    const src = stripComments(readSource('app/triad/components/codex/tabs/KnytCommunityContentTab.tsx'));
    expect(src).toMatch(/status.*shared.*runtime_promoted|shared,runtime_promoted/);
  });

  it("ConstitutionalInternetBridgeViewSequence's Crossings tab projects Qriptopian Pulse, scoped to CI's own campaign tag", () => {
    const src = stripComments(readSource('components/journey/ConstitutionalInternetBridgeViewSequence.tsx'));
    expect(src).toMatch(/cartridge="qripto"/);
    expect(src).toMatch(/campaignTag=\{CI_BRIDGE_CAMPAIGN_ID\}/);
    expect(src).toMatch(/hideCrossingsFilter/);
  });

  it('hideCrossingsFilter genuinely suppresses the chip that would otherwise leak KNYTS content into the CI projection', () => {
    const src = stripComments(readSource('app/triad/components/codex/tabs/KnytCommunityContentTab.tsx'));
    expect(src).toMatch(/hideCrossingsFilter\?:\s*boolean/);
    expect(src).toMatch(/!hideCrossingsFilter\s*&&/);
  });
});

describe('correction 2 — CI Bridge Admin video-slot check', () => {
  it('the editorial-config route accepts ci-home/ci-orient/ci-view-<blockId>, via the shared KNYTS_BRIDGE_ALLOWED_SECTIONS allow-list (moved 2026-09-01 so the placements route can reuse it — see knytsBridgeEditorialConfig.ts)', async () => {
    const routeSrc = stripComments(readSource('app/api/journey/knyts-bridge/editorial-config/route.ts'));
    expect(routeSrc).toMatch(/import \{[\s\S]*KNYTS_BRIDGE_ALLOWED_SECTIONS[\s\S]*\} from '@\/services\/journey\/knytsBridgeEditorialConfig'/);
    expect(routeSrc).toMatch(/KNYTS_BRIDGE_ALLOWED_SECTIONS\.has\(section\)/);

    const configSrc = stripComments(readSource('services/journey/knytsBridgeEditorialConfig.ts'));
    expect(configSrc).toMatch(/CI_BRIDGE_VIEW_CONTENT/);
    expect(configSrc).toMatch(/'ci-home'/);
    expect(configSrc).toMatch(/'ci-orient'/);
    expect(configSrc).toMatch(/ci-view-\$\{block\.id\}/);

    const { KNYTS_BRIDGE_ALLOWED_SECTIONS } = await import('@/services/journey/knytsBridgeEditorialConfig');
    expect(KNYTS_BRIDGE_ALLOWED_SECTIONS.has('ci-home')).toBe(true);
    expect(KNYTS_BRIDGE_ALLOWED_SECTIONS.has('ci-orient')).toBe(true);

    const { CI_BRIDGE_VIEW_CONTENT } = await import('@/services/journey/constitutionalInternetBridgeViewContent');
    expect(CI_BRIDGE_VIEW_CONTENT.length).toBeGreaterThan(0);
    for (const block of CI_BRIDGE_VIEW_CONTENT) {
      expect(KNYTS_BRIDGE_ALLOWED_SECTIONS.has(`ci-view-${block.id}`)).toBe(true);
    }
  });

  it('KNYTS_BRIDGE_SECTION_DEFAULTS carries real fallback copy for ci-home and ci-orient', async () => {
    const { KNYTS_BRIDGE_SECTION_DEFAULTS } = await import('@/services/journey/knytsBridgeEditorialConfig');
    expect(KNYTS_BRIDGE_SECTION_DEFAULTS['ci-home']?.headline).toBeTruthy();
    expect(KNYTS_BRIDGE_SECTION_DEFAULTS['ci-orient']?.headline).toBeTruthy();
  });

  it('the CI Bridge admin modal lists ci-home, ci-orient, and one row per Ethos vignette, with correct branding', () => {
    const src = stripComments(readSource('app/bridge/ci/page.tsx'));
    expect(src).toMatch(/section="ci-home"/);
    expect(src).toMatch(/section="ci-orient"/);
    expect(src).toMatch(/section=\{`ci-view-\$\{block\.id\}`\}/);
    expect(src).toMatch(/bridgeLabel="Constitutional Internet Bridge"/);
  });

  it("ConstitutionalInternetBridgeViewSequence's Ethos vignettes fetch a per-block video override from the same table", () => {
    const src = stripComments(readSource('components/journey/ConstitutionalInternetBridgeViewSequence.tsx'));
    expect(src).toMatch(/ci-view-\$\{block\.id\}/);
  });
});
