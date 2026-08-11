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
 * chosen by Claude within that constraint (not specified by the operator
 * block-by-block) — flagged for the operator to confirm/adjust.
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
   * Optional "deep dive / further reading" reference (Polity Paper),
   * per the Ethos hierarchy: Video+Plate = hero, Excerpt = supporting
   * context, Paper = deep dive. Undefined for every block today — CLAUDE.md's
   * No-Guessing rule forbids inventing a URL; a real paper reference is added
   * here once one exists for a given proposition, never fabricated to fill
   * the tier.
   */
  paperRef?: { title: string; url: string };
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
    plateImageId: 'CIP-007A', // The Constitutional Trinity — Reasoning · Order · Action
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
  },
];
