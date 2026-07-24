/**
 * MMC Flow — mySoftware tab canary (PRD-MMC-IMPL-007 Phase 1 + SPEC-MMC-002
 * §6.2 Phase 2).
 *
 * Locks the composition-not-duplication guarantee: mySoftware is a read-only
 * mirror of EXISTING, already persona-owned data — Phase 1's
 * `/api/dev-command-center/sessions` and, as of Phase 2, the new
 * `/api/artifact/records/mine` route (which filters `artifact_records` by
 * the T2-safe `actor_commitment` column added in migration
 * 20260819000000 — see SPEC-MMC-002 §6.2 / PRD-MMC-IMPL-007 §0.2/§0.3). It
 * must never introduce a route beyond that fixed set, never POST/write, and
 * never import `artifactRecordStore`/`softwarePilot` DIRECTLY — Phase 2
 * reaches `artifact_records` only through the mediating API route, exactly
 * like every other spine-guarded read in this tab. Also pins the
 * tab-registration shape against the sibling myCluster tabs, the myLedger
 * filter-chip wiring, and the Companion Search source fan-out.
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
  it('only calls the fixed set of existing/mediating routes -- no undocumented new backend', () => {
    const fetchTargets = [...tabSource.matchAll(/personaFetch\(\s*"([^"]+)"/g)].map((m) => m[1].split('?')[0]);
    expect(new Set(fetchTargets)).toEqual(
      new Set([
        '/api/dev-command-center/sessions',
        '/api/artifact/records/mine',
        '/api/constitutional/capability-registry',
      ]),
    );
  });

  it('uses personaFetch, never raw fetch', () => {
    expect(tabSource).not.toMatch(/[^A-Za-z]fetch\(/);
    expect(tabSource).toContain('personaFetch(');
  });

  it('is read-only -- no POST/PUT/DELETE/PATCH method appears anywhere', () => {
    expect(tabSource).not.toMatch(/method:\s*['"](POST|PUT|DELETE|PATCH)['"]/);
  });

  it('reaches artifact_records only through the mediating API route -- never imports the store or pilot module directly (Phase 2 discipline)', () => {
    expect(tabSource).not.toContain('artifactRecordStore');
    expect(tabSource).not.toContain('softwarePilot');
    expect(tabSource).not.toMatch(/from\s+["']@\/services\/artifact/);
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
