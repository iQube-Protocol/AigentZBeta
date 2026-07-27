/**
 * persona-spine-fetch — the canary CLAUDE.md has always named and that did not
 * exist until 2026-07-27.
 *
 * THE RULE (CLAUDE.md, "Client-side spine fetches — MUST use `personaFetch`"):
 * any client-side call to a route that resolves the caller through the identity
 * spine (`getActivePersona` / `getCallerIdentityContext`) must go through
 * `personaFetch`. Neither raw `fetch` nor `authedFetchHeaders` + `fetch` is
 * acceptable:
 *
 *   - raw `fetch` sends no Bearer at all → the route 401s and the surface falls
 *     into its empty state with no console error ("the feature just doesn't
 *     work for this user");
 *   - `authedFetchHeaders` + `fetch` sends the Bearer but carries NO PERSONA
 *     SELECTION → `getActivePersona` resolves a FALLBACK persona for an operator
 *     who owns several. This is the more dangerous of the two because it fails
 *     silently and plausibly: real-looking data for the wrong identity.
 *
 * WHY IT MATTERS BEYOND ADMIN SURFACES. A steward route gated on
 * `cartridgeFlags.isAdmin` bounds the damage — a fallback persona belonging to
 * the same admin still passes the gate. That bound disappears the moment a
 * surface becomes PARTICIPANT-FACING, where a partner operator reading a
 * fallback persona would see another participant's grants. The Venture Lab
 * Participation surface is exactly that, which is why this canary is a
 * prerequisite of it rather than a clean-up after it.
 *
 * WHAT THIS ASSERTS. Source-level, because the defect is a transport choice
 * visible in source and invisible at runtime until someone owns two personas:
 *   1. the spine-endpoint allowlist is real (each path is served by a route that
 *      actually resolves through the spine) — otherwise the canary could pass by
 *      guarding nothing;
 *   2. no client component calls a spine endpoint through a forbidden transport;
 *   3. `personaFetch` itself still carries persona selection (hint → URL,
 *      `x-persona-id` header) — the property everything above depends on.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { readSource, stripComments } from './_lib/sourceAuthority';

/**
 * Client-visible path prefixes whose routes resolve the caller through the
 * spine. Each is verified against the route source below — a prefix that no
 * longer resolves through the spine must be removed from this list, and one
 * that starts to must be added.
 */
const SPINE_ENDPOINT_PREFIXES = [
  '/api/steward/participation',
  '/api/participation/',
  '/api/wallet/active-persona',
  '/api/persona/',
] as const;

/** Route files backing the prefixes above — used to prove the list is honest. */
const PREFIX_ROUTE_PROOF: Record<string, string> = {
  '/api/steward/participation': 'app/api/steward/participation/route.ts',
  '/api/participation/': 'app/api/participation/my-access/route.ts',
};

/**
 * PRINCIPLED EXCEPTION — modules that ESTABLISH the active persona cannot route
 * through the transport that CONSUMES it. `personaFetch` reads
 * `localStorage['currentPersonaId']`, which `PersonaContext` owns and writes;
 * routing the resolver through it would be circular. These modules read the JWT
 * directly and attach the Bearer themselves, so they are not the persona-unaware
 * defect — they are the persona resolver.
 */
const PERSONA_BOOTSTRAP = new Set([
  'app/contexts/PersonaContext.tsx',
  'app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts',
]);

/**
 * FROZEN DEBT BASELINE — pre-existing violations found when this canary was
 * finally written (2026-07-27). The rule had been documented in CLAUDE.md and
 * UNENFORCED, so violations accumulated. Each is named with why it was not
 * fixed in the same pass; the list MUST NOT GROW, and the count assertion below
 * fails the build if it does.
 *
 * Deliberately NOT a blanket allowlist: a new offender in a file not on this
 * list fails immediately, and removing an entry (by fixing it) is always safe.
 */
const KNOWN_DEBT: Record<string, string> = {
  // Tier 1 sovereign surface with 10+ call sites mixing two header helpers.
  // Converting it blind, without being able to exercise the Locker, risks
  // breaking the operator's own Locker. Its own focused increment.
  'app/triad/components/codex/tabs/LockerTab.tsx':
    'Tier 1 Locker — 10+ call sites, needs a focused pass with live verification',
  'app/triad/components/codex/tabs/PassportBureauApplyTab.tsx':
    'Passport application surface — same conversion, same focused pass',
  // These pass an explicit ?personaId= on the URL, which the spine honours
  // (ownership-checked), so they carry persona selection even without
  // personaFetch. Different risk profile: a possible 401, not a silent
  // wrong-persona read.
  'app/components/content/SmartTriadProvider.tsx':
    'passes explicit ?personaId= — carries selection; lacks Bearer',
  'app/hooks/useCardAccess.ts':
    'passes explicit ?personaId= — carries selection; lacks Bearer',
  // Attaches a Bearer by hand with no persona hint. Borderline bootstrap: the
  // wallet drawer is where persona switching happens.
  'app/components/content/SmartWalletDrawer.tsx':
    'hand-attached Bearer, no hint — wallet owns persona switching (borderline bootstrap)',
};

