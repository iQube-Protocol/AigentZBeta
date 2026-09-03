/**
 * MoneyPenny experience-coherence correction (2026-09-03), item 3 —
 * "Correct the complete rendered composition... Consolidate cartridge
 * navigation and right-pane presentation."
 *
 * Confirmed defect (background-agent research, verified against source
 * before this pass): MoneyPenny's render tree stacked THREE-TO-FOUR
 * navigation layers at once — CodexPanelDynamic's outer HFT/Connect/
 * Service/Administer tab-group bar, its sibling-tab sub-header (14 tabs),
 * the five-area nav (MoneyPennyAreaNav — already correct, mounted once),
 * and on the Home/overview panel specifically a SECOND full
 * Understand/Design/Markets/Operate/Monitor capability-card grid
 * duplicating the area nav's own contextual chip row. Plus an oversized
 * "MoneyPenny — Financial Services Runtime Agents" banner with a
 * technical connection-light strip occupying default screen space.
 *
 * This file (extended across 2a-2e) proves each layer was actually
 * removed/consolidated, not merely hidden with route-specific CSS.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('2b — MoneyPennyOverviewPanel (Home) uses a restrained hierarchy, not the whole capability registry as cards', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyOverviewPanel.tsx'));

  it('renders exactly 3 primary action cards, backed by real capability items — never invented destinations', () => {
    expect(src).toContain('const PRIMARY_ACTION_ITEM_IDS = ["financial-profile", "risk-envelope", "market-console"] as const;');
    expect(src).toMatch(/"financial-profile": "Understand my money"/);
    expect(src).toMatch(/"risk-envelope": "Make a plan"/);
    expect(src).toMatch(/"market-console": "Explore investing"/);
  });

  it('the remaining capability items are behind closed-by-default <details> sections, one per MONEYPENNY_CAPABILITY_GROUPS group — never exposed unconditionally', () => {
    expect(src).toMatch(/MONEYPENNY_CAPABILITY_GROUPS\.map\(\(group\) => \{/);
    expect(src).toMatch(/<details key=\{group\.id\}/);
    expect(src).not.toMatch(/<details[^>]*\bopen\b/);
  });

  it('primary-action items are excluded from their group\'s expandable section — never shown twice', () => {
    expect(src).toMatch(/const remaining = group\.items\.filter\(\(item\) => !primaryIds\.has\(item\.id\)\);/);
  });

  it('the header is a compact contextual summary, not a capability-registry preamble or implementation jargon (SPEC-MPY-002 §7 truthfulness / plain-language rule)', () => {
    expect(src).toMatch(/Where would you like to start\?/);
    expect(src).not.toMatch(/SPEC-MPY-002|MPY2-1|canonical runtime\. Many experience altitudes/);
  });
});

describe('2d — the duplicate right-pane MoneyPennyChat panel is retired from the codex-side dispatcher', () => {
  const panelTabSrc = stripComments(readSource('app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx'));
  const capabilitiesSrc = stripComments(readSource('app/(shell)/moneypenny/components/moneypennyCapabilities.ts'));

  it('MoneyPennyPanelTab.tsx no longer imports or registers MoneyPennyChat as a panel', () => {
    expect(panelTabSrc).not.toMatch(/import \{ MoneyPennyChat \}/);
    expect(panelTabSrc).not.toMatch(/\bchat:\s*MoneyPennyChat/);
    expect(panelTabSrc).not.toMatch(/\| "chat"/);
  });

  it('the two capability items that used to open the duplicate chat panel now point at "overview" (Home) — the canonical copilot is already visible there', () => {
    const marketResearch = capabilitiesSrc.match(/\{ id: "market-research",[^}]*\}/)?.[0] ?? '';
    const learn = capabilitiesSrc.match(/\{ id: "learn", label: "Learn \/ Explain",[^}]*\}/)?.[0] ?? '';
    expect(marketResearch).toMatch(/panel: "overview"/);
    expect(learn).toMatch(/panel: "overview"/);
  });

  it('MONEYPENNY_AREA_FOR_PANEL no longer carries a "chat" entry', () => {
    expect(capabilitiesSrc).not.toMatch(/(^|\s)chat:\s*"/m);
  });

  it('the standalone /moneypenny route (explicitly out of scope) keeps its own MoneyPennyChat usage untouched — this is a targeted retirement of the codex-side duplicate, not a deletion of the shared component', () => {
    const standaloneSrc = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCartridge.tsx'));
    expect(standaloneSrc).toMatch(/MoneyPennyChat/);
  });
});

describe('2e — CRM moved to Activity, no longer a separately-pinned utility button', () => {
  const capabilitiesSrc = stripComments(readSource('app/(shell)/moneypenny/components/moneypennyCapabilities.ts'));
  const areaNavSrc = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyAreaNav.tsx'));

  it('MONEYPENNY_AREA_FOR_PANEL maps crm to activity — no longer excluded from area mapping', () => {
    expect(capabilitiesSrc).toMatch(/crm: "activity"/);
    expect(capabilitiesSrc).not.toMatch(/Exclude<MoneyPennyPanelKey, "crm" \| "learn">/);
  });

  it('areaForPanel no longer special-cases crm as area-less — only the chip-only "learn" panel stays excluded', () => {
    expect(capabilitiesSrc).toMatch(/if \(panel === "learn"\) return null;/);
    expect(capabilitiesSrc).not.toMatch(/panel === "crm"/);
  });

  it('CRM is a real item in MONEYPENNY_UNGROUPED_ITEMS (reachable from Activity\'s chip row), not a separate MONEYPENNY_UTILITY_ITEM export', () => {
    expect(capabilitiesSrc).not.toMatch(/export const MONEYPENNY_UTILITY_ITEM/);
    const ungroupedBlock = capabilitiesSrc.match(/export const MONEYPENNY_UNGROUPED_ITEMS[\s\S]*?\];/)?.[0] ?? '';
    expect(ungroupedBlock).toMatch(/id: "crm"/);
  });

  it('MoneyPennyAreaNav no longer renders a separately-pinned utility button outside the five-area strip', () => {
    expect(areaNavSrc).not.toMatch(/MONEYPENNY_UTILITY_ITEM/);
    expect(areaNavSrc).not.toMatch(/ml-auto/);
  });
});

describe('2c — the oversized runtime-agents banner + connection-light strip no longer occupy default screen space', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyShell.tsx'));

  it('the "Financial Services Runtime Agents" banner text is gone', () => {
    expect(src).not.toMatch(/Financial Services Runtime Agents/);
    expect(src).not.toMatch(/Real-time high-frequency trading agent powered by Qripto/);
  });

  it('connection diagnostics (Quotes/Execution/X402/FIO) are preserved, but behind a closed-by-default <details> disclosure — not deleted, not exposed by default', () => {
    expect(src).toMatch(/<details className="group[^"]*">/);
    expect(src).toMatch(/Connection diagnostics/);
    // The four status rows still exist, honestly derived (unchanged logic) —
    // only their default visibility moved.
    for (const label of ['Quotes', 'Execution', 'X402', 'FIO']) {
      expect(src, `diagnostic row '${label}' missing`).toContain(`>${label}<`);
    }
    // <details> with no `open` attribute is closed by default — confirm
    // the element itself carries no open flag.
    expect(src).not.toMatch(/<details[^>]*\bopen\b/);
  });

  it('the Connected/Disconnected badge is still visible at a glance (on the closed summary row), not buried', () => {
    const summaryBlock = src.match(/<summary[\s\S]*?<\/summary>/)?.[0] ?? '';
    expect(summaryBlock).toMatch(/isConnected \? "Connected" : "Disconnected"/);
  });

  it('MoneyPennyAreaNav — the one sanctioned navigation — is unaffected by this change, still mounted exactly once', () => {
    const mounts = src.match(/<MoneyPennyAreaNav activePanel=\{activePanel\} \/>/g) ?? [];
    expect(mounts.length).toBe(1);
  });
});

describe('3 — MoneyPenny role selector (Advisor/Architect/Runtime) is real context wiring, not a cosmetic dropdown', () => {
  const selectorSrc = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyRoleSelector.tsx'));
  const shellSrc = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyShell.tsx'));
  const workspaceSrc = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx'));
  const versioningSrc = stripComments(readSource('services/moneypenny/contextVersioning.ts'));

  it('reuses the shared MoneyPennyProviderMode vocabulary — never a second, parallel role type', () => {
    expect(selectorSrc).toMatch(/import type \{ MoneyPennyProviderMode \} from '@\/types\/financialServices'/);
    expect(selectorSrc).not.toMatch(/type\s+MoneyPennyProviderMode\s*=/);
    for (const role of ['ADVISOR', 'ARCHITECT', 'RUNTIME']) {
      expect(selectorSrc, `role option '${role}' missing`).toContain(`'${role}'`);
    }
  });

  it('renders the compact "MoneyPenny · Role: X ▾" control, closed by default, using the established dropdown idiom', () => {
    expect(selectorSrc).toMatch(/Role: \{ROLE_LABEL\[role\]\}/);
    expect(selectorSrc).toMatch(/const \[open, setOpen\] = useState\(false\)/);
    expect(selectorSrc).toMatch(/border-slate-800 bg-slate-900\/95 py-1 shadow-lg backdrop-blur-sm/);
  });

  it('selecting a role only ever calls the passed-in onChange — no fetch, no API call, no identity/delegation write anywhere in the file', () => {
    expect(selectorSrc).toMatch(/onClick=\{\(\) => \{\s*onChange\(option\.id\);\s*setOpen\(false\);\s*\}\}/);
    expect(selectorSrc).not.toMatch(/fetch\(/);
    expect(selectorSrc).not.toMatch(/persona-assignment/);
    expect(selectorSrc).not.toMatch(/establishDelegation|proposeDelegation|delegation\(/);
    expect(selectorSrc).not.toMatch(/environment\s*[:=]\s*['"]live['"]/);
  });

  it('is mounted at the top of the right workspace, outside the diagnostics <details> and distinct from AigentMeRoleSelector', () => {
    const roleBlockIndex = shellSrc.indexOf('<MoneyPennyRoleSelector');
    const detailsIndex = shellSrc.indexOf('<details');
    expect(roleBlockIndex).toBeGreaterThan(-1);
    expect(detailsIndex).toBeGreaterThan(-1);
    expect(roleBlockIndex).toBeLessThan(detailsIndex);
    expect(shellSrc).not.toMatch(/AigentMeRoleSelector/);
  });

  it('MoneyPennyShell requires role + onRoleChange as real props — not optional cosmetic ones', () => {
    expect(shellSrc).toMatch(/role: MoneyPennyProviderMode;\s*onRoleChange: \(role: MoneyPennyProviderMode\) => void;/);
  });

  it('the selected role flows into the copilot groundContext as providerMode — read, never used to authorize', () => {
    expect(workspaceSrc).toMatch(/providerMode: role,/);
  });

  it('a role change bumps SC-04 generation and is embedded in both context-version constructions — stale-response protection covers role, not just panel/persona/environment', () => {
    expect(workspaceSrc).toMatch(/useEffect\(\(\) => \{ generationRef\.current \+= 1; \}, \[role\]\);/);
    const versionConstructions = workspaceSrc.match(/generation: generationRef\.current,[\s\S]{0,120}?role,/g) ?? [];
    expect(versionConstructions.length).toBe(2);
    expect(versioningSrc).toMatch(/role: MoneyPennyProviderMode;/);
    expect(versioningSrc).toMatch(/version\.role/);
  });

  it('changing role does not touch activePanel, personaId, or environment state — no cross-wiring into identity, delegation, or sim/live', () => {
    // The role setter (setRole) is only ever called from the selector's
    // onChange plumbing — never from within an activePanel/personaId/
    // environment setter, and no other setter is called alongside it.
    expect(workspaceSrc).toMatch(/onRoleChange=\{setRole\}/);
    expect(workspaceSrc).not.toMatch(/setRole\([^)]*\)[\s\S]{0,40}(setActivePanel|setPersonaId|setEnvironment)\(/);
    expect(workspaceSrc).not.toMatch(/(setActivePanel|setPersonaId|setEnvironment)\([^)]*\)[\s\S]{0,40}setRole\(/);
  });
});
