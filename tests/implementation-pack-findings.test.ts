/**
 * Session-findings bridge canary (workflow-gap fix, 2026-07-13).
 *
 * The gap: the DCC dev-loop's Context Pack / Gap Analysis / Consequence Canvas
 * stages inventoried what exists vs what's needed, but pack generation
 * received only a goal string — the inventory died in the session and the pack
 * shipped "areas to touch: not drafted" while the Canvas literally warned
 * against duplicate capabilities. These tests pin the bridge's PURE half:
 * findings fold into the draft prompt with the anti-duplication mandate, and
 * areasToTouch seeds deterministically from SESSION-NAMED paths only.
 */

import { describe, it, expect } from 'vitest';
import {
  sessionFindingsBlock,
  areasFromFindings,
  type SessionFindings,
} from '@/services/constitutional/implementationPack';

const findings: SessionFindings = {
  existing: [
    { name: 'Video Generation — Venice', path: 'registry_assets/agentiq-native-video-venice', disposition: 'use_directly' },
    { name: 'Article / Story Generation', path: 'registry_assets/agentiq-native-article-generation', disposition: 'use_directly' },
    { name: 'Video + Article Bundle', path: 'registry_assets/agentiq-native-video-article-bundle', disposition: 'extend' },
  ],
  missing: [
    { name: 'Automated Content Alignment', path: 'services/content/alignmentService.ts', complexity: 'medium', dependencies: ['Video Generation — Venice', 'Article / Story Generation'] },
    { name: 'Rendering Optimization', path: 'services/rendering/optimization.ts', complexity: 'small' },
  ],
  contextAssets: [{ title: 'AgentiQ and metaMe Cartridges', path: 'data/codex-configs.ts', signal: 'reuse' }],
  reusePercent: 60,
  boundaries: ['Creation of duplicate capabilities leading to redundancy', 'Violations of identity and access protocols'],
};

describe('sessionFindingsBlock — the inventory reaches the drafter', () => {
  it('folds existing, missing, assets, reuse ratio, and boundaries into the prompt', () => {
    const block = sessionFindingsBlock(findings).join('\n');
    expect(block).toContain('60% reuse');
    expect(block).toContain('never duplicate an existing capability');
    expect(block).toContain('Article / Story Generation');
    expect(block).toContain('[use_directly]');
    expect(block).toContain('services/content/alignmentService.ts');
    expect(block).toContain('deps: Video Generation — Venice');
    expect(block).toContain('data/codex-configs.ts');
    expect(block).toContain('Creation of duplicate capabilities');
    expect(block).toContain('areasToTouch MUST be drawn from these paths');
  });

  it('no findings → no block (packs without a session are unchanged)', () => {
    expect(sessionFindingsBlock(undefined)).toEqual([]);
    expect(sessionFindingsBlock({})).toEqual([]);
  });
});

describe('areasFromFindings — deterministic, session-named paths only', () => {
  it('seeds from extend/wrap/adapt targets + missing locations; use_directly assets are composed, not touched', () => {
    expect(areasFromFindings(findings)).toEqual([
      'registry_assets/agentiq-native-video-article-bundle',
      'services/content/alignmentService.ts',
      'services/rendering/optimization.ts',
    ]);
  });

  it('empty findings seed nothing (never invented)', () => {
    expect(areasFromFindings(undefined)).toEqual([]);
    expect(areasFromFindings({ existing: [{ name: 'x', path: 'p', disposition: 'use_directly' }] })).toEqual([]);
  });
});
