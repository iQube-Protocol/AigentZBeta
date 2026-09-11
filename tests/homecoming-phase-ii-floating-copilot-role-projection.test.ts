/**
 * Floating aigentMe copilot — P1 Item 6 (operator brief 2026-08-16, "fix
 * the floating aigentMe copilot by tracing the existing mount").
 *
 * Direct trace confirmed the actual floating bubble the app renders on the
 * metaMe cartridge (app/triad/components/CodexPanelDynamic.tsx, mounting
 * CodexCopilotLayer with agent from data/codex-configs.ts's metame-codex
 * entry: `{ id: 'aigent-me', name: 'aigentMe' }`) had a purely static
 * header label with no role-derived selector — unlike
 * SmartTriadCopilotLayer, which already mounts AigentMeRoleSelector
 * (components/smarttriad/copilot/AigentMeRoleSelector.tsx) in its header,
 * gated on `agentId === 'aigent-me'`.
 *
 * The fix reuses that SAME selector in CodexCopilotLayer's header — never a
 * second, parallel selector — so switching the aigentMe role from either
 * mount converges on the identical resolveConstitutionalContext() projection
 * (GET /api/identity/constitutional-context).
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const FILE = 'app/components/codex/CodexCopilotLayer.tsx';
const CANONICAL_SELECTOR_PATH = 'components/smarttriad/copilot/AigentMeRoleSelector';

describe('CodexCopilotLayer floating copilot header — reuses the canonical aigentMe role selector', () => {
  it('imports the SAME AigentMeRoleSelector SmartTriadCopilotLayer uses, not a new one', () => {
    const code = stripComments(readSource(FILE));
    expect(code).toContain(`from "@/${CANONICAL_SELECTOR_PATH}"`);
  });

  it('mounts the selector gated on agent.id === "aigent-me", matching SmartTriadCopilotLayer\'s own gate', () => {
    const code = stripComments(readSource(FILE));
    const uses = code.match(/agent\?\.id === 'aigent-me' && <AigentMeRoleSelector personaId=\{personaId\} \/>/g) ?? [];
    expect(uses.length, 'expected the selector mounted in both header render branches').toBeGreaterThanOrEqual(2);
  });

  it('no second aigentMe-role selector component was created for this mount', () => {
    // A parallel selector file would be the exact anti-pattern the brief
    // forbids ("do not create another selector").
    const code = readSource(FILE);
    expect(code).not.toMatch(/function\s+AigentMeRoleSelector/);
    expect(code).not.toMatch(/const\s+AigentMeRoleSelector\s*=/);
  });
});
