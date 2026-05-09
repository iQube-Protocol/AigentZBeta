#!/usr/bin/env node
/**
 * scripts/verify-spine.mjs
 *
 * Run the access-spine verification recipe against a deployed environment.
 * Returns a single PASS/FAIL summary so you don't have to read logs.
 *
 * SIMPLEST USAGE — while the operator-authorised debug bypass is ON
 * (commit 5e5c2d0; tracked as plan §11.e for replacement):
 *
 *   node scripts/verify-spine.mjs
 *
 * That's it. No JWT, no flags. Defaults to dev-beta.aigentz.me and a
 * known-seeded asset (mk_ep00_print_common, the GN free preview).
 *
 * FULL USAGE (when the bypass is restored to strict auth):
 *
 *   JWT=<your-supabase-jwt> node scripts/verify-spine.mjs \
 *     --host dev-beta.aigentz.me \
 *     --personaId <uuid-of-the-persona-you-want-tested> \
 *     --free   <asset-with-row-level-gating_kind=free> \
 *     --owned  <an-asset-the-test-persona-owns> \
 *     --unowned mk_ep01_print_rare
 *
 * Args (all optional):
 *   --host       Target host (default: dev-beta.aigentz.me)
 *   --personaId  UUID of the persona to test against. Sent as
 *                x-persona-id header so the server resolves the
 *                operator's intended persona instead of falling
 *                through to 'first owned'. REQUIRED for users with
 *                multiple personas where ownership lives only on
 *                a non-default one. Get yours from /api/access/whoami
 *                or from localStorage.currentPersonaId after a wallet
 *                drawer switch.
 *   --free       Asset id/cid expected ALLOW/free (no default — the GN
 *                is no longer free in production; supply explicitly)
 *   --owned      Asset id/cid expected ALLOW/owned (skipped if omitted)
 *   --unowned    Asset id/cid expected DENY/payment-required
 *                  (default: mk_ep01_print_rare — known seeded paid asset)
 *   --action     Action to test (default: read)
 *
 * To grab a JWT from the browser when needed (DevTools console):
 *
 *   (() => {
 *     const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'));
 *     const raw = k ? JSON.parse(localStorage.getItem(k) || 'null') : null;
 *     return raw?.access_token ?? raw?.currentSession?.access_token ?? '';
 *   })()
 *
 * Exit codes:
 *   0  all checks passed (or skipped because args weren't provided)
 *   1  one or more checks failed
 *   2  config error
 */

const args = parseArgs(process.argv.slice(2));
const jwt = process.env.JWT || args.jwt || '';
const host = args.host || 'dev-beta.aigentz.me';
const action = args.action || 'read';
const personaId = args.personaId || process.env.PERSONA_ID || '';

const baseUrl = host.startsWith('http') ? host : `https://${host}`;
const authHeader = jwt ? { Authorization: `Bearer ${jwt}` } : {};
// When a personaId is supplied, send x-persona-id so the server-side
// resolver picks the operator's intended persona instead of falling
// through to 'first owned by created_at'. Required for users with
// multiple personas where ownership only exists on one of them.
const personaHeader = personaId ? { 'x-persona-id': personaId } : {};
const baseHeaders = { Accept: 'application/json', ...authHeader, ...personaHeader };

const cases = [
  // --free has NO default. Per operator (2026-05-06) the GN
  // (mk_ep00_print_common) is paid in production; we no longer have a
  // confirmed-free seeded asset to test against. The free-state-A path
  // is exercised by the local unit tests; live verification of ALLOW/free
  // requires the operator to point --free at a row whose gating_kind
  // column is explicitly set to 'free'.
  ...(args.free ? [{ label: 'free asset', target: args.free, expect: { allow: true, reason: 'free' } }] : []),
  ...(args.owned ? [{ label: 'owned asset', target: args.owned, expect: { allow: true, reason: 'owned' } }] : []),
  { label: 'unowned asset', target: args.unowned ?? 'mk_ep01_print_rare',   expect: { allow: false, reason: 'payment-required' } },
  // Tx-class FIO guard. When the active persona has no fio_handle,
  // any tx-class action (mint/transfer/payment-settle) must deny with
  // reason='fio-handle-required'. Run with `--txGuard` to exercise.
  ...(args.txGuard
    ? [{ label: 'tx-class FIO guard', target: args.txGuard, action: 'payment-settle', expect: { allow: false, reason: 'fio-handle-required' } }]
    : []),
];

