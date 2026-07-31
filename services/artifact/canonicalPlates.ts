/**
 * The Canonical Plates (CP) of Invariant Intelligence v1.0 — the visual ontology
 * that ENCODES the science (CFS-027; operator-specced 2026-07-11).
 *
 * The third of three complementary systems that form one knowledge architecture:
 *   • IRL — the Invariant Research Lab (discovers the science).
 *   • CPS — the Constitutional Publishing System (communicates the science).
 *   • CP  — the Canonical Plates (encodes the science, visually).
 *
 * SEVEN plates, not twelve — like Euclid's Elements, Darwin's sketches, Bell Labs
 * system diagrams. Everything else is DERIVED. The plates are stable intellectual
 * artifacts in their own right, independent of any single publication: every
 * paper, deck, memorandum, standard, PRD, or teaching resource is simply a
 * different COMPOSITION of the same plates — "no new diagrams, only new
 * compositions." Numbered CP-001..CP-007 so writing can reference them:
 * "See Canonical Plate CP-002." This is how a discipline earns a visual identity
 * (UML in software, Feynman diagrams in physics).
 *
 * DATA (the ontology encoded) — a later rendering layer turns each plate into an
 * SVG engineering drawing (NASA / Bell Labs / IBM Systems Journal / Da Vinci
 * register). Isomorphic; order is meaning; the canary pins it.
 */

import type { CpsFigureType } from '@/services/artifact/constitutionalPublishingSystem';

export type PlateForm = 'branch' | 'radial' | 'circle' | 'stack' | 'flow';

export interface CanonicalPlate {
  /** Canonical plate number — cite as "See Canonical Plate CP-002". */
  number: string;
  /** Roman numeral (I..VII) — the plate's classical index. */
  roman: string;
  id: string;
  title: string;
  form: PlateForm;
  kind: CpsFigureType;
  /** The plate's content, in structured groups (drives the SVG renderer later). */
  structure: Readonly<Record<string, readonly string[] | string>>;
  /** What the plate MEANS — the one-line reading. */
  message: string;
  /** A signature plate of the discipline (recognise-at-a-glance). */
  signature?: boolean;
}

