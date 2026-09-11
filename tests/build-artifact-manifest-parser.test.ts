/**
 * scripts/build-artifact-manifest.sh's sha256/path join was broken: it ran
 * `awk -F'\t'` against `sha256sum`'s own output, which is NEVER tab-
 * separated (format: "<64-hex><SP><mode-char><filename>" -- a single space,
 * then a mode character (' ' text / '*' binary), then the filename
 * verbatim). With no tabs to split on, the whole "hash  path" line collapsed
 * into one field, so every manifest row came out with an empty path, an
 * empty size, and the hash+path crammed into the third column -- silently,
 * for every single file, on every run this script ever produced (discovered
 * 2026-09-07 during the Amplify build-size forensic investigation while
 * diffing two manifests that should have matched on path exactly).
 *
 * This fixture builds a tiny fake `.next` tree -- including a filename that
 * contains a space, the exact case that would break a naive space-based
 * split -- runs the real script against it, and asserts every manifest row
 * has the correct path, byte count, and sha256 digest.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO = path.join(__dirname, '..');
const SCRIPT = path.join(REPO, 'scripts', 'build-artifact-manifest.sh');

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

describe('scripts/build-artifact-manifest.sh — path/size/hash parsing', () => {
  let tmpDir: string;
  let outPrefix: string;
  const fixtures: Record<string, string> = {
    '.next/BUILD_ID': 'fixture-build-id',
    '.next/standalone/server.js': 'console.log("fixture server")',
    // The case that breaks a naive `awk -F'\t'` join against raw sha256sum
    // output: a filename containing a literal space.
    '.next/static/chunks/app auth page.js': 'export default function Page() {}',
    // A second space-bearing name, with a DIFFERENT byte length, so a bug
    // that merely swapps two rows (rather than corrupting all of them)
    // would still be caught by the byte-count assertion.
    '.next/server/app/api/my route/route.js': 'export const GET = () => new Response("ok")',
  };

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-fixture-'));
    for (const [rel, content] of Object.entries(fixtures)) {
      const abs = path.join(tmpDir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, 'utf8');
    }
    outPrefix = path.join(tmpDir, 'out');
    execFileSync('bash', [SCRIPT, tmpDir, outPrefix], { stdio: 'pipe' });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes a manifest row for every fixture file', () => {
    const manifest = fs.readFileSync(`${outPrefix}.manifest.tsv`, 'utf8').trim().split('\n');
    expect(manifest.length).toBe(Object.keys(fixtures).length);
  });

  it('parses path, byte count, and sha256 correctly for every row -- including space-bearing filenames', () => {
    const rows = fs
      .readFileSync(`${outPrefix}.manifest.tsv`, 'utf8')
      .trim()
      .split('\n')
      .map((line) => {
        const [filePath, bytes, hash] = line.split('\t');
        return { filePath, bytes, hash };
      });

    for (const [rel, content] of Object.entries(fixtures)) {
      const row = rows.find((r) => r.filePath === rel);
      expect(row, `no manifest row found for path "${rel}" -- got paths: ${rows.map((r) => r.filePath).join(', ')}`).toBeDefined();
      expect(row!.bytes, `wrong byte count for "${rel}"`).toBe(String(Buffer.byteLength(content, 'utf8')));
      expect(row!.hash, `wrong sha256 for "${rel}"`).toBe(sha256(content));
    }
  });

  it('never leaves a row with an empty path or empty size (the exact corruption the bug produced)', () => {
    const rows = fs.readFileSync(`${outPrefix}.manifest.tsv`, 'utf8').trim().split('\n');
    for (const line of rows) {
      const [filePath, bytes, hash] = line.split('\t');
      expect(filePath, `empty path in row: ${JSON.stringify(line)}`).not.toBe('');
      expect(bytes, `empty size in row: ${JSON.stringify(line)}`).not.toBe('');
      expect(hash, `row missing a 64-hex-char hash: ${JSON.stringify(line)}`).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
