#!/usr/bin/env node
/**
 * scripts/bankr-live-rehearsal.mjs
 *
 * Factor + Aegis Bankr PRD, Phase 9 — the live rehearsal boundary.
 *
 * Drives the REAL governed pipeline (over real HTTP, against a deployed
 * host) from a fresh draft all the way to 'approval_pending', then STOPS
 * and prints the exact human approval package. It never calls submit or
 * approve — those are the operator's own, separate, explicit act.
 *
 * What this script MAY do (Phase 9):
 *   - verify provider credentials (readiness route reports bankrConfigured/bankrMode honestly)
 *   - query capabilities (readiness)
 *   - provision or inspect a Bankr provider wallet (--provision-binding)
 *   - prepare and simulate a launch (create + preflight)
 *   - obtain an Aegis assessment (request + drive findings + ratify)
 *   - request MoneyPenny approval routing (moves the launch to approval_pending)
 *   - generate and print the exact human approval package
 *
 * What this script MUST NOT do, and does not implement any flag for:
 *   - submit a launch
 *   - sign a transaction
 *   - broadcast
 *   - claim fees
 *   - move funds
 *   - bypass confirmation (there is no --yes/--force; there is nothing to
 *     confirm because this script never reaches a destructive action)
 *
 * USAGE:
 *   JWT=<supabase-jwt> node scripts/bankr-live-rehearsal.mjs \
 *     --host dev-beta.aigentz.me \
 *     --beneficiaryAgentRuntimeId aigent-factor \
 *     --preparingAgentRuntimeId aigent-factor \
 *     --requestedByAgentRef aigent-factor \
 *     --chain base \
 *     --tokenName "Example Token" \
 *     --tokenSymbol EXMP \
 *     --feeRecipient 0xE478E454b8c97682CACabe0345bb01AF30900ac1 \
 *     [--tenantId default] \
 *     [--provision-binding] \
 *     [--description "..."] [--websiteUrl "..."] [--pairedAsset WETH]
 *
 * chain/tokenName/tokenSymbol/feeRecipient are REQUIRED — this script
 * never invents them (the same rule the API/service layer itself enforces).
 *
 * Findings recorded here are a deliberately minimal, honest rehearsal set
 * (one pass finding per required dimension) so the assessment can reach a
 * ratifiable state — a real assessment for a real launch should carry
 * whatever findings the operator/Aegis actually determine, not these.
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

const REQUIRED = ['beneficiaryAgentRuntimeId', 'preparingAgentRuntimeId', 'requestedByAgentRef', 'chain', 'tokenName', 'tokenSymbol', 'feeRecipient'];
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
async function get(path) {
  const res = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${jwt}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(`${path} failed (${res.status}): ${JSON.stringify(json)}`);
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

  section('4. Request independent Aegis assessment');
  const withAegis = await call(`/api/moneypenny/factor/bankr/launches/${launchId}/action`, {
    action: 'request_aegis',
    tenantId,
    policyVersion: 'v1',
    evidenceSnapshot: { rehearsal: true, launchId },
    requestedByAgentRef: args.requestedByAgentRef,
  });
  const assessmentId = withAegis.launch.aegis_assessment_id;
  console.log(`assessment ${assessmentId} opened, launch state=${withAegis.launch.state}`);

  section('5. Drive the assessment to a ratifiable state (rehearsal findings only)');
  await call(`/api/moneypenny/aegis/assessments/${assessmentId}/transition`, { action: 'begin-running' });
  await call(`/api/moneypenny/aegis/assessments/${assessmentId}/transition`, { action: 'require-review' });
  await call(`/api/moneypenny/aegis/assessments/${assessmentId}/findings`, {
    dimension: 'utility',
    claim: 'rehearsal placeholder — replace with a real Aegis finding',
    method: 'review',
    result: 'pass',
    confidence: 0.5,
    falsificationCondition: 'n/a (rehearsal)',
  });
  const ratified = await call(`/api/moneypenny/aegis/assessments/${assessmentId}/ratify`, {
    decision: 'admissible_with_conditions',
    rationale: 'Phase 9 rehearsal — REPLACE with a real Aegis ratification before any real launch.',
  });
  console.log(`assessment ratified: decision=${ratified.assessment.decision}`);

  section('6. Request MoneyPenny/human approval routing');
  const approvalPending = await call(`/api/moneypenny/factor/bankr/launches/${launchId}/action`, { action: 'request_approval', tenantId });
  console.log(`launch state=${approvalPending.launch.state}`);

  section('7. STOP — the exact human approval package (nothing beyond this point runs automatically)');
  const finalLaunch = await get(`/api/moneypenny/factor/bankr/launches/${launchId}?tenantId=${encodeURIComponent(tenantId)}`);
  const l = finalLaunch.launch;
  console.log(JSON.stringify({
    launchId: l.id,
    state: l.state,
    chain: l.chain,
    tokenName: l.token_name,
    tokenSymbol: l.token_symbol,
    feeRecipient: l.fee_recipient,
    pairedAsset: l.paired_asset,
    bankrTerms: l.bankr_terms,
    bankrTermsSourceUrl: l.bankr_terms_source_url,
    bankrTermsRetrievedAt: l.bankr_terms_retrieved_at,
    bankrTermsHash: l.bankr_terms_hash,
    aegisAssessmentId: l.aegis_assessment_id,
    aegisDecision: ratified.assessment.decision,
    aegisRationale: ratified.assessment.rationale,
    conflictDisclosures: l.conflict_disclosures,
    riskDisclosures: l.risk_disclosures,
    version: l.version,
  }, null, 2));

  console.log(
    `\nThis script performs NO further action. To approve this EXACT version, an operator must separately call:\n` +
    `  POST ${base}/api/moneypenny/factor/bankr/launches/${launchId}/approve  (body: {"tenantId":"${tenantId}"})\n` +
    `That call computes and freezes spec_hash/approval_hash from the launch's CURRENT state — if anything above changes before then, approval is refused until it is re-preflighted (Phase 8 drift protection).\n` +
    `Submission (the ONE call that reaches Bankr's write API) requires a SEPARATE approved state and an idempotency key, and is never triggered by this rehearsal.`,
  );
}

main().catch((err) => {
  console.error('\nRehearsal failed:', err.message);
  process.exit(1);
});
