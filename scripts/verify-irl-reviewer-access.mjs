#!/usr/bin/env node
/**
 * scripts/verify-irl-reviewer-access.mjs
 *
 * Verifies the Phase 2 scoped reviewer restoration (2026-09-08) against a
 * deployed environment, end-to-end, with a REAL authenticated persona — the
 * live-environment half that unit tests (tests/irl-reviewer-scoped-access-2026-09-08.test.ts)
 * cannot cover, since they exercise the route handlers directly with mocked
 * persona/grant objects rather than a real Supabase JWT + database row.
 *
 * USAGE — you need a JWT for a persona holding an ACTIVE research-lab grant
 * (role 'reviewer' or another REVIEW_VIEW_READABLE_ROLES member) scoped to
 * EXP-P1 (or unrestricted). To create one for a TEST persona (never Austin's
 * real one, unless this IS the real invitation flow):
 *
 *   -- run in Supabase SQL editor, or via createAccessInvitation server-side —
 *   insert into access_grants (persona_id, access_domain, role, source, status, allowed_experiments)
 *   values ('<test-persona-uuid>', 'research-lab', 'reviewer', 'manual-test', 'active', array['EXP-P1']);
 *
 * To grab a JWT from the browser for that persona (DevTools console, while
 * logged in as it):
 *
 *   (() => {
 *     const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'));
 *     const raw = k ? JSON.parse(localStorage.getItem(k) || 'null') : null;
 *     return raw?.access_token ?? raw?.currentSession?.access_token ?? '';
 *   })()
 *
 *   JWT=<jwt> node scripts/verify-irl-reviewer-access.mjs --host dev-beta.aigentz.me
 *
 * Args (all optional):
 *   --host   Target host (default: dev-beta.aigentz.me)
 *
 * What it checks (both routes, unauthenticated AND authenticated):
 *   1. Anonymous request to an EXP-P1 path            -> DENY (404 on both routes)
 *   2. Authenticated (JWT) request to the SAME path    -> ALLOW if the JWT's
 *      persona holds a qualifying EXP-P1 research-lab grant, DENY otherwise —
 *      this script reports which it observed; it does not assert which one
 *      is "correct" for your JWT, since that depends on the grant you set up.
 *   3. Authenticated request to material OUTSIDE any experiment folder
 *      (a Charter path) -> DENY even with a valid EXP-P1 grant — proves the
 *      widening never exceeds the experiment folder it targets.
 *
 * Exit codes:
 *   0  ran to completion (read the PASS/FAIL summary — this script reports
 *      observed behavior; it cannot know your grant's intended scope)
 *   2  config error (no host reachable)
 */

const args = parseArgs(process.argv.slice(2));
const jwt = process.env.JWT || args.jwt || '';
const host = args.host || 'dev-beta.aigentz.me';
const baseUrl = host.startsWith('http') ? host : `https://${host}`;

const EXP_P1_README = 'foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md';
const EXP_P1_KIT = 'foundation/experiments/exp-p1-representation-runtime-gauntlet/AUSTIN_REVIEWER_KIT.md';
const UNRELATED_PATH = 'foundation/CFS-019_charter.md';

async function fetchDoc(routeBase, path, withAuth) {
  const headers = { Accept: 'application/json' };
  if (withAuth && jwt) headers.Authorization = `Bearer ${jwt}`;
  const url = `${baseUrl}${routeBase}?path=${encodeURIComponent(path)}`;
  try {
    const res = await fetch(url, { headers });
    return { status: res.status, ok: res.ok };
  } catch (e) {
    return { status: null, error: String(e) };
  }
}

const ROUTES = [
  { label: 'packs/file', base: '/api/codex/packs/irl/file' },
  { label: 'public/irl/doc', base: '/api/public/irl/doc' },
];

let anyChecked = false;

console.log(`[verify-irl-reviewer-access] host=${baseUrl} jwt=${jwt ? 'provided' : 'NOT provided'}`);
console.log('');

for (const route of ROUTES) {
  console.log(`--- ${route.label} ---`);

  const anon = await fetchDoc(route.base, EXP_P1_README, false);
  anyChecked = true;
  const anonDenied = anon.status === 401 || anon.status === 403 || anon.status === 404;
  console.log(
    `anonymous  -> EXP-P1 README: status=${anon.status} ${anonDenied ? 'PASS (denied)' : 'FAIL (expected a denial status)'}`,
  );

  if (jwt) {
    const authed = await fetchDoc(route.base, EXP_P1_README, true);
    console.log(
      `authorized -> EXP-P1 README: status=${authed.status} ` +
        (authed.status === 200
          ? "ALLOW (your JWT's persona has a qualifying EXP-P1 grant, or is admin)"
          : "DENY (your JWT's persona has no qualifying EXP-P1 grant, or the JWT is invalid — check your grant setup if you expected ALLOW)"),
    );

    const authedKit = await fetchDoc(route.base, EXP_P1_KIT, true);
    console.log(
      `authorized -> Reviewer Kit:  status=${authedKit.status} ` +
        (authedKit.status === 200 ? 'ALLOW' : 'DENY'),
    );

    const authedUnrelated = await fetchDoc(route.base, UNRELATED_PATH, true);
    const unrelatedDenied = authedUnrelated.status === 401 || authedUnrelated.status === 403 || authedUnrelated.status === 404;
    console.log(
      `authorized -> unrelated Charter path: status=${authedUnrelated.status} ` +
        `${unrelatedDenied ? 'PASS (still denied outside any experiment folder)' : 'FAIL (should NEVER be 200 — scope escaped its experiment folder!)'}`,
    );
  } else {
    console.log('(set JWT=<token> to also check the authenticated path)');
  }
  console.log('');
}

if (!anyChecked) {
  console.log('[verify-irl-reviewer-access] could not reach the host at all — check --host');
  process.exit(2);
}

console.log('[verify-irl-reviewer-access] done — read the PASS/FAIL lines above.');
console.log('[verify-irl-reviewer-access] the ONE line that must NEVER read FAIL, under any JWT: "unrelated Charter path" must stay denied.');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}
