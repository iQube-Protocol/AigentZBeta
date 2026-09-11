/**
 * polityPapersSeries — the real, live Qriptopian Codex "Polity Papers"
 * series (`papers/polity` scope), used to give the CI Bridge View's Paper
 * featured state a document-gallery composition (cover + adjacent series
 * covers) instead of one portrait cover floating alone in a wide viewport.
 *
 * Queried 2026-08-11 from the live `GET /api/codex/qripto/papers?group=papers`
 * endpoint on dev-beta — four real papers, real covers, real PDFs, all
 * sharing the same real cover pixel dimensions (1055×1491, verified by
 * fetching each binary). No interior-page thumbnails exist anywhere in this
 * codebase (CLAUDE.md's "Grids of PDF Assets" section documents that
 * server-side PDF page rasterization was tried and abandoned — Lambda
 * worker-bundling failures) — so this is deliberately the SERIES-COVER
 * fallback (option B), not fabricated interior pages.
 *
 * Order here is the series' own paper-number order (1-4) — used to derive
 * "previous"/"next" relative to whichever paper is selected.
 */

export interface PolityPaperSeriesEntry {
  codexRef: string;
  paperNumber: number;
  title: string;
  url: string;
  coverImageUrl: string;
  coverWidth: number;
  coverHeight: number;
}

export const POLITY_PAPERS_SERIES: readonly PolityPaperSeriesEntry[] = [
  {
    codexRef: '4030a684-1c42-44b8-bd23-8d31b4b33720',
    paperNumber: 1,
    title: 'Beyond the Binary',
    url: 'https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/codex/assets/qriptopian/background_lore_doc/papers-polity_1779856425607.pdf',
    coverImageUrl:
      'https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/codex/assets/qriptopian/cover_image/papers-polity_1779908913185.png',
    coverWidth: 1055,
    coverHeight: 1491,
  },
  {
    codexRef: 'f737e898-bdaa-45b3-8cf5-8149ef9d3410',
    paperNumber: 2,
    title: 'From Perimeter to Polity',
    url: 'https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/codex/assets/qriptopian/background_lore_doc/papers-polity_1779909639350.pdf',
    coverImageUrl:
      'https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/codex/assets/qriptopian/cover_image/papers-polity_1779909398435.png',
    coverWidth: 1055,
    coverHeight: 1491,
  },
  {
    codexRef: 'd598222f-bfd9-4ff3-87de-833411d7aa21',
    paperNumber: 3,
    title: 'Citizenship in the Agentic Internet',
    url: 'https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/codex/assets/qriptopian/background_lore_doc/papers-polity_1779909641667.pdf',
    coverImageUrl:
      'https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/codex/assets/qriptopian/cover_image/papers-polity_1779909401217.png',
    coverWidth: 1055,
    coverHeight: 1491,
  },
  {
    codexRef: 'f7342afc-477d-447f-a68b-75df94b2a954',
    paperNumber: 4,
    title: 'The Constitution of the Agentic Polity',
    url: 'https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/codex/assets/qriptopian/background_lore_doc/papers-polity_1779909643233.pdf',
    coverImageUrl:
      'https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/codex/assets/qriptopian/cover_image/papers-polity_1779909402717.png',
    coverWidth: 1055,
    coverHeight: 1491,
  },
];

/** The series entries adjacent to `codexRef`, in series order — never wraps
 *  (a paper at either end of the series legitimately has only one neighbor). */
export function polityPapersNeighbors(codexRef: string): {
  previous?: PolityPaperSeriesEntry;
  next?: PolityPaperSeriesEntry;
} {
  const index = POLITY_PAPERS_SERIES.findIndex((p) => p.codexRef === codexRef);
  if (index === -1) return {};
  return {
    previous: POLITY_PAPERS_SERIES[index - 1],
    next: POLITY_PAPERS_SERIES[index + 1],
  };
}
