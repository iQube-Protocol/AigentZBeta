/**
 * ParticipationStandingTab — 4-tab restructure canary (2026-08-01).
 *
 * Operator direction: the Activate stage's Standing surface must also expose
 * the registry Ingestion Factory as a 4th tab, reusing the SAME
 * IngestionFactoryPanel component IQubeRegistryIntakeTab already mounts
 * (composition, not a fork — inv.engineering.036/037). Source-scan style,
 * matching this repo's existing canary convention — no React rendering
 * harness.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('ParticipationStandingTab — Ingestion Factory is the 4th tab, not a fork', () => {
  const source = read('app/triad/components/codex/tabs/ParticipationStandingTab.tsx');

  it('imports the canonical IngestionFactoryPanel — never a duplicate implementation', () => {
    expect(source).toContain("import { IngestionFactoryPanel } from '@/components/registry/IngestionFactoryPanel';");
  });

  it('declares exactly 4 sub-tabs: standing, reach, receipts, ingestion', () => {
    const match = source.match(/const SUB_TABS:[\s\S]*?\]\s*;/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain("id: 'standing'");
    expect(match![0]).toContain("id: 'reach'");
    expect(match![0]).toContain("id: 'receipts'");
    expect(match![0]).toContain("id: 'ingestion'");
    expect(match![0]).toContain('Ingestion Factory');
  });

  it('renders IngestionFactoryPanel when the ingestion tab is active', () => {
    expect(source).toMatch(/activeTab === 'ingestion'[\s\S]{0,40}<IngestionFactoryPanel \/>/);
  });

  it('mounts IngestionFactoryPanel with no props — it is self-contained and reads its own canonical APIs', () => {
    expect(source).not.toMatch(/<IngestionFactoryPanel\s+\w/);
  });
});

describe('Journey wiring — Activate stage documents the 4-tab Standing surface', () => {
  it('journeySurfaceRegistry notes the Ingestion Factory as the 4th tab', () => {
    const source = read('services/journey/journeySurfaceRegistry.ts');
    const match = source.match(/'venture-participate-standing':\s*\{([\s\S]*?)\n {2}\},/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('Ingestion Factory');
  });

  it('horizenMoneyPennyJourney Activate stage note mentions the Ingestion Factory tab', () => {
    const source = read('services/journey/horizenMoneyPennyJourney.ts');
    const activateStageMatch = source.match(/id: 'activate',[\s\S]*?nextStageId: 'aigentme',/);
    expect(activateStageMatch).not.toBeNull();
    expect(activateStageMatch![0]).toContain('Ingestion Factory');
  });
});
