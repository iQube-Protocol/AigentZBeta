#!/usr/bin/env node
/**
 * scripts/factor-horizen-mandate-rehearsal.mjs
 *
 * Factor + Aegis PRD tranche (2026-09-05) — "prepare Factor for a controlled
 * end-to-end Horizen Journey Spine rehearsal." Mirrors the shape of
 * scripts/bankr-live-rehearsal.mjs: drives the REAL governed pipeline over
 * real HTTP against a deployed host, then STOPS at the signing boundary and
 * prints the exact operator approval package.
 *
 * What this script MAY do:
 *   - read Factor's current Horizen Journey Spine state (GET .../state)
 *   - prepare the PRINCIPAL-role registration mandate (POST .../register/mandate/prepare)
 *     — this signs NOTHING; it only creates a pending SigningRequest the
 *     operator's own wallet will render in its Pending Actions section.
 *
 * What this script MUST NOT do, and implements no flag for:
 *   - approve the principal mandate (approvePrincipalRegistrationMandate)
 *   - sign or broadcast the AGENT registry transaction (approveAgentRegistryInvocation)
 *   - invoke Factor's ERC-8004 registration in any way that reaches Horizen
 *   - perform any other irreversible external act
 *
 * Per operator instruction governing this tranche: "Do not broadcast
 * Factor's ERC-8004 registration or perform any irreversible external act
 * in this tranche." This script enforces that by construction — there is no
 * code path here that can sign or broadcast anything.
 *
 * USAGE:
 *   JWT=<supabase-jwt> node scripts/factor-horizen-mandate-rehearsal.mjs \
 *     --host dev-beta.aigentz.me \
 *     [--agentSlug factor]
 */

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const host = args.host || 'dev-beta.aigentz.me';
const agentSlug = args.agentSlug || 'factor';
const jwt = process.env.JWT;

if (!jwt) {
  console.error('Missing required input.\n  JWT env var: MISSING\n\nSee the header of this script for full usage.');
  process.exit(1);
}

const base = `https://${host}`;

async function get(path) {
  const res = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${jwt}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(`${path} failed (${res.status}): ${JSON.stringify(json)}`);
  return json;
}
async function post(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(`${path} failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

function section(title) {
  console.log(`\n${'='.repeat(70)}\n${title}\n${'='.repeat(70)}`);
}

async function main() {
  section('1. Factor\'s current Horizen Journey Spine state (read-only)');
  const state = await get(`/api/journey/moneypenny-horizen/state?agentSlug=${encodeURIComponent(agentSlug)}`);
  console.log(JSON.stringify(state, null, 2));

  section('2. Prepare the PRINCIPAL registration mandate (signs NOTHING — creates a pending wallet-signing request only)');
  const prepared = await post('/api/journey/moneypenny-horizen/register/mandate/prepare', { agentSlug });
  console.log(JSON.stringify(prepared, null, 2));

  section('3. STOP — the signing boundary. This script performs NO further action.');
  console.log(
    `A PRINCIPAL SigningRequest now exists (id=${prepared.request?.id ?? '(see above)'}). It is inert until the ` +
    `operator's own wallet reviews and signs it in the Pending Actions section — this script cannot do that, and ` +
    `implements no flag to try.\n\n` +
    `The full ceremony beyond this point (all irreversible, all requiring separate explicit operator acts):\n` +
    `  1. Operator's wallet signs the PRINCIPAL mandate ("authorize registration").\n` +
    `  2. approvePrincipalRegistrationMandate verifies that signature and creates the AGENT-role invocation request.\n` +
    `  3. Operator's wallet (or the agent's own registered signer) signs the AGENT registry invocation.\n` +
    `  4. approveAgentRegistryInvocation is the ONLY function that actually signs and broadcasts — it submits the\n` +
    `     ERC-8004 registration transaction to the live Horizen network.\n\n` +
    `None of steps 1-4 are invoked by this script, and this tranche's own governing instruction is: do not broadcast\n` +
    `Factor's ERC-8004 registration or perform any irreversible external act. Reaching step 4 requires a fresh,\n` +
    `separate, explicit operator decision outside this rehearsal.`,
  );
}

main().catch((err) => {
  console.error('\nRehearsal failed:', err.message);
  process.exit(1);
});