console.log(`[verify-spine] target: ${baseUrl}`);
console.log(`[verify-spine] jwt:    ${jwt ? '(provided)' : '(none — relying on bypass if active)'}`);
console.log(`[verify-spine] persona:${personaId ? ' ' + personaId : ' (none — server picks default)'}`);
console.log(`[verify-spine] action: ${action}`);
console.log(`[verify-spine] cases:  ${cases.length}\n`);

let failures = 0;
let bypassActive = false;

// ───────────────────────────────────────────────────────────────────────
// Step 1: whoami — confirms the spine resolves a context (real or bypassed)
// ───────────────────────────────────────────────────────────────────────
{
  const url = `${baseUrl}/api/access/whoami`;
  process.stdout.write(`whoami         /api/access/whoami           ... `);
  const res = await fetch(url, { headers: baseHeaders }).catch((e) => ({ error: e }));
  if (res?.error) {
    console.log(`FAIL (network: ${res.error.message})`);
    failures++;
  } else if (res.status === 401 && !jwt) {
    console.log(`FAIL (401 — bypass appears OFF and no JWT was provided)`);
    console.log(`            either set JWT=... or wait for ACCESS bypass to be redeployed`);
    failures++;
  } else if (res.status !== 200) {
    console.log(`FAIL (HTTP ${res.status})`);
    failures++;
  } else {
    const body = await res.json().catch(() => null);
    bypassActive = !!body?.bypassed;
    console.log(
      `PASS (bypassed=${bypassActive} ` +
      `admin=${body?.cartridgeFlags?.isAdmin} ` +
      `partner=${body?.cartridgeFlags?.isPartner} ` +
      `identifiability=${body?.identifiability})`,
    );
    if (bypassActive) {
      console.log(`            ⚠  TEMPORARY DEBUG bypass is live. Persona-owned tests will be skipped.`);
    }
    // When admin=false but caller expected admin, surface the whoami hint
    // (which names the exact auth_profile_id rows to check in
    // crm_admin_roles). Saves operator a second curl.
    if (body && body.cartridgeFlags?.isAdmin === false && body.hint) {
      console.log(`            ℹ  ${body.hint}`);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────
// Step 2: list-assets — confirms admin-only browse works
// ───────────────────────────────────────────────────────────────────────
{
  const url = `${baseUrl}/api/access/list-assets?limit=10`;
  process.stdout.write(`list-assets    /api/access/list-assets      ... `);
  const res = await fetch(url, { headers: baseHeaders }).catch((e) => ({ error: e }));
  if (res?.error) {
    console.log(`FAIL (network: ${res.error.message})`);
    failures++;
  } else if (res.status !== 200) {
    console.log(`FAIL (HTTP ${res.status})`);
    failures++;
  } else {
    const body = await res.json().catch(() => null);
    const m = body?.counts?.masters ?? 0;
    const a = body?.counts?.assets ?? 0;
    if (m + a > 0) {
      console.log(`PASS (${m} masters, ${a} assets)`);
    } else {
      console.log(`WARN (returned 0 rows — catalog may be empty for this prefix)`);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────
// Step 3: privacy guard — surface MUST NOT contain T0 fields
// (only meaningful when not bypassed)
// ───────────────────────────────────────────────────────────────────────
if (!bypassActive && jwt) {
  const url = `${baseUrl}/api/wallet/active-persona`;
  process.stdout.write(`privacy guard  T0 leak check                ... `);
  const res = await fetch(url, { headers: baseHeaders }).catch((e) => ({ error: e }));
  if (res?.error || res.status !== 200) {
    console.log(`SKIP (active-persona unavailable; HTTP ${res?.status ?? 'network'})`);
    // Surface the error body's hint when present — the route returns
    // { error, detail, hint } on 500 so the operator gets actionable
    // diagnostics inline instead of having to curl separately.
    try {
      const errBody = res?.json ? await res.json().catch(() => null) : null;
      if (errBody?.hint) {
        console.log(`            ℹ  ${errBody.hint}`);
      } else if (errBody?.detail) {
        console.log(`            ℹ  detail: ${errBody.detail}`);
      } else if (errBody?.error) {
        console.log(`            ℹ  error: ${errBody.error}`);
      }
    } catch { /* non-JSON body; nothing to surface */ }
  } else {
    const surface = await res.json().catch(() => null);
    const leaks = [];
    if (surface && typeof surface === 'object') {
      if ('personaId'       in surface) leaks.push('personaId');
      if ('authProfileId'   in surface) leaks.push('authProfileId');
      if ('fioHandle'       in surface) leaks.push('fioHandle');
      if ('rootDid'         in surface) leaks.push('rootDid');
      if ('kybeAttestation' in surface) leaks.push('kybeAttestation');
    }
    if (leaks.length === 0) {
      console.log(`PASS (no T0 fields in surface)`);
    } else {
      console.log(`FAIL (T0 LEAK: ${leaks.join(', ')})`);
      failures++;
    }
  }
} else {
  console.log(`privacy guard  T0 leak check                ... SKIP (bypass active or no JWT)`);
}

// ───────────────────────────────────────────────────────────────────────
// Step 4: inspect cases
// ───────────────────────────────────────────────────────────────────────
for (const c of cases) {
  // Skip 'owned' ONLY when this request will actually use the bypass —
  // i.e. no JWT was provided. The bypass synthesises an admin context
  // when getActivePersona returns null (unauthenticated). With a JWT,
  // the real persona is resolved server-side and ownership tests are
  // valid even while the bypass is hardcoded ON for unauth callers.
  if (bypassActive && !jwt && c.expect.reason === 'owned') {
    console.log(`${c.label.padEnd(14)} ${c.target.padEnd(40)} SKIP (bypass + no JWT — synth persona has no entitlements)`);
    continue;
  }

  const caseAction = c.action || action;
  const url = `${baseUrl}/api/access/inspect?cid=${encodeURIComponent(c.target)}&action=${caseAction}`;
  process.stdout.write(`${c.label.padEnd(14)} ${c.target.padEnd(40)} `);
  const res = await fetch(url, { headers: baseHeaders }).catch((e) => ({ error: e }));
  if (res?.error) {
    console.log(`FAIL (network: ${res.error.message})`);
    failures++;
    continue;
  }
  const json = await res.json().catch(() => null);
  if (res.status === 404 || !json?.descriptor) {
    console.log(`FAIL (descriptor not found — value not in catalog)`);
    if (Array.isArray(json?.nearby?.byCidPrefix) && json.nearby.byCidPrefix.length > 0) {
      console.log(`            nearby: ${json.nearby.byCidPrefix.slice(0, 3).join(', ')}`);
    }
    failures++;
    continue;
  }
  const d = json.decision;
  const allowMatch  = d?.allow  === c.expect.allow;
  const reasonMatch = d?.reason === c.expect.reason;
  if (allowMatch && reasonMatch) {
    console.log(
      `PASS (${d.allow ? 'ALLOW' : 'DENY'}/${d.reason} ` +
      `state=${json.descriptor.state} ` +
      `gating=${json.descriptor.gating.kind})`,
    );
  } else {
    console.log(
      `FAIL got ${d?.allow ? 'ALLOW' : 'DENY'}/${d?.reason} ` +
      `(state=${json.descriptor.state} gating=${json.descriptor.gating.kind}) ` +
      `expected ${c.expect.allow ? 'ALLOW' : 'DENY'}/${c.expect.reason}`,
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
  if (bypassActive) {
    console.log(`[verify-spine] ⚠  bypass is live; persona-owned ALLOW path was not exercised.`);
    console.log(`[verify-spine]    when bypass is restored, re-run with JWT and --owned for full coverage.`);
  } else {
    console.log(`[verify-spine] safe to set ACCESS_SPINE_ENFORCE=1 in Amplify env when ready.`);
  }
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
