/**
 * Step 3 of 3 for unblocking Commercialisation discovery — acquire documents
 * from every ratified + verified institution, populating discovery_evidence.
 *
 * Run in order: ratify-commercialisation-institutions.js, then
 * verify-commercialisation-institutions.js, then this.
 *
 * This is the step that actually makes "Discover invariants" activate in
 * the IDE — runDiscoveryForDomain re-checks canRunInstitutionDiscovery
 * itself (status: 'ratified' AND verificationStatus: 'verified'), so only
 * institutions that cleared BOTH prior steps are attempted here; anything
 * that failed verification is silently skipped by design, not an error.
 *
 * HOW TO RUN. Browser console script — open https://dev-beta.aigentz.me
 * signed in as admin, paste the WHOLE file, press enter. maxDuration is
 * 300s; this fetches real documents from each institution's site, so it can
 * take several minutes. Wait for the summary line.
 */

(async () => {
  const key = Object.keys(localStorage).find((k) => k.includes('auth-token'));
  if (!key) { console.error('No Supabase auth token in localStorage — sign in first.'); return; }
  const parsed = JSON.parse(localStorage.getItem(key));
  const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
  if (!token) { console.error('Token found but unreadable — check the localStorage shape.'); return; }

  console.log('Running discovery across the commercialisation registry — this can take several minutes…');
  const res = await fetch('/api/corpus-scout/institution-discovery/domain', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: 'commercialisation' }),
  });
  const body = await res.json();
  if (!body.ok) { console.error('Discovery call failed', res.status, body); return; }

  console.log(
    `%cInstitutions attempted: ${body.institutionsAttempted} · candidates found: ${body.totalFound} · submitted as evidence: ${body.totalSubmitted}`,
    'font-weight:bold',
  );
  for (const r of body.perInstitution ?? []) {
    console.log(`  ${r.institutionName ?? '(unnamed)'} — found ${r.found}, submitted ${r.submitted}`);
  }
  if (body.totalSubmitted > 0) {
    console.log('%cDone — evidence has landed. Reload the IDE and Discover invariants should now be enabled for Commercialisation.', 'color:#34d399;font-weight:bold');
  } else {
    console.warn('No evidence was submitted. Check institutionsAttempted above — if it is 0, verification (step 2) did not actually clear any institutions; re-check its output.');
  }
})();
