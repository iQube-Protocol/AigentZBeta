/**
 * Step 2 of 3 for unblocking Commercialisation discovery — verify the 40
 * ratified institutional registry entries, ONE AT A TIME.
 *
 * Run scripts/ratify-commercialisation-institutions.js first.
 *
 * WHY PER-INSTITUTION AND NOT THE DOMAIN ROUTE. The domain-wide route
 * (/api/corpus-scout/institution-verification/domain) verifies all 40
 * sequentially inside ONE request. Each verification does real HTTP fetches
 * against the institution's own site, so the request runs for minutes — and
 * the deployed gateway cuts the connection at its own timeout long before
 * the route's maxDuration=300 is reached. The operator hit a 504 Gateway
 * Timeout, twice, with no partial results: a whole-batch call that dies
 * mid-way loses everything it had already done.
 *
 * Driving the per-institution route (maxDuration=60) from the client makes
 * each request short enough to survive the gateway, and — more importantly —
 * makes the work RESUMABLE and PARTIAL-SAFE: every institution's outcome is
 * written to its row as it completes, so a failure at #37 keeps the first 36.
 * Re-running skips nothing and simply re-verifies, which is harmless.
 *
 * HOW TO RUN. Browser console — open https://dev-beta.aigentz.me signed in
 * as admin, paste the WHOLE file, press enter. Progress prints per row.
 * Expect several minutes; a slow institution is normal.
 *
 * Verification is NOT all-or-nothing. A real result set will legitimately
 * mix 'verified', 'insufficient_corpus' (site loads, nothing acquirable) and
 * 'verification_failed' (URL did not resolve). Only 'verified' opens the
 * discovery gate; the others are honest outcomes, not script errors.
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

  const tally = {};
  let done = 0;
  for (const [pillarKey, institutionName] of INSTITUTIONS) {
    done++;
    let res, body;
    try {
      res = await fetch('/api/corpus-scout/institution-verification', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: DOMAIN, pillarKey, institutionName }),
      });
      // A gateway timeout returns an empty body — .json() would throw and
      // kill the whole loop. Read text first, parse defensively, keep going.
      const text = await res.text();
      body = text ? JSON.parse(text) : null;
    } catch (e) {
      console.error(`[${done}/${INSTITUTIONS.length}] ✕ ${pillarKey} · ${institutionName} — request failed: ${e.message}`);
      tally['request_error'] = (tally['request_error'] ?? 0) + 1;
      continue;
    }

    if (!body) {
      console.error(`[${done}/${INSTITUTIONS.length}] ✕ ${pillarKey} · ${institutionName} — HTTP ${res.status}, empty body (likely gateway timeout on this one institution)`);
      tally['gateway_timeout'] = (tally['gateway_timeout'] ?? 0) + 1;
      continue;
    }

    const status = body.outcome?.status ?? (body.error ? 'run-never-started' : 'unknown');
    tally[status] = (tally[status] ?? 0) + 1;
    const style = status === 'verified' ? 'color:#34d399'
      : status === 'run-never-started' ? 'color:#fbbf24'
      : 'color:#f87171';
    console.log(`%c[${done}/${INSTITUTIONS.length}] ${status === 'verified' ? '✓' : '✕'} ${pillarKey} · ${institutionName} — ${status}`, style);
    if (status !== 'verified') {
      const why = body.outcome?.detail ?? body.error ?? '(no detail)';
      console.log(`      ${why}`);
    }
  }

  console.log('%cSummary:', 'font-weight:bold', tally);
  const verified = tally['verified'] ?? 0;
  if (verified > 0) {
    console.log(`%c${verified} institution(s) verified — run scripts/discover-commercialisation-evidence.js next.`, 'color:#34d399;font-weight:bold');
  } else {
    console.warn('Nothing verified. Read the per-row details above — they now carry the real reason from the server.');
  }
})();
