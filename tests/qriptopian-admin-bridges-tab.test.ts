/**
 * Native Bridges tab under Qriptopian Admin (QRP-BRIDGE-ADMIN A0/A1 first
 * slice, 2026-09-01). Migrates the existing page-local CI/KNYTS bridge-admin
 * modals (app/bridge/ci/page.tsx, app/bridge/knyts/page.tsx) into a native
 * cartridge sub-view, reusing KnytsBridgeAdminPanel and the existing
 * knyts_bridge_editorial_config table/route completely unchanged.
 *
 * Source-level structural proof — this repo's established pattern for UI
 * wiring that would otherwise need a live browser (see
 * financial-sovereignty-crossing-chain.test.ts, fs-cross-wallet-conversion-
 * capability.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { CI_BRIDGE_VIEW_CONTENT } from '@/services/journey/constitutionalInternetBridgeViewContent';

const TAB_SRC = 'app/triad/components/codex/tabs/QriptopianAdminTab.tsx';

describe('QriptopianAdminTab gains a native Bridges sub-view — no new admin app', () => {
  const src = stripComments(readSource(TAB_SRC));

  it('reuses the EXISTING KnytsBridgeAdminPanel — never a forked/second editor component', () => {
    expect(src).toMatch(/import \{ KnytsBridgeAdminPanel \} from '@\/components\/journey\/KnytsBridgeAdminPanel'/);
  });

  it('reuses the EXISTING CI_BRIDGE_VIEW_CONTENT registry — never a hand-copied block list', () => {
    expect(src).toMatch(/import \{ CI_BRIDGE_VIEW_CONTENT \} from '@\/services\/journey\/constitutionalInternetBridgeViewContent'/);
  });

  it('registers exactly one new AdminView variant and dashboard entry for bridges', () => {
    expect(src).toMatch(/\|\s*\{\s*kind:\s*'bridges'\s*\}/);
    const dashboardEntries = src.match(/key:\s*'bridges'/g) ?? [];
    expect(dashboardEntries.length).toBe(1);
  });

  it('handleNavigate, breadcrumb, and the render switch all cover the bridges view', () => {
    expect(src).toMatch(/key === 'bridges'\)\s*\{\s*setView\(\{ kind: 'bridges' \}\)/);
    expect(src).toMatch(/view\.kind === 'bridges' \? 'Bridges'/);
    expect(src).toMatch(/view\.kind === 'bridges' && <BridgesManager personaId=\{personaId\} \/>/);
  });

  it('never introduces a new editorial-config table, route, or upsert function', () => {
    expect(src).not.toMatch(/CREATE TABLE|supabase\.from\(['"`](?!.*knyts)/i);
    expect(src).not.toMatch(/upsertKnytsBridgeEditorialSection|getKnytsBridgeEditorialSection/);
    // BridgesManager delegates entirely to KnytsBridgeAdminPanel's own fetch/PUT — it performs no I/O itself.
    const managerBody = src.match(/function BridgesManager[\s\S]*?\n\}/)?.[0] ?? '';
    expect(managerBody).not.toMatch(/fetch\(|personaFetch\(/);
  });
});

describe('bridge section lists exactly mirror the existing page-local modals — a rehost, not a reimplementation', () => {
  const src = stripComments(readSource(TAB_SRC));
  const ciPageSrc = stripComments(readSource('app/bridge/ci/page.tsx'));
  const knytsPageSrc = stripComments(readSource('app/bridge/knyts/page.tsx'));

  it("KNYTS section list is exactly ['home', 'orient', 'choose'] — same three sections the existing knyts/page.tsx modal mounts", () => {
    expect(src).toMatch(/return \['home', 'orient', 'choose'\]/);
    for (const section of ['home', 'orient', 'choose']) {
      expect(knytsPageSrc).toMatch(new RegExp(`section="${section}"`));
    }
  });

  it("CI section list starts with the same three fixed sections the existing ci/page.tsx modal mounts", () => {
    expect(src).toMatch(/'ci-home', 'ci-orient', 'ci-passport-established'/);
    for (const section of ['ci-home', 'ci-orient', 'ci-passport-established']) {
      expect(ciPageSrc).toMatch(new RegExp(`section="${section}"`));
    }
  });

  it('CI section list appends one ci-view-<id> per CI_BRIDGE_VIEW_CONTENT block, same as the existing modal', () => {
    expect(src).toMatch(/CI_BRIDGE_VIEW_CONTENT\.map\(\(b\) => `ci-view-\$\{b\.id\}`\)/);
    expect(CI_BRIDGE_VIEW_CONTENT.length).toBeGreaterThan(0);
    for (const block of CI_BRIDGE_VIEW_CONTENT) {
      expect(ciPageSrc).toMatch(new RegExp(`section=\\{\`ci-view-\\$\\{block\\.id\\}\`\\}`));
    }
  });

  it('bridgeLabel matches the existing modals\' labels exactly for both bridges', () => {
    expect(src).toMatch(/ci:\s*'Constitutional Internet Bridge'/);
    expect(src).toMatch(/knyts:\s*'KNYTS Bridge'/);
    expect(ciPageSrc).toMatch(/bridgeLabel="Constitutional Internet Bridge"/);
    expect(knytsPageSrc).not.toMatch(/bridgeLabel=/); // KNYTS modal omits it, relying on the component's own 'KNYTS Bridge' default — same as this tab's default path
  });
});

describe('personaId threads through unchanged — no new identity resolution path', () => {
  const src = stripComments(readSource(TAB_SRC));

  it('BridgesManager receives personaId from the already-accepted QriptopianAdminTab prop, never a new resolver', () => {
    expect(src).toMatch(/export function QriptopianAdminTab\(\{ isAdmin, theme, personaId \}: Props\)/);
    expect(src).toMatch(/<BridgesManager personaId=\{personaId\} \/>/);
    expect(src).not.toMatch(/getActivePersona|useActivePersona/); // this file never resolves identity itself — KnytsBridgeAdminPanel/its route do that, unchanged
  });
});
