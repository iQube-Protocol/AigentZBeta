/**
 * Source-wiring canaries for the Register-stage cross-agent contamination
 * fix (operator directive, 2026-08-08): "A registration receipt can satisfy
 * an agent's Register stage iff the receipt subject is that exact runtime
 * agent." Source-scan style, matching this repo's existing convention (e.g.
 * tests/pulse-plnl-split-and-correlation-trace.test.ts) — no React rendering
 * harness is set up in this codebase.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

const drawerSource = read('components/journey/StageReceiptsDrawer.tsx');
const surfaceSource = read('components/journey/JourneyRunSurface.tsx');
const journeySource = read('services/journey/horizenMoneyPennyJourney.ts');
const tabSource = read('app/triad/components/codex/tabs/PilotJourneyTab.tsx');
const journeyTypesSource = read('types/journey.ts');

describe('StageReceiptsDrawer — agent-scoped queries (operator directive, 2026-08-08)', () => {
  it('accepts an agentsInvoked prop and includes it in the receipts query when non-empty', () => {
    expect(drawerSource).toMatch(/agentsInvoked\?:\s*readonly string\[\]/);
    expect(drawerSource).toContain("params.set('agentsInvoked', agentsInvoked.join(','))");
  });

  it('invalidates its loaded cache when the scope (receiptTypes/agentsInvoked) changes, and refetches if open', () => {
    // The staleness gap: this component is never remounted on agent switch,
    // so without this, `loaded` would stay true from a PRIOR agent's fetch.
    expect(drawerSource).toContain('const scopeKey = `${receiptTypes.join');
    expect(drawerSource).toMatch(/if \(priorScopeKey\.current === scopeKey\) return;/);
    expect(drawerSource).toContain('setLoaded(false)');
    expect(drawerSource).toMatch(/if \(open\) void load\(\);/);
  });
});

describe('JourneyRunSurface — agent scoping is opt-in per stage (operator directive, 2026-08-08)', () => {
  it('passes agentsInvoked to the drawer ONLY when the active stage declares receiptsScopedToSubjectAgent', () => {
    expect(surfaceSource).toContain('receiptsSubjectAgentRef');
    expect(surfaceSource).toMatch(
      /activeStage\.receiptsScopedToSubjectAgent && receiptsSubjectAgentRef\s*\n\s*\? \[receiptsSubjectAgentRef\]\s*\n\s*: undefined/,
    );
  });

  it('never hardcodes the aigent-${slug} naming convention inside the generic runner — that stays with the caller', () => {
    expect(surfaceSource).not.toMatch(/`aigent-\$\{/);
  });
});

describe('types/journey.ts — receiptsScopedToSubjectAgent is declared', () => {
  it('the field exists on JourneyStageDefinition, distinct from receiptsSurfacedNatively', () => {
    expect(journeyTypesSource).toContain('receiptsScopedToSubjectAgent?: boolean');
  });
});

describe('horizenMoneyPennyJourney.ts — only verified subject-tagged stages opt in (operator directive, 2026-08-08)', () => {
  function stageBlock(stageId: string): string {
    const idx = journeySource.indexOf(`id: '${stageId}',`);
    expect(idx, `stage '${stageId}' must exist`).toBeGreaterThan(-1);
    const nextStageIdx = journeySource.indexOf("id: '", idx + 10);
    return journeySource.slice(idx, nextStageIdx > -1 ? nextStageIdx : undefined);
  }

  it('register opts in — every one of its receipt types is written with agentsInvoked: [agent.runtimeAgentId]', () => {
    expect(stageBlock('register')).toContain('receiptsScopedToSubjectAgent: true');
  });

  it('claim opts in — agent_control_proven is written with agentsInvoked: [agent.runtimeAgentId]', () => {
    expect(stageBlock('claim')).toContain('receiptsScopedToSubjectAgent: true');
  });

  it('verify does NOT opt in — agreement_formed/agreement_authorized carry only the orchestrator (aigent-z), never a subject agent', () => {
    expect(stageBlock('verify')).not.toContain('receiptsScopedToSubjectAgent: true');
  });
});

describe('PilotJourneyTab — threads the selected agent\'s subject ref through (operator directive, 2026-08-08)', () => {
  it('passes receiptsSubjectAgentRef computed from the currently selected agent, not a hardcoded default', () => {
    // Horizen Pilot Closure item 5 (2026-08-09): now the canonical
    // runtimeAgentId from the resolved agent, never the aigent-${slug}
    // string coincidence — so a future agent whose slug does not match that
    // convention still scopes correctly.
    expect(tabSource).toContain('receiptsSubjectAgentRef={selectedAgent.runtimeAgentId}');
    expect(tabSource).not.toMatch(/receiptsSubjectAgentRef=\{`aigent-\$\{/);
  });
});
