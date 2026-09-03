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
  const carouselSrc = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCapabilityCarousel.tsx'));

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

  it('MoneyPennyCapabilityCarousel no longer renders a separately-pinned utility button — CRM is just another carousel item like any other (the carousel\'s own ml-auto is Connection diagnostics, a different, sanctioned right-alignment, not a utility-item revival)', () => {
    expect(carouselSrc).not.toMatch(/MONEYPENNY_UTILITY_ITEM/);
    expect(carouselSrc).toMatch(/Connection diagnostics/);
  });
});

describe('2c — the oversized runtime-agents banner no longer occupies default screen space; connection diagnostics moved into the capability carousel (navigation-hierarchy correction, 2026-09-03, second pass)', () => {
  const shellSrc = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyShell.tsx'));
  const carouselSrc = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCapabilityCarousel.tsx'));

  it('the "Financial Services Runtime Agents" banner text is gone', () => {
    expect(shellSrc).not.toMatch(/Financial Services Runtime Agents/);
    expect(shellSrc).not.toMatch(/Real-time high-frequency trading agent powered by Qripto/);
  });

  it('connection diagnostics (Quotes/Execution/X402/FIO) are preserved, but as the FINAL carousel button + an expandable detail region below it — no longer a standalone full-width accordion above the menu (item 3 correction, 2026-09-03)', () => {
    expect(shellSrc).not.toMatch(/<details/);
    expect(carouselSrc).toMatch(/Connection diagnostics/);
    expect(carouselSrc).toMatch(/diagnosticsOpen/);
    // The four status rows still exist, honestly derived (unchanged logic) —
    // only their location (and default visibility) moved.
    for (const label of ['Quotes', 'Execution', 'X402', 'FIO']) {
      expect(carouselSrc, `diagnostic row '${label}' missing`).toContain(`>${label}<`);
    }
    // Closed by default — the detail region is conditionally rendered on
    // diagnosticsOpen, not an <details> with an `open` attribute.
    expect(carouselSrc).toMatch(/\{diagnosticsOpen && \(/);
  });

  it('the Connected/Disconnected badge is still visible at a glance, on the diagnostics button itself, not buried', () => {
    const buttonBlock = carouselSrc.match(/onClick=\{\(\) => setDiagnosticsOpen[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(buttonBlock).toMatch(/isConnected \? 'Connected' : 'Disconnected'/);
  });

  it('MoneyPennyCapabilityCarousel — the one sanctioned per-area carousel — is mounted exactly once in MoneyPennyShell', () => {
    const mounts = shellSrc.match(/<MoneyPennyCapabilityCarousel/g) ?? [];
    expect(mounts.length).toBe(1);
  });
});

describe('3 — MoneyPenny role selector (Advisor/Architect/Runtime) is real context wiring in the LEFT copilot header, not a cosmetic right-pane dropdown (navigation-hierarchy correction, 2026-09-03, second pass: relocated from MoneyPennyShell into SmartTriadCopilotLayer)', () => {
  const selectorSrc = stripComments(readSource('components/smarttriad/copilot/MoneyPennyRoleSelector.tsx'));
  const shellSrc = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyShell.tsx'));
  const workspaceSrc = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx'));
  const layerSrc = stripComments(readSource('components/smarttriad/copilot/SmartTriadCopilotLayer.tsx'));
  const versioningSrc = stripComments(readSource('services/moneypenny/contextVersioning.ts'));

  it('reuses the shared MoneyPennyProviderMode vocabulary — never a second, parallel role type', () => {
    expect(selectorSrc).toMatch(/import type \{ MoneyPennyProviderMode \} from '@\/types\/financialServices'/);
    expect(selectorSrc).not.toMatch(/type\s+MoneyPennyProviderMode\s*=/);
    for (const role of ['ADVISOR', 'ARCHITECT', 'RUNTIME']) {
      expect(selectorSrc, `role option '${role}' missing`).toContain(`'${role}'`);
    }
  });

  it('renders the compact "Role: X ▾" control, closed by default, using the established dropdown idiom', () => {
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

  it('MoneyPennyShell no longer renders the role selector at all — it moved into the left copilot header, not the right pane', () => {
    expect(shellSrc).not.toMatch(/MoneyPennyRoleSelector/);
    expect(shellSrc).not.toMatch(/role: MoneyPennyProviderMode/);
  });

  it('SmartTriadCopilotLayer renders MoneyPennyRoleSelector in its header ONLY for agentId === \'aigent-moneypenny\', replacing the redundant agentSubtitle descriptor there — AigentMeRoleSelector stays a distinct, separate control', () => {
    expect(layerSrc).toMatch(/import \{ MoneyPennyRoleSelector \} from "\.\/MoneyPennyRoleSelector"/);
    expect(layerSrc).toMatch(/agentId === 'aigent-moneypenny' && moneyPennyRole && onMoneyPennyRoleChange/);
    expect(layerSrc).toMatch(/<MoneyPennyRoleSelector role=\{moneyPennyRole\} onChange=\{onMoneyPennyRoleChange\} \/>/);
    expect(layerSrc).toMatch(/agentId === 'aigent-me' && <AigentMeRoleSelector/);
  });

  it('MoneyPennyCopilotWorkspace passes the SAME role state into SmartTriadCopilotLayer as moneyPennyRole/onMoneyPennyRoleChange — no second role store, no agentSubtitle text for MoneyPenny any more', () => {
    expect(workspaceSrc).toMatch(/moneyPennyRole=\{role\}/);
    expect(workspaceSrc).toMatch(/onMoneyPennyRoleChange=\{setRole\}/);
    expect(workspaceSrc).not.toMatch(/agentSubtitle=/);
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
    expect(workspaceSrc).toMatch(/onMoneyPennyRoleChange=\{setRole\}/);
    expect(workspaceSrc).not.toMatch(/setRole\([^)]*\)[\s\S]{0,40}(setActivePanel|setPersonaId|setEnvironment)\(/);
    expect(workspaceSrc).not.toMatch(/(setActivePanel|setPersonaId|setEnvironment)\([^)]*\)[\s\S]{0,40}setRole\(/);
  });
});
