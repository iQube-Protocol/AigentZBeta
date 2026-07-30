import { describe, it, expect } from 'vitest';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const REPO = join(__dirname, '..');

describe('R-12 -- BitCent Rune name-availability check (governed-reserve, 2026-07-30)', () => {
  it('a 404 from the indexer is reported as inconclusive-toward-available, never an unqualified "available"', async () => {
    const { checkName } = await import(pathToFileURL(join(REPO, 'scripts/check-bitcent-name-availability.js')).href);
    const result = await checkName('BITCENT', { httpGet: async () => ({ status: 404, data: undefined }) });
    expect(result.verdict).toMatch(/LIKELY AVAILABLE/);
    // Never conclusive from one indexer's 404 alone -- a second source is required.
    expect(result.conclusive).toBe(false);
  });

  it('a 200 with an existing Rune record is reported as taken, conclusively', async () => {
    const { checkName } = await import(pathToFileURL(join(REPO, 'scripts/check-bitcent-name-availability.js')).href);
    const result = await checkName('BITCENT', {
      httpGet: async () => ({ status: 200, data: { rune: 'BITCENT', etched: true } }),
    });
    expect(result.verdict).toMatch(/ALREADY ETCHED/);
    expect(result.conclusive).toBe(true);
  });

  it('an unexpected status is INCONCLUSIVE, never coerced into a yes/no answer', async () => {
    const { checkName } = await import(pathToFileURL(join(REPO, 'scripts/check-bitcent-name-availability.js')).href);
    const result = await checkName('BITCENT', { httpGet: async () => ({ status: 500, data: null }) });
    expect(result.verdict).toBe('INCONCLUSIVE');
    expect(result.conclusive).toBe(false);
  });

  it('a transport failure is INCONCLUSIVE, not a silent "available"', async () => {
    const { checkName } = await import(pathToFileURL(join(REPO, 'scripts/check-bitcent-name-availability.js')).href);
    const result = await checkName('BITCENT', {
      httpGet: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    expect(result.verdict).toBe('INCONCLUSIVE');
    expect(result.detail).toMatch(/ECONNREFUSED/);
  });

  it('loads the name from the ratified issuance record, not a hardcoded literal', async () => {
    const src = require('node:fs').readFileSync(join(REPO, 'scripts/check-bitcent-name-availability.js'), 'utf-8');
    expect(src).toMatch(/loadIssuanceRecord/);
    expect(src).toMatch(/record\.runeName\?\.value/);
  });
});
