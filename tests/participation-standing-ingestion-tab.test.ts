/**
 * ParticipationStandingTab — Ingestion Factory pairing canary (2026-08-01,
 * corrected same day per operator feedback).
 *
 * NOT a 4-way split (Standing/Reach/Receipts/Ingestion). The Ingestion
 * Factory renders full width and untouched — exactly as it appears
 * elsewhere in the iQube Registry — with Standing as ONE additional tab
 * beside it, reusing the SAME IngestionFactoryPanel component
 * IQubeRegistryIntakeTab already mounts (composition, not a fork —
 * inv.engineering.036/037). Source-scan style, matching this repo's
 * existing canary convention — no React rendering harness.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('ParticipationStandingTab — Ingestion Factory beside a single Standing tab, not a 4-way split', () => {
  const source = read('app/triad/components/codex/tabs/ParticipationStandingTab.tsx');

  it('imports the canonical IngestionFactoryPanel — never a duplicate implementation', () => {
    expect(source).toContain("import { IngestionFactoryPanel } from '@/components/registry/IngestionFactoryPanel';");
  });

  it('declares exactly 2 views: registry and standing — never a split of Standing into Standing/Reach/Receipts tabs', () => {
    expect(source).toMatch(/type StandingView = 'registry' \| 'standing';/);
    expect(source).not.toMatch(/'reach'\s*\|\s*'receipts'/);
  });

  it('defaults to the registry (Ingestion Factory) view, not Standing', () => {
    const match = source.match(/const \[view, setView\] = useState<StandingView>\('([a-z]+)'\)/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('registry');
  });

  it('renders IngestionFactoryPanel full width with no wrapping title/description chrome pushed above it', () => {
    const match = source.match(/if \(view === 'registry'\) \{([\s\S]*?)\n {2}\}/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('<IngestionFactoryPanel />');
    // No h2/title text competing with the panel's own header when this view is active.
    expect(match![1]).not.toMatch(/<h2/);
  });

  it('mounts IngestionFactoryPanel with no props — it is self-contained and reads its own canonical APIs', () => {
    expect(source).not.toMatch(/<IngestionFactoryPanel\s+\w/);
  });

  it('the Standing view keeps its original combined lanes+reach+receipts content in one tab, not three', () => {
    const match = source.match(/if \(view === 'registry'\)[\s\S]*?return \(\s*<div className="w-full">\s*\{tabStrip\}\s*<div className="mx-auto max-w-3xl([\s\S]*)$/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('Standing lanes');
    expect(match![1]).toContain('<h3 className="mb-2 text-sm font-semibold text-slate-200">Reach</h3>');
    expect(match![1]).toContain('Contribution history');
  });

  it('the tab strip offers exactly Ingestion Factory and Standing, both togglable from one row', () => {
    const match = source.match(/const tabStrip = \(([\s\S]*?)\n {2}\);/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain("setView('registry')");
    expect(match![1]).toContain("setView('standing')");
    expect(match![1]).toContain('Ingestion Factory');
    expect(match![1]).toMatch(/<Award className="h-3\.5 w-3\.5" \/>\s*Standing/);
  });
});

describe('Journey wiring — Activate stage documents the Ingestion Factory + Standing pairing', () => {
  it('journeySurfaceRegistry notes the pairing without claiming a 4-tab split', () => {
    const source = read('services/journey/journeySurfaceRegistry.ts');
    const match = source.match(/'venture-participate-standing':\s*\{([\s\S]*?)\n {2}\},/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('Ingestion Factory');
  });

  it('horizenMoneyPennyJourney Activate stage note mentions the Ingestion Factory pairing', () => {
    const source = read('services/journey/horizenMoneyPennyJourney.ts');
    const activateStageMatch = source.match(/id: 'activate',[\s\S]*?nextStageId: 'aigentme',/);
    expect(activateStageMatch).not.toBeNull();
    expect(activateStageMatch![0]).toContain('Ingestion Factory');
  });
});
