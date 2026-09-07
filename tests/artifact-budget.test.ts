/**
 * scripts/check-artifact-budget.mjs is the enforcement point for CLAUDE.md's
 * "Amplify Build-Size Budget" invariant: the cleaned .next/standalone
 * artifact must stay under a fixed byte budget, well clear of Amplify's
 * 230,686,720-byte hard SSR-compute cap. A gate that only exists as prose
 * regresses silently (the exact failure mode this repo's own dev-merge-
 * message rule and pack-corpus rules were written to stop) -- this is the
 * executable half.
 *
 * Required behaviors, each with its own fixture: under budget, exactly at
 * budget (ceiling is EXCLUSIVE -- exact equality fails), over budget, a
 * missing .next/standalone (fail closed), a safe in-artifact symlink
 * (ignored, does not fail), a symlink resolving outside the artifact (fail
 * closed), and .next/standalone/node_modules itself being a symlink (fail
 * closed -- the pnpm-compatibility hazard documented in
 * scripts/guard-standalone-prune.sh).
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

  it('fails when the artifact is EXACTLY at budget (ceiling is exclusive)', () => {
    tmpDir = makeStandaloneOfSize(1_500_000);
    const result = run(tmpDir, 1_500_000);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('FAIL');
    expect(result.stderr).toContain('meets or exceeds the 1500000-byte budget');
    expect(result.stderr).toContain('ceiling is exclusive');
  });

  it('fails when the artifact exceeds budget, printing measured/budget/overage', () => {
    tmpDir = makeStandaloneOfSize(1_500_001);
    const result = run(tmpDir, 1_500_000);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('FAIL');
    expect(result.stderr).toContain('meets or exceeds the 1500000-byte budget');
    expect(result.stderr).toContain('by 1 bytes');
  });

  it('fails closed when .next/standalone is missing entirely', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-budget-fixture-'));
    // Deliberately no .next/standalone under this directory.
    const result = run(tmpDir, 190_000_000);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('FAIL CLOSED');
    expect(result.stderr).toContain('does not exist');
  });

  it('ignores a symlink that resolves INSIDE the artifact rather than dereferencing it into the measurement', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-budget-fixture-'));
    const standalone = path.join(tmpDir, '.next', 'standalone');
    fs.mkdirSync(standalone, { recursive: true });
    fs.writeFileSync(path.join(standalone, 'real.bin'), Buffer.alloc(100, 1));
    // A symlink whose target is genuinely inside the artifact is safe -- it
    // is still not dereferenced into the byte count (symlinks are skipped
    // entirely, matching the prune guard's own hazard-avoidance), but it must
    // not trip the fail-closed outside-symlink check either.
    const insideTarget = path.join(standalone, 'real.bin');
    fs.symlinkSync(insideTarget, path.join(standalone, 'link-to-inside'));
    const result = run(tmpDir, 1_000);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('measured .next/standalone: 100 bytes');
  });

  it('fails closed when a symlink under .next/standalone resolves OUTSIDE it', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-budget-fixture-'));
    const standalone = path.join(tmpDir, '.next', 'standalone');
    fs.mkdirSync(standalone, { recursive: true });
    fs.writeFileSync(path.join(standalone, 'real.bin'), Buffer.alloc(100, 1));
    // A symlink pointing at something outside the artifact must fail the
    // gate rather than silently being skipped -- a later prune step could
    // follow it and touch files outside the disposable build artifact.
    const outsideBig = path.join(tmpDir, 'outside-huge.bin');
    fs.writeFileSync(outsideBig, Buffer.alloc(10_000_000, 1));
    fs.symlinkSync(outsideBig, path.join(standalone, 'link-to-outside'));
    const result = run(tmpDir, 1_000);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('FAIL CLOSED');
    expect(result.stderr).toContain('OUTSIDE');
  });

  it('fails closed when .next/standalone/node_modules itself is a symlink (pnpm-compatibility hazard)', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-budget-fixture-'));
    const standalone = path.join(tmpDir, '.next', 'standalone');
    fs.mkdirSync(standalone, { recursive: true });
    fs.writeFileSync(path.join(standalone, 'real.bin'), Buffer.alloc(100, 1));
    const realNodeModules = path.join(tmpDir, 'real-node_modules');
    fs.mkdirSync(realNodeModules, { recursive: true });
    fs.symlinkSync(realNodeModules, path.join(standalone, 'node_modules'));
    const result = run(tmpDir, 1_000);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('FAIL CLOSED');
    expect(result.stderr).toContain('node_modules');
    expect(result.stderr).toContain('is a symlink');
  });

  it('fails closed when a symlink under .next/standalone resolves outside it, even nested in a subdirectory', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-budget-fixture-'));
    const standalone = path.join(tmpDir, '.next', 'standalone');
    const nested = path.join(standalone, 'node_modules', 'some-pkg');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(standalone, 'real.bin'), Buffer.alloc(100, 1));
    const outsidePkg = path.join(tmpDir, 'outside-pkg');
    fs.mkdirSync(outsidePkg, { recursive: true });
    fs.symlinkSync(outsidePkg, path.join(nested, 'linked-dep'));
    const result = run(tmpDir, 1_000);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('FAIL CLOSED');
    expect(result.stderr).toContain('OUTSIDE');
  });
});
