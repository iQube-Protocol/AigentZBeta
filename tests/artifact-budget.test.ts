/**
 * scripts/check-artifact-budget.mjs is the enforcement point for CLAUDE.md's
 * "Amplify Build-Size Budget" invariant: the cleaned .next/standalone
 * artifact must stay under a fixed byte budget, well clear of Amplify's
 * 230,686,720-byte hard SSR-compute cap. A gate that only exists as prose
 * regresses silently (the exact failure mode this repo's own dev-merge-
 * message rule and pack-corpus rules were written to stop) -- this is the
 * executable half.
 *
 * Four required behaviors, each with its own fixture: under budget, exactly
 * at budget (inclusive pass), over budget, and a missing .next/standalone
 * (fail closed).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO = path.join(__dirname, '..');
const SCRIPT = path.join(REPO, 'scripts', 'check-artifact-budget.mjs');

let tmpDir: string | null = null;

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

function makeStandaloneOfSize(totalBytes: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-budget-fixture-'));
  const standalone = path.join(dir, '.next', 'standalone');
  fs.mkdirSync(standalone, { recursive: true });
  fs.writeFileSync(path.join(standalone, 'payload.bin'), Buffer.alloc(totalBytes, 1));
  return dir;
}

function run(dir: string, budget: number): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('node', [SCRIPT, '--dir', dir, '--budget', String(budget)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err: any) {
    return { code: err.status ?? 1, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '' };
  }
}

describe('scripts/check-artifact-budget.mjs', () => {
  it('passes when the artifact is under budget', () => {
    tmpDir = makeStandaloneOfSize(1_000_000);
    const result = run(tmpDir, 2_000_000);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('PASS: within budget');
    expect(result.stdout).toContain('measured .next/standalone: 1000000 bytes');
  });

  it('passes when the artifact is EXACTLY at budget (inclusive boundary)', () => {
    tmpDir = makeStandaloneOfSize(1_500_000);
    const result = run(tmpDir, 1_500_000);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('PASS: within budget');
    expect(result.stdout).toContain('remaining headroom (budget):    +0 bytes');
  });

  it('fails when the artifact exceeds budget, printing measured/budget/overage', () => {
    tmpDir = makeStandaloneOfSize(1_500_001);
    const result = run(tmpDir, 1_500_000);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('FAIL');
    expect(result.stderr).toContain('exceeds the 1500000-byte budget by 1 bytes');
  });

  it('fails closed when .next/standalone is missing entirely', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-budget-fixture-'));
    // Deliberately no .next/standalone under this directory.
    const result = run(tmpDir, 190_000_000);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('FAIL CLOSED');
    expect(result.stderr).toContain('does not exist');
  });

  it('ignores symlinks rather than following them into the measurement (matches the prune guard\'s own hazard)', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-budget-fixture-'));
    const standalone = path.join(tmpDir, '.next', 'standalone');
    fs.mkdirSync(standalone, { recursive: true });
    fs.writeFileSync(path.join(standalone, 'real.bin'), Buffer.alloc(100, 1));
    // A symlink pointing at something huge outside the artifact must not be
    // dereferenced into the size count -- exactly the symlinked-node_modules
    // hazard scripts/guard-standalone-prune.sh exists to prevent, applied to
    // measurement rather than deletion.
    const outsideBig = path.join(tmpDir, 'outside-huge.bin');
    fs.writeFileSync(outsideBig, Buffer.alloc(10_000_000, 1));
    fs.symlinkSync(outsideBig, path.join(standalone, 'link-to-outside'));
    const result = run(tmpDir, 1_000);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('measured .next/standalone: 100 bytes');
  });
});
