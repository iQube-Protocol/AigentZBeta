/**
 * The Constitutional Publishing System (CPS) — the canonical publication language
 * of metaMe, and the visual implementation of Human Civic Futurism (Aletheon,
 * operator-ratified 2026-07-11; evolved from the CDS framing).
 *
 * The milestone: this is no longer "the Policy Papers design system." It is the
 * publishing subsystem for the ENTIRE metaMe ecosystem — CPS is to artifacts what
 * the Constitutional Runtime is to intelligent systems: a canonical, reusable,
 * invariant production layer. Every publication metaMe produces (IRL Papers,
 * Polity Papers, Constitutional Standards, Venture Papers, Investment Memoranda,
 * Technical Specifications, Research Reports) eventually speaks THIS language —
 * same language, different templates.
 *
 * The loop with Production closes here: the Production Runtime (CFS-025 Artifact
 * Runtime) does NOT generate PDFs — it generates constitutional publications. CPS
 * is ONE RENDERER inside it (others: Executive Brief, Scientific Paper, PRD,
 * Standards Document, Investment Memorandum, …). Same runtime, different renderer.
 *
 *   Human Civic Futurism → Constitutional Publishing System → {templates}
 *
 * This module is data + pure builders: the CPS invariants encoded so the Artifact
 * Runtime (and any delegate producing a publication natively) APPLIES them.
 * Isomorphic; order is meaning; the canary pins it.
 */

import type { ArtifactProfileId } from '@/types/artifactRuntime';

export const CPS_VERSION = '0.1';

/** The publisher hierarchy every publication carries (establishes the imprint). */
export const CPS_PUBLISHER = {
  organisation: 'metaMe',
  lab: 'Invariant Research Lab',
  series: 'Foundational Research Series',
} as const;

/** The three governing design principles (order pinned). */
export const CPS_DESIGN_PRINCIPLES = ['seriousness', 'constitutional-humanity', 'timelessness'] as const;
export type CpsDesignPrinciple = (typeof CPS_DESIGN_PRINCIPLES)[number];

export const CPS_PRINCIPLE_STATEMENT: Record<CpsDesignPrinciple, string> = {
  seriousness:
    'Documents resemble standards bodies and research institutions (W3C, IEEE, NIST, IBM Research, government white papers), never marketing collateral.',
  'constitutional-humanity':
    'Technically rigorous yet human-centred: ivory, paper, restrained navy and gold, architectural precision — never cyberpunk, neon, or glossy marketing.',
  timelessness: 'Equally appropriate today or ten years from now. Design for permanence; avoid visual trends.',
};

