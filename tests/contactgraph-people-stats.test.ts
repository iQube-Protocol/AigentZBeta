import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('ContactGraph People statistics', () => {
  it('paginates imported contact rows so sources above the PostgREST row cap are counted', () => {
    const reconciliation = source('services/contactGraph/reconciliation.ts');
    expect(reconciliation).toContain('const pageSize = 1000');
    expect(reconciliation).toContain('.range(offset, offset + pageSize - 1)');
    expect(reconciliation).toContain("const source = row.source?.trim() || 'unknown'");
  });

  it('keeps imported records distinct from canonical graph people', () => {
    const route = source('app/api/contactgraph/people/route.ts');
    expect(route).toContain('graphPeople: result.value.people.length');
    expect(route).toContain('importedRecords: imports.value.importedRecords');
    expect(route).toContain('importedBySource: imports.value.bySource');
  });

  it('uses one shared statistics projection in Agent Me and Runtime People surfaces', () => {
    const compact = source('components/metame/welcome/layouts/PeopleLayout.tsx');
    const runtime = source('components/metame/runtime/RuntimeQubeTalkDrawer.tsx');
    const strip = source('components/metame/contactgraph/ContactGraphStatsStrip.tsx');

    expect(compact).toContain('<ContactGraphStatsStrip stats={stats} theme={theme} />');
    expect(runtime).toContain('<ContactGraphStatsStrip stats={stats} theme="dark" />');
    expect(strip).toContain('Import records preserve source provenance and may overlap.');
  });
});
