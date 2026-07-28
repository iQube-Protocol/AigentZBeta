/**
 * Step 4 of 4 — steward triage of commercialisation candidate sources.
 *
 * WHY THE IDE SHOWS 0. The discovery script acquires documents into
 * corpus_candidate_sources at reviewWorkflowStatus='pending_review'.
 * discovery_evidence (what the IDE's Evidence panel reads, and what enables
 * "Discover invariants") is only written when a STEWARD approves a candidate
 * (PRD-ICA-001 §6/§11 — approval is a human act, never automatic; the review
 * route ingests in the same action as the approval decision). Until at least
 * one candidate is approved, Evidence = 0 is the pipeline working as
 * designed, not a defect.
 *
 * WHAT THIS SCRIPT DOES. Lists every pending_review commercialisation
 * candidate DEDUPED by canonical_url (the discovery run was executed twice,
 * so each document has two rows — approving one is enough), then gives you
 * three console helpers to act on them one by one or in a selected batch:
 *
 *   approve('<id>')                 — approve + ingest (provenance defaults
 *                                     to 'external-established'; pass a
 *                                     second arg to override)
 *   rejectCand('<id>', 'reject_low_substance' | 'reject_out_of_domain' | ...)
 *   approveMany(['<id>','<id>'])    — sequential batch of YOUR selection
 *
 * Rows at 'needs_retrieval_fix' are NOT listed — those are quarantined bad
 * retrievals (bit.ly stubs, blocked bitstreams, 0-char bodies) and cannot be
 * approved until re-retrieved.
 *
 * HOW TO RUN. Browser console — open https://dev-beta.aigentz.me signed in
 * as admin, paste the WHOLE file, press enter. Then call the helpers.
 */

(async () => {
  const key = Object.keys(localStorage).find((k) => k.includes('auth-token'));
  if (!key) { console.error('No Supabase auth token in localStorage — sign in first.'); return; }
  const parsed = JSON.parse(localStorage.getItem(key));
  const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
  if (!token) { console.error('Token found but unreadable — check the localStorage shape.'); return; }
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const res = await fetch(
    '/api/corpus-scout/candidates?campaignDomain=commercialisation&reviewWorkflowStatus=pending_review',
    { headers },
  );
  const body = await res.json().catch(() => null);
  if (!body?.ok) { console.error('List failed:', res.status, body?.error ?? '(no body)'); return; }

  // Dedupe: the discovery run executed twice, so most documents carry two
  // rows. Keep the first row per canonical_url; the duplicate stays
  // pending_review harmlessly (mark_duplicate it later if you care).
  const byUrl = new Map();
  for (const c of body.candidates ?? []) {
    if (!byUrl.has(c.canonicalUrl)) byUrl.set(c.canonicalUrl, c);
  }
  const unique = Array.from(byUrl.values());

  console.log(`%c${unique.length} unique pending_review candidate(s) (${(body.candidates ?? []).length} rows incl. duplicates)`, 'font-weight:bold');
  // The review route keys on sourceId (corpus_candidate_sources.source_id),
  // NOT the row's DB id — pass the sourceId column to the helpers.
  console.table(unique.map((c) => ({
    sourceId: c.sourceId,
    pillar: c.campaignSubDomain ?? '(domain-wide)',
    chars: c.normalizedTextChars ?? (c.normalizedText ?? '').length,
    title: (c.title ?? '').slice(0, 80),
    url: c.canonicalUrl,
    tags: Array.isArray(c.structuralTags) ? c.structuralTags.join(',') : '',
  })));

  async function review(id, decision, provenanceClass) {
    // `id` here is the candidate's sourceId (the route resolves source_id).
    const r = await fetch(`/api/corpus-scout/candidates/${id}/review`, {
      method: 'POST', headers,
      body: JSON.stringify(provenanceClass ? { decision, provenanceClass } : { decision }),
    });
    const b = await r.json().catch(() => null);
    if (!b?.ok) { console.error(`✕ ${id} — ${decision}: HTTP ${r.status}`, b?.error ?? '(no body)'); return b; }
    if (b.ingestion) {
      if (b.ingestion.ok) console.log(`%c✓ ${id} approved + ingested → evidence row(s): ${(b.ingestion.evidenceIds ?? []).join(', ')}`, 'color:#34d399');
      else console.warn(`△ ${id} approved but ingestion refused: ${b.ingestion.error}`);
    } else {
      console.log(`✓ ${id} — ${decision}`);
    }
    return b;
  }

  window.approve = (id, provenanceClass = 'external-established') =>
    review(id, 'approve_exp_p1', provenanceClass);
  window.rejectCand = (id, decision = 'reject_low_substance') => review(id, decision);
  window.approveMany = async (ids, provenanceClass = 'external-established') => {
    let ok = 0;
    for (const id of ids) { const b = await window.approve(id, provenanceClass); if (b?.ok && b?.ingestion?.ok) ok++; }
    console.log(`%c${ok}/${ids.length} approved + ingested. Reload the IDE — Evidence should now show these and Discover should enable.`, 'font-weight:bold;color:#34d399');
  };

  console.log('%cHelpers ready: approve(id[, provenanceClass]) · rejectCand(id[, decision]) · approveMany([ids])', 'color:#60a5fa');
  console.log('Provenance classes: external-established (default) · external-empirical · platform-derived · platform-hypothesized · platform-doctrine');
  console.log('Reject decisions: reject_low_substance · reject_out_of_domain · reject_provenance · reject_access_or_license');
})();
