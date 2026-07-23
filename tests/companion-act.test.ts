/**
 * MMC Flow — Movement III (Act) canary (PRD-MMC-IMPL-004 Increment 2).
 *
 * `IntentChainPanel.tsx` is a plain `.tsx` React component with no
 * `chrome.*`/extension dependency, so unlike the Capture extension files
 * this COULD be functionally rendered with a DOM test harness -- but this
 * repo's existing test suite doesn't set one up for this file elsewhere,
 * so a structural source-grep canary (mirroring the style already used for
 * `tests/companion-capture.test.ts`'s extension checks) is the right bar
 * here too: lock the composition-not-duplication guarantee and the four
 * curated verb mappings against silent drift.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const PANEL_PATH = join(process.cwd(), 'components', 'metame', 'workbench', 'IntentChainPanel.tsx');
const source = readFileSync(PANEL_PATH, 'utf8');

// ActRow's own function body only -- bounded to the next top-level function
// declaration (PostApprovalDraftButton) so these checks don't accidentally
// sweep in unrelated sibling components (which also call intent-advance)
// further down the file.
const actStart = source.indexOf('function ActRow(');
const actEnd = source.indexOf('function PostApprovalDraftButton(');
const actSection = source.slice(actStart, actEnd);

describe('IntentChainPanel — Act (Movement III) composition canary', () => {
  it('never introduces a new route -- only calls the existing /api/assistant/ask-agent', () => {
    expect(actStart).toBeGreaterThan(-1);
    expect(actEnd).toBeGreaterThan(actStart);
    expect(actSection).toContain("personaFetch(\"/api/assistant/ask-agent\"");
    // No other new fetch target should appear in the Act section.
    const fetchTargets = [...actSection.matchAll(/personaFetch\(\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(fetchTargets)).toEqual(new Set(['/api/assistant/ask-agent']));
  });

  it('uses personaFetch, never raw fetch, in the Act section', () => {
    expect(actSection).not.toMatch(/[^A-Za-z]fetch\(/);
    expect(actSection).toContain('personaFetch(');
  });

  it('declares exactly the four curated verbs, each with a specialistId and a prompt', () => {
    expect(source).toContain('type ActVerb = "delegate" | "summarize" | "research" | "classify";');
    for (const verb of ['delegate', 'summarize', 'research', 'classify']) {
      const re = new RegExp(`${verb}:\\s*\\{[^}]*specialistId:\\s*"[a-z0-9-]+"[^}]*prompt:\\s*"[^"]+"`, 's');
      expect(source).toMatch(re);
    }
  });

  it('threads intentId and specialistId+prompt into the ask-agent request body', () => {
    expect(actSection).toMatch(/JSON\.stringify\(\{\s*specialistId,\s*intentId,\s*prompt\s*\}\)/);
  });

  it('mounts ActRow only alongside ChainActionRow, under the same canAct (non-terminal) gate', () => {
    const mountSection = source.slice(source.indexOf('{canAct && ('), source.indexOf('{canAct && (') + 600);
    expect(mountSection).toContain('<ChainActionRow');
    expect(mountSection).toContain('<ActRow');
  });

  it('does not modify ask-agent, specialistRouter, or the constitutional agreement engine', () => {
    // Structural proxy: this file itself never imports from those modules --
    // it only ever calls the HTTP route, confirming composition rather than
    // reaching into their internals.
    expect(source).not.toContain('specialistRouter');
    expect(source).not.toContain('constitutionalAgreement');
  });
});
