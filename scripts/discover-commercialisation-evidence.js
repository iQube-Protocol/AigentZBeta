/**
 * Step 3 of 3 — acquire documents from every verified institution, one at a
 * time, populating discovery_evidence.
 *
 * Order: ratify-commercialisation-institutions.js →
 * verify-commercialisation-institutions.js → this. This is the step that
 * makes "Discover invariants" activate in the IDE.
 *
 * PER-INSTITUTION, for the same reason as the verify script: the domain-wide
 * route runs all institutions inside one request and dies on the deployed
 * gateway's timeout with no partial results (the operator hit a 504 on the
 * verification equivalent). Each institution's candidates are persisted as
 * they complete, so a failure part-way keeps everything before it.
 *
 * Institutions that did not reach 'verified' are SKIPPED BY THE SERVER, not
 * by this script — runDiscoveryForInstitution re-checks
 * canRunInstitutionDiscovery itself (status 'ratified' AND
 * verificationStatus 'verified'). A refusal here is that gate working, not
 * an error; the reason is printed.
 *
 * HOW TO RUN. Browser console — open https://dev-beta.aigentz.me signed in
 * as admin, paste the WHOLE file, press enter.
 */

(async () => {
  const key = Object.keys(localStorage).find((k) => k.includes('auth-token'));
  if (!key) { console.error('No Supabase auth token in localStorage — sign in first.'); return; }
  const parsed = JSON.parse(localStorage.getItem(key));
  const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
  if (!token) { console.error('Token found but unreadable — check the localStorage shape.'); return; }

  const DOMAIN = 'commercialisation';
  const INSTITUTIONS = [
    ['venture-operations', "NBER"],
    ['adoption', "NBER"],
    ['venture-operations', "Kauffman Foundation"],
    ['partnerships', "Kauffman Foundation"],
    ['venture-operations', "SSRN"],
    ['adoption', "SSRN"],
    ['adoption', "OECD"],
    ['scaling', "OECD"],
    ['venture-operations', "World Bank"],
    ['commercial-governance', "World Bank"],
    ['adoption', "MIT Sloan"],
    ['venture-operations', "MIT Sloan"],
    ['scaling', "Stanford Graduate School of Business"],
    ['venture-operations', "Stanford Graduate School of Business"],
    ['revenue-architecture', "Harvard Business School"],
    ['adoption', "Harvard Business School"],
    ['revenue-architecture', "Strategic Management Society"],
    ['commercial-governance', "Strategic Management Society"],
    ['scaling', "Santa Fe Institute"],
    ['outcome-assurance', "INCOSE"],
    ['commercial-governance', "INCOSE"],
    ['customer-discovery', "Silicon Valley Product Group"],
    ['value-proposition', "Silicon Valley Product Group"],
    ['customer-discovery', "Product School"],
    ['value-proposition', "Product School"],
    ['value-proposition', "Strategyzer"],
    ['revenue-architecture', "Strategyzer"],
    ['customer-discovery', "Lean Startup"],
    ['trust-formation', "OECD"],
    ['trust-formation', "UK Competition and Markets Authority"],
    ['pricing', "NBER"],
    ['pricing', "OECD"],
    ['distribution', "World Trade Organization"],
    ['distribution', "UN Trade and Development (UNCTAD)"],
    ['settlement-exchange', "BIS Committee on Payments and Market Infrastructures"],
    ['settlement-exchange', "UNCITRAL"],
    ['commercial-failure-modes', "NBER"],
    ['commercial-failure-modes', "U.S. Bureau of Labor Statistics"],
    ['partnerships', "NBER"],
    ['outcome-assurance', "National Infrastructure and Service Transformation Authority"]
  ];

  let totalFound = 0, totalSubmitted = 0, ran = 0, refused = 0, errored = 0;
  let done = 0;
  for (const [pillarKey, institutionName] of INSTITUTIONS) {
    done++;
    let res, body;
    try {
      res = await fetch('/api/corpus-scout/institution-discovery', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: DOMAIN, pillarKey, institutionName }),
      });
      const text = await res.text();
      body = text ? JSON.parse(text) : null;
    } catch (e) {
      console.error(`[${done}/${INSTITUTIONS.length}] ✕ ${pillarKey} · ${institutionName} — request failed: ${e.message}`);
      errored++;
      continue;
    }

    if (!body) {
      console.error(`[${done}/${INSTITUTIONS.length}] ✕ ${pillarKey} · ${institutionName} — HTTP ${res.status}, empty body (gateway timeout on this institution)`);
      errored++;
      continue;
    }

    if (body.ok) {
      ran++;
      totalFound += body.found ?? 0;
      totalSubmitted += body.submitted ?? 0;
      console.log(
        `%c[${done}/${INSTITUTIONS.length}] ✓ ${pillarKey} · ${institutionName} — found ${body.found ?? 0}, submitted ${body.submitted ?? 0}`,
        (body.submitted ?? 0) > 0 ? 'color:#34d399' : 'color:#94a3b8',
      );
    } else {
      refused++;
      console.log(`%c[${done}/${INSTITUTIONS.length}] – ${pillarKey} · ${institutionName} — ${body.error ?? 'refused'}`, 'color:#fbbf24');
    }
  }

  console.log(
    `%cRan ${ran}, refused ${refused} (not verified), errored ${errored} · candidates found ${totalFound}, submitted as evidence ${totalSubmitted}`,
    'font-weight:bold',
  );
  if (totalSubmitted > 0) {
    console.log('%cEvidence has landed. Reload the IDE — Discover invariants should now be enabled for Commercialisation.', 'color:#34d399;font-weight:bold');
  } else if (refused === INSTITUTIONS.length) {
    console.warn('Every institution was refused — none reached \'verified\'. Re-run the verify script and read its per-row details.');
  } else {
    console.warn('No evidence submitted. Institutions ran but yielded no qualifying documents — check the found/submitted counts above.');
  }
})();
