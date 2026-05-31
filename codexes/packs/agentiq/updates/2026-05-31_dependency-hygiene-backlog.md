# Dependency Hygiene Backlog — npm deprecation warnings + transitive cleanup

**Date:** 2026-05-31
**Triggered by:** Amplify build log (2026-05-31T04:13–14Z) surfacing 20+ deprecation warnings during `npm install`.
**Status:** Backlog — not blocking. Recommended next dependency-upgrade window.

---

## Why this exists

The Amplify build log produces a wall of `npm warn deprecated` messages on every install. None of them currently break the build — they're informational — but they fill the log noise budget and obscure real warnings, and some flag transitive deps that have known issues (slowdowns, security advisories, or removal from npm in future versions).

The most recent build also hit a transient `ECONNRESET` during `npm install` (see `.amplify-deploy` 2026-05-31T04:28Z trigger commit `3149f5c8`). Old transitive deps from less-mirrored packages compound the chance of fetch failure.

---

## Warnings surfaced (2026-05-31 build)

Grouped by upgrade direction:

### Glob / rimraf family — old globbing implementations

```
glob@5.0.15  → use glob@10+
glob@7.1.7   → use glob@10+
glob@7.2.3   → use glob@10+ (multiple instances)
glob@8.1.0   → use glob@10+
rimraf@3.0.2 → use rimraf@4+
```

**Why it matters:** transitive deps from older test/build tooling. Globs are O(N) on each invocation in older versions; v9+ is significantly faster.

**Fix path:** identify which top-level deps pull these (likely `npm-run-all`, older test runners, legacy ESLint plugins). Bump or replace top-level deps; transitive globs follow.

### Lodash micro-packages

```
lodash.isequal@4.5.0 → use require('node:util').isDeepStrictEqual
lodash.get@4.4.2     → use optional chaining (?.)
```

**Why it matters:** micro-packages each install a separate lodash; bundle size + install time bloat. Native equivalents are available in every Node version we support.

**Fix path:** grep callers, replace with native, drop the deps. Likely transitive — find the parent.

### ESLint family

```
eslint@8.57.1 → ESLint 8 no longer supported; migrate to ESLint 9
@humanwhocodes/object-schema@2.0.3 → use @eslint/object-schema
@humanwhocodes/config-array@0.13.0 → use @eslint/config-array
```

**Why it matters:** ESLint 9 migration is non-trivial (flat config required) but ESLint 8 is EOL.

**Fix path:** dedicated ESLint 9 migration PR. Plan for ~1 day; touches `.eslintrc` flat conversion + plugin compatibility.

### Core-js

```
core-js@2.6.12 → upgrade to 3.x (security + perf advisories)
```

**Why it matters:** `core-js@<3.23.3` has known security issues. Old core-js polyfills can cause 100× V8 slowdowns per the deprecation message.

**Fix path:** identify parent dep. Likely from an old Babel/webpack toolchain. Modern build outputs target ES2017+ and don't need core-js@2 polyfills.

### Misc smaller items

```
@substrate/connect@0.8.11 → 1.x       (likely from a wallet/web3 dep)
npmlog@5.0.1                          (no longer supported)
text-encoding@0.7.0                   (no longer maintained — Node has TextEncoder/TextDecoder built in)
node-domexception@1.0.0               (use native DOMException)
hast@1.0.0                            (renamed to rehype)
gauge@3.0.2                           (no longer supported)
are-we-there-yet@2.0.0                (no longer supported)
```

Most are transitive from older Node build tooling. The `text-encoding` + `node-domexception` ones are particularly worth removing — native equivalents exist on every supported Node version.

---

## Recommended approach

**Don't try to fix everything in one PR.** Break into three PRs by risk + blast radius:

### PR 1 — Safe transitive upgrades (low risk)

- Run `npm audit fix --force` in a sandbox, capture the diff
- Manually review which top-level deps got bumped
- Cherry-pick safe bumps only (patch + minor versions where changelog reviews clean)
- Smoke-test build + dev server + a representative set of routes
- Expected outcome: removes ~half the warnings without touching app code

### PR 2 — ESLint 9 migration

- Dedicated PR. Convert `.eslintrc*` to flat config (`eslint.config.mjs`)
- Audit plugin compatibility (every `eslint-plugin-*` needs an ESLint-9-compatible version)
- Re-run lint across the codebase, accept any new rule findings
- Estimated 1 day

### PR 3 — Lodash + core-js + native-replacement cleanup

- `grep -r "from 'lodash"` and `from "lodash.*"` — replace with native where trivial
- Remove the micro-packages once no consumer remains
- Identify the dep pulling `core-js@2` (likely `react-scripts`-era tooling); replace or bump
- Estimated 1 day

---

## Not in scope here

- Major version bumps of production deps (React, Next, Supabase, ethers, ReactQuery, etc.) — those are their own PRs with their own risk profiles
- Security-only dependabot alerts (handled separately by the dependabot config)
- The 296 vulnerability count GitHub reports — most are transitive low/moderate; this hygiene PR will likely reduce the count significantly as a side effect, but the security review is its own workstream

---

## Operational signal

If `ECONNRESET` repeats on `npm install` more than once a week, prioritise PR 1 above other backlog work. Old transitive deps from less-mirrored packages are the most common source of these flaky fetches.

---

## How to run

When this backlog item is picked up:

```bash
# In a fresh worktree on a clean branch
cd /path/to/AigentZBeta
git checkout -b deps/hygiene-2026-06

# PR 1 — safe upgrades
npm audit fix --force
npm install
git diff package*.json
# Review, sanity-check, run dev server, smoke-test
git add package*.json
git commit -m "deps: PR 1 — safe transitive upgrades (removes glob/rimraf/lodash micro-package warnings)"

# PR 2 — ESLint 9 (separate branch)
git checkout -b deps/eslint-9
# Convert eslintrc, install eslint@9, fix plugin compat, run lint
# ...
```

Each PR pushes individually; don't bundle.

---

**Filed under:** `codexes/packs/agentiq/updates/`. Pick up when a clear engineering window opens; not blocking any current workstream.
