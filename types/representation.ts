/**
 * Constitutional Representation System — the canonical, interpretation-AGNOSTIC
 * contract (CFS-021).
 *
 * Constitutional principle (CFS-021 §3.1): "The system is the invariants — it
 * accommodates many interpretations." What is canonical here is the CONTRACT —
 * the semantic ROLES and the RELATIONSHIP LAWS every rendering must satisfy —
 * NOT any one look. A concrete binding of every role to a value (a colour, a
 * font token, an easing) is an INTERPRETATION. Constitutional Civic Futurism
 * (ivory parchment · charcoal linework · indigo geometry · muted gold) is
 * interpretation v1, never the definition (`inv.representation.128`).
 *
 * A style is an interpretation of the representation invariants exactly as a
 * modality is a projection of them; identity and connotation are preserved
 * across interpretations as across modalities. An interpretation is VALID only
 * if it satisfies this contract — fills every required role AND preserves every
 * relationship law. The system does not impose a look; it guarantees coherence
 * across looks.
 *
 * This file is pure data + types — no logic, no `window`, no I/O. The resolver
 * (`services/representation/representationResolver.ts`) executes the laws.
 *
 * Pattern source: types/access.ts + services/constitutional/ontologyResolver.ts
 * (contract-first, one authoritative service, canary-guarded).
 */

// ---------------------------------------------------------------------------
// §1 The semantic roles — names carry MEANING, not appearance
// ---------------------------------------------------------------------------

/** Surface + ink: the ground the field is drawn on and the marks upon it. */
export const SURFACE_INK_ROLES = [
  'surface.base',
  'surface.raised',
  'ink.body',
  'ink.muted',
  'border.subtle',
] as const;

/** Emphasis: the single reserved principal emphasis + the geometry accent.
 * `highlight.principal` is CCF's muted gold — reserved for the principal figure,
 * used sparingly (one new primitive per plate, CFS-021 §6). */
export const EMPHASIS_ROLES = ['highlight.principal', 'accent.geometry'] as const;

/** Standing scale — the bearing's standing function (CFS-021 §5). ORDERED and
 * monotonic in emphasis: experimental → validated → canonical → foundational.
 * The array order IS the constitutional ordering; do not reorder. */
export const STANDING_ROLES = [
  'standing.experimental',
  'standing.validated',
  'standing.canonical',
  'standing.foundational',
] as const;

/** State roles — positive / caution / critical dispositions. */
export const STATE_ROLES = ['state.positive', 'state.caution', 'state.critical'] as const;

/** Type roles — the serif title voice, the humanist-sans annotation voice, mono. */
export const TYPE_ROLES = ['type.title', 'type.annotation', 'type.mono'] as const;

/** Motion roles — the tempo (a duration token) and the reveal easing
 * ("discovered rather than noticed", CFS-021 §11). */
export const MOTION_ROLES = ['motion.tempo', 'motion.reveal'] as const;

/** Surface material roles — the physical substance a surface is painted WITH
 * (CFS-021 §3/§5; `inv.representation.129`). Colour alone cannot express a
 * rendering system: a surface has translucency, blur, a hairline edge, and
 * elevation. An interpretation binds material as it binds colour — "flat" (no
 * blur, opaque tint, no shadow) is a VALID material, exactly as parchment is a
 * valid ground. These carry NON-colour CSS values (a backdrop-filter, a surface
 * fill, a border colour, a box-shadow), so the colour relationship laws
 * (contrast / distinctness / monotonic standing) do NOT run over them — they
 * join `type.*` and `motion.*` as roles the contrast math never touches. Only
 * completeness applies: an interpretation MUST bind all four. */
export const MATERIAL_ROLES = [
  'material.blur',
  'material.tint',
  'material.hairline',
  'material.elevation',
] as const;

/** Bearing / field sector roles — the canonical Constitutional Field sectors
 * (CFS-021 §5), orientation anchors around the Bearing Instrument. Canon order:
 * Reasoning · Intelligence · Order · Action · Knowledge · Experience · Consequence. */
export const FIELD_ROLES = [
  'field.reasoning',
  'field.intelligence',
  'field.order',
  'field.action',
  'field.knowledge',
  'field.experience',
  'field.consequence',
] as const;

/** Roles that resolve to a colour value (hex) — the resolver's colour laws
 * (contrast, distinctness, monotonic standing) run over exactly these. */
export const COLOR_ROLES = [
  ...SURFACE_INK_ROLES,
  ...EMPHASIS_ROLES,
  ...STANDING_ROLES,
  ...STATE_ROLES,
  ...FIELD_ROLES,
] as const;

/** Every required role. An interpretation MUST bind all of them to be valid.
 * MATERIAL_ROLES are appended last so every pre-material role keeps its position
 * — the extension is purely additive and backward-compatible. */
export const ALL_ROLES = [
  ...SURFACE_INK_ROLES,
  ...EMPHASIS_ROLES,
  ...STANDING_ROLES,
  ...STATE_ROLES,
  ...TYPE_ROLES,
  ...MOTION_ROLES,
  ...FIELD_ROLES,
  ...MATERIAL_ROLES,
] as const;

/** The canonical union of role keys — semantic slots, never raw values. */
export type RepresentationRole = (typeof ALL_ROLES)[number];