/** The seven canonical plates, in order (CP-001..CP-007). */
export const CANONICAL_PLATES_V1: readonly CanonicalPlate[] = [
  {
    number: 'CP-001',
    roman: 'I',
    id: 'evolution-of-intelligence',
    title: 'The Evolution of Intelligence',
    form: 'branch',
    kind: 'ontology',
    structure: {
      object: 'Intelligence',
      manifestations: ['Human', 'Machine'],
      composition: 'Hybrid',
      scale: 'Civilisational Intelligence',
    },
    message: 'Intelligence is the scientific object; human and machine are manifestations; hybrid is the composition; civilisation is the scale.',
  },
  {
    number: 'CP-002',
    roman: 'II',
    id: 'first-principles-of-intelligence',
    title: 'The First Principles of Intelligence',
    form: 'branch',
    kind: 'ontology',
    structure: {
      root: 'Intelligence',
      structuralInvariants: ['Compression', 'Abstraction', 'Representation', 'Composition', 'Learning', 'Prediction', 'Generalisation'],
      constitutionalInvariants: ['Standing', 'Delegation', 'Authority', 'Trust', 'Identity', 'Consequence', 'Constitutional Economics'],
      synthesis: 'Hybrid Intelligence',
    },
    message: 'Intelligence has two invariant families — structural and constitutional — whose synthesis is hybrid intelligence. The periodic table of the discipline.',
    signature: true,
  },
  {
    number: 'CP-003',
    roman: 'III',
    id: 'human-agency',
    title: 'Human Agency',
    form: 'radial',
    kind: 'ontology',
    structure: {
      centre: 'Human Agency',
      mechanisms: ['Privacy', 'Property', 'Identity', 'Standing', 'Trust', 'Delegation', 'Constitutional Economics', 'Knowledge'],
    },
    message: 'Human agency at the centre; each surrounding constitutional mechanism expands it. Research Invariant 001, visualised.',
    signature: true,
  },
  {
    number: 'CP-004',
    roman: 'IV',
    id: 'invariant-intelligence-cycle',
    title: 'Invariant Intelligence',
    form: 'circle',
    kind: 'lifecycle',
    structure: {
      cycle: ['Observation', 'Pattern', 'Invariant', 'Validation', 'Primitive', 'Reference Architecture', 'Engineering Discipline', 'Deployment'],
    },
    message: 'The discovery cycle — a circle, not a pipeline: observation compresses to invariants, becomes primitives, architecture, and deployment, feeding new observation.',
    signature: true,
  },
  {
    number: 'CP-005',
    roman: 'V',
    id: 'constitutional-computing-stack',
    title: 'Constitutional Computing',
    form: 'stack',
    kind: 'layer',
    structure: {
      layers: ['Applications', 'Constitutional Runtime', 'Constitutional Primitives', 'Protocols', 'Verification', 'Settlement', 'Infrastructure'],
    },
    message: 'The constitutional computing stack — applications above, infrastructure below. Restrained: Bell Labs, NASA, IBM.',
    signature: true,
  },
  {
    number: 'CP-006',
    roman: 'VI',
    id: 'metame-institutional-architecture',
    title: 'The metaMe Institutional Architecture',
    form: 'flow',
    kind: 'architecture',
    structure: {
      institution: 'metaMe',
      functions: ['Invariant Research Lab', 'Discovery', 'Engineering Disciplines', 'Venture Studio', 'Platforms', 'Deployment', 'Research'],
    },
    message: 'metaMe defined by constitutional FUNCTIONS, not products — a closed loop from research through deployment back to research.',
  },
  {
    number: 'CP-007',
    roman: 'VII',
    id: 'discovery-to-civilisation',
    title: 'Discovery → Civilisation',
    form: 'flow',
    kind: 'lifecycle',
    structure: {
      ascent: ['Observation', 'Knowledge', 'Science', 'Engineering', 'Infrastructure', 'Institutions', 'Civilisation'],
      contributors: ['IRL', 'Venture Studio', 'metaMe'],
    },
    message: 'The capstone: civilisation is built from observation upward; IRL, the Venture Studio, and metaMe each contribute along the ascent.',
    signature: true,
  },
] as const;

export const CANONICAL_PLATE_COUNT = CANONICAL_PLATES_V1.length;

/**
 * Every publication is a COMPOSITION of plates — no new diagrams, only new
 * compositions. The publication → plate-number map (operator spec + extensible).
 */
export const PLATE_COMPOSITIONS: Record<string, readonly string[]> = {
  'IRL-001': ['CP-001', 'CP-002', 'CP-003', 'CP-004', 'CP-005', 'CP-006', 'CP-007'],
  'constitutional-computing': ['CP-002', 'CP-004', 'CP-005', 'CP-006'],
  'hybrid-intelligence': ['CP-001', 'CP-002', 'CP-003', 'CP-007'],
  'investment-memorandum': ['CP-006', 'CP-007'],
};

/** A plate by its CP number (e.g. 'CP-002'), or undefined. Pure. */
export function plateByNumber(number: string): CanonicalPlate | undefined {
  return CANONICAL_PLATES_V1.find((p) => p.number === number);
}

/** The signature plates of the discipline. Pure. */
export function signaturePlates(): CanonicalPlate[] {
  return CANONICAL_PLATES_V1.filter((p) => p.signature);
}

/** The plates a named publication composes (or all seven if unmapped). Pure. */
export function platesForPublication(publication: string): CanonicalPlate[] {
  const numbers = PLATE_COMPOSITIONS[publication] ?? CANONICAL_PLATES_V1.map((p) => p.number);
  return numbers.map((n) => plateByNumber(n)).filter((p): p is CanonicalPlate => p !== undefined);
}

/** A compact text manifest of the plate set for grounding a diagrams-first production. Pure. */
export function buildPlateManifest(plates: readonly CanonicalPlate[] = CANONICAL_PLATES_V1): string {
  return plates
    .map((p) => {
      const groups = Object.entries(p.structure)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join(' | ');
      return `${p.number} (Plate ${p.roman}) — ${p.title} [${p.form}]: ${groups}. ${p.message}`;
    })
    .join('\n');
}
