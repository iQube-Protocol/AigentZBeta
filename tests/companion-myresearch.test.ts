/**
 * MMC Flow — myResearch tab canary (PRD-MMC-IMPL-006).
 *
 * Locks the composition-not-duplication guarantee: myResearch is a read-only
 * mirror of the EXISTING, already persona-gated `/api/research/overview`
 * route — it must never introduce a new backend route, never POST/write,
 * and never reach into `services/research/*` internals directly. Also pins
 * the tab-registration shape against the sibling myCluster tabs.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const TAB_PATH = join(process.cwd(), 'app', 'triad', 'components', 'codex', 'tabs', 'MyResearchTab.tsx');
const tabSource = readFileSync(TAB_PATH, 'utf8');

const CONFIG_PATH = join(process.cwd(), 'data', 'codex-configs.ts');
const configSource = readFileSync(CONFIG_PATH, 'utf8');

const RENDERER_PATH = join(process.cwd(), 'app', 'triad', 'components', 'codex', 'TabRenderer.tsx');
const rendererSource = readFileSync(RENDERER_PATH, 'utf8');

describe('MyResearchTab — composition + read-only canary', () => {
  it('only calls the existing /api/research/overview route -- no new backend', () => {
    const fetchTargets = [...tabSource.matchAll(/personaFetch\(\s*"([^"]+)"/g)].map((m) => m[1].split('?')[0]);
    expect(new Set(fetchTargets)).toEqual(new Set(['/api/research/overview']));
  });

  it('uses personaFetch, never raw fetch', () => {
    expect(tabSource).not.toMatch(/[^A-Za-z]fetch\(/);
    expect(tabSource).toContain('personaFetch(');
  });

  it('is read-only -- no POST/PUT/DELETE/PATCH method appears anywhere', () => {
    expect(tabSource).not.toMatch(/method:\s*['"](POST|PUT|DELETE|PATCH)['"]/);
  });

  it('never reaches into services/research/* or types/research.ts internals directly', () => {
    expect(tabSource).not.toContain("from '@/services/research");
    expect(tabSource).not.toContain("from '@/types/research'");
  });

  it('is registered as a fifth mycluster tab, same shape as its siblings, no adminOnly flag', () => {
    const myResearchEntry = configSource.slice(
      configSource.indexOf("id: 'myresearch'"),
      configSource.indexOf("id: 'myresearch'") + 500
    );
    expect(myResearchEntry).toContain("group: 'mycluster'");
    expect(myResearchEntry).toContain("activationId: 'mycanvas'");
    expect(myResearchEntry).toContain("component: 'MyResearchTab'");
    expect(myResearchEntry).not.toContain('adminOnly');
  });

  it('is wired into the TabRenderer component registry', () => {
    expect(rendererSource).toContain('import { MyResearchTab } from "./tabs/MyResearchTab";');
    expect(rendererSource).toMatch(/MyLedgerTab,\s*\n\s*MyResearchTab,/);
  });

  it('degrades honestly for non-admin viewers instead of hiding or breaking', () => {
    expect(tabSource).toContain('isAdmin');
    expect(tabSource).toMatch(/Read-only summary/);
  });
});
