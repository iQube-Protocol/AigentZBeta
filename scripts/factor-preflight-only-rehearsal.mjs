#!/usr/bin/env node
/**
 * scripts/factor-preflight-only-rehearsal.mjs
 *
 * A DELIBERATELY NARROWER sibling of scripts/bankr-live-rehearsal.mjs — this
 * script performs ONLY sections 1-3 of that script (issuer readiness, launch
 * preparation, deterministic preflight) and then STOPS. It never requests an
 * Aegis assessment, never ratifies one, never requests MoneyPenny approval,
 * and obviously never submits/signs/broadcasts. Use this when the goal is
 * specifically "rehearse a governed token-launch preparation" (Factor's own
 * `governedOperationRehearsal` step in services/factor/useCaseZeroOrchestrator.ts
 * — see stepRehearsal, which calls exactly this same createOrResumeDraft ->
 * claimDraftForPreflight -> preflightLaunch sequence and nothing further)
 * WITHOUT crossing the Aegis-ratification / human-approval boundary that
 * bankr-live-rehearsal.mjs's later sections deliberately do cross.
 *
 * What this script DOES:
 *   1. Reads issuer readiness (Bankr configured/mode + provider-wallet
 *      binding state) — never fabricates a live connection.
 *   2. Prepares a launch-spec draft (operator-supplied fields only).
 *   3. Runs the deterministic preflight (quotes REAL — live or fake — Bankr
 *      terms) and prints the resulting launch row.
 *
 * What this script explicitly does NOT do, and implements no flag for:
 *   - request or ratify an Aegis assessment
 *   - request MoneyPenny/human approval routing
 *   - submit, sign, or broadcast anything
 *
 * USAGE:
 *   JWT=<supabase-jwt> node scripts/factor-preflight-only-rehearsal.mjs \
 *     --host dev-beta.aigentz.me \
 *     --beneficiaryAgentRuntimeId aigent-factor \
 *     --preparingAgentRuntimeId aigent-factor \
 *     --chain base \
 *     --tokenName "Use Case Zero Rehearsal" \
 *     --tokenSymbol UCZR \
 *     --feeRecipient 0xE478E454b8c97682CACabe0345bb01AF30900ac1 \
 *     [--tenantId default] \
 *     [--provision-binding] \
 *     [--description "..."] [--websiteUrl "..."] [--pairedAsset WETH]
 *
 * The JWT must belong to an authenticated persona (the identity spine
 * requires a real Bearer token — see CLAUDE.md's "Client-side spine
 * fetches" section); this script cannot mint one for you.
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
const tenantId = args.tenantId || 'default';
const jwt = process.env.JWT;

const REQUIRED = ['beneficiaryAgentRuntimeId', 'preparingAgentRuntimeId', 'chain', 'tokenName', 'tokenSymbol', 'feeRecipient'];
const missing = REQUIRED.filter((k) => !args[k]);
if (!jwt || missing.length > 0) {
  console.error(`Missing required input.\n  JWT env var: ${jwt ? 'set' : 'MISSING'}\n  Missing --flags: ${missing.join(', ') || 'none'}\n\nSee the header of this script for full usage.`);
  process.exit(1);
}

const base = `https://${host}`;
async function call(path, body) {
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
  section('1. Issuer readiness (credential + capability check — never fabricates a live connection)');
  const readinessAction = args['provision-binding'] ? { action: 'provision_binding' } : {};
  const readinessRes = await call('/api/moneypenny/factor/bankr/readiness', {
    beneficiaryAgentRuntimeId: args.beneficiaryAgentRuntimeId,
    tenantId,
    ...readinessAction,
  });
  console.log(JSON.stringify(readinessRes, null, 2));
  if (!readinessRes.readiness.bankrConfigured) {
    console.log('\n[HONEST STATE] Bankr is NOT configured for this deployment — every call below runs against the deterministic FAKE transport, never a live connection.');
  }

  section('2. Prepare launch proposal (operator-supplied fields only — nothing invented)');
  const created = await call('/api/moneypenny/factor/bankr/launches', {
    beneficiaryAgentRuntimeId: args.beneficiaryAgentRuntimeId,
    preparingAgentRuntimeId: args.preparingAgentRuntimeId,
    chain: args.chain,
    tokenName: args.tokenName,
    tokenSymbol: args.tokenSymbol,
    feeRecipient: args.feeRecipient,
    description: args.description || undefined,
    websiteUrl: args.websiteUrl || undefined,
    pairedAsset: args.pairedAsset || undefined,
    tenantId,
  });
  const launchId = created.launch.id;
  console.log(`Launch ${launchId} created, state=${created.launch.state}`);

  section('3. Deterministic preflight (quotes REAL — live or fake — Bankr terms)');
  const preflighted = await call(`/api/moneypenny/factor/bankr/launches/${launchId}/action`, { action: 'preflight', tenantId });
  console.log(`state=${preflighted.launch.state}, bankr_terms_hash=${preflighted.launch.bankr_terms_hash}`);
  console.log(`bankrTerms.raw.simulated=${preflighted.bankrTerms.raw.simulated}, sourceUrl=${preflighted.bankrTerms.sourceUrl}`);

  section('STOP — rehearsal complete. Nothing beyond preflight runs automatically.');
  console.log(JSON.stringify({
    launchId,
    state: preflighted.launch.state,
    chain: preflighted.launch.chain,
    tokenName: preflighted.launch.token_name,
    tokenSymbol: preflighted.launch.token_symbol,
    feeRecipient: preflighted.launch.fee_recipient,
    bankrTermsHash: preflighted.launch.bankr_terms_hash,
    bankrTermsSourceUrl: preflighted.launch.bankr_terms_source_url,
  }, null, 2));
  console.log(
    `\nThis script performs NO further action. The NEXT acts — requesting an independent Aegis assessment, ` +
    `ratifying it, and requesting MoneyPenny/human approval — are separate, explicit, later steps ` +
    `(scripts/bankr-live-rehearsal.mjs sections 4-7 show the full sequence, for when that boundary is ` +
    `deliberately being crossed) that this script never performs.`,
  );
}

main().catch((err) => {
  console.error('\nRehearsal failed:', err.message);
  process.exit(1);
});
