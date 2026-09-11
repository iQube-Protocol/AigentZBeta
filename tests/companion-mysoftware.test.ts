/**
 * MMC Flow — mySoftware tab canary (PRD-MMC-IMPL-007 Phase 1 + SPEC-MMC-002
 * §6.2 Phase 2 + §6.3 Phase 3).
 *
 * Locks the composition-not-duplication guarantee: mySoftware reads from
 * EXISTING, already persona-owned data sources and — as of Phase 3 — calls
 * EXISTING mutating ceremonies (never a second implementation of one).
 * Fixed route set: Phase 1's `/api/dev-command-center/sessions`, Phase 2's
 * `/api/artifact/records/mine` and `/api/constitutional/capability-registry/
 * mine`, and Phase 3's `/api/constitutional/deployment-proposal` +
 * `/api/constitutional/agreement` (both pre-existing ceremonies this tab
 * only calls, never reimplements). It must never introduce a route beyond
 * that fixed set, and must never import `artifactRecordStore`/
 * `softwarePilot` DIRECTLY — Phase 2's `artifact_records` read stays behind
 * the mediating API route, exactly like every other spine-guarded read in
 * this tab.
 *
 * Phase 3 authority-boundary canary (the one that matters most): the ONLY
 * call site for `action: 'authorize'` — the Constitutional Agreement's
 * human-only authorization step — must be the one inside
 * `handleAuthorizeDelegation`, fired exclusively by an explicit human button
 * click, never chained automatically from the `form`/`accept` propose flow.
 * This mirrors `tests/moneypenny-runtime-authority-boundary.test.ts`'s own
 * canary for the same primitive.
 *
 * Also pins the tab-registration shape against the sibling myCluster tabs,
 * the myLedger filter-chip wiring, and the Companion Search source fan-out.
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

describe('MySoftwareTab — composition + authority-boundary canary', () => {
  it('only calls the fixed set of existing/mediating routes -- no undocumented new backend', () => {
    const fetchTargets = [...tabSource.matchAll(/personaFetch\(\s*"([^"]+)"/g)].map((m) => m[1].split('?')[0]);
    expect(new Set(fetchTargets)).toEqual(
      new Set([
        '/api/dev-command-center/sessions',
        '/api/artifact/records/mine',
        '/api/constitutional/capability-registry/mine',
        '/api/constitutional/deployment-proposal',
        '/api/constitutional/agreement',
      ]),
    );
  });

  it('uses personaFetch, never raw fetch', () => {
    expect(tabSource).not.toMatch(/[^A-Za-z]fetch\(/);
    expect(tabSource).toContain('personaFetch(');
  });

  it('Phase 3 mutations are scoped to the sanctioned action set -- archive/test/form/accept/authorize only, over the two existing ceremonies plus the new persona-scoped mine POST', () => {
    const postActions = [...tabSource.matchAll(/action:\s*["'](\w+)["']/g)].map((m) => m[1]);
    expect(new Set(postActions)).toEqual(new Set(['archive', 'test', 'form', 'accept', 'authorize']));
  });

  it('the ONLY call site for action: "authorize" is inside handleAuthorizeDelegation -- never auto-chained from handleProposeDelegation (Principal-Delegate Separation)', () => {
    const authorizeCallSites = [...tabSource.matchAll(/action:\s*["']authorize["']/g)];
    expect(authorizeCallSites.length).toBe(1);

    const proposeFnStart = tabSource.indexOf('const handleProposeDelegation');
    const proposeFnEnd = tabSource.indexOf('const handleAuthorizeDelegation');
    const proposeFnBody = tabSource.slice(proposeFnStart, proposeFnEnd);
    expect(proposeFnBody).not.toMatch(/action:\s*["']authorize["']/);

    const authorizeFnStart = tabSource.indexOf('const handleAuthorizeDelegation');
    const authorizeFnBody = tabSource.slice(authorizeFnStart, authorizeFnStart + 2000);
    expect(authorizeFnBody).toMatch(/action:\s*["']authorize["']/);
  });

  it('reaches artifact_records only through the mediating API route -- never imports the store or pilot module directly (Phase 2 discipline)', () => {
    // Bug fixed 2026-07-24: this test previously asserted the bare strings
    // 'artifactRecordStore'/'softwarePilot' never appear ANYWHERE in the
    // file -- but the real invariant is "never IMPORTED directly", and the
    // module header's own Phase 2 prose (`"...outside the narrow DCC/
    // softwarePilot pipeline"`) legitimately mentions the name without
    // importing it, which made the blunt substring check fail against the
    // actual shipped file. The `from '@/services/artifact...'` import-path
    // check below is the precise, already-sufficient guard (both modules
    // live under services/artifact/) -- kept; the two over-broad substring
    // assertions were dropped rather than the legitimate prose rewritten to
    // dodge a test that was checking the wrong thing.
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
