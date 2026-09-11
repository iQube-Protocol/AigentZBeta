/**
 * Deep-link tab resolution — the 2026-07-28 regression.
 *
 * Operator: a Companion "View in your workspace" link carrying
 * `?tab=my-workspace` opened the metaMe cartridge's DEFAULT tab instead.
 *
 * ROOT CAUSE. `enabledTabs` resolves asynchronously — a tab may carry an
 * `activationId` (my-workspace requires `mycanvas`), an adminOnly gate, or a
 * persona-dependent condition, so the set grows over several renders. The
 * deep-link effect LATCHED its "already applied" ref when the requested slug
 * was not present, permanently abandoning the link; when the tab finally
 * appeared, the guard short-circuited and the fallback effect had already sent
 * the panel to `enabledTabs[0]`.
 *
 * This is the MS-4 shape ("a zero measurement is a teardown artifact, never a
 * layout value") applied to tab resolution: an absence observed before the
 * observation completed is not an absence.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildCodexUrl } from '@/utils/codex-nav';
import { METAME_CODEX } from '@/data/codex-configs';

const PANEL = readFileSync(join(process.cwd(), 'app', 'triad', 'components', 'CodexPanelDynamic.tsx'), 'utf8');

describe('a deep link is never abandoned because its tab has not resolved yet', () => {
  it('the deep-link effect latches ONLY after a successful apply', () => {
    const effect = /if \(!normalizedInitialTab\) return;[\s\S]*?\}, \[normalizedInitialTab, enabledTabs\]\);/.exec(PANEL)?.[0] ?? '';
    expect(effect, 'deep-link effect not found — the canary is anchored to a shape that moved').not.toBe('');

    // The miss branch must return WITHOUT writing the ref. Anything that
    // assigns the ref before `setActiveTabSlug` re-introduces the defect.
    const missBranch = /!enabledTabs\.some\(\(tab\) => tab\.slug === normalizedInitialTab\)\) \{([\s\S]*?)\n    \}/.exec(effect)?.[1] ?? '';
    expect(missBranch).toMatch(/return;/);
    expect(missBranch, 'the miss branch latches the ref — the deep link is abandoned').not.toMatch(
      /lastAppliedInitialTabRef\.current\s*=/,
    );

    // …and the success path must still latch, or the effect would re-apply the
    // requested tab over a later deliberate tab change by the operator.
    expect(effect).toMatch(/setActiveTabSlug\(normalizedInitialTab\);\s*\n\s*lastAppliedInitialTabRef\.current = normalizedInitialTab;/);
  });

  it('the workspace deep link the Companion builds names a slug the metaMe cartridge really has', () => {
    // Guards the other half of the failure: a correct effect cannot rescue a
    // link that names a slug no tab carries.
    const url = buildCodexUrl('metame', { tab: 'my-workspace', personaId: 'p-1', from: 'companion', fromTab: 'capture-inbox' });
    expect(url).toContain('tab=my-workspace');
    const slugs = METAME_CODEX.tabs.map((t) => t.slug);
    expect(slugs, "metaMe has no 'my-workspace' tab — the Companion link cannot resolve").toContain('my-workspace');
  });
});
