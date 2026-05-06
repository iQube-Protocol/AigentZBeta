#!/usr/bin/env node
/**
 * scripts/verify-spine.mjs
 *
 * Run the access-spine verification recipe against a deployed environment.
 *
 * Usage (from the AigentZBeta repo root):
 *
 *   JWT=<your-supabase-jwt> node scripts/verify-spine.mjs \
 *     --host dev-beta.aigentz.me \
 *     --free   mk_ep00_print_common \
 *     --owned  mk_ep01_print_common \
 *     --unowned mk_ep05_motion_common
 *
 * Args:
 *   --host       Target host (default: dev-beta.aigentz.me)
 *   --free       An assetId or CID expected to ALLOW with reason='free'
 *   --owned      An assetId or CID expected to ALLOW with reason='owned'
 *   --unowned    An assetId or CID expected to DENY with reason='payment-required'
 *   --action     Action to test (default: read; pick watch for video assets)
 *
 * The JWT comes from the JWT env var. To grab yours from the browser,
 * sign into dev-beta.aigentz.me, open DevTools console and run:
 *
 *   (await (await import('/utils/supabaseBrowser')).getSupabaseBrowserClient().auth.getSession()).data.session.access_token
 *
 * Copy the string and run this script with it as JWT.
 *
 * Exit codes:
 *   0  all checks passed (or skipped because args weren't provided)
 *   1  one or more checks failed
 *   2  config error (missing JWT, etc.)
 */

const args = parseArgs(process.argv.slice(2));
const jwt = process.env.JWT || args.jwt;
const host = args.host || 'dev-beta.aigentz.me';
const action = args.action || 'read';

if (!jwt) {
  console.error('error: JWT env var is required (export JWT=...)');
  console.error('       grab it from the browser DevTools — see the script header.');
  process.exit(2);
}

const baseUrl = host.startsWith('http') ? host : `https://${host}`;

const cases = [];
if (args.free)    cases.push({ label: 'free asset',    target: args.free,    expect: { allow: true,  reason: 'free' } });
if (args.owned)   cases.push({ label: 'owned asset',   target: args.owned,   expect: { allow: true,  reason: 'owned' } });
if (args.unowned) cases.push({ label: 'unowned asset', target: args.unowned, expect: { allow: false, reason: 'payment-required' } });

console.log(`[verify-spine] target: ${baseUrl}`);
console.log(`[verify-spine] action: ${action}`);
console.log(`[verify-spine] cases:  ${cases.length}\n`);

let failures = 0;

// ───────────────────────────────────────────────────────────────────────
// Step 1: unauthenticated probe — should 401
// ───────────────────────────────────────────────────────────────────────
{
  const url = `${baseUrl}/api/wallet/active-persona`;
  process.stdout.write(`unauth probe   /api/wallet/active-persona ... `);
  const res = await fetch(url, { headers: { Accept: 'application/json' } }).catch((e) => ({ error: e }));
  if (res.error) {
    console.log(`FAIL (network: ${res.error.message})`);
    failures++;
  } else if (res.status === 401) {
    console.log(`PASS (401 unauthenticated)`);
  } else {
    console.log(`FAIL (expected 401, got ${res.status})`);
    failures++;
  }
}

// ───────────────────────────────────────────────────────────────────────
// Step 2: authenticated baseline — should 200 with surface payload
// ───────────────────────────────────────────────────────────────────────
let surface = null;
{
  const url = `${baseUrl}/api/wallet/active-persona`;
  process.stdout.write(`auth probe     /api/wallet/active-persona ... `);
  const res = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${jwt}` },
  }).catch((e) => ({ error: e }));
  if (res?.error) {
    console.log(`FAIL (network: ${res.error.message})`);
    failures++;
  } else if (res.status !== 200) {
    console.log(`FAIL (expected 200, got ${res.status})`);
    failures++;
  } else {
    surface = await res.json().catch(() => null);
    if (!surface?.personaSessionToken) {
      console.log(`FAIL (no personaSessionToken in response)`);
      failures++;
    } else {
      console.log(
        `PASS (identifiability=${surface.identifiability} ` +
        `admin=${surface.cartridgeFlags?.isAdmin} ` +
        `partner=${surface.cartridgeFlags?.isPartner} ` +
        `cohorts=${surface.cohortMemberships?.length || 0})`,
      );
    }
  }
}

// ───────────────────────────────────────────────────────────────────────
// Step 3: privacy guard — surface MUST NOT contain T0 fields
// ───────────────────────────────────────────────────────────────────────
if (surface) {
  process.stdout.write(`privacy guard  T0 leak check                ... `);
  const leaks = [];
  if ('personaId'      in surface) leaks.push('personaId');
  if ('authProfileId'  in surface) leaks.push('authProfileId');
  if ('fioHandle'      in surface) leaks.push('fioHandle');
  if ('rootDid'        in surface) leaks.push('rootDid');
  if ('kybeAttestation' in surface) leaks.push('kybeAttestation');
  if (leaks.length === 0) {
    console.log(`PASS (no T0 fields in surface)`);
  } else {
    console.log(`FAIL (T0 LEAK: ${leaks.join(', ')})`);
    failures++;
  }
}

// ───────────────────────────────────────────────────────────────────────
// Step 4: inspect cases
// ───────────────────────────────────────────────────────────────────────
for (const c of cases) {
  // The route falls back between cid/assetId, so we always pass as cid.
  const url = `${baseUrl}/api/access/inspect?cid=${encodeURIComponent(c.target)}&action=${action}`;
  process.stdout.write(`${c.label.padEnd(14)} ${c.target} ... `);
  const res = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${jwt}` },
  }).catch((e) => ({ error: e }));
  if (res?.error) {
    console.log(`FAIL (network: ${res.error.message})`);
    failures++;
    continue;
  }
  const json = await res.json().catch(() => null);
  if (res.status === 404 || !json?.descriptor) {
    console.log(`FAIL (descriptor not found — check the value)`);
    failures++;
    continue;
  }
  const d = json.decision;
  if (!d) {
    console.log(`FAIL (no decision in response)`);
    failures++;
    continue;
  }
  const allowMatch  = d.allow  === c.expect.allow;
  const reasonMatch = d.reason === c.expect.reason;
  if (allowMatch && reasonMatch) {
    console.log(
      `PASS (${d.allow ? 'ALLOW' : 'DENY'}/${d.reason} ` +
      `state=${json.descriptor.state} ` +
      `gating=${json.descriptor.gating.kind})`,
    );
  } else {
    console.log(
      `FAIL expected ${c.expect.allow ? 'ALLOW' : 'DENY'}/${c.expect.reason}, ` +
      `got ${d.allow ? 'ALLOW' : 'DENY'}/${d.reason} ` +
      `(state=${json.descriptor.state} gating=${json.descriptor.gating.kind})`,
    );
    failures++;
  }
}

// ───────────────────────────────────────────────────────────────────────
// Summary
// ───────────────────────────────────────────────────────────────────────
console.log('');
if (failures === 0) {
  console.log(`[verify-spine] ✓ all checks passed`);
  console.log(`[verify-spine] safe to set ACCESS_SPINE_ENFORCE=1 in Amplify env when you're ready.`);
  process.exit(0);
} else {
  console.log(`[verify-spine] ✗ ${failures} check(s) failed`);
  console.log(`[verify-spine] do NOT enable ACCESS_SPINE_ENFORCE=1 yet — investigate above.`);
  process.exit(1);
}

// ───────────────────────────────────────────────────────────────────────
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
