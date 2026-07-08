/**
 * High-Contrast Accessible — interpretation v2 (CFS-021 §3.1 proof).
 *
 * PROVES the Constitutional Representation System accommodates many
 * interpretations: it binds every contract role to DIFFERENT concrete values
 * than Constitutional Civic Futurism (a dark, maximum-legibility reading) yet
 * satisfies the SAME invariant contract. A component that consumes roles
 * reskins from CCF to this with no code change — identity and connotation
 * preserved across interpretations exactly as across modalities.
 *
 * Near-black base, near-white body ink (WCAG AAA body contrast), bright gold
 * principal, bright indigo geometry; Atkinson-Hyperlegible-first type stacks;
 * snappier motion. Satisfies CONSTITUTIONAL_REPRESENTATION_CONTRACT.
 */

import type { Interpretation } from '@/types/representation';

export const highContrastAccessible: Interpretation = {
  id: 'high-contrast-accessible',
  label: 'High-Contrast Accessible',
  connotation:
    'Maximum legibility — near-black ground, near-white marks, saturated standing ramp. Same constitutional object, read for the widest range of sight.',
  roles: {
    // Surface + ink — near-black ground, near-white marks.
    'surface.base': '#0B0B0F',
    'surface.raised': '#1A1A22',
    'ink.body': '#F5F5FA',
    'ink.muted': '#B8B8C4',
    'border.subtle': '#3A3A46',

    // Emphasis — bright gold reserved for the principal figure; bright indigo.
    'highlight.principal': '#FFD24A',
    'accent.geometry': '#7C9DFF',

    // Standing — strictly increasing contrast (brighter) against the black base.
    'standing.experimental': '#7A7A88',
    'standing.validated': '#A9C4E8',
    'standing.canonical': '#D8E2F0',
    'standing.foundational': '#FFFFFF',

    // State — high-luminance dispositions.
    'state.positive': '#5BE08A',
    'state.caution': '#FFC24A',
    'state.critical': '#FF6B5E',

    // Type — accessibility-first stacks, still honouring the serif/sans/mono roles.
    'type.title': "'Atkinson Hyperlegible', Georgia, 'Times New Roman', serif",
    'type.annotation': "'Atkinson Hyperlegible', system-ui, 'Segoe UI', sans-serif",
    'type.mono': "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",

    // Motion — snappier tempo, standard ease.
    'motion.tempo': '200ms',
    'motion.reveal': 'cubic-bezier(0.4, 0, 0.2, 1)',

    // Field sectors — bright, maximally separable hues.
    'field.reasoning': '#7C9DFF',
    'field.intelligence': '#5BD0E0',
    'field.order': '#5BE08A',
    'field.action': '#FF9E4A',
    'field.knowledge': '#C08AFF',
    'field.experience': '#4ADFC8',
    'field.consequence': '#FFD24A',
  },
};
