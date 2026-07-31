/**
 * MMC Flow — Movement IV (Project) canary (PRD-MMC-IMPL-005 Increment 2).
 *
 * Mirrors `tests/companion-act.test.ts`'s structural-grep style: locks the
 * composition-not-duplication guarantee (only the existing create-artifact/
 * connectors/execute/approve-action pipeline is called, never a new route)
 * and protects the pre-existing email path from regression while the
 * Calendar/Doc quick-actions are added alongside it.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const PANEL_PATH = join(process.cwd(), 'components', 'metame', 'workbench', 'IntentChainPanel.tsx');
const source = readFileSync(PANEL_PATH, 'utf8');

// PostApprovalDraftButton's own function body only -- bounded to the next
// top-level function declaration (ChildIntentActionRow).
const fnStart = source.indexOf('function PostApprovalDraftButton(');
const fnEnd = source.indexOf('function ChildIntentActionRow(');
const fnSection = source.slice(fnStart, fnEnd);

describe('IntentChainPanel — Project (Movement IV) composition canary', () => {
  it('declares exactly the three project kinds', () => {
    expect(source).toContain("type ProjectKind = 'email' | 'calendar' | 'doc';");
  });

  it('never introduces a new route -- only create-artifact is POSTed', () => {
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const fetchTargets = [...fnSection.matchAll(/personaFetch\(\s*'([^']+)'/g)].map((m) => m[1]);
    expect(new Set(fetchTargets)).toEqual(new Set(['/api/assistant/create-artifact']));
  });

  it('uses personaFetch, never raw fetch', () => {
    expect(fnSection).not.toMatch(/[^A-Za-z]fetch\(/);
    expect(fnSection).toContain('personaFetch(');
  });

  it('calendar connectorInput uses the real create-artifact field names (summary/startIso/endIso)', () => {
    expect(fnSection).toContain('summary: subject || child.intentName');
    expect(fnSection).toContain('startIso:');
    expect(fnSection).toContain('endIso:');
    // Must NOT use the wrong/guessed field names.
    expect(fnSection).not.toMatch(/connectorInput:\s*\{\s*title:[^}]*start:/);
  });

  it('doc connectorInput uses the real create-artifact field name (title)', () => {
    expect(fnSection).toMatch(/artifactType:\s*'google-doc'[\s\S]*?connectorInput:\s*\{\s*title:/);
  });

  it('the pre-existing email request shape is unchanged (regression canary)', () => {
    expect(fnSection).toContain("artifactType: 'gmail-draft'");
    expect(fnSection).toContain("destination: 'gmail'");
    expect(fnSection).toContain('connectorInput: { to: to.trim(), subject: subject || child.intentName, bodyText: body }');
  });

  it("the pre-existing isEmailIntent gate is unchanged (regression canary)", () => {
    expect(fnSection).toContain('/email|gmail|outreach|message|draft/i.test(child.intentName)');
  });

  it('treats a missing actionConnectorId as success (eager-create), not a thrown error', () => {
    // The old logic threw whenever actionConnectorId was absent -- that was
    // correct ONLY because gmail-draft always sets one. Calendar (private
    // event) and Doc (no share suggestion) legitimately succeed without one,
    // so the fixed logic must branch on data.actionConnectorId rather than
    // throwing whenever it's absent.
    expect(fnSection).not.toMatch(/if\s*\(!res\.ok\s*\|\|\s*!data\.actionConnectorId\)/);
    expect(fnSection).toContain('if (data.actionConnectorId)');
    expect(fnSection).toContain('setCreatedLink(');
  });

  it('never modifies create-artifact, connectors/execute, or the google connector registry', () => {
    expect(source).not.toContain('GOOGLE_CONNECTORS');
    expect(source).not.toContain("from '@/services/google/connectors'");
  });
});
