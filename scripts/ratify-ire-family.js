/**
 * Record operator act ACT-IRE-FAMILY-2026-07-28 — the ratification of
 * CFS-037, CFS-038, CFS-039, CFS-040 and CFS-041 as ONE act carrying FIVE
 * independent document commitments.
 *
 * HOW TO RUN. This is a BROWSER CONSOLE script, not a node script. Open
 * https://dev-beta.aigentz.me signed in as an admin, open DevTools console,
 * paste the whole file, press enter.
 *
 * Why the browser and not curl: `/api/governance/ratify` is admin-gated and
 * resolves the caller through the identity spine from a Supabase Bearer
 * token. Neither DevTools' URL bar nor curl sends that header, so the token
 * is read from localStorage below. No persona id is passed — the route
 * resolves it from the token, so there is nothing to look up or invent.
 *
 * RUN THE DEPLOY FIRST. The route reads documents through the pack corpus,
 * which `scripts/export-pack-corpus.mjs` rebuilds during the Amplify build.
 * Until dev has rebuilt with the newly-filed CFS-045..048 and the amended
 * CFS-037..041, this returns `document-not-ratifiable`.
 *
 * WHAT SUCCESS LOOKS LIKE. Five lines, each `200` with a contentHash and a
 * NON-NULL receiptId. The route deliberately returns `ok:false` +
 * `receipt-not-written` (HTTP 500) if the record was written but no receipt
 * was — reporting success for a ratification that nothing will ever anchor
 * is the defect this whole path exists to prevent. A `receiptId: null` is a
 * hard failure, not a warning.
 *
 * Idempotent: re-running returns `alreadyRecorded: true` rather than
 * double-recording.
 *
 * Expected contentHash per document (the `as-recorded` bytes — i.e. the file
 * as it now stands, including its status block; distinct from the
 * `as-ratified` pre-status-block hash in AMENDMENT_RECORDS.md, because a
 * sha256 cannot commit to bytes that contain it):
 *
 *   CFS-037  99bb19701f12c7309bcc108be3efbd765e40be8da44352b7121442184fd3db0d
 *   CFS-038  379b89d0cb35c0d6bbba267ebcdeacb7fd4bcafce22715feba5f57962bc9fad7
 *   CFS-039  eb7ec72ce80c103aeff70ed9f0dcea5321a731f55f83024706bdd89a6cd8a467
 *   CFS-040  f82d4d7c695af44dc32ec0f770f9d9e6c047d8232c8fcaccc194d40810224899
 *   CFS-041  b05cbf292c41908f322a520791c5a33fdf2d454a40d801f1ec5db4001d8ab5d5
 *
 * A hash that does NOT match means the file changed after the freeze — stop
 * and re-derive rather than ratifying bytes nobody reviewed.
 *
 * Requires migration 20260825000000_governance_ratifications.sql to be
 * applied. If it is not, the route returns `governance_ratifications table
 * missing`.
 */

(async () => {
  const key = Object.keys(localStorage).find((k) => k.includes('auth-token'));
  if (!key) { console.error('No Supabase auth token in localStorage — sign in first.'); return; }
  const parsed = JSON.parse(localStorage.getItem(key));
  const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
  if (!token) { console.error('Token found but unreadable — check the localStorage shape.'); return; }

  const DOCS = [
    ['CFS-037', 'codexes/packs/irl/foundation/CFS-037_invariant-resolution-engine.md',      'The Invariant Resolution Engine (IRE) — PRD-IRE-001'],
    ['CFS-038', 'codexes/packs/irl/foundation/CFS-038_constitutional-coordinates-registry.md', 'The Constitutional Coordinates Registry (CCR) — PRD-CCR-001'],
    ['CFS-039', 'codexes/packs/irl/foundation/CFS-039_invariant-projection-engine.md',      'The Invariant Projection Engine (IPE) — PRD-IPE-001'],
    ['CFS-040', 'codexes/packs/irl/foundation/CFS-040_knowledge-resolution-engine.md',      'The Knowledge Resolution Engine (KRE) — PRD-KRE-001'],
    ['CFS-041', 'codexes/packs/irl/foundation/CFS-041_constitutional-field-observatory.md', 'The Constitutional Field Observatory (CFO) — PRD-CFO-001'],
  ];

  for (const [id, documentPath, documentTitle] of DOCS) {
    const res = await fetch('/api/governance/ratify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        act: 'ratify',
        decisionId: id,
        documentPath,
        documentId: id,
        documentTitle,
        documentVersion: '1.0',
        decisionType: 'constitutional',
        summary:
          `${id} ratified under operator act ACT-IRE-FAMILY-2026-07-28 — one act, ` +
          `five independent document commitments, no aggregate family hash`,
        authorityBasis: 'Law XI — amending canon is an operator act',
        amendmentIds: ['ACT-IRE-FAMILY-2026-07-28'],
      }),
    });
    const body = await res.json();
    if (body.ok) {
      const r = body.ratification;
      console.log(
        `%c${id} ${res.status} ${body.alreadyRecorded ? '(already recorded)' : 'recorded'}`,
        'color:#34d399',
        `\n  contentHash ${r.contentHash}\n  receiptId   ${r.receiptId}`,
      );
    } else {
      console.error(`${id} ${res.status} FAILED`, body);
    }
  }
})();
