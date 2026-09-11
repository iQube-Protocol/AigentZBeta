/**
 * CRM / MVL personal-data routes must never be reachable unauthenticated.
 *
 * THE INCIDENT (found 2026-07-28, while doing UI layout work of all things).
 * Six handlers across four routes served and MUTATED personal data with ZERO
 * authorization:
 *
 *   GET  /api/crm/investors          ~7,000 people: email, name, investment
 *                                    band, KNYT-ID, shares, profession, city
 *   POST /api/crm/investors          create
 *   PATCH /api/crm/investors/[id]    edit
 *   POST /api/crm/investors/bulk     bulk cohort/state update
 *   GET/POST/PATCH/DELETE /api/mvl/partners   partner contacts incl. email
 *
 * Every one used a SERVICE-ROLE Supabase client, which bypasses RLS entirely —
 * so the row-level policy on `avl_partner_contacts` was inert, and
 * `nakamoto_knyt_personas` has no policy at all. Middleware does CORS only.
 * The net effect was an anonymous read/write API over the investor and partner
 * tables.
 *
 * WHY IT SURVIVED SO LONG. The client tabs called these routes with a plain
 * `fetch()` and no credentials, so the routes could not have required any —
 * the missing gate and the credential-less caller each made the other look
 * correct. `services/passport/participationAccess.ts` had a "venture filter"
 * that read like scoping but ran CLIENT-SIDE over the full unscoped payload:
 * cosmetic, not a boundary. A reviewer seeing the filter would reasonably
 * assume a boundary existed somewhere.
 *
 * WHAT THIS FILE ASSERTS. Not "an auth symbol appears somewhere in the file" —
 * that is the check that would have passed in a world where one handler was
 * guarded and three were not. It asserts EVERY exported handler in these
 * routes is individually gated, because the defect was per-handler.
 *
 * The gate is `requireAdminPersona`, which resolves through the identity spine
 * (`getActivePersona` → `cartridgeFlags.isAdmin`). The older `requireAdmin`
 * stub is explicitly NOT acceptable here: it returns `true` for any request
 * whose URL contains "localhost" or when NODE_ENV !== 'production'. That is
 * defensible for a route exposing admin *actions*; it is not defensible for a
 * route returning other people's personal data, where a preview deployment or
 * a misread env var opens the whole table.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { stripComments } from './_lib/sourceAuthority';

/** Every route that serves or mutates personal data from a service-role client. */
const PII_ROUTES = [
  'app/api/crm/investors/route.ts',
  'app/api/crm/investors/[id]/route.ts',
  'app/api/crm/investors/bulk/route.ts',
  'app/api/mvl/partners/route.ts',
  // Added 2026-07-28: the estate-wide aggregate built in response to the
  // operator's ruling that "an estate-wide admin aggregate should default to
  // counts and distributions, not unrestricted row-level PII" — still an
  // admin-only surface, so it belongs in this list. See
  // tests/crm-investors-aggregate.test.ts for the field-shape/k-anonymity
  // canaries specific to this route.
  'app/api/crm/investors/aggregate/route.ts',
  // Added 2026-07-28, same review pass: this route DID gate (unlike the four
  // above, which had none) but on the requireAdmin stub — production-safe on
  // its own terms (requires a matching x-admin-token header), but its own
  // caller never sent one via bare fetch(), and it was inconsistent with
  // every other investor-PII route. Migrated to requireAdminPersona.
  'app/api/admin/investor-dashboard/route.ts',
];

const HANDLER = /export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\s*\(/g;

/** The body of one exported handler, from its signature to the next one. */
function handlerBodies(src: string): { method: string; body: string }[] {
  const starts = [...src.matchAll(HANDLER)].map((m) => ({ method: m[1], at: m.index! }));
  return starts.map((s, i) => ({
    method: s.method,
    body: src.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : src.length),
  }));
}

describe('CRM / MVL personal-data routes are gated per handler', () => {
  it('every exported handler calls the spine-resolved admin gate', () => {
    const offenders: string[] = [];
    let handlersSeen = 0;

    for (const route of PII_ROUTES) {
      const src = stripComments(readFileSync(route, 'utf-8'));
      const handlers = handlerBodies(src);
      // Non-vacuity per FILE, not just overall: a route that stopped exporting
      // handlers (renamed, moved) must not silently drop out of the check.
      expect(handlers.length, `${route} exports no handlers — did it move?`).toBeGreaterThan(0);
      handlersSeen += handlers.length;

      for (const { method, body } of handlers) {
        if (!/await\s+requireAdminPersona\(/.test(body)) {
          offenders.push(`${route} → ${method}() is not gated by requireAdminPersona`);
        }
        // Awaiting is not enough — the result must be ACTED ON. `await gate(req)`
        // with the value discarded is the latent-mechanism defect (CB-1): the
        // call happens, nothing is refused.
        if (!/if\s*\(!\(await\s+requireAdminPersona\(/.test(body)) {
          offenders.push(`${route} → ${method}() calls the gate without branching on it`);
        }
      }
    }

    expect(handlersSeen, 'no handlers found at all — the route list is stale').toBeGreaterThan(5);
    expect(offenders, `unguarded personal-data handlers:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('these routes do not use the localhost-bypassing requireAdmin stub', () => {
    for (const route of PII_ROUTES) {
      const src = stripComments(readFileSync(route, 'utf-8'));
      // `requireAdminPersona` contains `requireAdmin` as a substring, so match
      // the bare call rather than the name.
      expect(
        /requireAdmin\s*\(/.test(src),
        `${route} uses the requireAdmin stub, which returns true for any localhost/non-production request`,
      ).toBe(false);
    }
  });

  it('the stub still carries its dev bypass — so the rule above is not vacuous', () => {
    // If someone "fixes" requireAdmin by removing the bypass, the assertion
    // above stops protecting anything and should be revisited deliberately
    // rather than passing for a reason that no longer holds.
    const stub = readFileSync('app/api/_lib/requireAdmin.ts', 'utf-8');
    expect(stub).toMatch(/isDev\s*\|\|\s*isLocalhost/);
    expect(stub).toMatch(/export async function requireAdminPersona/);
  });

  it('the client callers send credentials — a gate the UI cannot pass is an outage', () => {
    // The routes and their callers have to move together. A guarded route whose
    // caller uses bare fetch() 403s for everyone, which is how a security fix
    // becomes a rollback.
    const callers = [
      'app/triad/components/codex/tabs/InvestorDirectoryTab.tsx',
      'app/triad/components/codex/tabs/RelationshipBuilderTab.tsx',
      'app/triad/components/codex/tabs/KnytInvestmentsAdminTab.tsx',
    ];
    for (const caller of callers) {
      const src = stripComments(readFileSync(caller, 'utf-8'));
      const bare = [...src.matchAll(/(?<![A-Za-z])fetch\(\s*[`"']\/api\/(crm\/investors|mvl\/partners|admin\/investor-dashboard)/g)];
      expect(
        bare.map((m) => m[0]),
        `${caller} calls a gated route with bare fetch() — it will 403`,
      ).toEqual([]);
      expect(src, `${caller} does not import personaFetch`).toMatch(/personaFetch/);
    }
  });
});