const CLIENT_ROOTS = ['app', 'components'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'worktrees']);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** Only client components can commit this defect — server code has no transport choice. */
function isClientModule(src: string): boolean {
  return /^\s*["']use client["']/m.test(src);
}

describe('spine endpoints are reached only through personaFetch', () => {
  it('the allowlist is honest — each prefix is served by a route that resolves through the spine', () => {
    // Guards against the canary passing vacuously because the list drifted off
    // the real spine surface.
    for (const [prefix, routePath] of Object.entries(PREFIX_ROUTE_PROOF)) {
      const route = stripComments(readSource(routePath));
      expect(
        /getActivePersona|getCallerIdentityContext/.test(route),
        `${prefix} is on the allowlist but ${routePath} does not resolve through the spine`,
      ).toBe(true);
    }
    expect(SPINE_ENDPOINT_PREFIXES.length).toBeGreaterThan(0);
  });

  it('no client module reaches a spine endpoint with a forbidden transport', () => {
    const offenders: string[] = [];

    for (const root of CLIENT_ROOTS) {
      for (const file of walk(root)) {
        const raw = readFileSync(file, 'utf-8');
        if (!isClientModule(raw)) continue;
        const src = stripComments(raw);

        // Which spine endpoints does this module name at all?
        const touched = SPINE_ENDPOINT_PREFIXES.filter((p) => src.includes(p));
        if (touched.length === 0) continue;

        // `authedFetchHeaders` in a module that talks to a spine endpoint is the
        // persona-unaware pattern — forbidden outright, because its whole
        // purpose is to hand-build auth headers for a raw fetch.
        const rel = file.replace(/\\/g, '/');
        if (PERSONA_BOOTSTRAP.has(rel) || rel in KNOWN_DEBT) continue;

        if (/\bauthedFetchHeaders\b/.test(src)) {
          offenders.push(
            `${file}: uses authedFetchHeaders while calling ${touched.join(', ')} — persona-UNAWARE (CLAUDE.md)`,
          );
          continue;
        }

        // A bare `fetch('<spine path>'…)` — no Bearer at all.
        for (const prefix of touched) {
          const bare = new RegExp(`(?<!persona)\\bfetch\\(\\s*["'\`]${prefix.replace(/\//g, '\\/')}`);
          if (bare.test(src)) {
            offenders.push(`${file}: raw fetch() against ${prefix} — no Bearer attached`);
          }
        }
      }
    }

    expect(offenders, `forbidden spine transports:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the debt baseline does not grow, and every entry still exists', () => {
    // A frozen baseline is only honest if it cannot quietly expand and cannot
    // rot: an entry for a file that no longer exists (or no longer offends)
    // must be REMOVED, so the list always reflects real, outstanding debt.
    expect(Object.keys(KNOWN_DEBT).length).toBeLessThanOrEqual(5);
    for (const [file, reason] of Object.entries(KNOWN_DEBT)) {
      expect(reason.length, `${file} is grandfathered without a reason`).toBeGreaterThan(20);
      const src = stripComments(readSource(file));
      const stillOffends =
        /\bauthedFetchHeaders\b/.test(src) || /(?<!persona)\bfetch\(\s*[\`'"]\/api\//.test(src);
      expect(stillOffends, `${file} is in KNOWN_DEBT but no longer offends — remove it`).toBe(true);
    }
  });

  it('personaFetch still carries persona selection — the property everything else assumes', () => {
    // If personaFetch stopped forwarding a persona, every call site above would
    // silently become persona-unaware while still passing the checks.
    const src = stripComments(readSource('utils/personaSpine.tsx'));
    // Bearer.
    expect(src).toMatch(/headers\.set\('Authorization', `Bearer \$\{token\}`\)/);
    // Explicit hint from the surface.
    expect(src).toMatch(/personaIdHint/);
    // Ownership-safe header fallback to the spine's own record of the active
    // persona — this is what rescues a surface that has no hint to pass.
    expect(src).toMatch(/x-persona-id/);
    expect(src).toMatch(/currentPersonaId/);
  });

  it('the participation surfaces specifically are persona-aware', () => {
    // Named explicitly because these are the surfaces the Venture Lab
    // Participation work is about to build on, and because the steward tab was
    // the live offender this canary was written to close (2026-07-27).
    for (const file of [
      'app/triad/components/codex/tabs/StewardParticipationTab.tsx',
    ]) {
      const src = stripComments(readSource(file));
      expect(src, `${file} still hand-builds auth headers`).not.toMatch(/authedFetchHeaders/);
      expect(src, `${file} does not use the canonical transport`).toMatch(/personaFetch\(/);
    }
  });
});
