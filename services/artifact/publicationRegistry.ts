/**
 * The Publication Registry — series + canonical numbering for CPS publications
 * (CFS-026 · CFS-027 factory plumbing).
 *
 * Publications are numbered like plates and papers in a mature discipline:
 * four-digit within a series (IRL-0001), the number a stable reference
 * independent of any document instance. This is the IN-SITU registry (the
 * canonicalAssets pattern): pinned series + the publications reserved so far,
 * pure helpers, no DB. When produced publications persist as first-class
 * records (the operational-artifact persistence follow-on), allocation moves
 * behind a store; the numbering contract here does not change.
 *
 * Isomorphic: pure data + pure helpers. Order pinned by canary.
 */

import { cpsPaperNumber, CPS_SERIES } from '@/services/artifact/constitutionalPublishingSystem';
import { PLATE_COMPOSITIONS } from '@/services/artifact/canonicalPlates';

export interface PublicationSeries {
  code: string;
  imprint: string;
}

/** The publication series (codes pinned; imprints from the CPS). */
export const PUBLICATION_SERIES: readonly PublicationSeries[] = Object.entries(CPS_SERIES).map(
  ([code, imprint]) => ({ code, imprint }),
);

export interface RegisteredPublication {
  /** The canonical number — e.g. IRL-0001. */
  number: string;
  seriesCode: string;
  title: string;
  /** The Canonical Plates this publication composes (CP numbers). */
  plates: readonly string[];
  /** Honest state: reserved (numbered, not yet produced) | produced | published. */
  state: 'reserved' | 'produced' | 'published';
}

/**
 * The publications registered so far. IRL-0001 is RESERVED (numbered, awaiting
 * production — the operator produces it in the workshop when ready). Extend by
 * appending; numbers are never reused or reordered.
 */
export const PUBLICATION_REGISTER: readonly RegisteredPublication[] = [
  {
    number: 'IRL-0001',
    seriesCode: 'IRL',
    title: 'The Invariant Research Lab — Foundational Paper',
    plates: PLATE_COMPOSITIONS['IRL-001'] ?? [],
    state: 'reserved',
  },
  {
    // CS-001 formal publication (CFS-029 §7.4, ratified 2026-07-13). Source:
    // codexes/packs/irl/foundation/CS-001_duplicate-capability-as-constitutional-drift.md
    // Production follows the same deferred CPS path as IRL-0001.
    number: 'IRL-0002',
    seriesCode: 'IRL',
    title: 'Duplicate Capability as Constitutional Drift — Case Study CS-001',
    plates: [],
    state: 'reserved',
  },
] as const;

/** The next canonical number in a series (max existing + 1). Pure. */
export function nextPublicationNumber(seriesCode: string): string {
  const inSeries = PUBLICATION_REGISTER.filter((p) => p.seriesCode === seriesCode);
  const max = inSeries.reduce((m, p) => {
    const n = Number.parseInt(p.number.split('-')[1] ?? '0', 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return cpsPaperNumber(seriesCode, max + 1);
}

/** A registered publication by its canonical number, or undefined. Pure. */
export function publicationByNumber(number: string): RegisteredPublication | undefined {
  return PUBLICATION_REGISTER.find((p) => p.number === number);
}

/** A series by code, or undefined. Pure. */
export function seriesByCode(code: string): PublicationSeries | undefined {
  return PUBLICATION_SERIES.find((s) => s.code === code);
}
