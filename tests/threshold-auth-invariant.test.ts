import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractThresholdBearer,
  normalizeThresholdScope,
} from '@/services/threshold/requireThresholdSession';

const THRESHOLD_ROUTES = path.join(process.cwd(), 'app', 'api', 'threshold');
const BROWSER_AUTH_ALLOWLIST = new Set([
  // HUMAN authorization act: this route intentionally resolves canonical
  // persona authority before projecting it into a Threshold bearer.
  path.normalize('oauth/complete/route.ts'),
]);

function routeFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...routeFiles(absolute));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

describe('Threshold authentication invariant', () => {
  it('extracts Bearer credentials case-insensitively', () => {
    const headers = new Headers({ authorization: 'bEaReR ths_example_token' });
    expect(extractThresholdBearer({ headers })).toBe('ths_example_token');
  });

  it('rejects absent or non-Bearer authorization headers', () => {
    expect(extractThresholdBearer({ headers: new Headers() })).toBeNull();
    expect(extractThresholdBearer({ headers: new Headers({ authorization: 'Basic abc' }) })).toBeNull();
  });

  it('normalizes minted capability scope without changing order', () => {
    expect(normalizeThresholdScope([
      'passport.status.read',
      'content.asset.upload',
      'content.asset.upload',
      ' research.read ',
      '',
      'passport.status.read',
    ])).toEqual([
      'passport.status.read',
      'content.asset.upload',
      'research.read',
    ]);
  });

  it('forbids browser/persona auth adapters in Threshold action routes', () => {
    const offenders: string[] = [];
    for (const file of routeFiles(THRESHOLD_ROUTES)) {
      const relative = path.normalize(path.relative(THRESHOLD_ROUTES, file));
      if (BROWSER_AUTH_ALLOWLIST.has(relative)) continue;
      const source = fs.readFileSync(file, 'utf8');
      if (/from\s+['"]@\/services\/identity\/getActivePersona['"]/.test(source)) {
        offenders.push(relative);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps native upload action on the canonical Threshold auth adapter', () => {
    const file = path.join(THRESHOLD_ROUTES, 'upload-action', 'route.ts');
    const source = fs.readFileSync(file, 'utf8');
    expect(source).toContain("requireThresholdSession(req, 'content.asset.upload')");
    expect(source).not.toMatch(/from\s+['"]@\/services\/identity\/getActivePersona['"]/);
  });
});
