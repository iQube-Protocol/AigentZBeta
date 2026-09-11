/**
 * C-01 full-screen trading/analysis takeover (2026-09-02): "Full-screen
 * trading or analysis is an in-place takeover. Escape/back restores the
 * earlier layout, selection, scroll position, and conversation. Operational
 * controls, environment, acting agent, and stop/pause remain accessible."
 *
 * Reuses HFTConsole.tsx's existing disclosed simulation (operator
 * direction: "the existing disclosed HFT simulation is a suitable
 * surface") rather than building a new one. Source-shape tests — this
 * repo's established convention for this file family — proving: the
 * takeover expands in-frame (not a new route/window), both panes stay
 * mounted (conversation/task state survive), Escape restores the prior
 * layout, and the two OTHER HFTConsole renderers (the untouched standalone
 * /moneypenny route and SmartTriadSurfaces.tsx) are unaffected.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('MoneyPennyFullScreenContext — safe outside its provider, real inside it', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyFullScreenContext.tsx'));

  it('defaults to a safe no-op OUTSIDE the provider — agentName null, never throws', () => {
    expect(src).toMatch(/agentName: null,/);
    expect(src).toMatch(/enterFullScreen: \(\) => undefined,/);
    expect(src).toMatch(/exitFullScreen: \(\) => undefined,/);
  });

  it('carries environment (SC-04 axis) and agentName — C-01: "environment... acting agent... remain accessible"', () => {
    expect(src).toMatch(/environment: MoneyPennyEnvironment \| null;/);
    expect(src).toMatch(/agentName: string \| null;/);
  });
});

describe('MoneyPennyCopilotWorkspace — provides the full-screen context and owns the takeover layout', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx'));

  it('provides MoneyPennyFullScreenProvider wrapping the whole workspace', () => {
    expect(src).toMatch(/<MoneyPennyFullScreenProvider value=\{fullScreenContextValue\}>/);
    expect(src).toMatch(/<\/MoneyPennyFullScreenProvider>/);
  });

  it('Escape restores the prior layout (isFullScreen -> false) while the takeover is active', () => {
    const effectBody = src.match(/useEffect\(\(\) => \{\s*if \(!isFullScreen\) return;([\s\S]*?)\}, \[isFullScreen\]\);/)?.[1] ?? '';
    expect(effectBody).toMatch(/e\.key === 'Escape'/);
    expect(effectBody).toMatch(/setIsFullScreen\(false\)/);
  });

  it('the copilot pane is hidden — not unmounted — during the takeover: no conditional JSX removal, only a className swap', () => {
    // The copilot pane's wrapping <div> uses a ternary on className, not on
    // whether <SmartTriadCopilotLayer> itself is rendered — proving the
    // instance (and its conversation history) survives the takeover.
    expect(src).not.toMatch(/\{!isFullScreen && <SmartTriadCopilotLayer/);
    expect(src).not.toMatch(/\{isFullScreen \? null : <SmartTriadCopilotLayer/);
    const copilotWrapper = src.match(/<div\s+className=\{\s*isFullScreen\s*\n\s*\? 'hidden'\s*\n\s*: `h-full min-h-0 w-full flex-col lg:flex lg:w-\[38%\][\s\S]*?\}\s*\n\s*>\s*<SmartTriadCopilotLayer/);
    expect(copilotWrapper).not.toBeNull();
  });

  it('the workspace pane expands to full width during takeover — same MoneyPennyShell instance, task state untouched', () => {
    const workspaceWrapper = src.match(/<div\s+className=\{\s*isFullScreen\s*\n\s*\? 'h-full min-h-0 w-full overflow-y-auto'/);
    expect(workspaceWrapper).not.toBeNull();
    // MoneyPennyShell is rendered exactly once — not duplicated for a
    // separate full-screen tree, so its internal state is never reset.
    const shellMounts = src.match(/<MoneyPennyShell activePanel=\{activePanel\}[^>]*>/g) ?? [];
    expect(shellMounts.length).toBe(1);
  });

  it('the takeover bar exposes the acting agent and environment, and an explicit exit control — operational accessibility, not just restoration', () => {
    expect(src).toMatch(/\{isFullScreen && \(/);
    expect(src).toMatch(/\{fullScreenContextValue\.agentName\}/);
    expect(src).toMatch(/\{fullScreenContextValue\.environment\}/);
    expect(src).toMatch(/Exit full screen/);
  });

  it('the context value threads the SAME environment state SC-04 uses — not a second, disconnected value', () => {
    expect(src).toMatch(/environment,\s*\n\s*agentName: 'MoneyPenny',/);
  });
});

describe('HFTConsole — the reused disclosed-simulation surface for the takeover', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/HFTConsole.tsx'));

  it('consumes useMoneyPennyFullScreen rather than inventing its own full-screen state', () => {
    expect(src).toMatch(/import \{ useMoneyPennyFullScreen \} from "\.\/MoneyPennyFullScreenContext"/);
    expect(src).toMatch(/const \{ isFullScreen, enterFullScreen, exitFullScreen, environment, agentName \} = useMoneyPennyFullScreen\(\);/);
  });

  it('the Expand/Exit control only renders when a real workspace hosts it (agentName non-null) — the two other renderers are unaffected', () => {
    const buttonBlock = src.match(/\{agentName && \(\s*<Button[\s\S]*?<\/Button>\s*\)\}/)?.[0] ?? '';
    expect(buttonBlock).toMatch(/isFullScreen \? exitFullScreen\(\) : enterFullScreen\(\)/);
  });

  it('the SimulationNotice disclosure is still present — updated wording (2026-09-04: deterministic simulation, not "randomly generated"; fills/performance replace executions/P&L terminology) but the same honest-disclosure obligation, never dropped', () => {
    expect(src).toMatch(/<SimulationNotice label="Quotes, fills and performance below are simulated — not a live market feed" \/>/);
  });
});

describe('The two OTHER HFTConsole renderers are unaffected by the takeover feature', () => {
  it('MoneyPennyCartridge.tsx (standalone /moneypenny route, deliberately untouched) still renders HFTConsole with no provider changes needed', () => {
    const src = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCartridge.tsx'));
    expect(src).toMatch(/HFTConsole/);
    expect(src).not.toMatch(/MoneyPennyFullScreenProvider/);
  });

  it('SmartTriadSurfaces.tsx still renders HFTConsole with no provider changes needed', () => {
    const src = stripComments(readSource('app/components/content/SmartTriadSurfaces.tsx'));
    expect(src).toMatch(/HFTConsole/);
    expect(src).not.toMatch(/MoneyPennyFullScreenProvider/);
  });
});
