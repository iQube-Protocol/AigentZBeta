/**
 * canonicalPlateImages — the seven canonical CIP plate images (raster,
 * operator-supplied 2026-08-11), which supersede the code-generated SVG
 * schematics (canonicalPlates.ts / CanonicalPlateFigure) for any surface
 * that shows a "plate" artifact to a visitor. Operator instruction,
 * verbatim: "Do not introduce schematic diagrams, placeholder diagrams,
 * generic line drawings, generic icons, or any non-canonical visual
 * replacements... only the seven canonical plates."
 *
 * URLs are the real, publicly-hosted Supabase Storage objects (the repo
 * carries the pointer, never the bytes — CLAUDE.md's Dense Materials
 * rule), verified 2026-08-11 by fetching each binary and confirming its
 * visible title against the operator's authoritative order mapping
 * (uploader filenames — `papers-protocols_<timestamp>.png` — are
 * semantically meaningless; identity comes from the mapping, never
 * inferred from the filename). Width/height are the REAL pixel
 * dimensions of each fetched binary (never invented), carried so callers
 * can preserve aspect ratio exactly — no distortion, no arbitrary crop.
 *
 * Canon-wide manifest reconciliation against
 * `docs/constitutional-plates/constitutional-internet.v1.json`
 * (approved-source hashes, `authorized-public-rendering` classification)
 * is a separate, still-open task (no such manifest file exists in this
 * repo today). This module exists so the CI Bridge can render the real
 * plates now without waiting on that reconciliation — it is not itself
 * that reconciliation.
 *
 * None of the seven is a book/paper COVER (the mapping labels every one
 * of them "Plate:") — there is no verified Polity Papers cover image in
 * this repo yet. Do not repurpose a plate as a fake cover.
 */

export interface CanonicalPlateImage {
  id: string;
  title: string;
  url: string;
  width: number;
  height: number;
}

const SUPABASE_BASE =
  'https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/codex/assets/qriptopian/social_campaign_image';

export const CANONICAL_PLATE_IMAGES: Record<string, CanonicalPlateImage> = {
  'CIP-003A': {
    id: 'CIP-003A',
    title: 'Canonical MetaVitruvian — Male Rendering',
    url: `${SUPABASE_BASE}/papers-protocols_1786419365812.png`,
    width: 1367,
    height: 1151,
  },
  'CIP-003B': {
    id: 'CIP-003B',
    title: 'Canonical MetaVitruvian — Female Rendering',
    url: `${SUPABASE_BASE}/papers-protocols_1786419363235.png`,
    width: 1448,
    height: 1086,
  },
  'CIP-004': {
    id: 'CIP-004',
    title: 'Government-Grade, Not Government-Dependent',
    url: `${SUPABASE_BASE}/papers-protocols_1786419372418.png`,
    width: 1672,
    height: 941,
  },
  'CIP-005': {
    id: 'CIP-005',
    title: 'Constitutional Agency',
    url: `${SUPABASE_BASE}/papers-protocols_1786419370993.png`,
    width: 1536,
    height: 1024,
  },
  'CIP-006': {
    id: 'CIP-006',
    title: 'The Constitutional Internet',
    url: `${SUPABASE_BASE}/papers-protocols_1786419373853.png`,
    width: 1536,
    height: 1024,
  },
  'CIP-007A': {
    id: 'CIP-007A',
    title: 'The Constitutional Trinity — Reasoning · Order · Action',
    url: `${SUPABASE_BASE}/papers-protocols_1786419369554.png`,
    width: 1024,
    height: 1536,
  },
  'CIP-007B': {
    id: 'CIP-007B',
    title: 'Constitutional Bearing Instrument — Navigate the Atlas',
    url: `${SUPABASE_BASE}/papers-protocols_1786419367616.png`,
    width: 1254,
    height: 1254,
  },
};

export function canonicalPlateImage(id: string): CanonicalPlateImage | undefined {
  return CANONICAL_PLATE_IMAGES[id];
}