/** Every publication follows this section hierarchy (order pinned). */
export const CPS_EDITORIAL_HIERARCHY = [
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
export const CPS_DOCUMENT_ARC = [
  'problem',
  'opportunity',
  'constitutional-principle',
  'architecture',
  'implementation',
] as const;

/** Visual invariants — the restrained, permanent palette + type system. */
export const CPS_VISUAL = {
  palette: { primary: ['ivory', 'paper-white', 'navy', 'charcoal'] as const, accent: 'gold' as const, rule: 'Nothing else unless required.' },
  typography: { headings: 'classical serif', body: 'modern sans', monospace: 'engineering notation' },
  spacing: 'Large margins, generous whitespace, twelve-column grid, consistent baseline.',
} as const;

/**
 * Cover invariants (operator refinement 2026-07-11): a constitutional MANUSCRIPT,
 * not a Renaissance poster. Geometric constructions, circles, golden ratio, Da
 * Vinci notebook marks, faint engineering sketches — and NO literal human figure
 * (the Vitruvian Man is too literal; keep the geometry, lose the body).
 */
export const CPS_COVER = {
  keep: ['geometric-constructions', 'circles', 'golden-ratio', 'da-vinci-notebook-marks', 'faint-engineering-sketches'],
  omit: ['human-figure', 'vitruvian-man'],
  feel: 'a constitutional manuscript, not a Renaissance poster',
} as const;

/**
 * Engineering-notebook marks (operator refinement): very faint, never decorative —
 * everything useful. The page should read like a working drafting sheet.
 */
export const CPS_NOTEBOOK_MARKS = [
  'margin-construction-marks',
  'drafting-ticks',
  'annotation-arrows',
  'page-registration-marks',
  'architectural-scale-bars',
] as const;

/** Figures are engineering artifacts; every one numbered · titled · captioned · referenced. */
export const CPS_FIGURE_TYPES = ['architecture', 'sequence', 'layer', 'lifecycle', 'state', 'ontology', 'matrix'] as const;
export const CPS_DIAGRAM_VOCABULARY = ['boxes', 'layers', 'swim-lanes', 'flow', 'relationships', 'evidence'] as const;
/** Architecture diagrams are ENGINEERING DRAWINGS, not infographics — this is the
 *  design space that makes a CPS publication distinctive (operator refinement). */
export const CPS_DIAGRAM_REFERENCES = ['NASA systems diagrams', 'Bell Labs drawings', 'IBM Systems Journal', 'Da Vinci engineering notebooks'] as const;

/** The AI production invariants — the publications-layer agent.md. Order pinned. */
export const CPS_PRODUCTION_RULES = [
  'Author in an editable format first (DOCX / Markdown / LaTeX); PDF is ALWAYS derived, never authored.',
  'One page equals one page — never a contact sheet.',
  'Never rasterize text; never embed paragraphs inside images.',
  'Engineering/architecture diagrams are SVG engineering drawings (NASA / Bell Labs / IBM Systems Journal / Da Vinci register), never PNG, never infographics.',
  'Images only for cover, section dividers, or conceptual illustration; everything else is vector.',
  'Every figure is numbered, titled, captioned, and referenced in text; no decorative infographics/arrows/icons.',
  'Use publication style, not presentation style.',
  'White papers precede standards; standards precede implementation.',
  'All documents derive from the master template and this publishing system.',
] as const;

/**
 * The Constitutional Design System (CDS) lives WITHIN the CPS — CPS RE-CONSTITUTES
 * it, it does not replace it. The CDS is the DESIGN-LANGUAGE layer of the CPS (the
 * look): principles + editorial hierarchy + document arc + visual + cover +
 * notebook marks. The CPS is the whole publishing system = CDS (design) + the
 * canonical diagram library + templates + renderers + the production pipeline.
 */
export const CDS_DESIGN_LANGUAGE = {
  principles: CPS_DESIGN_PRINCIPLES,
  editorialHierarchy: CPS_EDITORIAL_HIERARCHY,
  documentArc: CPS_DOCUMENT_ARC,
  visual: CPS_VISUAL,
  cover: CPS_COVER,
  notebookMarks: CPS_NOTEBOOK_MARKS,
} as const;

/**
 * The CPS PRODUCTION PIPELINE — the core inversion. A publication is produced
 * DIAGRAMS-FIRST: the diagrams are knowledge primitives, not illustrations, and
 * the prose is written AROUND them (Euclid / Darwin / Tufte / Bell Labs / NASA /
 * IBM Research). Never write-then-illustrate. Order pinned.
 */
export const CPS_PRODUCTION_PIPELINE = [
  'canonical-concepts',
  'canonical-diagrams',
  'canonical-narrative',
  'publication',
] as const;

/**
 * The CPS publication TEMPLATES — one design language, many templates
 * (the Human Civic Futurism layer model). Order pinned.
 */
export const CPS_TEMPLATES = [
  'irl-papers',
  'polity-papers',
  'constitutional-standards',
  'venture-papers',
  'investment-memoranda',
  'technical-specifications',
  'research-reports',
] as const;

/** Series codes → imprint (numbering authority). IRL leads the Foundational series. */
export const CPS_SERIES: Record<string, string> = {
  IRL: 'Invariant Research Lab — Foundational Research Series',
  CCS: 'Constitutional Commerce Specifications',
  PP: 'Polity Papers',
  REG: 'Registry Specifications',
  PAS: 'Passport Specifications',
  AIG: 'Agent Specifications',
};

/**
 * Canonical publication number — four digits, so the series survives into the
 * hundreds (operator refinement: IRL-0001, not IRL-1). Pure.
 */
export function cpsPaperNumber(seriesCode: string, n: number): string {
  return `${seriesCode}-${String(Math.max(0, Math.trunc(n))).padStart(4, '0')}`;
}

/**
 * RENDERERS — the pluggable output layer of the Production Runtime. CPS is the
 * FIRST/canonical constitutional-publication renderer; others render the same
 * produced artifact into a different output form. Same runtime, different
 * renderer. (Captured here; wiring renderers into the AR contract is a follow-on —
 * a renderer is HOW an artifact is output, distinct from the AR profile which is
 * WHAT it is.) Order pinned.
 */
export const CPS_RENDERERS = [
  'constitutional-publishing-system', // the canonical one — this module
  'executive-brief',
  'scientific-paper',
  'prd',
  'standards-document',
  'investment-memorandum',
  'constitutional-specification',
  'research-report',
  'white-paper',
  'book',
  'presentation',
  'website',
  'interactive-experience',
] as const;
export type CpsRenderer = (typeof CPS_RENDERERS)[number];

/**
 * The Artifact-Runtime profiles rendered as CPS publications (the document class).
 */
export const CPS_DOCUMENT_PROFILES: ReadonlySet<ArtifactProfileId> = new Set<ArtifactProfileId>([
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

/** Whether a profile's output is a CPS publication. Pure. */
export function isDocumentProfile(profile: ArtifactProfileId): boolean {
  return CPS_DOCUMENT_PROFILES.has(profile);
}

/**
 * A production-prompt guidance block encoding the CPS for a producing agent — so a
 * delegate producing a publication natively yields output in the canonical metaMe
 * publication language. Pure + deterministic.
 */
export function buildCpsProductionGuidance(): string {
  return [
    `Constitutional Publishing System v${CPS_VERSION} — you are producing a metaMe constitutional publication in the canonical publication language (the visual implementation of Human Civic Futurism). Honour these invariants:`,
    `Publisher imprint: ${CPS_PUBLISHER.organisation} · ${CPS_PUBLISHER.lab} · ${CPS_PUBLISHER.series}. Number publications four-digit (e.g. IRL-0001).`,
    `Design principles: ${CPS_DESIGN_PRINCIPLES.map((p) => `${p} (${CPS_PRINCIPLE_STATEMENT[p]})`).join(' ')}`,
    `Editorial hierarchy (in order): ${CPS_EDITORIAL_HIERARCHY.join(' → ')}.`,
    `Reason in this order, never implementation-first: ${CPS_DOCUMENT_ARC.join(' → ')}.`,
    `PRODUCE DIAGRAMS-FIRST (the core inversion): ${CPS_PRODUCTION_PIPELINE.join(' → ')}. The diagrams are knowledge primitives, not illustrations — establish the canonical diagrams FIRST, then write the prose AROUND them. COMPOSE from the seven Canonical Plates (CP-001..CP-007) provided; reference each as "See Canonical Plate CP-00N" — do NOT invent new diagrams where a canonical plate exists.`,
    `Architecture diagrams are ENGINEERING DRAWINGS (${CPS_DIAGRAM_REFERENCES.join(', ')} register) described in text as numbered SVG-describable figures — never infographics, never decorative.`,
    `Production rules:\n${CPS_PRODUCTION_RULES.map((r) => `- ${r}`).join('\n')}`,
    'Write publication-style prose (standards-body register); a constitutional manuscript, not marketing.',
  ].join('\n\n');
}
