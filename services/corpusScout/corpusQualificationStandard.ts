/**
 * The **Corpus Qualification Standard** — the named, single-source definition
 * of what makes a retrieved artefact a QUALIFYING document.
 *
 * ── This standard is PROMOTED, not invented ────────────────────────────────
 *
 * PRD-ICA-001 §7 already ratifies these numbers as its content-presence
 * inspection threshold — *"Illustrative threshold (configurable by source
 * type, not fixed by this PRD): `pageCount ≥ 5 AND substantiveTextCharacters
 * ≥ 5,000 AND blankPageRatio < 0.25`"*. Operator ruling, 2026-07-27: promote
 * them into a named standard; do not invent new numbers.
 *
 * They lived as private constants inside `inspection.ts`. Registry
 * verification needs the same numbers, and two copies of a threshold is the
 * `inv.engineering.036` defect applied to a number. `inspection.ts` now
 * imports them from here — one authoritative location, two consumers.
 *
 * ── THE UNIT IS CHARACTERS, NOT WORDS ──────────────────────────────────────
 *
 * Stated in capitals because the ambiguity is live: the operator's own
 * recollection of the threshold was "5,000 words", and PRD-ICA-001 §7's field
 * name is `substantiveTextCharacters`. 5,000 words is roughly 30,000
 * characters — a six-fold difference that would silently reject most
 * qualifying documents. A named standard that leaves its unit implicit is a
 * standard that will be misapplied, so the unit is in the constant name, in
 * this comment, and in the human-readable statement below.
 */

/** Minimum pages for a paginated (PDF) artefact. PRD-ICA-001 §7. */
export const CQS_PDF_MIN_PAGE_COUNT = 5;

/** Minimum substantive text for a paginated artefact, in CHARACTERS. */
export const CQS_PDF_MIN_SUBSTANTIVE_CHARACTERS = 5_000;

/** A paginated artefact must be below this fraction of blank pages. */
export const CQS_PDF_MAX_BLANK_PAGE_RATIO = 0.25;

/** A page with fewer than this many words counts as blank. */
export const CQS_BLANK_PAGE_WORD_THRESHOLD = 10;

/**
 * Minimum substantive text for NON-PAGINATED content (HTML, plain text), in
 * CHARACTERS. A deliberate adaptation, not a weaker rule slipped in: a web
 * page has no page count, so the page-shaped half of the §7 threshold cannot
 * apply to it and a substitute has to be stated explicitly rather than left
 * to whatever the checker happens to do.
 */
export const CQS_TEXT_ONLY_MIN_SUBSTANTIVE_CHARACTERS = 2_000;

/**
 * The standard in words, for the registry document, the review workspace and
 * any report that has to say what "qualifying" means without restating the
 * numbers by hand. Pinned to SPEC-CIR-001 by canary.
 */
export const CORPUS_QUALIFICATION_STANDARD_STATEMENT =
  'A retrieved artefact QUALIFIES when its bytes were retrieved and inspected — never inferred from a URL or a ' +
  'declared MIME type — and, for a paginated artefact, it has at least ' + CQS_PDF_MIN_PAGE_COUNT + ' pages, at least ' +
  CQS_PDF_MIN_SUBSTANTIVE_CHARACTERS + ' substantive text CHARACTERS (not words), and a blank-page ratio below ' +
  CQS_PDF_MAX_BLANK_PAGE_RATIO + '; or, for non-paginated content, at least ' +
  CQS_TEXT_ONLY_MIN_SUBSTANTIVE_CHARACTERS + ' substantive text CHARACTERS.';
