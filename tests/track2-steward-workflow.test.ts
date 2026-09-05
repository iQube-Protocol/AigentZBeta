/**
 * Track 2 — the constitutional constraints the steward surface must keep.
 *
 * ── What went wrong, and why a canary ──────────────────────────────────────
 *
 * The Track 2 programme shipped as a correct ORCHESTRATION with no OPERATOR
 * WORKFLOW. Stage 2 reported "41 sources await a human decision" and offered
 * nothing to decide with; everything downstream is downstream of those
 * decisions, so an unactionable Stage 2 made the whole programme unactionable
 * (EXP agent, 2026-08-02: "does it open the 41 sources, do nothing, or show an
 * empty page?" — it did nothing).
 *
 * Building the queue is the easy half. The hard half is that a review surface
 * is where every automatic-admission defect would enter, so the rules Al set —
 *
 *   no automatic admission · no automatic promotion · no automatic validation
 *   no automatic assignment · no automatic freeze · every governance act
 *   explicit, receipted and attributable
 *
 * — are asserted here rather than trusted to survive the next edit.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { REVIEW_WORKFLOW_STATUSES, APPROVED_FOR_INGESTION } from '@/services/corpusScout/types';
import { buildTrack2Programme } from '@/services/research/track2Programme';

const PANEL = 'components/research/Track2ProgrammePanel.tsx';

describe('Track 2 steward workflow — Stage 2 is actionable', () => {
  it('the review queue exists and calls the EXISTING review route', () => {
    const src = stripComments(readSource(PANEL));
    expect(src, 'no review queue is mounted').toMatch(/function CorpusReviewQueue\(/);
    // Mounted on the stage it belongs to, not floating somewhere else.
    expect(src).toMatch(/s\.id === "review-and-admit" &&[\s\S]{0,200}<CorpusReviewQueue/);
    // Reads the pending queue, and the DECISION goes to the route that already
    // implements PRD-ICA-001 §6/§8/§9.
    expect(src).toMatch(/\/api\/corpus-scout\/candidates\?campaignDomain=/);
    expect(src).toMatch(/reviewWorkflowStatus=pending_review/);
    expect(src).toMatch(/\/api\/corpus-scout\/candidates\/\$\{encodeURIComponent\(row\.sourceId\)\}\/review/);
  });

  it('the queue does not re-implement the decision → status mapping', () => {
    /*
     * The client sends a DECISION; the server maps it to a
     * reviewWorkflowStatus and decides whether the Ingestion Broker runs. A
     * second copy of that mapping here would be the stale one the first time
     * §8 changes — and it would be the copy the operator sees.
     */
    const src = stripComments(readSource(PANEL));
    for (const status of REVIEW_WORKFLOW_STATUSES) {
      expect(
        src.includes(`"${status}"`) && status !== 'pending_review',
        `the panel names the workflow STATUS '${status}' — it should send a decision and let the server map it`,
      ).toBe(false);
    }
    // And it must not decide ingestion itself.
    expect(src).not.toMatch(/ingestApprovedSource|APPROVED_FOR_INGESTION/);
  });

  it('no admission is automatic — a decision needs a choice AND a rationale', () => {
    const src = stripComments(readSource(PANEL));
    // Nothing is posted without both.
    expect(src).toMatch(/if \(!chosen \|\| !notes\.trim\(\)\) return;/);
    // And the control is disabled until both exist, so the refusal is visible
    // before it is needed rather than only enforced after a click.
    expect(src).toMatch(/disabled=\{busy \|\| !chosen \|\| !notes\.trim\(\)/);
    // No effect may submit a decision — an admission must be an act.
    const submitAt = src.indexOf('const submit = useCallback');
    expect(submitAt).toBeGreaterThan(-1);
    expect(src).not.toMatch(/useEffect\([\s\S]{0,160}void submit\(\)/);
  });

  /*
   * AN ADMISSION THAT DOES NOT INGEST IS NOT AN ADMISSION (2026-08-03).
   *
   * The queue posted `{ decision, notes }` and never a provenanceClass.
   * `ingestApprovedSource` requires one and refuses without it — so the route
   * answered `{ ok: true, ingestion: { ok: false } }`, the client checked only
   * the outer `ok`, and every EXP-P1 admission through this queue moved the
   * source to `approved_*` (Stage 2's own signals then read it as admitted)
   * while producing NO evidence row. "Safe read as finished", one stage
   * earlier than where Al found it, and invisible because nothing inspected
   * `ingestion.ok`.
   */
  it('an ingesting admission cannot be submitted without a provenance class', () => {
    const src = stripComments(readSource(PANEL));
    // The client asks for it and sends it.
    expect(src).toMatch(/PROVENANCE_CLASSES\.map/);
    expect(src).toMatch(/provenanceClass: provenanceClass \|\| undefined/);
    // And refuses to submit without one where it is required.
    expect(src).toMatch(/if \(requiresProvenanceClass && !provenanceClass\) return;/);
    expect(src).toMatch(/requiresProvenanceClass && !provenanceClass\)\}/);
  });

  it('the server refuses the same thing, so the client gate is not the only one', () => {
    const svc = stripComments(readSource('services/corpusScout/reviewDecision.ts'));
    const at = svc.indexOf('if (willIngest && !input.provenanceClass)');
    expect(at, 'the server accepts an ingesting admission with no provenance class').toBeGreaterThan(-1);
    expect(svc.slice(at, at + 400)).toMatch(/ok: false/);
    // The refusal must be BEFORE any write.
    expect(at).toBeLessThan(svc.indexOf('updateCandidateReview('));
  });

  it('a failed ingestion is never reported as a plain success', () => {
    const src = stripComments(readSource(PANEL));
    // The outer `ok` reports the DECISION; ingestion has its own outcome.
    expect(src).toMatch(/const ingestion = d\.ingestion as/);
    expect(src).toMatch(/ingestionFailed: Boolean\(ingestion && !ingestion\.ok\)/);
    expect(src).toMatch(/the Ingestion Broker hand-off FAILED/);
  });
});

