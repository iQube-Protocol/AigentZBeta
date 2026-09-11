#!/usr/bin/env node
/**
 * Marketa Activation Engine smoke test — full pipeline against a live host.
 *
 *   node scripts/smoke-marketa-activation.mjs --host=dev-beta.aigentz.me
 *
 * Steps: list → create → score → registry → reputation → passport → outreach
 * draft → export. Exits non-zero on first failure. A 500 with
 * "marketa_candidate_agents" in the detail on step 1 means the
 * 20260610000000_marketa_activation_engine.sql migration has not been run.
 */

const hostArg = process.argv.find((a) => a.startsWith('--host='));
const host = hostArg ? hostArg.slice('--host='.length) : 'dev-beta.aigentz.me';
const base = host.startsWith('http') ? host : `https://${host}`;

let failures = 0;

async function step(name, fn) {
  process.stdout.write(`${name} ... `);
  try {
    const detail = await fn();
    console.log(`PASS${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    failures += 1;
    console.log(`FAIL — ${err instanceof Error ? err.message : err}`);
  }
}

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(`${res.status} ${json.error ?? ''} ${json.detail ?? ''}`.trim());
  }
  return json;
}

const SMOKE_CANDIDATE = {
  name: `Smoke Test Candidate ${new Date().toISOString()}`,
  description:
    'Executive travel and relocation coordination agent with legal aid intake support for displaced persons. Agent Card and MCP server available.',
  sourceType: 'manual',
  sourceUrl: 'manual://smoke-test',
  // Resolvable A2A card served by the host under test; unique per run — the
  // Bureau allows one open application per agent card URL.
  agentCardUrl: `${base}/api/marketa/activation/sample-agent-card?seed=smoke-${Date.now()}`,
  operatorName: 'Smoke Test Operator',
  operatorType: 'organization',
  capabilities: ['travel coordination', 'relocation', 'legal aid intake', 'CRM'],
  targetUsers: ['executives', 'displaced persons'],
};

let candidateId = null;

await step('1. list candidates (migration check)', async () => {
  const json = await call('GET', '/api/marketa/activation/candidates?limit=1');
  return `${json.count} returned`;
});

await step('2. create candidate', async () => {
  const json = await call('POST', '/api/marketa/activation/candidates', SMOKE_CANDIDATE);
  candidateId = json.candidate?.id;
  if (!candidateId) throw new Error('no candidate id in response');
  return candidateId;
});

await step('2b. agent card resolves (A2A JSON)', async () => {
  const res = await fetch(SMOKE_CANDIDATE.agentCardUrl);
  if (!res.ok) throw new Error(`${res.status}`);
  const card = await res.json();
  if (!card.name || !Array.isArray(card.skills)) throw new Error('not a valid agent card shape');
  return card.name;
});

await step('3. score (classification + clean-revenue + human mobility)', async () => {
  const json = await call('POST', `/api/marketa/activation/candidates/${candidateId}/score`);
  const c = json.candidate;
  const hm = c.humanMobility ?? {};
  return `priority=${c.scores?.overallPriorityScore} lanes=[${c.strategicLanes}] mobility=${hm.userContext ?? 'none'}/${hm.timeHorizon ?? 'none'}`;
});

await step('4. registry handoff (AigentQube)', async () => {
  const json = await call('POST', `/api/marketa/activation/candidates/${candidateId}/registry`);
  return json.candidate?.iqubeRegistry?.agentIqubeId ?? 'linked';
});

await step('5. reputation (RQH canister → mirror → fallback)', async () => {
  const json = await call('GET', `/api/marketa/activation/candidates/${candidateId}/reputation`);
  return `source=${json.source ?? json.reputation?.source ?? 'unknown'}`;
});

await step('6. passport handoff (Bureau dry-run, consents NOT faked)', async () => {
  const json = await call('POST', `/api/marketa/activation/candidates/${candidateId}/passport`);
  return json.candidate?.passportIntegration?.passportApplicationStatus ?? json.note ?? 'prepared';
});

await step('6b. passport submit (operator-consented → Bureau steward queue)', async () => {
  const json = await call('POST', `/api/marketa/activation/candidates/${candidateId}/passport`, {
    action: 'submit',
    actorId: 'smoke-test-operator',
    consents: {
      participant_terms_accepted: true,
      registry_pending_record_consent: true,
      constraints_and_obligations_accepted: true,
      review_process_accepted: true,
    },
  });
  if (!json.bureau?.applicationId) throw new Error('no Bureau application id returned');
  return `bureau app ${json.bureau.applicationId} status=${json.bureau.applicationStatus}`;
});

await step('7. outreach draft (never auto-sends)', async () => {
  const json = await call('POST', `/api/marketa/activation/candidates/${candidateId}/outreach`, {
    actorId: 'smoke-test',
    angle: 'smoke test run',
  });
  if (!json.draft?.subject) throw new Error('no draft returned');
  return `outreachStatus=${json.candidate?.outreachStatus}`;
});

await step('8. export (json)', async () => {
  const res = await fetch(`${base}/api/marketa/activation/export?format=json`);
  if (!res.ok) throw new Error(`${res.status}`);
  return 'ok';
});

console.log(failures === 0 ? '\nAll smoke steps passed.' : `\n${failures} step(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
