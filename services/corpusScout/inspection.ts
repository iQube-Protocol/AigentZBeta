/**
 * Corpus Scout (PRD-ICA-001) — Inspection Agent (§10 agent E). Parses content
 * and confirms substantive material is actually present (§7's content-presence
 * inspection) — never infers validity from a URL or declared MIME type alone.
 *
 * PDF: reuses `services/content/pdfExtractionService.ts` (§0.4) — do not add a
 * second PDF library or reimplement page/word counting.
 *
 * HTML/plain text: a simple tag-stripping extraction. No new HTML-parsing
 * dependency was added — `package.json` has none (cheerio/jsdom/etc.) and
 * PRD-ICA-001 §0.4 asks that existing infra be reused before adding a new one;
 * a regex-based strip is sufficient for the content-presence check this stage
 * needs (title/heading/table-of-contents-only detection is a Phase 3 concern,
 * out of scope here).
 */

import { getPDFExtractionService } from '@/services/content/pdfExtractionService';
import type { InspectionResult } from './types';

// Illustrative thresholds (PRD-ICA-001 §7) — configurable by source type, not
// fixed by the PRD. Kept as named constants so a future campaign config can
// override them without touching the check logic.
const PDF_MIN_PAGE_COUNT = 5;
const PDF_MIN_SUBSTANTIVE_CHARS = 5_000;
const PDF_MAX_BLANK_PAGE_RATIO = 0.25;
const BLANK_PAGE_WORD_THRESHOLD = 10;

// Deliberate adaptation, not an oversight: HTML/plain-text sources have no
// page concept, so the §7 threshold (page-count-shaped) does not apply. This
// lighter-weight, text-only threshold is the explicit substitute for
// non-paginated content.
const TEXT_ONLY_MIN_SUBSTANTIVE_CHARS = 2_000;

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function inspectPdf(bytes: Buffer): Promise<InspectionResult> {
  const svc = getPDFExtractionService();
  const result = await svc.extractFromBuffer(bytes);
  if (!result.success) {
    return {
      ok: false,
      normalizedText: '',
      pageCount: null,
      substantiveTextCharacters: 0,
      blankPageRatio: null,
      extractionWarnings: [result.error ?? 'pdf extraction failed'],
      passesContentPresenceCheck: false,
    };
  }

  const normalizedText = result.fullText.trim();
  const substantiveTextCharacters = normalizedText.length;
  const pageCount = result.metadata.pageCount;
  const blankPages = result.pages.filter((p) => p.wordCount < BLANK_PAGE_WORD_THRESHOLD).length;
  const blankPageRatio = result.pages.length > 0 ? blankPages / result.pages.length : null;

  const warnings: string[] = [];
  const passesContentPresenceCheck =
    pageCount >= PDF_MIN_PAGE_COUNT &&
    substantiveTextCharacters >= PDF_MIN_SUBSTANTIVE_CHARS &&
    (blankPageRatio ?? 0) < PDF_MAX_BLANK_PAGE_RATIO;

  if (!passesContentPresenceCheck) {
    if (pageCount < PDF_MIN_PAGE_COUNT) {
      warnings.push(`page count ${pageCount} below the ${PDF_MIN_PAGE_COUNT}-page illustrative threshold (PRD-ICA-001 §7)`);
    }
    if (substantiveTextCharacters < PDF_MIN_SUBSTANTIVE_CHARS) {
      warnings.push(`substantive text ${substantiveTextCharacters} chars below the ${PDF_MIN_SUBSTANTIVE_CHARS}-char illustrative threshold`);
    }
    if ((blankPageRatio ?? 0) >= PDF_MAX_BLANK_PAGE_RATIO) {
      warnings.push(`blank-page ratio ${(blankPageRatio ?? 0).toFixed(2)} at/above the ${PDF_MAX_BLANK_PAGE_RATIO} threshold`);
    }
  }

  return {
    ok: true,
    normalizedText,
    pageCount,
    substantiveTextCharacters,
    blankPageRatio,
    extractionWarnings: warnings,
    passesContentPresenceCheck,
  };
}

function inspectHtmlOrText(bytes: Buffer): InspectionResult {
  const raw = bytes.toString('utf8');
  const normalizedText = stripHtmlTags(raw);
  const substantiveTextCharacters = normalizedText.length;
  const passesContentPresenceCheck = substantiveTextCharacters >= TEXT_ONLY_MIN_SUBSTANTIVE_CHARS;

  const warnings: string[] = [];
  if (!passesContentPresenceCheck) {
    warnings.push(
      `substantive text ${substantiveTextCharacters} chars below the ${TEXT_ONLY_MIN_SUBSTANTIVE_CHARS}-char ` +
      `text-only threshold (non-paginated content — a deliberate PRD-ICA-001 §7 adaptation, not the PDF threshold)`,
    );
  }

  return {
    ok: true,
    normalizedText,
    pageCount: null,
    substantiveTextCharacters,
    blankPageRatio: null,
    extractionWarnings: warnings,
    passesContentPresenceCheck,
  };
}

/**
 * Inspect retrieved bytes for substantive content presence. `mimeType` should
 * be the CALLER's best determination of the actual type (e.g. from magic-byte
 * sniffing in `retrieval.ts`, not blindly the declared Content-Type header) —
 * this function itself does no further sniffing beyond checking the string.
 */
export async function inspectArtifact(bytes: Buffer, mimeType: string): Promise<InspectionResult> {
  const mt = mimeType.toLowerCase();
  if (mt.includes('pdf')) return inspectPdf(bytes);
  return inspectHtmlOrText(bytes);
}