describe('Track 2 Stage 2 — governed bulk admission', () => {
  const ROUTE = 'app/api/corpus-scout/candidates/bulk-review/route.ts';

  it('the bulk route loops the SAME decision function the single-source route calls', () => {
    // A second admission path is the parallel implementation
    // inv.engineering.037 forbids, and it would be the one with the relaxed
    // rules — a bulk-only door into the corpus.
    const bulk = stripComments(readSource(ROUTE));
    const single = stripComments(readSource('app/api/corpus-scout/candidates/[sourceId]/review/route.ts'));
    expect(bulk).toMatch(/applyCandidateReviewDecision\(/);
    expect(single).toMatch(/applyCandidateReviewDecision\(/);
    // Neither route restates the decision vocabulary.
    for (const route of [bulk, single]) {
      expect(route).not.toMatch(/approved_exp_p1:\s*'approved_exp_p1'/);
      expect(route).not.toMatch(/ingestApprovedSource\(/);
    }
  });

  it('dryRun defaults TRUE — a forgotten flag inspects, never admits', () => {
    const bulk = stripComments(readSource(ROUTE));
    expect(bulk).toMatch(/const dryRun = body\.dryRun !== false;/);
    // And the write path is gated on it.
    expect(bulk).toMatch(/if \(dryRun\) \{/);
  });

  it('a write requires a rationale; an inspection does not', () => {
    const bulk = stripComments(readSource(ROUTE));
    expect(bulk).toMatch(/if \(!dryRun && !notes\)/);
  });

  it('every source in a batch shares ONE provenance class, and it is required to ingest', () => {
    const bulk = stripComments(readSource(ROUTE));
    const at = bulk.indexOf('INGESTING_DECISIONS.has(body.decision) && !body.provenanceClass');
    expect(at).toBeGreaterThan(-1);
    expect(bulk.slice(at, at + 500)).toMatch(/must be split, not guessed/);
  });

  it('mark_duplicate is refused in bulk — it is a per-source fact', () => {
    const bulk = stripComments(readSource(ROUTE));
    const at = bulk.indexOf("body.decision === 'mark_duplicate'");
    expect(at).toBeGreaterThan(-1);
    expect(bulk.slice(at, at + 500)).toMatch(/cannot be applied in bulk/);
    // The client does not offer it either.
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/DECISIONS\.filter\(\(d\) => d\.value !== "mark_duplicate"\)/);
  });

  it('an oversized batch is refused by name, never silently truncated', () => {
    const bulk = stripComments(readSource(ROUTE));
    expect(bulk).toMatch(/sourceIds\.length > MAX_BATCH/);
    const at = bulk.indexOf('sourceIds.length > MAX_BATCH');
    expect(bulk.slice(at, at + 600).replace(/`\s*\+\s*\n?\s*'/g, '')).toMatch(/refused rather than truncated/);
    // No slice() that would quietly drop the tail.
    expect(bulk).not.toMatch(/sourceIds\.slice\(0, MAX_BATCH\)/);
  });

  it('the prior status is read BEFORE the write, so a re-run is visible', () => {
    const bulk = stripComments(readSource(ROUTE));
    const readAt = bulk.indexOf('const existing = await getCandidateSource(admin, sourceId);');
    const writeAt = bulk.indexOf('await applyCandidateReviewDecision(');
    expect(readAt).toBeGreaterThan(-1);
    expect(writeAt).toBeGreaterThan(-1);
    expect(readAt).toBeLessThan(writeAt);
    // And an already-decided source is named as an OVERWRITE in the dry run.
    expect(bulk).toMatch(/would OVERWRITE that decision/);
  });

  it('one receipt per batch, on the shared research-lifecycle constructor', () => {
    const bulk = stripComments(readSource(ROUTE));
    expect(bulk).toMatch(/writeLifecycleReceipt\(\{/);
    // Never a second receipt constructor, and never a new action type.
    expect(bulk).not.toMatch(/createActivityReceipt\(/);
    expect(bulk).not.toMatch(/actionType:/);
    // Attribution is the T2-safe reference, never the raw personaId.
    expect(bulk).toMatch(/personaPublicRef\(persona\.personaId\)/);
    // Exactly one receipt call for the whole batch, outside the per-source loop.
    expect((bulk.match(/writeLifecycleReceipt\(/g) ?? []).length).toBe(1);
  });

  it('a receipt failure never rolls back an admission and is never silent', () => {
    const bulk = stripComments(readSource(ROUTE));
    const at = bulk.indexOf('if (!receipt.ok)');
    expect(at).toBeGreaterThan(-1);
    const block = bulk.slice(at, at + 500);
    expect(block).toMatch(/console\.error\('\[CORPUS BULK REVIEW\]/);
    expect(block).toMatch(/receiptWarning =/);
    expect(block).not.toMatch(/rollback|revert|undo/i);
  });

  it('per-source outcomes are reported individually, ingestion failures included', () => {
    const bulk = stripComments(readSource(ROUTE));
    expect(bulk).toMatch(/ingestionFailures: ingestionFailures\.length/);
    expect(bulk).toMatch(/outcomes,/);
    const src = stripComments(readSource(PANEL));
    // And the surface renders them rather than a bare count.
    expect(src).toMatch(/result\.outcomes\.map\(\(o\) =>/);
    expect(src).toMatch(/admitted WITHOUT becoming evidence/);
  });

  it('the record button unlocks only against an inspection of THIS selection', () => {
    // A dry run of a different selection or decision must not authorise a
    // write — the same staleness discipline the freeze act uses on its hash.
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(
      /result\.dryRun && result\.decision === decision && result\.requested === selected\.size/,
    );
    expect(src).toMatch(/disabled=\{busy \|\| !inspection \|\| !notes\.trim\(\)\}/);
  });

  it('duplicate groups are shown from the EXISTING detector, not a second one', () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/findDuplicateCandidates\(/);
    // The list projection has no normalizedTextHash — passing null is honest;
    // substituting the artifact hash would fabricate a match on an axis that
    // was never checked.
    expect(src).toMatch(/normalizedTextHash: null/);
    // Selecting duplicates is WARNED, never silently blocked.
    expect(src).toMatch(/belong to an exact-duplicate group/);
    /*
     * ASSERTION BROADENED 2026-08-03, reason recorded inline.
     *
     * This pinned the literal lowercase substring "this is not blocked", which
     * was a fragment of the sentence "…this is not blocked, because only you
     * can say which copy is canonical." That sentence became STALE when the
     * in-place duplicate resolution board shipped: the operator CAN now resolve
     * the group right there, so a warning ending on that caveat was a dead end
     * (UX invariant II — every exception terminates in an executable decision).
     *
     * The PROPERTY the canary exists to protect — warned, never silently
     * blocked — is unchanged and is asserted case-insensitively below. What is
     * no longer pinned is one particular rendering of it, which had made the
     * canary fail on a reword that improved the surface.
     */
    expect(src).toMatch(/not blocked/i);
    // …and the warning must now NAME the remedy rather than ending on a caveat.
    expect(src).toMatch(/Resolve them in the duplicate panel above/);
  });

  it('the institution tier is read from the ratified registry, never assumed', () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/findRegistryEntry\(r\.campaignDomain, r\.campaignSubDomain, issuer\)/);
    // An undeclared tier is reported as undeclared — never counted as an authority.
    expect(src).toMatch(/tier: entry\?\.tier \?\? null/);
    expect(src).toMatch(/tier undeclared/);
  });

  it('a selection does not survive a reload that changed the queue', () => {
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('const load = useCallback');
    const block = src.slice(at, src.indexOf('}, [acquisitionDomain]);', at));
    expect(block).toMatch(/setSelected\(new Set\(\)\)/);
  });

  it('the two admissions that ingest are distinguished from the one that does not', () => {
    /*
     * "Approve" and "approve AND hand to the Ingestion Broker" are different
     * acts. APPROVED_FOR_INGESTION is the authority on which is which; the
     * operator choosing between them must be told, or reference-only looks
     * like an admission that feeds the crystal and quietly does not.
     */
    const src = stripComments(readSource(PANEL));
    for (const status of APPROVED_FOR_INGESTION) {
      const decision = status.replace(/^approved_/, 'approve_');
      expect(src, `${decision} is not offered`).toContain(decision);
    }
    expect(src).toContain('approve_reference_only');
    // The reference-only consequence must say it is not ingested.
    const at = src.indexOf('approve_reference_only');
    const block = src.slice(at, at + 400);
    expect(block).toMatch(/NOT ingested/);
  });

  it('an unreadable queue is never rendered as an empty one', () => {
    // "Could not read" and "nothing to review" are different facts, and on a
    // review queue the second is the dangerous one to guess.
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('const load = useCallback');
    const block = src.slice(at, src.indexOf('}, [acquisitionDomain]);', at));
    expect(block).toMatch(/setRows\(null\)/);
    expect(block).not.toMatch(/setRows\(\[\]\)/);
  });

  it('a failed decision says the source is still pending', () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/this source is still pending/);
  });

  it('no `deferred` status is fabricated', () => {
    /*
     * Al asked for Admit / Reject / Defer. §8 has no `deferred` value. A
     * button that appeared to record a deferral while writing nothing would be
     * a governance act with no receipt — precisely what the constraints
     * forbid. Leaving the source pending is defer's effect and is labelled as
     * exactly that.
     */
    expect(REVIEW_WORKFLOW_STATUSES).not.toContain('deferred' as never);
    const src = stripComments(readSource(PANEL));
    expect(src).not.toMatch(/decision:\s*["'`]defer/);
    expect(src).toMatch(/Leave pending/);
  });
});

describe('Track 2 programme surface — the guided view', () => {
  it('stages that cannot proceed yet collapse, but completed ones never hide', () => {
    /*
     * Al + EXP agent: later stages showed "Nothing here has failed…" warnings
     * that made the screen noisy and buried where the attention belonged. The
     * remedy is collapse-with-a-count, not concealment — and a stage that is
     * COMPLETE stays visible whatever its ordinal, or the surface would
     * misreport progress in the other direction.
     *
     * ── SUPERSEDED RULE, REPLACED 2026-08-03 (exception-isolation ruling §6) ─
     *
     * This canary previously pinned the literal
     * `s.ordinal > current.ordinal && s.status !== "complete"`. That rule was
     * the UI half of the paralysis the ruling abolishes: with Stage 2
     * partially-complete — 29 sources admitted, 3 quarantined — Stage 3 was
     * hidden even though the evidence it extracts from already existed.
     *
     * Per OS-9, a canary that requires the defective shape in order to pass is
     * defending the defect. The collapse behaviour it legitimately protects is
     * preserved; only the AUTHORITY changes, from a client-side ordinal
     * comparison to the server's own `unblockedStageIds`.
     */
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/const unblocked = programme\.unblockedStageIds\?\.includes\(s\.id\) \?\? true;/);
    expect(src).toMatch(/const locked = !unblocked && s\.status !== "complete";/);
    expect(src).toMatch(/if \(locked && !showAllStages\) return null;/);
    // The count is stated, so nothing is silently dropped.
    expect(src).toMatch(/remaining stage\(s\) unlock automatically/);
  });

  it('the acquisition domain comes from the server, never from the crystal domain', () => {
    // The route says these are different namespaces and refuses to guess one
    // from the other. The queue must not undo that on the client.
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/setAcquisitionDomain\(typeof d\.acquisitionDomain === "string"/);
    expect(src).not.toMatch(/campaignDomain=\$\{encodeURIComponent\(programme\.crystalDomain\)/);
  });

  it('with sources pending, the programme still points at Stage 2', () => {
    // The projection, not the panel — proving the surface and the derivation
    // agree about where the work is.
    const programme = buildTrack2Programme({
      experimentId: 'EXP-P1',
      crystalDomain: 'financial-risk-value-systems',
      acquisitionDomain: 'financial-services',
      signals: {
        candidateSources: { total: 47, pendingReview: 41, admitted: 0 },
        discoveryCandidates: { total: 0, awaitingReview: 0, promoted: 0 },
        unclassifiedPromoted: null,
        readiness: {
          ok: false,
          invariantCount: 0,
          checks: [],
          graph: { relationshipCount: 0, orphanCount: 0 },
        } as never,
        lifecycle: { stageId: 'CANDIDATE_NOT_CONSTITUTED', whatIsMissing: 'no corpus' } as never,
        artifact: null,
        independentReviewRequestOpen: false,
        acquisitionSourceUniverse: null,
      },
    });
    expect(programme.currentStageId).toBe('review-and-admit');
    expect(programme.nextActions.join(' ')).toMatch(/41 source\(s\) await a human decision/);
  });

  /*
   * SEARCH FILTERS THE QUEUE; THE EXPORT IS THE WHOLE CANON (operator,
   * 2026-08-02).
   *
   *   > "add a search feature to the Discover sources and a link to download
   *   >  the json for all the sources in the canon so I can provide the list
   *   >  to Al to assist in filtering"
   *
   * These are two different populations and conflating them would be the
   * quiet defect: filtering advice about a corpus cannot be given from a view
   * that has already dropped the rejected and the admitted. The queue shows
   * what awaits a decision; the export is every source at every status.
   */
  it('the canon export is not the review queue', () => {
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('const exportCanon = useCallback');
    expect(at, 'no canon export').toBeGreaterThan(-1);
    const block = src.slice(at, src.indexOf('}, [acquisitionDomain]);', at));
    // Reads the domain WITHOUT a status FILTER — every source, every status.
    // (It still READS each row's status to count them, which is the opposite
    // concern: the envelope reports the shape of what the file contains.)
    expect(block).toMatch(/\/api\/corpus-scout\/candidates\?campaignDomain=/);
    expect(block).not.toMatch(/reviewWorkflowStatus=/);
    // And it does not export the already-filtered in-memory queue.
    expect(block).not.toMatch(/\brows\b|\bvisible\b/);
  });

  it('the export declares its own truncation rather than looking complete', () => {
    // The list projection caps normalizedText to stay under the payload limit.
    // A file that looks whole and is not is worse than one that states its
    // edges — whoever reads it downstream is entitled to know which fields
    // survived intact.
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/normalizedText is TRUNCATED in this export/);
    expect(src).toMatch(/normalizedTextChars carries each source's true length/);
    expect(src).toMatch(/Nothing has been filtered out/);
    // Counted by status, so the reader can see the shape of what they hold.
    expect(src).toMatch(/byReviewStatus/);
  });

  it('search filters what was read — it never issues a second query', () => {
    /*
     * A server-side search would be a parallel implementation of a list this
     * component already holds, and the two would answer differently the moment
     * either changed (inv.engineering.037).
     */
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/const visible = !rows/);
    expect(src).toMatch(/rows\.filter\(\(r\) =>/);
    // The count says which population it is talking about, so a filtered view
    // is never mistaken for the queue being smaller than it is.
    expect(src).toMatch(/of \{rows\.length\} awaiting-decision source\(s\) match/);
    expect(src).toMatch(/the download is always the whole canon/);
  });

  /*
   * THE QUEUE MUST STAY REACHABLE AFTER A DECISION (operator, 2026-08-02,
   * 14:33).
   *
   *   > "After I admit the first entry I can't scroll through or access the
   *   >  rest of the modal. I need to exit the modal and return to the stage
   *   >  for it to open and scroll."
   *
   * Two mechanisms could each produce that, and both are closed:
   *   1. forty cards rendered inline are only reachable if every ancestor
   *      lets the page grow — not something a surface inside the cartridge
   *      embed may assume;
   *   2. a search filter matching nothing rendered NOTHING — no rows, no
   *      explanation, no way back except unmounting the stage.
   */
  it('the queue scrolls itself rather than depending on an ancestor', () => {
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('{visible?.map((r) => (');
    expect(at).toBeGreaterThan(-1);
    const before = src.slice(Math.max(0, at - 260), at);
    expect(before, 'the card list has no bounded scroll region').toMatch(/overflow-y-auto/);
    expect(before).toMatch(/max-h-\[\d+vh\]/);
  });

  it('a filter that hides everything says so and offers a way back', () => {
    const src = stripComments(readSource(PANEL));
    // The state that used to render nothing at all.
    expect(src).toMatch(/visible !== null && visible\.length === 0 && rows\.length > 0/);
    expect(src).toMatch(/the search is\s+hiding them, nothing has been removed/);
    // A decided source leaving the queue is named, because that is the most
    // likely reason a search for one comes back empty.
    expect(src).toMatch(/it has\s+left the queue/);
    // And there is a control out of the dead end.
    expect(src).toMatch(/Show all \{rows\.length\}/);
    expect(src).toMatch(/Clear search/);
  });

  it('the search box cannot be filled by the browser', () => {
    // A filter nobody typed is indistinguishable from an empty queue, on a
    // surface whose entire job is to show what is waiting.
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('placeholder="search title, issuer, author, URL, sub-domain"');
    expect(at).toBeGreaterThan(-1);
    const block = src.slice(Math.max(0, at - 400), at);
    expect(block).toMatch(/autoComplete="off"/);
    expect(block).toMatch(/type="search"/);
  });

  /*
   * METADATA A STEWARD CAN DECIDE ON (Al, 2026-08-02, reviewing the canon
   * export).
   *
   *   > "issuer = null · publicationDate = null · BIS titles are duplicated as
   *   >  'survey of the users of BIS research' · CFTC titles appear only as
   *   >  'PDF' ... the crawler is preserving the document content but not
   *   >  enough bibliographic metadata for a steward to make an informed
   *   >  constitutional admission."
   *
   * Two separate defects. `issuer` was hardcoded null while the orchestrator
   * held the institution name — a fact thrown away. Titles come from crawler
   * link text, so "PDF" is what a link labelled "PDF" yields — a fact that is
   * not a title, and must not be dressed as one.
   */
  it('the institution is carried through to the row, not discarded', () => {
    const prov = stripComments(readSource('services/corpusScout/provenance.ts'));
    // No longer a hardcoded null.
    expect(prov).not.toMatch(/^\s*issuer: null,\s*$/m);
    expect(prov).toMatch(/issuer: input\.issuer\?\.trim\(\) \|\| null/);
    // And both discovery call sites supply it.
    const orch = stripComments(readSource('services/corpusScout/discoveryOrchestrator.ts'));
    const supplied = orch.match(/issuer: institutionName,/g) ?? [];
    expect(supplied.length, 'a discovery path still drops the institution').toBe(2);
  });

  it('a title that is not a title is flagged, never repaired', () => {
    /*
     * MOVED 2026-08-03 (exception-isolation ruling §4). The judgement now
     * lives in `services/corpusScout/admissionRecommendation.ts` so the
     * SERVER-side recommendation pass and this card give the same answer; the
     * panel keeps a one-line adapter. This canary follows it rather than
     * pinning the old location — which would have required the duplicate to
     * stay in order to pass (inv.engineering.036, and the OS-9 rule against a
     * test that defends the shape it was written beside).
     */
    const svc = stripComments(readSource('services/corpusScout/admissionRecommendation.ts'));
    expect(svc).toMatch(/export function titleResolutionIssue\(/);
    // The literal cases Al found.
    expect(svc).toMatch(/\^\(pdf\|document\|download\|file\|link\|here\|view\)\$/);
    // The URL-basename fallback case.
    expect(svc).toMatch(/This title is the URL filename/);
    // It must NOT invent a replacement — guessing a title is worse than
    // naming the absence.
    const at = svc.indexOf('export function titleResolutionIssue(');
    const body = svc.slice(at, svc.indexOf('\n}', at));
    expect(body).not.toMatch(/title =|repair/i);

    // The panel still SURFACES it, through the shared function.
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/titleResolutionIssue\(row\.title, row\.canonicalUrl\)/);
    expect(src).toMatch(/The title is unresolved\./);
  });

  it('an unresolved title is a WARNING on a verifiable source, never a quarantine', () => {
    /*
     * Ruling §4, verbatim: "Do not make the operator chase missing titles when
     * the content itself suffices for evidence admission." Mutation: return a
     * forcing 'manual review required' on an unresolved title → a filename-
     * shaped title once again withholds a byte-verified, institutionally
     * sourced document.
     */
    const svc = stripComments(readSource('services/corpusScout/admissionRecommendation.ts'));
    expect(svc).toMatch(/UNRESOLVED_TITLE_WARNING/);
    expect(svc).toMatch(/Document title unresolved; source admitted on verified content, issuer, URL and artifact hash\./);
    // The title check must sit AFTER the content-verifiability gates, in the
    // warnings-only region.
    const titleAt = svc.indexOf('const titleIssue = titleResolutionIssue(');
    const hashGateAt = svc.indexOf('if (!source.artifactHash) {');
    expect(hashGateAt).toBeGreaterThan(-1);
    expect(titleAt).toBeGreaterThan(hashGateAt);
  });

  it('absence is rendered, not omitted', () => {
    /*
     * A blank row and a row whose publication date was never extracted look
     * identical, and only one of them is a reason to hesitate.
     */
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/function bibliographicFields\(/);
    expect(src).toMatch(/\{f\.value \?\? "not captured"\}/);
    for (const label of ['Institution', 'Published', 'Authors', 'Licence']) {
      expect(src, `${label} is not shown`).toContain(`label: "${label}"`);
    }
  });

  it('fields the pipeline does not capture are named as such, not faked', () => {
    // Rendering permanently-empty rows for jurisdiction/document type would be
    // noise pretending to be rigour; inventing values would be worse.
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/does not yet capture regulation or programme, document type, jurisdiction/);
    expect(src).toMatch(/absent from every row, not just this one/);
  });

  /*
   * STAGE 8 MUST NOT BE A BYPASS (Al, 2026-08-02).
   *
   *   > "68 promoted invariants have no recorded evidence provenance, and
   *   >  validation and relationships have not started. So the UI should
   *   >  currently take you into Stage 5, not invite you to type IDs into
   *   >  Stage 8."
   *
   * Collapsing the stage was not enough. A steward who expands "show all
   * stages" still met an invariant-ID textarea, and pasting IDs there would
   * skip provenance classification, validation and relationship review
   * entirely. A control that can circumvent the stages before it is a hole in
   * the ladder, not a convenience.
   */
  it('the assignment control is gated, and a partially-complete earlier stage no longer withholds it', () => {
    /*
     * SUPERSEDED RULE, REPLACED 2026-08-03 (exception-isolation ruling).
     *
     * This canary previously required `x.status !== "complete"` alone — every
     * earlier stage COMPLETE before Stage 8 offered any control. That was
     * correct while the control was a textarea, because pasting ids into it
     * bypassed provenance, validation and relationship review.
     *
     * The derived surface cannot bypass anything: every row it offers has been
     * through `evaluateCrystalAssignment`, so an invariant lacking validation
     * or evidence provenance renders as an exception and cannot be selected.
     * The safety moved from the STAGE to the RECORD, which is strictly
     * stronger — and it is what lets a partially-complete Stage 5 stop
     * withholding assignment of the cohort that IS eligible.
     *
     * Per OS-9, keeping the old assertion would have required the paralysis to
     * remain in order to pass.
     */
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/const blockers = programme\.stages\.filter\(/);
    expect(src).toMatch(/x\.status !== "complete" &&/);
    expect(src).toMatch(/x\.status !== "partially-complete"/);
    expect(src).toMatch(/if \(blockers\.length === 0\) \{/);
    // The control is still INSIDE that branch — never rendered unconditionally.
    const at = src.indexOf('if (blockers.length === 0) {');
    const guarded = src.slice(at, at + 300);
    expect(guarded).toMatch(/<AssignmentControl/);
    expect((src.match(/<AssignmentControl/g) ?? []).length).toBe(1);
  });

  it('a locked Stage 8 names the stage that IS the next act', () => {
    // Routing the operator to the real blocker is the point — a bare refusal
    // would leave them where the ladder does not want them.
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/Assignment is not the next act\./);
    expect(src).toMatch(/\{next\.ordinal\}\. \{next\.label\}/);
    // And the reason given is now the honest one: no eligible invariant can
    // exist yet — NOT that earlier stages hold unresolved exceptions.
    expect(src).toMatch(/no eligible invariant can exist yet/);
  });

  it('the assignment lock is derived from the programme, not a second rule', () => {
    // Eligibility and stage state are the server's; re-deciding them here
    // would be the parallel implementation inv.engineering.037 forbids.
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('const blockers = programme.stages.filter(');
    const block = src.slice(at, at + 400);
    expect(block).not.toMatch(/provenance|validated|relationship/i);
  });
});


/**
 * EXCEPTION ISOLATION at the Track 2 surface (operator ruling, 2026-08-03).
 *
 *   > "Constitutional control constrains the unsafe act; it does not
 *   >  immobilize the safe remainder."
 *
 * The behavioural model itself is canaried in `tests/exception-isolation.test.ts`.
 * These pin the SURFACE and the PROJECTION — the two places the model was
 * previously contradicted even when the underlying counts were right.
 */
describe('Track 2 exception isolation — the surface never reimposes the paralysis', () => {
  const PANEL = 'components/research/Track2ProgrammePanel.tsx';
  const PROGRAMME = 'services/research/track2Programme.ts';

  it('Stage 2 reports partially-complete when sources are admitted AND some remain', () => {
    // Mutation: return 'in-progress' here -> the stage reads as unfinished
    // work rather than partial completion, `unblockedStageIds` stops
    // including Stage 3, and extraction waits for a perfect corpus.
    const src = stripComments(readSource(PROGRAMME));
    const at = src.indexOf("id: 'review-and-admit'");
    // The window ends at the NEXT stage rather than at a fixed character
    // count: a byte budget makes this assertion fail when an unrelated field
    // is added to the stage (the `population` declaration did exactly that on
    // 2026-08-03), which is a canary reporting its own brittleness rather than
    // the mutation it was written to catch.
    const next = src.indexOf("id: 'extract-candidates'", at);
    const stage = src.slice(at, next > at ? next : at + 1200);
    expect(stage).toMatch(/'partially-complete'/);
  });

  it('the programme state model carries partially-complete, and exposes unblockedStageIds', () => {
    const src = stripComments(readSource(PROGRAMME));
    expect(src).toMatch(/export type Track2StageStatus =[\s\S]{0,240}'partially-complete'/);
    expect(src).toMatch(/unblockedStageIds/);
  });

  it('a stage after a PARTIALLY-COMPLETE stage is unblocked', () => {
    // Mutation: drop 'partially-complete' from PASSES_THROUGH -> three
    // unresolved sources withhold extraction of the twenty-nine already
    // admitted.
    const src = stripComments(readSource(PROGRAMME));
    const at = src.indexOf('PASSES_THROUGH');
    const block = src.slice(at, at + 400);
    expect(block).toMatch(/'complete'/);
    expect(block).toMatch(/'partially-complete'/);
  });

  it('the panel gates stage locks on the server unblockedStageIds, never on ordinals', () => {
    // The UI half of the paralysis. Mutation: restore
    // `s.ordinal > current.ordinal` -> Stage 3 hides behind a
    // partially-complete Stage 2 even though its inputs exist.
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('const unblocked =');
    const block = src.slice(at, at + 300);
    expect(block).toMatch(/programme\.unblockedStageIds/);
    expect(block).not.toMatch(/ordinal >/);
  });

  it('partial completion is never rendered as a failure', () => {
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('const STATUS_LABEL');
    const labels = src.slice(at, at + 600);
    expect(labels).toMatch(/"partially-complete":\s*"partially complete/);
    expect(labels).toMatch(/blocked: "blocked/);
  });

  it('the primary action is enabled from the shared summary, never from an exception count', () => {
    // Acceptance criterion #1, at the surface. Mutation: gate the batch panel
    // on `counts.exceptions === 0` -> three anomalous sources disable
    // admission of thirty eligible ones again.
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('function ExecutableBatchSummary');
    const block = src.slice(at, src.indexOf('function ExceptionsSurface'));
    expect(block.length).toBeGreaterThan(500);
    expect(block).toMatch(/isolation\.globalStop/);
    expect(block).not.toMatch(/counts\.exceptions\s*===\s*0/);
  });

  it('the full population is disclosed on the surface, not just what advanced', () => {
    // The section-5 guardrail: exception isolation WITHOUT population
    // disclosure lets a materially narrow crystal look complete.
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('function ExecutableBatchSummary');
    const block = src.slice(at, src.indexOf('function ExceptionsSurface'));
    expect(block).toMatch(/Discovered:/);
    expect(block).toMatch(/Assigned to crystal:/);
    expect(block).toMatch(/population\.exceptions/);
  });

  it('the exceptions surface renders all FOUR blocks* booleans separately', () => {
    // "This is what stops the system from treating all amber notices alike."
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('function ExceptionsSurface');
    const block = src.slice(at, at + 4000);
    for (const field of ['blocksCurrentStage', 'blocksCrystalAssignment', 'blocksReadiness', 'blocksFreeze']) {
      expect(block, `${field} must be rendered`).toContain(field);
    }
  });

  it('the title heuristic lives in ONE place and the panel consumes it', () => {
    // Moved server-side so the recommendation pass and the card agree
    // (inv.engineering.036).
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/titleResolutionIssue\(row\.title, row\.canonicalUrl\)/);
    expect(src).not.toMatch(/is link text, not a document title/);
  });

  it('readiness reports exclusions SEPARATELY and never lets them change ok', () => {
    // Ruling section 3/7. Mutation: fold `excludedFromCrystal` into the `ok`
    // computation -> an unresolved record outside the crystal becomes a
    // crystal failure, which is exactly what must not happen.
    const src = stripComments(readSource('services/research/crystalReadiness.ts'));
    expect(src).toMatch(/excludedFromCrystal/);
    const okAt = src.indexOf('const ok = checks.every');
    const okLine = src.slice(okAt, okAt + 120);
    expect(okLine).not.toMatch(/exclusion|excluded/i);
    expect(src).toMatch(/computeFreezeBlocking\(/);
  });
});


/**
 * STAGE 8 — the DERIVED assignment surface (operator ruling, 2026-08-03).
 *
 *   > "Stage 8 is the highest-value next commit because it turns all earlier
 *   >  classifications into an actual crystal rather than leaving the operator
 *   >  to paste invariant IDs."
 *
 *   > "Do not accept pasted invariant IDs as the primary path."
 */
describe('Track 2 Stage 8 — assignment is derived, never pasted', () => {
  const ROUTE = 'app/api/research/crystal/[experimentId]/assign/route.ts';

  it('the route DERIVES the candidate list from the substrate', () => {
    // Mutation: delete the GET handler -> the panel has nothing to render and
    // the operator is back to pasting ids.
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/export async function GET\(/);
    expect(src).toMatch(/listInvariants\(\{ domain: acquisitionDomain/);
  });

  it('the derived view uses the SAME eligibility function the write path uses', () => {
    // inv.engineering.036/037: one eligibility rule. Mutation: hand-roll a
    // status/provenance check in GET -> the view can offer what POST refuses.
    const src = stripComments(readSource(ROUTE));
    const getAt = src.indexOf('export async function GET(');
    const postAt = src.indexOf('export async function POST(');
    const getBlock = src.slice(getAt, postAt);
    expect(getBlock).toMatch(/evaluateCrystalAssignment\(/);
    expect(src.slice(postAt)).toMatch(/evaluateCrystalAssignment\(/);
    // The GET must not invent its own eligibility literals.
    expect(getBlock).not.toMatch(/status === 'validated'/);
    expect(getBlock).not.toMatch(/eligibleStatuses\.includes/);
  });

  it('the derived view WRITES NOTHING', () => {
    // Mutation: upsert the context in GET "since it already evaluated" ->
    // reading the screen would assign the crystal.
    const src = stripComments(readSource(ROUTE));
    const getBlock = src.slice(src.indexOf('export async function GET('), src.indexOf('export async function POST('));
    for (const forbidden of ['upsertContext(', 'writeLifecycleReceipt(']) {
      expect(getBlock, `GET must not call ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('an ineligible invariant is an EXCEPTION with a remedy, never a refusal', () => {
    // Both per-record refusals are recoverable; marking them `refused` would
    // misreport recoverable work as a dead end.
    const src = stripComments(readSource(ROUTE));
    const getBlock = src.slice(src.indexOf('export async function GET('), src.indexOf('export async function POST('));
    expect(getBlock).toMatch(/disposition: 'exception'/);
    expect(getBlock).not.toMatch(/disposition: 'refused'/);
    expect(getBlock).toMatch(/advance/);
    expect(getBlock).toMatch(/classify/);
  });

  it('an ineligible invariant does not block the eligible cohort', () => {
    // THE ruling, at Stage 8. Mutation: set blocksCrystalAssignment true ->
    // one unvalidated invariant withholds every valid one.
    const src = stripComments(readSource(ROUTE));
    const getBlock = src.slice(src.indexOf('export async function GET('), src.indexOf('export async function POST('));
    expect(getBlock).toMatch(/blocksCurrentStage: false/);
    expect(getBlock).toMatch(/blocksCrystalAssignment: false/);
    expect(getBlock).toMatch(/blocksReadiness: false/);
  });

  it('an unratified boundary is a GLOBAL stop, not N per-record refusals', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/governing-declaration-absent/);
    expect(src).toMatch(/domainAcceptsAssignment\(declaration\)/);
  });

  it('the cohort hash and rationale are generated by the server', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/computeCohortHash\(/);
    expect(src).toMatch(/suggestedRationale:/);
  });

  it('the panel loads the derived list and preselects the executable cohort', () => {
    // Mutation: drop the preselect -> the operator hand-picks from a list
    // again, which is the manual work this stage exists to remove.
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('const loadDerived = useCallback');
    const block = src.slice(at, at + 1400);
    expect(block.length).toBeGreaterThan(400);
    expect(block).toMatch(/summary\.executableRecordIds/);
    expect(block).toMatch(/setSelected\(new Set\(payload\.summary\.executableRecordIds\)\)/);
  });

  it('the paste box is a labelled FALLBACK, not the primary path', () => {
    // The hard requirement. Mutation: render the textarea unconditionally at
    // the top again -> pasting becomes the primary path.
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/Manual fallback — paste invariant ids/);
    // It is behind a toggle that defaults CLOSED.
    expect(src).toMatch(/const \[showPaste, setShowPaste\] = useState\(false\)/);
    expect(src).toMatch(/\{showPaste && \(/);
  });

  it('each row shows provenance, validation and relationship status', () => {
    // The three facts the steward is deciding on. Mutation: drop any one ->
    // the operator is asked to confirm a cohort they cannot assess.
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf('{derived.rows.map((r) => (');
    const block = src.slice(at, at + 3000);
    expect(block).toMatch(/r\.evidenceProvenance/);
    expect(block).toMatch(/r\.timesValidated/);
    expect(block).toMatch(/r\.relationshipCount/);
  });

  it('confirmation still requires a dry run and a rationale', () => {
    // Derived does NOT mean automatic. One explicit steward confirmation.
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/!dryRunSeen \|\|/);
    expect(src).toMatch(/!rationale\.trim\(\) \|\|/);
  });
});

// ── CLASSIFY PROVENANCE — machine recommendation ≠ steward decision
// (2026-08-30 incident) ──────────────────────────────────────────────────────
//
// A steward clicked through Classify Provenance for 3 newly-promoted
// invariants. The first record never had a class explicitly selected or
// reviewed — yet the write succeeded and Track 2 marked the stage complete.
// Root cause: `ClassificationQueue`'s per-record "✓ Accept" and batch
// "Accept All High-Confidence" controls submitted the machine's own
// `suggestedClass` directly, bypassing the guarded `<select>`/`to` state and
// its `disabled={!to || ...}` check entirely — and nothing server-side
// distinguished that from a genuine steward selection. These canaries pin
// the UI side of the repair (server-side coverage lives in
// tests/evidence-provenance-populations.test.ts, describe('the constitutional
// act — classDisposition is declared, never inferred')).

describe('Classify Provenance — every submission declares WHICH explicit steward act produced the class', () => {
  it('the manual "Classify & next" path declares classDisposition: operator-selected', () => {
    const src = stripComments(readSource(PANEL));
    const fnStart = src.indexOf('const classifyAndNext = useCallback');
    const fnEnd = src.indexOf('[submit, to, evidenceRefs, rationale]', fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toMatch(/classDisposition:\s*"operator-selected"/);
  });

  it('the per-record "✓ Accept" path declares recommendation-accepted AND carries the full accepted recommendation', () => {
    const src = stripComments(readSource(PANEL));
    const fnStart = src.indexOf('const acceptSuggestion = useCallback');
    const fnEnd = src.indexOf('[classSuggestion, submit]', fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toMatch(/classDisposition:\s*"recommendation-accepted"/);
    // The EXACT card the steward saw — never a re-derived or partial value.
    expect(fnBody).toMatch(/acceptedRecommendation:\s*classSuggestion/);
  });

  it('the cohort-ratification batch act ALSO declares recommendation-accepted per-record — a batch click is not exempt from the rule', () => {
    // This is the control the operator specifically flagged (2026-09-05
    // audit): a click on it is a real steward act, but confidence alone must
    // never be what completes the classification. The client-side
    // "Accept All High-Confidence (>95%)" shortcut this test used to pin was
    // retired (no calibration/ratification of 95 exists anywhere in this
    // repo) — the batch act now lives ENTIRELY server-side in
    // provenance-cohort/route.ts's POST handler, which still declares, for
    // every real write, exactly the recommendation it accepted — an even
    // stronger guarantee, since no client path to a batch write without this
    // declaration exists at all anymore.
    const routeSrc = stripComments(readSource('app/api/research/track2/[experimentId]/provenance-cohort/route.ts'));
    expect(routeSrc).toMatch(/classDisposition:\s*'recommendation-accepted'/);
    expect(routeSrc).toMatch(/acceptedRecommendation:\s*\{/);
  });

  it('every submit() call site in this queue declares a classDisposition — none can silently omit it', () => {
    const src = stripComments(readSource(PANEL));
    const fnStart = src.indexOf('function ClassificationQueue(');
    const fnEnd = src.indexOf('\nfunction ', fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > -1 ? fnEnd : undefined);
    // Every call that posts `action: "classify"` (the guarded submit() plus
    // the standalone batch fetch inside acceptAllHighConfidence) carries the
    // literal string "classDisposition" — three occurrences: the type
    // declaration on submit's own args, and the two direct POST bodies
    // (submit's own body, and the batch's per-record body).
    const classifyPosts = (fnBody.match(/action:\s*"classify"/g) ?? []).length;
    const dispositionMentions = (fnBody.match(/classDisposition/g) ?? []).length;
    expect(classifyPosts).toBeGreaterThan(0);
    expect(dispositionMentions).toBeGreaterThanOrEqual(classifyPosts + 1); // +1 for submit()'s own arg type
  });

  it('the OTHER classify surface (InvariantDiscoveryTab, manual-only, no suggestion pre-select) also declares operator-selected', () => {
    const src = stripComments(readSource('components/composer/InvariantDiscoveryTab.tsx'));
    const fnStart = src.indexOf('const classify = useCallback');
    const fnEnd = src.indexOf('[classifyFor, post, load]', fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toMatch(/classDisposition:\s*"operator-selected"/);
  });
});
