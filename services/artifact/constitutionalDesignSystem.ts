/**
 * The Constitutional Design System (CDS) — the design-invariant layer of the
 * Constitutional Publishing Factory (Aletheon v0.1, operator-shared 2026-07-11).
 *
 * Three products were discovered in the publishing work, kept distinct:
 *   • CCS — the Constitutional Commerce Specifications (the standards themselves).
 *   • CDS — this: the visual, editorial, and architectural INVARIANTS every
 *           Constitutional Commerce publication derives from. A reusable SYSTEM,
 *           not a collection of templates.
 *   • CPS — the Constitutional Publications System (the production workflow +
 *           templates). CPS is not a new engine: it is the Artifact Runtime
 *           (CFS-025) operating on the DOCUMENT profiles, CONFIGURED by this CDS.
 *
 * So this module is data, not prose: the CDS invariants encoded so the Artifact
 * Runtime (and any delegate producing a document natively) can APPLY them — every
 * CCS spec, Polity Paper, Registry spec, CCRL report, and white paper produced by
 * the factory inherits the same standards-grade design without re-authoring it.
 *
 * Isomorphic: pure data + pure builders. Order is meaning; the canary pins it.
 */

import type { ArtifactProfileId } from '@/types/artifactRuntime';

export const CDS_VERSION = '0.1';

/** The three governing design principles (order pinned). */
export const CDS_DESIGN_PRINCIPLES = ['seriousness', 'constitutional-humanity', 'timelessness'] as const;
export type CdsDesignPrinciple = (typeof CDS_DESIGN_PRINCIPLES)[number];

export const CDS_PRINCIPLE_STATEMENT: Record<CdsDesignPrinciple, string> = {
  seriousness:
    'Documents resemble standards bodies and research institutions (W3C, IEEE, NIST, IBM Research, government white papers), never marketing collateral.',
  'constitutional-humanity':
    'Technically rigorous yet human-centred: ivory, paper, restrained navy and gold, architectural precision — never cyberpunk, neon, or glossy marketing.',
  timelessness: 'Equally appropriate today or ten years from now. Design for permanence; avoid visual trends.',
};

/** Every publication follows this section hierarchy (order pinned). */
export const CDS_EDITORIAL_HIERARCHY = [
  'cover',
  'executive-summary',
  'concept',
  'architecture',
  'implementation',
  'governance',
  'future-work',
  'appendices',
] as const;

/** Every document reasons in THIS order — never implementation-first (order pinned). */
export const CDS_DOCUMENT_ARC = [
  'problem',
  'opportunity',
  'constitutional-principle',
  'architecture',
  'implementation',
] as const;

/** Visual invariants — the restrained, permanent palette + type system. */
export const CDS_VISUAL = {
  palette: {
    primary: ['ivory', 'paper-white', 'navy', 'charcoal'] as const,
    accent: 'gold' as const,
    rule: 'Nothing else unless required.',
  },
  typography: {
    headings: 'classical serif',
    body: 'modern sans',
    monospace: 'engineering notation',
  },
  spacing: 'Large margins, generous whitespace, twelve-column grid, consistent baseline.',
} as const;

/** Figures + diagrams are engineering artifacts, never decoration (order pinned). */
export const CDS_FIGURE_TYPES = ['architecture', 'sequence', 'layer', 'lifecycle', 'state', 'ontology', 'matrix'] as const;
export const CDS_DIAGRAM_VOCABULARY = ['boxes', 'layers', 'swim-lanes', 'flow', 'relationships', 'evidence'] as const;

/** The AI production invariants — the publishing-factory rules a producing agent
 *  MUST honour (this is the publications-layer agent.md). Order pinned. */
export const CDS_PRODUCTION_RULES = [
  'Author in an editable format first (DOCX / Markdown / LaTeX); PDF is ALWAYS derived, never authored.',
  'One page equals one page — never a contact sheet.',
  'Never rasterize text; never embed paragraphs inside images.',
  'Engineering diagrams are SVG (editable, version-controlled), never PNG.',
  'Images only for cover, section dividers, or conceptual illustration; everything else is vector.',
  'Every figure is numbered, titled, captioned, and referenced in text; no decorative infographics/arrows/icons.',
  'Use publication style, not presentation style.',
  'White papers precede standards; standards precede implementation.',
  'All documents derive from the master template and this design system.',
] as const;

/** The document series that share the system (numbering authority). */
export const CDS_SERIES: Record<string, string> = {
  CCS: 'Constitutional Commerce Specifications',
  PP: 'Polity Papers',
  CCRL: 'Research Reports',
  REG: 'Registry Specifications',
  PAS: 'Passport Specifications',
  AIG: 'Agent Specifications',
};

/**
 * The Artifact-Runtime profiles GOVERNED by the CDS — the document-class outputs
 * of the Constitutional Publishing Factory. A `software` or `multimedia` artifact
 * is not a CDS publication; a `standard` / `white-paper` / `policy` / … is.
 */
export const CDS_DOCUMENT_PROFILES: ReadonlySet<ArtifactProfileId> = new Set<ArtifactProfileId>([
  'standard',
  'white-paper',
  'research',
  'agreement',
  'presentation',
  'book',
  'investor-deck',
  'api',
  'documentation',
  'policy',
]);

/** Whether a profile's output is a CDS-governed publication. Pure. */
export function isDocumentProfile(profile: ArtifactProfileId): boolean {
  return CDS_DOCUMENT_PROFILES.has(profile);
}

/**
 * A production-prompt guidance block encoding the CDS for a producing agent — so a
 * delegate producing a document natively yields factory-grade, standards-consistent
 * output without re-deriving the design language. Pure + deterministic.
 */
export function buildCdsProductionGuidance(): string {
  return [
    `Constitutional Design System v${CDS_VERSION} — you are producing a Constitutional Commerce publication. Honour these invariants:`,
    `Design principles: ${CDS_DESIGN_PRINCIPLES.map((p) => `${p} (${CDS_PRINCIPLE_STATEMENT[p]})`).join(' ')}`,
    `Editorial hierarchy (in order): ${CDS_EDITORIAL_HIERARCHY.join(' → ')}.`,
    `Reason in this order, never implementation-first: ${CDS_DOCUMENT_ARC.join(' → ')}.`,
    `Production rules:\n${CDS_PRODUCTION_RULES.map((r) => `- ${r}`).join('\n')}`,
    'Write publication-style prose (standards-body register), with numbered/titled figures described in text where a diagram belongs (as SVG-describable engineering figures, never decorative).',
  ].join('\n\n');
}
