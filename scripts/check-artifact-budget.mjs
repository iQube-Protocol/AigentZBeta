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
import { statSync, existsSync, readdirSync } from "fs";
import { join } from "path";

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

  const measured = dirSizeBytes(standalonePath);
  const remaining = budget - measured;
  const capHeadroom = AMPLIFY_HARD_CAP_BYTES - measured;

  console.log(`[artifact-budget] measured .next/standalone: ${measured} bytes`);
  console.log(`[artifact-budget] budget:                    ${budget} bytes`);
  console.log(`[artifact-budget] remaining headroom (budget):    ${remaining >= 0 ? "+" : ""}${remaining} bytes`);
  console.log(`[artifact-budget] remaining headroom (Amplify's hard cap): ${capHeadroom >= 0 ? "+" : ""}${capHeadroom} bytes`);

  if (measured > budget) {
    console.error(
      `[artifact-budget] FAIL: cleaned .next/standalone (${measured} bytes) exceeds the ` +
        `${budget}-byte budget by ${measured - budget} bytes. This budget exists precisely so a ` +
        `growth like this is caught HERE, at build time, with a clear byte count and a route to ` +
        `investigate -- not as a razor-thin Amplify CustomerError days later. See CLAUDE.md's ` +
        `"Amplify Build-Size Budget" section: any new native dependency or traced asset over 5 MB ` +
        `needs explicit route attribution and a documented runtime-placement decision before it ships.`,
    );
    process.exit(1);
  }

  console.log(`[artifact-budget] PASS: within budget.`);
  process.exit(0);
}

main();
