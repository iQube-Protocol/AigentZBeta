/**
 * Constitutional Civic Futurism — interpretation v1 (CFS-021 §3).
 *
 * The FIRST reading the Constitutional Representation System carries — never
 * its definition (`inv.representation.128`). Ivory parchment surface, charcoal
 * linework ink, subtle indigo geometry, muted gold reserved for the principal
 * figure; elegant serif titles, humanist-sans annotations; calm reveal motion
 * ("discovered rather than noticed"). Museum-quality, timeless — Leonardo
 * notebook / government atlas / scientific field guide.
 *
 * Satisfies CONSTITUTIONAL_REPRESENTATION_CONTRACT (validated in
 * tests/representation-system.test.ts).
 */

import type { Interpretation } from '@/types/representation';

export const constitutionalCivicFuturism: Interpretation = {
  id: 'constitutional-civic-futurism',
  label: 'Constitutional Civic Futurism',
  connotation:
    'Timeless civic authority — parchment atlas, charcoal linework, indigo geometry, gold reserved for the principal figure. Beauty from making constitutional order visible, not from ornament.',
  roles: {
    // Surface + ink — warm ivory parchment, charcoal marks.
    'surface.base': '#F4EFE2',
    'surface.raised': '#FCFAF3',
    'ink.body': '#2B2A26',
    'ink.muted': '#6B6659',
    'border.subtle': '#D8D0BE',

    // Emphasis — muted gold reserved for the principal figure; indigo geometry.
    'highlight.principal': '#B08D3E',
    'accent.geometry': '#3B3A66',

    // Standing — strictly increasing contrast against the ivory base.
    'standing.experimental': '#9A9482',
    'standing.validated': '#5E7C6A',
    'standing.canonical': '#3B3A66',
    'standing.foundational': '#2B2A26',

    // State.
    'state.positive': '#4F7A5B',
    'state.caution': '#B0842E',
    'state.critical': '#9E3B32',

    // Type — serif title, humanist-sans annotation, mono.
    'type.title': "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
    'type.annotation': "'Segoe UI', system-ui, 'Helvetica Neue', Arial, sans-serif",
    'type.mono': "'SF Mono', ui-monospace, Menlo, Consolas, monospace",

    // Motion — calm tempo, ease-out reveal (discovered rather than noticed).
    'motion.tempo': '320ms',
    'motion.reveal': 'cubic-bezier(0.22, 0.61, 0.36, 1)',

    // Field sectors — muted, distinct hues as orientation anchors.
    'field.reasoning': '#3B3A66',
    'field.intelligence': '#4A5C7A',
    'field.order': '#5E7C6A',
    'field.action': '#9E5A32',
    'field.knowledge': '#7A5C8A',
    'field.experience': '#3E7C82',
    'field.consequence': '#8A6A3E',
  },
};
