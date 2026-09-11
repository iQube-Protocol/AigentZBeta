/**
 * Capability-artefact home canaries (operator ruling 2026-07-27:
 * *"The natural home for these would be the registries tabs for AgentiQ and
 * AgentiQ OS — AgentiQ should be the home and AgentiQ OS a mirror"*).
 *
 * THE DEFECT THIS CLOSES. Constitutional Capability Briefs existed only as
 * dated entries in the AgentiQ Updates collection — 300+ items with nothing
 * distinguishing a Brief from a deploy note — and mySoftware, the surface that
 * should have been their front door, rendered a repo-relative `briefUrl` as
 * dead grey monospace. The operator could see a brief existed and had no way
 * to open it.
 *
 * What these assert:
 *  1. THE HOME EXISTS, in the Registry group of the AgentiQ cartridge, and the
 *     AgentiQ OS tab is a MIRROR — same pack, same collection, same component.
 *     A mirror is a second ENTRANCE, never a second copy (inv.engineering.037).
 *  2. THE COLLECTION IS REAL — every path it names is a file that exists, and
 *     every registered capability with a repo-relative brief is reachable.
 *  3. mySOFTWARE LINKS, and links through `buildCodexUrl` (cross-cartridge
 *     identity propagation), never a hand-built embed URL.
 *  4. NO ICON IS INERT. Every `metadata.icon` in the codex config resolves in
 *     the icon map. 56 names did not on 2026-07-27 — more than half the
 *     platform's tab icons silently rendered a blank `Circle`. That is MS-7
 *     (an inert mechanism is a defect even though nothing errors) at platform
 *     scale, and it is exactly the class of thing only a canary catches.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { getIconComponent } from '../app/triad/components/codex/iconMap';

const COLLECTION_ID = 'col_capabilities';
const PACK_DIR = 'codexes/packs/agentiq';

describe('the capability artefacts have a home', () => {
  it('AgentiQ carries the home tab in its Registry group', async () => {
    const { AGENTIQ_CARTRIDGE } = await import('../data/codex-configs');
    const tab = AGENTIQ_CARTRIDGE.tabs.find((t: { id: string }) => t.id === 'capability-briefs');
    expect(tab, 'no capability home on the AgentiQ cartridge').toBeTruthy();
    expect(tab!.group, 'the home is not in the Registry group').toBe('registry');
    expect(tab!.enabled).toBe(true);
    expect(tab!.config.component).toBe('AgentiqCartridgeTab');
    expect(tab!.config.props?.collectionId).toBe(COLLECTION_ID);
  });

  it('AgentiQ OS mirrors it — a second entrance, not a second copy', async () => {
    const { AGENTIQ_CARTRIDGE, AGENTIQ_OS_CARTRIDGE } = await import('../data/codex-configs');
    const home = AGENTIQ_CARTRIDGE.tabs.find((t: { id: string }) => t.id === 'capability-briefs');
    const mirror = AGENTIQ_OS_CARTRIDGE.tabs.find(
      (t: { id: string }) => t.id === 'agentiq-os-capability-briefs',
    );
    expect(mirror, 'no mirror on AgentiQ OS').toBeTruthy();
    expect(mirror!.group).toBe('registry');
    // Same source, same renderer. A mirror that pointed at its own collection
    // would be the duplicate-content defect the ruling explicitly avoids.
    expect(mirror!.config.component).toBe(home!.config.component);
    expect(mirror!.config.props?.packId).toBe(home!.config.props?.packId);
    expect(mirror!.config.props?.collectionId).toBe(home!.config.props?.collectionId);
    // Distinct slugs, or one shadows the other in deep links.
    expect(mirror!.slug).not.toBe(home!.slug);
  });

  it('every document the collection names exists on disk', async () => {
    const collections = JSON.parse(readSource(`${PACK_DIR}/collections.json`)) as {
      collections: Array<{ id: string; items: string[] }>;
    };
    const col = collections.collections.find((c) => c.id === COLLECTION_ID);
    expect(col, `${COLLECTION_ID} is not registered in the pack`).toBeTruthy();
    expect(col!.items.length, 'the capability collection is empty').toBeGreaterThan(0);
    for (const item of col!.items) {
      expect(existsSync(join(PACK_DIR, item)), `${item} is listed but does not exist`).toBe(true);
    }
  });

  it('every registered capability with a repo-relative brief is in the collection', () => {
    // Otherwise a capability shows "Read the brief" in mySoftware and lands on
    // a Capabilities tab that does not list it.
    const script = stripComments(readSource('scripts/register-ccb-capabilities.ts'));
    const briefs = Array.from(script.matchAll(/briefUrl:\s*"([^"]+)"/g)).map((m) => m[1]);
    expect(briefs.length, 'no briefUrl in the registration script').toBeGreaterThan(0);

    const collections = JSON.parse(readSource(`${PACK_DIR}/collections.json`)) as {
      collections: Array<{ id: string; items: string[] }>;
    };
    const items = new Set(
      (collections.collections.find((c) => c.id === COLLECTION_ID)?.items ?? []).map(
        (i) => `${PACK_DIR}/${i}`,
      ),
    );
    for (const brief of briefs) {
      if (brief.startsWith('http')) continue;
      expect(items.has(brief), `${brief} is registered but absent from the Capabilities collection`).toBe(true);
    }
  });

  it('the CCR-001 reference artifact is registered', () => {
    // It had a Brief from the day it was written and no registry row.
    const script = stripComments(readSource('scripts/register-ccb-capabilities.ts'));
    expect(script).toContain('companion-menu-system');
  });
});

describe('mySoftware opens the brief instead of naming a file', () => {
  it('links a repo-relative briefUrl through buildCodexUrl', () => {
    const src = stripComments(readSource('app/triad/components/codex/tabs/MySoftwareTab.tsx'));
    expect(src, 'MySoftwareTab does not use the canonical nav helper').toMatch(/buildCodexUrl\(/);
    expect(src).toMatch(/tab: "capabilities"/);
    // The dead-end render is gone: a briefUrl must never come back as a bare
    // filename in a <span>.
    expect(
      /<span[^>]*>\s*\{cap\.briefUrl\.split\("\/"\)\.pop\(\)\}/.test(src),
      'a repo-relative briefUrl still renders as unopenable text',
    ).toBe(false);
    // Cross-cartridge links must carry identity (the canonical rule).
    expect(src).toMatch(/personaId,/);
  });
});

describe('no tab icon is inert', () => {
  it('every metadata.icon in the codex config resolves to a real icon', () => {
    // getIconComponent falls back to `Circle`, so an unregistered name renders
    // a blank dot with no error anywhere. This is the only thing that catches
    // it. Compares against the map by identity, not by name.
    const src = readSource('data/codex-configs.ts');
    const used = Array.from(new Set(Array.from(src.matchAll(/icon: '([^']+)'/g)).map((m) => m[1])));
    expect(used.length, 'found no icons — the canary would pass vacuously').toBeGreaterThan(20);

    const fallback = getIconComponent(undefined);
    const inert = used.filter((name) => getIconComponent(name) === fallback);
    expect(
      inert,
      `these icons fall through to the blank fallback — register them in iconMap.ts:\n${inert.join(', ')}`,
    ).toEqual([]);
  });
});
