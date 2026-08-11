/**
 * constitutionalInternetBridgeViewContent — the ordered content-block model
 * for the Constitutional Internet Bridge's VIEW stage.
 *
 * Data, not JSX (operator instruction: "Do not hardcode finished prose into
 * React when it belongs in editable content configuration"). Each block
 * follows the brief's content grammar — Video creates consciousness, Plate
 * creates comprehension, Prose creates depth — composed here as
 * Plate → Excerpt per beat (no video asset exists in this codebase for
 * either Bridge yet; CLAUDE.md's No-Guessing rule forbids inventing a URL,
 * so `videoUrl` is left undefined until a real asset is supplied).
 *
 * Excerpts are VERBATIM quotes from the publication candidate manuscript
 * (codexes/packs/polity-core/items/commentary/constitutional-internet/
 * 01-controlling-manuscript-v1.0-publication-candidate.md), cited by line —
 * never paraphrased or invented.
 *
 * Plates (2026-08-11): the operator supplied seven REAL canonical plate
 * images (raster, `services/artifact/canonicalPlateImages.ts`) and ruled
 * that the CI Bridge must render these — never the code-generated SVG
 * schematics (`CANONICAL_PLATES_V1` / `CanonicalPlateFigure`), which are
 * now off-limits for this surface ("no schematic diagrams... only the
 * seven canonical plates"). `plateImageId` below is a thematic pairing
 * chosen by Claude within that constraint. Corrected same day: a plate's
 * NATIVE aspect ratio governs which role it can play — a portrait plate
 * (CIP-007A, 2:3) must never be forced into the landscape hero role just
 * because its subject matches, so 'the-acting-machine' was moved off it
 * onto CIP-005 (3:2, "Constitutional Agency" — capability/agency is the
 * same theme, correctly shaped for a landscape hero).
 *
 * Paper (2026-08-11): `paperRef` now points to a REAL, LIVE Qriptopian
 * Codex "Polity Papers" record — queried from the live
 * `GET /api/codex/qripto/papers?group=papers` endpoint on dev-beta
 * (scope `papers/polity`, id `f7342afc-477d-447f-a68b-75df94b2a954`,
 * "4 The Constitution of the Agentic Polity" — cover fetched and visually
 * confirmed, a genuine portrait white-paper cover, real pixel dimensions
 * 1055×1491). This is the series' own canonical asset — never a
 * fabricated cover or generic PDF icon. The series is "Polity Papers"
 * (not "Policy Papers" — corrected naming, 2026-08-11).
 */

export interface ViewContentBlock {
  id: string;
  proposition: string;
  /** Real CANONICAL_PLATE_IMAGES id (services/artifact/canonicalPlateImages.ts) — never the SVG schematics. */
  plateImageId: string;
  /** Verbatim manuscript excerpt. */
  excerpt: string;
  /** Citation — file + line, so the quote can be checked against source. */
  excerptSource: string;
  /** Optional real hero-film URL — undefined until a real asset exists. Also
   *  admin-overridable per vignette via the ci-view-<id> editorial config
   *  section (2026-08-11) — see ConstitutionalInternetBridgeViewSequence. */
  videoUrl?: string;
  /**
   * Optional "deep dive / further reading" reference into the real
   * Qriptopian Codex Polity Papers series — Ethos hierarchy: Video+Plate =
   * hero, Excerpt = supporting context, Paper = deep dive. `codexRef` is
   * the real `codex_media_assets` row id (dev-beta, `papers/polity` scope);
   * `coverImageUrl`/`coverWidth`/`coverHeight` are the series' own real
   * cover asset and its real pixel dimensions — never invented.
   */
  paperRef?: {
    title: string;
    url: string;
    coverImageUrl: string;
    coverWidth: number;
    coverHeight: number;
    codexRef: string;
  };
}

const MANUSCRIPT_SOURCE =
  'codexes/packs/polity-core/items/commentary/constitutional-internet/01-controlling-manuscript-v1.0-publication-candidate.md';

export const CI_BRIDGE_VIEW_CONTENT: readonly ViewContentBlock[] = [
  {
    id: 'the-disappearing-person',
    proposition: 'Personhood precedes identity.',
    plateImageId: 'CIP-003A', // Canonical MetaVitruvian — Male Rendering
    excerpt:
      'Personhood precedes identity.\nControl is not authority.\nAgents act under mandate.\nActions produce proof.\nStanding carries consequence.',
    excerptSource: `${MANUSCRIPT_SOURCE}:4236-4241`,
  },
  {
    id: 'the-acting-machine',
    proposition: 'Capability is not mandate.',
    plateImageId: 'CIP-005', // Constitutional Agency (3:2 landscape — CIP-007A is portrait, not a hero shape)
    excerpt:
      'Control is not authority.\nCapability is not mandate.\n…\nAuthority must precede consequence.\nThe person must remain the originating constitutional principal wherever the machine acts on their behalf.\n…\nWhere no legitimate authority exists, capability must not silently create it.',
    excerptSource: `${MANUSCRIPT_SOURCE}:1090-1097`,
  },
  {
    id: 'the-constitutional-frontier',
    proposition: 'Infrastructure must not become sovereignty.',
    plateImageId: 'CIP-006', // The Constitutional Internet
    excerpt:
      'The provider remains capable of building and competing.\nIt does not retain the right to convert control of infrastructure into sovereignty over participation.\nInfrastructure must not become sovereignty.\nThe operator may govern its systems.\nIt may not own the persons and markets that depend upon them.',
    excerptSource: `${MANUSCRIPT_SOURCE}:5187-5191`,
    paperRef: {
      title: 'The Constitution of the Agentic Polity',
      url: 'https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/codex/assets/qriptopian/background_lore_doc/papers-polity_1779909643233.pdf',
      coverImageUrl:
        'https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/codex/assets/qriptopian/cover_image/papers-polity_1779909402717.png',
      coverWidth: 1055,
      coverHeight: 1491,
      codexRef: 'f7342afc-477d-447f-a68b-75df94b2a954',
    },
  },
];
