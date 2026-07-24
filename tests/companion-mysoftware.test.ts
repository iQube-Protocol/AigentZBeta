/**
 * MMC Flow — mySoftware tab canary (PRD-MMC-IMPL-007).
 *
 * Locks the composition-not-duplication guarantee: mySoftware is a read-only
 * mirror of the EXISTING, already persona-owned `/api/dev-command-center/
 * sessions` route — it must never introduce a new backend route, never
 * POST/write, and never reach into `artifact_records` (the pre-existing
 * software-artifact store that has no per-persona ownership column today —
 * see PRD-MMC-IMPL-007 §0.2). Also pins the tab-registration shape against
 * the sibling myCluster tabs, the myLedger filter-chip wiring, and the
 * Companion Search source fan-out.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const TAB_PATH = join(process.cwd(), 'app', 'triad', 'components', 'codex', 'tabs', 'MySoftwareTab.tsx');
const tabSource = readFileSync(TAB_PATH, 'utf8');

const CONFIG_PATH = join(process.cwd(), 'data', 'codex-configs.ts');
const configSource = readFileSync(CONFIG_PATH, 'utf8');

const RENDERER_PATH = join(process.cwd(), 'app', 'triad', 'components', 'codex', 'TabRenderer.tsx');
const rendererSource = readFileSync(RENDERER_PATH, 'utf8');

const LEDGER_PATH = join(process.cwd(), 'app', 'triad', 'components', 'codex', 'tabs', 'MyLedgerTab.tsx');
const ledgerSource = readFileSync(LEDGER_PATH, 'utf8');

const FEDERATION_PATH = join(process.cwd(), 'services', 'companion', 'searchFederation.ts');
const federationSource = readFileSync(FEDERATION_PATH, 'utf8');

describe('MySoftwareTab — composition + read-only canary', () => {
  it('only calls the existing /api/dev-command-center/sessions and /api/constitutional/capability-registry routes -- no new backend', () => {
    const fetchTargets = [...tabSource.matchAll(/personaFetch\(\s*"([^"]+)"/g)].map((m) => m[1].split('?')[0]);
    expect(new Set(fetchTargets)).toEqual(
      new Set(['/api/dev-command-center/sessions', '/api/constitutional/capability-registry']),
    );
  });

  it('uses personaFetch, never raw fetch', () => {
    expect(tabSource).not.toMatch(/[^A-Za-z]fetch\(/);
    expect(tabSource).toContain('personaFetch(');
  });

  it('is read-only -- no POST/PUT/DELETE/PATCH method appears anywhere', () => {
    expect(tabSource).not.toMatch(/method:\s*['"](POST|PUT|DELETE|PATCH)['"]/);
  });

  it('never reaches into artifact_records or the softwarePilot internals directly (Phase 1 ownership-gap guard)', () => {
    expect(tabSource).not.toContain('artifact_records');
    expect(tabSource).not.toContain('artifactRecordStore');
    expect(tabSource).not.toContain('softwarePilot');
  });

  it('is registered as a sixth mycluster tab, same shape as its siblings, no adminOnly flag', () => {
    const entry = configSource.slice(
      configSource.indexOf("id: 'mysoftware'"),
      configSource.indexOf("id: 'mysoftware'") + 500,
    );
    expect(entry).toContain("group: 'mycluster'");
    expect(entry).toContain("activationId: 'mycanvas'");
    expect(entry).toContain("component: 'MySoftwareTab'");
    expect(entry).not.toContain('adminOnly');
  });

  it('mycartridge stays last in the mycluster group (order 5)', () => {
    const entry = configSource.slice(
      configSource.indexOf("id: 'mycartridge'"),
      configSource.indexOf("id: 'mycartridge'") + 500,
    );
    expect(entry).toContain('order: 5');
  });

  it('is wired into the TabRenderer component registry', () => {
    expect(rendererSource).toContain('import { MySoftwareTab } from "./tabs/MySoftwareTab";');
    expect(rendererSource).toMatch(/MyResearchTab,\s*\n\s*MySoftwareTab,/);
  });

  it('is wired into myLedger as a filter chip with a matching action-type set', () => {
    expect(ledgerSource).toContain("mysoftware: 'mySoftware'");
    expect(ledgerSource).toContain('SOFTWARE_ACTION_TYPES');
    expect(ledgerSource).toContain("activeChip === 'mysoftware'");
  });

  it('is wired into Companion Search as a sixth federated source', () => {
    expect(federationSource).toContain('searchMySoftware');
    expect(federationSource).toContain("guard('my-software', searchMySoftware(query, personaId))");
  });
});
