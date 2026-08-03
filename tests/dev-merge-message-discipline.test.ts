/**
 * The dev merge message the operator reads in the Amplify build history.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 *
 * CLAUDE.md's "Push Commit Messages" rule is the most-repeated instruction in
 * this repo and it has regressed repeatedly. Its own diagnosis names the
 * cause: the rule lived as PROSE, and prose does not fail a build. This is
 * the missing enforcement point.
 *
 * `.github/workflows/merge-claude-to-dev.yml` writes the message the operator
 * actually sees. It takes the SUBJECT from the session branch's LAST commit:
 *
 *     SUBJECT="$(git log -1 --pretty=%s origin/<session-branch>)"
 *     git merge --ff-only ... || git merge ... -m "merge <branch>: ${SUBJECT}"
 *
 * Two ways that produces an uninformative dev history, and this file guards
 * both:
 *
 *  1. THE WORKFLOW ITSELF regressing to the old `--no-edit` fallback, which
 *     emits the forbidden `Merge remote-tracking branch 'origin/claude/…'
 *     into dev`. Historically this recurred because the fix lived only on
 *     session branches and `dev` while `main` kept the stale copy — GitHub
 *     runs the copy in the PUSHED branch, so any branch seeded from a stale
 *     base reverted.
 *
 *  2. A BARE DEPLOY-TRIGGER COMMIT left as the branch tip. The workflow
 *     faithfully copies whatever the last subject is, so ending a push with a
 *     `.amplify-deploy`-only commit named "trigger deploy: …" produces
 *     `merge <branch>: trigger deploy: …` on dev — technically not the
 *     forbidden boilerplate, but it tells the operator nothing about what
 *     shipped, which is the entire point of the rule. Observed 2026-08-03
 *     (dev 3a3ac0390). The remedy is not a better trigger message: it is to
 *     fold the `.amplify-deploy` touch INTO the substantive commit so the
 *     branch tip always names the change.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const REPO = path.join(__dirname, '..');
const WORKFLOW = path.join(REPO, '.github', 'workflows', 'merge-claude-to-dev.yml');

describe('the auto-merge workflow writes a descriptive dev merge message', () => {
  it('exists on this branch — GitHub runs the copy in the pushed branch, not a central one', () => {
    expect(fs.existsSync(WORKFLOW), 'merge-claude-to-dev.yml missing from this branch').toBe(true);
  });

  it('derives the merge subject from the session branch tip, never --no-edit', () => {
    const yml = fs.readFileSync(WORKFLOW, 'utf8');
    expect(yml).toMatch(/SUBJECT="\$\(git log -1 --pretty=%s origin\//);
    expect(yml).toMatch(/git merge origin\/\$\{\{ github\.ref_name \}\} -m "merge/);
    // The old fallback is what emits "Merge remote-tracking branch ... into dev".
    const mergeLines = yml.split('\n').filter((l) => l.includes('git merge'));
    for (const line of mergeLines) {
      expect(line, `--no-edit reintroduced: ${line.trim()}`).not.toContain('--no-edit');
    }
  });
});

describe('the branch tip names the change, so the dev merge message does too', () => {
  /*
   * Reads real git history rather than asserting about source text — the
   * subject that reaches dev IS this value, so this is the honest thing to
   * check (OS-9: a canary must be written against real evidence).
   */
  function headSubject(): string | null {
    try {
      return execSync('git log -1 --pretty=%s', { cwd: REPO, encoding: 'utf8' }).trim();
    } catch {
      return null; // No git context (e.g. a packaged checkout) — cannot judge.
    }
  }

  it('the tip is not a bare deploy-trigger commit', () => {
    const subject = headSubject();
    if (subject === null) return; // Unjudgeable, not failed.
    expect(
      /^(trigger deploy|deploy trigger|chore: deploy|bump \.amplify-deploy)/i.test(subject),
      `HEAD subject "${subject}" would reach dev as "merge <branch>: ${subject}", which does not ` +
        'name what shipped. Fold the .amplify-deploy touch into the substantive commit instead.',
    ).toBe(false);
  });

  it('the tip is not a default git-generated merge message', () => {
    const subject = headSubject();
    if (subject === null) return;
    expect(
      /^Merge (remote-tracking )?branch/i.test(subject),
      `HEAD subject "${subject}" is a default git merge message — CLAUDE.md forbids these on any ` +
        'deploy-triggering push. Re-do the merge with an explicit -m naming the content.',
    ).toBe(false);
  });
});
