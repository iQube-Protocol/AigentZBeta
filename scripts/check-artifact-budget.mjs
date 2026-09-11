#!/usr/bin/env node
/**
 * Enforces the constitutional Amplify SSR artifact-size invariant (CLAUDE.md
 * "Amplify Build-Size Budget"). Amplify Hosting's 230,686,720-byte
 * (230686720) SSR Compute cap is a hard platform limit; this gate keeps the
 * CLEANED `.next/standalone` artifact well under it, with real headroom for
 * Amplify's own additional packaging overhead — not a razor's-edge pass.
 *
 * Run AFTER all postBuild pruning in amplify.yml (native-binary cleanup,
 * source-map/doc/type-declaration removal, pdf-parse vendored-build prune,
 * cache/trace/types removal) — this measures the artifact as it will
 * actually ship, not the raw `next build` output.
 *
 * Usage: node scripts/check-artifact-budget.mjs [--dir <dir-containing-.next>] [--budget <bytes>]
 * Exit 0: under budget. Exit 1: over budget, OR .next/standalone is missing
 * (fails closed — a missing standalone artifact means `output: "standalone"`
 * never activated, which is worse than an oversized one: every measurement
 * this script would print would be meaningless, and the 2026-09-07
 * forensic investigation's own first reproduction attempt hit exactly this
 * silently before it was caught).
 */
import { statSync, existsSync, readdirSync, lstatSync, realpathSync } from "fs";
import { join, sep } from "path";

const DEFAULT_BUDGET_BYTES = 190_000_000;
const AMPLIFY_HARD_CAP_BYTES = 230_686_720;

function parseArgs(argv) {
  let dir = ".";
  let budget = DEFAULT_BUDGET_BYTES;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") dir = argv[++i];
    else if (argv[i] === "--budget") budget = parseInt(argv[++i], 10);
  }
  return { dir, budget };
}

function dirSizeBytes(path) {
  let total = 0;
  const stack = [path];
  while (stack.length) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        // A symlink here is exactly the hazard documented in
        // scripts/guard-standalone-prune.sh -- never follow it into
        // measuring (or worse, pruning) something outside this artifact.
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        total += statSync(full).size;
      }
    }
  }
  return total;
}

/**
 * The same symlink hazard scripts/guard-standalone-prune.sh exists to catch
 * on the deletion side, checked here on the MEASUREMENT side: a symlinked
 * `.next/standalone/node_modules` (Next's pnpm-compatibility path when the
 * source node_modules is itself a symlink) means the artifact is not a real,
 * self-contained directory at all -- `dirSizeBytes` would silently measure
 * near-zero bytes for it (symlinks are skipped, never dereferenced), passing
 * a budget check that is measuring nothing. Any symlink ANYWHERE under
 * `.next/standalone` that resolves outside it is the same hazard one level
 * down (e.g. a package installed as a symlink) and must fail the gate too.
 * Returns a description of the first violation found, or null if none.
 */
function findUnsafeSymlink(standalonePath) {
  const standaloneReal = realpathSync(standalonePath);
  const nodeModulesPath = join(standalonePath, "node_modules");
  if (existsSync(nodeModulesPath) && lstatSync(nodeModulesPath).isSymbolicLink()) {
    return `${nodeModulesPath} is a symlink (-> ${realpathSync(nodeModulesPath)}) -- this is exactly the symlinked-node_modules hazard documented in scripts/guard-standalone-prune.sh; the artifact is not a real, self-contained directory and any byte measurement of it is meaningless.`;
  }

  const stack = [standalonePath];
  while (stack.length) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        let target;
        try {
          target = realpathSync(full);
        } catch {
          continue; // dangling symlink -- not a traversal-outside hazard
        }
        const isInside = target === standaloneReal || target.startsWith(standaloneReal + sep);
        if (!isInside) {
          return `${full} resolves to '${target}', OUTSIDE '${standaloneReal}' -- a budget measurement or later prune could touch files outside the disposable build artifact.`;
        }
        continue; // do not descend into a symlinked directory
      }
      if (entry.isDirectory()) {
        stack.push(full);
      }
    }
  }
  return null;
}

function main() {
  const { dir, budget } = parseArgs(process.argv.slice(2));
  const standalonePath = join(dir, ".next", "standalone");

  if (!existsSync(standalonePath)) {
    console.error(
      `[artifact-budget] FAIL CLOSED: ${standalonePath} does not exist. ` +
        `A missing .next/standalone means output: "standalone" never activated ` +
        `(check AWS_BRANCH/AMPLIFY_APP_ID were set before "next build" ran) -- ` +
        `every other measurement would be meaningless. Refusing to pass.`,
    );
    process.exit(1);
  }

  const unsafeSymlink = findUnsafeSymlink(standalonePath);
  if (unsafeSymlink) {
    console.error(`[artifact-budget] FAIL CLOSED: ${unsafeSymlink} Refusing to pass.`);
    process.exit(1);
  }

  const measured = dirSizeBytes(standalonePath);
  const remaining = budget - measured;
  const capHeadroom = AMPLIFY_HARD_CAP_BYTES - measured;

  console.log(`[artifact-budget] measured .next/standalone: ${measured} bytes`);
  console.log(`[artifact-budget] budget:                    ${budget} bytes`);
  console.log(`[artifact-budget] remaining headroom (budget):    ${remaining >= 0 ? "+" : ""}${remaining} bytes`);
  console.log(`[artifact-budget] remaining headroom (Amplify's hard cap): ${capHeadroom >= 0 ? "+" : ""}${capHeadroom} bytes`);

  // Exclusive ceiling: exact equality FAILS. The budget names the largest
  // size that is still comfortably clear of Amplify's hard cap -- landing
  // exactly on it is landing exactly on the edge this gate exists to avoid,
  // not a pass.
  if (measured >= budget) {
    console.error(
      `[artifact-budget] FAIL: cleaned .next/standalone (${measured} bytes) meets or exceeds the ` +
        `${budget}-byte budget (ceiling is exclusive) by ${measured - budget} bytes. This budget exists ` +
        `precisely so a growth like this is caught HERE, at build time, with a clear byte count and a ` +
        `route to investigate -- not as a razor-thin Amplify CustomerError days later. See CLAUDE.md's ` +
        `"Amplify Build-Size Budget" section: any new native dependency or traced asset over 5 MB ` +
        `needs explicit route attribution and a documented runtime-placement decision before it ships.`,
    );
    process.exit(1);
  }

  console.log(`[artifact-budget] PASS: within budget.`);
  process.exit(0);
}

main();
