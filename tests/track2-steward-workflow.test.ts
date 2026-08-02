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
    expect(src).toMatch(/disabled=\{busy \|\| !chosen \|\| !notes\.trim\(\)\}/);
    // No effect may submit a decision — an admission must be an act.
    const submitAt = src.indexOf('const submit = useCallback');
    expect(submitAt).toBeGreaterThan(-1);
    expect(src).not.toMatch(/useEffect\([\s\S]{0,160}void submit\(\)/);
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
  it('stages later than the current one collapse, but completed ones never hide', () => {
    /*
     * Al + EXP agent: later stages showed "Nothing here has failed…" warnings
     * that made the screen noisy and buried where the attention belonged. The
     * remedy is collapse-with-a-count, not concealment — and a stage that is
     * COMPLETE stays visible whatever its ordinal, or the surface would
     * misreport progress in the other direction.
     */
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/const locked = !!current && s\.ordinal > current\.ordinal && s\.status !== "complete";/);
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
});
