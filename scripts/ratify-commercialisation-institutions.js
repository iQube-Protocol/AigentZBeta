/**
 * Ratify every 'proposed' commercialisation institution — the missing step
 * that blocks Discover invariants from ever activating for Commercialisation.
 *
 * WHY THIS WAS THE ACTUAL BLOCKER. The IDE's "Discover invariants" button is
 * disabled with no evidence, correctly — that part of the diagnosis was
 * right (Commercialisation is a horizontal domain, evidence must be
 * acquired). But acquisition itself is gated behind
 * services/corpusScout/registryVerification.ts::canRunInstitutionDiscovery,
 * which requires an institution's registry row to be BOTH:
 *   status === 'ratified'
 *   verificationStatus === 'verified'
 *
 * Every commercialisation institutional-authority row inserted so far
 * (40 rows across three migrations: wave 1, wave 2 + verification-status
 * scaffolding, and the Law II closure) landed at status: 'proposed'. There
 * is a ratify-institution action (app/api/corpus-scout/domain-constitution),
 * but NO UI button calls it and NO bulk/domain-wide route exists — only a
 * single-institution POST. So there was no way, UI or script, for anyone to
 * actually ratify these 40 rows. Running institution-verification would
 * still have refused, because ratification is a THIRD, separate gate
 * verification does not satisfy.
 *
 * HOW TO RUN. Browser console script, not a node script — open
 * https://dev-beta.aigentz.me signed in as admin, paste, enter. Same reason
 * as scripts/ratify-ire-family.js: the route resolves the caller through the
 * identity spine from a Supabase Bearer token, which only the browser holds.
 *
 * The 40 (pillarKey, institutionName) pairs below were extracted
 * PROGRAMMATICALLY from the three migrations' INSERT statements — never
 * hand-transcribed. Regenerate rather than hand-edit if the registry
 * changes.
 *
 * Idempotent: ratifyInstitutionEntry is an UPDATE keyed on
 * (domain, pillar_key, institution_name) — re-running simply re-sets the
 * same ratified_by/ratified_at. Safe to run twice.
 *
 * AFTER THIS: ratification alone does not populate evidence. Next steps,
 * unchanged from the operator's original order:
 *   1. POST /api/corpus-scout/institution-verification/domain {domain:'commercialisation'}
 *   2. POST /api/corpus-scout/institution-discovery/domain {domain:'commercialisation'}
 *   3. Evidence rows land; Discover invariants activates.
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

  let ok = 0, failed = 0;
  for (const [pillarKey, institutionName] of INSTITUTIONS) {
    const res = await fetch('/api/corpus-scout/domain-constitution', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ratify-institution', domain: DOMAIN, pillarKey, institutionName }),
    });
    const body = await res.json();
    if (body.ok) {
      ok++;
      console.log(`%c✓ ${pillarKey} · ${institutionName}`, 'color:#34d399');
    } else {
      failed++;
      console.error(`✕ ${pillarKey} · ${institutionName}`, res.status, body);
    }
  }
  console.log(`%cDone: ${ok} ratified, ${failed} failed (of ${INSTITUTIONS.length}).`, 'font-weight:bold');
})();
