/**
 * Step 2 of 3 for unblocking Commercialisation discovery — verify the 40
 * newly-ratified institutional registry entries.
 *
 * Run scripts/ratify-commercialisation-institutions.js FIRST. This step
 * checks canRunInstitutionDiscovery's second condition (verificationStatus
 * === 'verified') for every row; ratification alone does not satisfy it.
 *
 * HOW TO RUN. Browser console script — open https://dev-beta.aigentz.me
 * signed in as admin, paste the WHOLE file, press enter. Do not paste a
 * shorthand description of the call ("POST /path {body}") — that is not
 * JavaScript and will throw a SyntaxError, which is what happened the first
 * time this step was attempted.
 *
 * maxDuration on the route is 300s (40 institutions verified sequentially,
 * each doing a real HTTP fetch against the institution's own site) — this
 * can legitimately take a few minutes. The browser's fetch() has no default
 * timeout, so just wait for the log line.
 *
 * Idempotent: re-verifying an already-verified institution just re-checks it.
 */

(async () => {
  const key = Object.keys(localStorage).find((k) => k.includes('auth-token'));
  if (!key) { console.error('No Supabase auth token in localStorage — sign in first.'); return; }
  const parsed = JSON.parse(localStorage.getItem(key));
  const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
  if (!token) { console.error('Token found but unreadable — check the localStorage shape.'); return; }

  console.log('Verifying commercialisation registry — this can take a few minutes (40 institutions, sequential)…');
  const res = await fetch('/api/corpus-scout/institution-verification/domain', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: 'commercialisation' }),
  });
  const body = await res.json();
  if (!body.ok) { console.error('Verification call failed', res.status, body); return; }

  console.log(`%cAttempted ${body.attempted}, verified ${body.verified}.`, 'font-weight:bold');
  for (const entry of body.perEntry ?? []) {
    const status = entry.outcome?.status;
    const style = status === 'verified' ? 'color:#34d399' : 'color:#f87171';
    console.log(`%c${status === 'verified' ? '✓' : '✕'} ${entry.pillarKey} · ${entry.institutionName} — ${status}`, style);
    if (status !== 'verified' && entry.outcome?.reason) console.log(`    reason: ${entry.outcome.reason}`);
  }
  if (body.verified < body.attempted) {
    console.warn(`${body.attempted - body.verified} institution(s) did not verify — their document URLs did not resolve to a qualifying source. These will not contribute evidence until fixed.`);
  }
  console.log('Next: scripts/discover-commercialisation-evidence.js to acquire documents from the verified institutions.');
})();
