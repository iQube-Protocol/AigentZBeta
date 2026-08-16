/**
 * DevOn UI Refinement, Phase E canaries — the DevOn identity pass.
 *
 * Protects: the Dev Command Center reads as DevOn (header/placeholder/
 * empty-states), the underlying `agent.id` / persona / KB / avatar routing
 * contract is UNCHANGED (display-name-only rename, not a fork — see
 * SmartTriadCopilotLayer.tsx's `resolvedPersona` which keys behavior off
 * `agent.id.startsWith('aigent-')`), legitimate Aigent Z actor attribution
 * is preserved (Aigent Z remains a distinct orchestratable agent), and the
 * generic Smart Triad Copilot substrate never hard-codes "DevOn" — the
 * identity enters only through the existing `agentName`/`agent` prop seam.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const TAB_SOURCE = readFileSync(
  path.join(process.cwd(), 'app/triad/components/codex/tabs/DevCommandCenterTab.tsx'),
  'utf-8',
);
const COPILOT_LAYER_SOURCE = readFileSync(
  path.join(process.cwd(), 'components/smarttriad/copilot/SmartTriadCopilotLayer.tsx'),
  'utf-8',
);
const ACTOR_EVENTS_SOURCE = readFileSync(
  path.join(process.cwd(), 'components/devcommandcenter/actorEvents.ts'),
  'utf-8',
);
const STRIP_SOURCE = readFileSync(
  path.join(process.cwd(), 'components/devcommandcenter/ActorActivityStrip.tsx'),
  'utf-8',
);
const IMPLEMENTATION_LAYOUT_SOURCE = readFileSync(
  path.join(process.cwd(), 'components/devcommandcenter/layouts/ImplementationLayout.tsx'),
  'utf-8',
);
const PERSONAS_SOURCE = readFileSync(path.join(process.cwd(), 'app/data/personas.ts'), 'utf-8');

const DEVCOMMANDCENTER_LAYOUT_FILES = [
  'PendingProposalCard.tsx',
  'IntentLayout.tsx',
  'GapAnalysisLayout.tsx',
  'ImplementationLayout.tsx',
  'ValidationLayout.tsx',
  'ConsequenceCanvasLayout.tsx',
  'ContextLayout.tsx',
  'TerminalLayout.tsx',
].map((f) => ({
  file: f,
  source: readFileSync(path.join(process.cwd(), 'components/devcommandcenter/layouts', f), 'utf-8'),
}));

describe('the Dev Command Center reads as DevOn', () => {
  it('the copilot header identity is DevOn, with agent.id unchanged (display rename, not a fork)', () => {
    expect(TAB_SOURCE).toMatch(/agent=\{\{ id: "aigent-z", name: "DevOn" \}\}/);
  });

  it('the composer placeholder addresses DevOn', () => {
    expect(TAB_SOURCE).toMatch(/promptPlaceholder="Ask DevOn/);
  });

  it('no user-visible "aigentZ" string remains anywhere in the tab (console.log telemetry is the only tolerated exception)', () => {
    const userVisibleOnly = TAB_SOURCE
      .split('\n')
      .filter((line) => !/console\.log/.test(line))
      .join('\n');
    expect(userVisibleOnly).not.toMatch(/aigentZ/);
  });

  it('every Dev Command Center capsule layout empty-state/attribution string says DevOn, never aigentZ (the `aigentz/pack-*` branch-name literal is a distinct, untouched concern)', () => {
    for (const { file, source } of DEVCOMMANDCENTER_LAYOUT_FILES) {
      const nonBranchLiteral = source.replace(/aigentz\/pack-\*/g, '').replace(/aigentz\/pack-/g, '');
      expect(nonBranchLiteral, `${file} still contains "aigentZ"`).not.toMatch(/aigentZ/);
    }
  });

  it('TerminalLayout\'s welcome banner and prompt symbol both read DevOn', () => {
    const terminal = DEVCOMMANDCENTER_LAYOUT_FILES.find((f) => f.file === 'TerminalLayout.tsx')!.source;
    expect(terminal).toMatch(/DevOn Constitutional Terminal/);
    expect(terminal).toMatch(/DevOn\$/);
  });
});

describe('agent.id / persona / KB / avatar routing is UNCHANGED — display-only rename', () => {
  it('resolvedPersona still keys off agent.id starting with "aigent-" (unaffected by the DevOn display rename)', () => {
    expect(COPILOT_LAYER_SOURCE).toMatch(/agent\?\.id && agent\.id\.startsWith\('aigent-'\)/);
  });

  it('the shared "aigent-z" persona system prompt is untouched by Phase E (a genuine fork risk, deliberately not taken)', () => {
    expect(PERSONAS_SOURCE).toMatch(/"aigent-z":\s*\{/);
    expect(PERSONAS_SOURCE).toMatch(/You are \*\*Aigent Z\*\*, the engineering intelligence/);
  });

  it('the avatar identity request still resolves from agent.id, not the display name', () => {
    expect(COPILOT_LAYER_SOURCE).toMatch(/requestAvatar\(avatarContainer, agent\?\.id \|\| "aigent-z"\)/);
  });
});

describe('legitimate Aigent Z actor attribution is preserved, never renamed to DevOn', () => {
  it('actorEvents.ts / ActorActivityStrip.tsx still document Aigent Z as a distinct orchestratable actor', () => {
    expect(ACTOR_EVENTS_SOURCE + STRIP_SOURCE).toMatch(/Aigent Z/);
  });

  it('ImplementationLayout\'s DevOn awaiting-authorization event is attributed to "devon", never to "aigent-z" — the two identities stay distinct actors in the stream', () => {
    const awaitingIdx = IMPLEMENTATION_LAYOUT_SOURCE.indexOf('action: "awaiting-authorization"');
    const block = IMPLEMENTATION_LAYOUT_SOURCE.slice(Math.max(0, awaitingIdx - 200), awaitingIdx);
    expect(block).toMatch(/actorId:\s*"devon"/);
    expect(block).not.toMatch(/actorId:\s*"aigent-z"/);
  });
});

describe('the generic Smart Triad Copilot substrate never hard-codes DevOn', () => {
  it('SmartTriadCopilotLayer.tsx contains no "DevOn" in actual code (a design-rationale doc comment referencing the requirement is fine; a hard-coded UI string is not) — identity enters only via the agentName/agent prop seam', () => {
    const codeOnly = COPILOT_LAYER_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/DevOn/);
  });

  it('the substrate\'s own generic fallback labels are unchanged ("Aigent Copilot" / "SmartTriad Copilot"), proving the seam is per-caller, not per-product', () => {
    expect(COPILOT_LAYER_SOURCE).toMatch(/agentName \?\? "Aigent Copilot"/);
    expect(COPILOT_LAYER_SOURCE).toMatch(/agentName \?\? "SmartTriad Copilot"/);
  });
});
