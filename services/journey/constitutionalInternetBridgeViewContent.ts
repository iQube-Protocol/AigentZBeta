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
 * never paraphrased or invented. Plates are real entries from
 * CANONICAL_PLATES_V1 (services/artifact/canonicalPlates.ts), chosen for
 * thematic fit — never a new plate invented for this Bridge alone (the
 * Canonical Plates are deliberately fixed at seven; "no new diagrams, only
 * new compositions").
 */

export interface ViewContentBlock {
  id: string;
  proposition: string;
  /** Real CANONICAL_PLATES_V1 plate number (see plateByNumber). */
  plateNumber: string;
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
    plateNumber: 'CP-003', // Human Agency
    excerpt:
      'Personhood precedes identity.\nControl is not authority.\nAgents act under mandate.\nActions produce proof.\nStanding carries consequence.',
    excerptSource: `${MANUSCRIPT_SOURCE}:4236-4241`,
  },
  {
    id: 'the-acting-machine',
    proposition: 'Capability is not mandate.',
    plateNumber: 'CP-005', // Constitutional Computing
    excerpt:
      'Control is not authority.\nCapability is not mandate.\n…\nAuthority must precede consequence.\nThe person must remain the originating constitutional principal wherever the machine acts on their behalf.\n…\nWhere no legitimate authority exists, capability must not silently create it.',
    excerptSource: `${MANUSCRIPT_SOURCE}:1090-1097`,
  },
  {
    id: 'the-constitutional-frontier',
    proposition: 'Infrastructure must not become sovereignty.',
    plateNumber: 'CP-006', // The metaMe Institutional Architecture
    excerpt:
      'The provider remains capable of building and competing.\nIt does not retain the right to convert control of infrastructure into sovereignty over participation.\nInfrastructure must not become sovereignty.\nThe operator may govern its systems.\nIt may not own the persons and markets that depend upon them.',
    excerptSource: `${MANUSCRIPT_SOURCE}:5187-5191`,
  },
];
