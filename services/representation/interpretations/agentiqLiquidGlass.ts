/**
 * AgentiQ Liquid Glass — interpretation v3, the platform HOUSE STYLE (CFS-021
 * §3/§5; `inv.representation.129`).
 *
 * The operator's demonstration that the Constitutional Representation System
 * accommodates the platform's OWN existing look as one interpretation — not an
 * invented aesthetic. Every value here is grounded in the real house tokens:
 * the glass surface fill, hairline, backdrop-filter, and elevation are lifted
 * from `styles/drawer.css` (the canonical SmartWallet copilot glass), and the
 * dark-slate chrome / near-white ink / indigo-and-fuchsia accents / the
 * emerald·sky·amber·rose state ramp are the platform's dominant utility usage
 * (`bg-white/5`, `border-white/10`, slate-200 body, slate-400 muted).
 *
 * This is the FIRST interpretation to bind the MATERIAL role family to a real
 * (non-flat) material — translucent tint + backdrop blur + white hairline +
 * soft shadow with the signature inset top-highlight — proving colour alone
 * cannot express a rendering system (`inv.representation.129`). It is the
 * DEFAULT interpretation so every adopted surface defaults to the house style
 * (platform cohesion); Constitutional Civic Futurism remains interpretation v1 /
 * the reference atlas grammar, a switch away.
 *
 * Satisfies CONSTITUTIONAL_REPRESENTATION_CONTRACT with zero violations
 * (validated in tests/representation-system.test.ts). The body-legibility law
 * checks near-white ink on `surface.base` — the deep-slate chrome the glass is
 * layered over — at 15.3:1 (well past WCAG AA 4.5:1).
 */

import type { Interpretation } from '@/types/representation';

export const agentiqLiquidGlass: Interpretation = {
  id: 'agentiq-liquid-glass',
  label: 'AgentiQ Liquid Glass',
  connotation:
    'The platform house style — translucent dark-slate glass, near-white ink, indigo geometry with a fuchsia principal, the emerald·sky·amber·rose ramp. The metaMe/AgentiQ default chrome, hydrated as one interpretation of the representation contract.',
  roles: {
    // Surface + ink — deep-slate chrome ground; the raised surface is the solid
    // fallback colour (the translucent version lives in material.tint below).
    // Near-white slate-200 body, slate-400 muted — the platform's dark chrome.
    'surface.base': '#0B1120',
    'surface.raised': '#172033',
    'ink.body': '#E2E8F0',
    'ink.muted': '#94A3B8',
    'border.subtle': '#28344A',

    // Emphasis — fuchsia reserved for the principal figure (the copilot signature
    // accent, drawer.css rgb(232,121,249)); indigo geometry (the platform primary).
    'highlight.principal': '#E879F9',
    'accent.geometry': '#818CF8',

    // Standing — strictly increasing contrast (brighter) against the deep base:
    // slate → indigo-400 → indigo-300 → near-white.
    'standing.experimental': '#64748B',
    'standing.validated': '#818CF8',
    'standing.canonical': '#A5B4FC',
    'standing.foundational': '#E2E8F0',

    // State — the platform's emerald / amber / rose disposition ramp.
    'state.positive': '#34D399',
    'state.caution': '#FBBF24',
    'state.critical': '#FB7185',

    // Type — the house sans (Inter/system-ui); the platform is not a serif system.
    'type.title': "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    'type.annotation': "'Inter', system-ui, 'Segoe UI', 'Helvetica Neue', sans-serif",
    'type.mono': "'SF Mono', ui-monospace, Menlo, Consolas, monospace",

    // Motion — the platform's standard tempo + ease (transitions ~0.2–0.3s).
    'motion.tempo': '250ms',
    'motion.reveal': 'cubic-bezier(0.4, 0, 0.2, 1)',

    // Field sectors — bright, maximally separable hues from the platform palette.
    'field.reasoning': '#818CF8',
    'field.intelligence': '#38BDF8',
    'field.order': '#34D399',
    'field.action': '#FB923C',
    'field.knowledge': '#C084FC',
    'field.experience': '#2DD4BF',
    'field.consequence': '#FBBF24',

    // Material — the LIQUID GLASS. Grounded in styles/drawer.css: the glass fill
    // rgba(15,23,42,0.6) (slate-900 @ 60%), the white hairline rgba(255,255,255,
    // 0.10), the backdrop blur(...) saturate(180%), and the soft drop shadow +
    // the signature inset top-highlight inset 0 1px 0 rgba(255,255,255,0.05).
    'material.blur': 'blur(16px) saturate(180%)',
    'material.tint': 'rgba(15, 23, 42, 0.6)',
    'material.hairline': 'rgba(255, 255, 255, 0.10)',
    'material.elevation':
      '0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
};