/** The ordered standing values (the badge/bearing consume this). */
export type StandingLevel = 'experimental' | 'validated' | 'canonical' | 'foundational';
export const STANDING_LEVELS: StandingLevel[] = [
  'experimental',
  'validated',
  'canonical',
  'foundational',
];

/** The canonical field sectors (the bearing consumes this). */
export type FieldSector =
  | 'reasoning'
  | 'intelligence'
  | 'order'
  | 'action'
  | 'knowledge'
  | 'experience'
  | 'consequence';
export const FIELD_SECTORS: FieldSector[] = [
  'reasoning',
  'intelligence',
  'order',
  'action',
  'knowledge',
  'experience',
  'consequence',
];

// ---------------------------------------------------------------------------
// §2 An interpretation — a concrete binding of every role to a value
// ---------------------------------------------------------------------------

/**
 * A binding of the invariant contract to concrete values. Colour roles bind to
 * hex strings; type roles to font-family tokens; motion.tempo to a duration
 * token; motion.reveal to an easing token; material roles to CSS substance
 * values (a backdrop-filter, a surface fill, a border colour, a box-shadow).
 * `connotation` records what the interpretation is meant to evoke — the
 * identity+connotation the contract preserves across interpretations.
 */
export interface Interpretation {
  id: string;
  label: string;
  /** What constitutional meaning this interpretation is meant to evoke. */
  connotation: string;
  /** Every required role bound to a concrete value. */
  roles: Record<RepresentationRole, string>;
}

// ---------------------------------------------------------------------------
// §3 The relationship laws — encoded as declarative, executable rules
// ---------------------------------------------------------------------------

/**
 * A relationship law, expressed as DATA so the contract stays logic-free and
 * the resolver stays the single authoritative executor (façade-not-fork). The
 * resolver switches on `kind`.
 */
export type RelationshipRule =
  | {
      kind: 'required-roles';
      id: string;
      description: string;
      roles: readonly RepresentationRole[];
    }
  | {
      /** Standing colours must be strictly increasing in emphasis (contrast vs
       * `against`) across `order` — the standing scale is monotonic. */
      kind: 'standing-monotonic';
      id: string;
      description: string;
      order: readonly RepresentationRole[];
      against: RepresentationRole;
    }
  | {
      /** `role` must be perceptibly distinct (RGB distance ≥ minDelta) from each
       * role in `from` — the reserved principal emphasis is never body/surface. */
      kind: 'distinct';
      id: string;
      description: string;
      role: RepresentationRole;
      from: readonly RepresentationRole[];
      minDelta: number;
    }
  | {
      /** WCAG contrast ratio of `foreground` on `background` ≥ `ratio`. */
      kind: 'min-contrast';
      id: string;
      description: string;
      foreground: RepresentationRole;
      background: RepresentationRole;
      ratio: number;
    };

/**
 * The interpretation-agnostic contract: the required roles + the relationship
 * laws. This is the constitutional object; interpretations are its readings.
 */
export interface RepresentationContract {
  /** Every role an interpretation must bind. */
  requiredRoles: readonly RepresentationRole[];
  /** The ordered standing scale (source of the monotonic law's order). */
  standingOrder: readonly RepresentationRole[];
  /** Roles that carry a colour value (the colour laws apply to these). */
  colorRoles: readonly RepresentationRole[];
  /** The relationship laws every valid interpretation preserves. */
  rules: readonly RelationshipRule[];
}

/** The result of validating an interpretation against the contract. */
export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

// ---------------------------------------------------------------------------
// §4 The canonical contract instance
// ---------------------------------------------------------------------------

/**
 * THE Constitutional Representation Contract. Constant across every
 * interpretation. Extend by adding roles/laws here — never fork.
 */
export const CONSTITUTIONAL_REPRESENTATION_CONTRACT: RepresentationContract = {
  requiredRoles: ALL_ROLES,
  standingOrder: STANDING_ROLES,
  colorRoles: COLOR_ROLES,
  rules: [
    {
      kind: 'required-roles',
      id: 'law.completeness',
      description:
        'Completeness — an interpretation must bind every role in the contract to a non-empty value.',
      roles: ALL_ROLES,
    },
    {
      kind: 'standing-monotonic',
      id: 'law.standing-monotonic',
      description:
        'Standing scale — experimental → validated → canonical → foundational must be strictly increasing in emphasis (WCAG contrast vs surface.base).',
      order: STANDING_ROLES,
      against: 'surface.base',
    },
    {
      kind: 'distinct',
      id: 'law.principal-distinct',
      description:
        'Reserved emphasis — highlight.principal must be perceptibly distinct from surface.base, surface.raised, and ink.body.',
      role: 'highlight.principal',
      from: ['surface.base', 'surface.raised', 'ink.body'],
      minDelta: 40,
    },
    {
      kind: 'min-contrast',
      id: 'law.body-legibility',
      description:
        'Accessibility — body ink on the base surface must meet WCAG AA (contrast ratio ≥ 4.5).',
      foreground: 'ink.body',
      background: 'surface.base',
      ratio: 4.5,
    },
  ],
};

/** CSS custom-property name for a role: `surface.base` → `--rep-surface-base`. */
export function roleCssVar(role: RepresentationRole): string {
  return `--rep-${role.replace(/\./g, '-')}`;
}
