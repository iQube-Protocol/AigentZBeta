/**
 * Canonical asset descriptors as Constitutional Objects (CFS-022a / CFS-022b).
 *
 * The assets the Composition engine RETRIEVES, expressed against the P0 object
 * model (`types/constitutionalObject.ts`) — identity · version · standing ·
 * authority · ownership · provenance · lifecycle · dependencies. These are the
 * assets that ACTUALLY EXIST in the tree today:
 *
 *   - Bearing Instrument v1 (canonical_asset) — Canonical Asset 001, the frozen
 *     navigation primitive (`components/representation/BearingInstrument.tsx`
 *     `variant="atlas"`).
 *   - The CCF palette + typography (representation_asset) — VIEWS of the
 *     `constitutionalCivicFuturism` interpretation's role bindings (CFS-022a §4:
 *     register the interpretation; expose palette/typography as named views, not
 *     independently-minted objects).
 *
 * Standing is read from the asset's ratification state: CFS-021 ratifies A1–A5,
 * so they enter at the `canonical` band (CFS-022a §2a crosswalk). Ownership is a
 * platform-steward COMMITMENT (T2-safe, one-way) — never a raw persona id. There
 * is NO storage here; this is the in-situ descriptor source the interim
 * `InSituAssetResolver` reads until the G2 registry lands.
 *
 * Server-safe: uses node crypto for the T2-safe content/owner commitments; no
 * clock, no randomness, no React, no DB.
 */

import { createHash } from 'crypto';
import type { Interpretation, RepresentationRole } from '@/types/representation';
import {
  COLOR_ROLES,
  TYPE_ROLES,
  MATERIAL_ROLES,
} from '@/types/representation';
import { constitutionalCivicFuturism } from '@/services/representation/interpretations';
import type {
  ConstitutionalObject,
  ObjectRef,
} from '@/types/constitutionalObject';
import { objectRef, standingBandFor } from '@/types/constitutionalObject';
import { CANONICAL_PLATES_V1, type CanonicalPlate } from '@/services/artifact/canonicalPlates';

// ─────────────────────────────────────────────────────────────────────────
// Commitments — T2-safe, deterministic, one-way (no T0 ever enters here)
// ─────────────────────────────────────────────────────────────────────────

/** A one-way T2-safe commitment over a namespaced key (publish.ts pattern). */
export function assetCommitment(namespace: string, key: string): string {
  return createHash('sha256').update(`${namespace}:${key}`).digest('hex').slice(0, 16);
}

/** Deterministic content commitment over a stable, canonically-serialised body. */
function contentCommitment(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
}

/** The platform steward owns canonical assets — a COMMITMENT, never a persona id. */
const PLATFORM_STEWARD_COMMITMENT = assetCommitment('platform-steward', 'canonical-assets');

/** CFS-021 ratifies the canonical assets → the `canonical` band. */
const CANONICAL_STANDING_SCORE = 0.7; // standingBandFor(0.7) === 'canonical'

// ─────────────────────────────────────────────────────────────────────────
// Bearing Instrument v1 — Canonical Asset 001
// ─────────────────────────────────────────────────────────────────────────

/** The frozen atlas anatomy this asset guarantees (mirrors the component's
 *  canonical constants; the pure engine reads these, never the React module). */
export const BEARING_TRINITY = ['order', 'reasoning', 'action'] as const;
export const BEARING_LAYERS = [
  'LAYER 1 · CURRENT PLATE',
  'LAYER 2 · ADJACENT DOMAINS',
  'LAYER 3 · KNOWLEDGE DOMAINS',
  'LAYER 4 · MODALITIES',
  'LAYER 5 · STANDING RING',
] as const;
export const BEARING_ARTEFACTS = ['document', 'dialogue', 'scene', 'runtime', 'data', 'share'] as const;

export const BEARING_INSTRUMENT_ID = 'bearing-instrument';

export function bearingInstrumentV1(): ConstitutionalObject {
  const payload = {
    variant: 'atlas',
    version: '1.0',
    trinity: [...BEARING_TRINITY],
    layers: [...BEARING_LAYERS],
    artefacts: [...BEARING_ARTEFACTS],
    functions: ['orientation', 'standing', 'navigation'],
  };
  return {
    identity: {
      id: BEARING_INSTRUMENT_ID,
      kind: 'canonical_asset',
      ref: assetCommitment('canonical_asset', BEARING_INSTRUMENT_ID),
      displayLabel: 'Bearing Instrument v1.0',
    },
    version: { version: 1, status: 'published' },
    standing: {
      standing: CANONICAL_STANDING_SCORE,
      band: standingBandFor(CANONICAL_STANDING_SCORE),
      reach: 3,
    },
    authority: {
      minStandingToCompose: 'validated',
      ratificationRequired: true,
      // Ratified by CFS-021 §5; the representation invariants that anchor it.
      governingInvariants: ['inv.representation.128', 'inv.representation.129'],
    },
    ownership: { ownerCommitment: PLATFORM_STEWARD_COMMITMENT },
    provenance: {
      receiptIds: [],
      contentCommitment: contentCommitment(payload),
      source: 'authored',
    },
    lifecycle: { state: 'canonized', order: ['draft', 'published', 'canonized', 'deprecated'] },
    dependencies: [
      objectRef('representation-contract', 'representation_asset'),
      objectRef('inv.representation.128', 'invariant'),
    ],
    payload,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// metaVitruvian v1 — Canonical Asset 002, the PAIR to the Bearing Instrument
// ─────────────────────────────────────────────────────────────────────────

export const META_VITRUVIAN_ID = 'meta-vitruvian';

/** The composable-human bearing functions — the pair to A1's orient/stand/navigate. */
export const VITRUVIAN_FUNCTIONS = ['proportion', 'standing', 'composition'] as const;

/**
 * Canonical Asset 002 — metaVitruvian, the composable human
 * (`components/representation/MetaVitruvian.tsx`). Role-driven LINE primitive,
 * interpretation-agnostic (hardcodes no look). The PAIR to the Bearing
 * Instrument: where A1 ORIENTS within the Field, A2 renders the composable
 * subject. Ratified alongside A1 (CFS-021 §5) → the `canonical` band.
 */
export function metaVitruvianV1(): ConstitutionalObject {
  const payload = {
    variant: 'line',
    version: '1.0',
    functions: [...VITRUVIAN_FUNCTIONS],
    pairedWith: BEARING_INSTRUMENT_ID,
  };
  return {
    identity: {
      id: META_VITRUVIAN_ID,
      kind: 'canonical_asset',
      ref: assetCommitment('canonical_asset', META_VITRUVIAN_ID),
      displayLabel: 'metaVitruvian v1.0',
    },
    version: { version: 1, status: 'published' },
    standing: {
      standing: CANONICAL_STANDING_SCORE,
      band: standingBandFor(CANONICAL_STANDING_SCORE),
      reach: 3,
    },
    authority: {
      minStandingToCompose: 'validated',
      ratificationRequired: true,
      governingInvariants: ['inv.representation.128', 'inv.representation.129'],
    },
    ownership: { ownerCommitment: PLATFORM_STEWARD_COMMITMENT },
    provenance: {
      receiptIds: [],
      contentCommitment: contentCommitment(payload),
      source: 'authored',
    },
    lifecycle: { state: 'canonized', order: ['draft', 'published', 'canonized', 'deprecated'] },
    dependencies: [
      objectRef('representation-contract', 'representation_asset'),
      objectRef(BEARING_INSTRUMENT_ID, 'canonical_asset'), // the pair
    ],
    payload,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Palette + Typography — VIEWS of an interpretation's role bindings
// ─────────────────────────────────────────────────────────────────────────

function roleSlice(interp: Interpretation, roles: readonly RepresentationRole[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const role of roles) {
    const v = interp.roles[role];
    if (typeof v === 'string' && v !== '') out[role] = v;
  }
  return out;
}

/** A representation-asset descriptor that is a VIEW of an interpretation's role
 *  slice (palette / typography / material). Not an independently-minted object —
 *  its id is scoped to the interpretation it reads (CFS-022a §4). */
function representationView(
  interp: Interpretation,
  view: 'palette' | 'typography' | 'material',
  roles: readonly RepresentationRole[],
): ConstitutionalObject {
  const id = `${view}:${interp.id}`;
  const payload = { view, interpretationId: interp.id, roles: roleSlice(interp, roles) };
  return {
    identity: {
      id,
      kind: 'representation_asset',
      ref: assetCommitment('representation_asset', id),
      displayLabel: `${interp.label} · ${view}`,
    },
    version: { version: 1, status: 'published' },
    standing: {
      standing: CANONICAL_STANDING_SCORE,
      band: standingBandFor(CANONICAL_STANDING_SCORE),
      reach: 2,
    },
    authority: {
      minStandingToCompose: 'validated',
      ratificationRequired: true,
      governingInvariants: ['inv.representation.128'],
    },
    ownership: { ownerCommitment: PLATFORM_STEWARD_COMMITMENT },
    provenance: {
      receiptIds: [],
      contentCommitment: contentCommitment(payload),
      source: 'derived', // a view derived from the interpretation asset
      composedFrom: [objectRef(`interpretation:${interp.id}`, 'representation_asset')],
    },
    lifecycle: { state: 'published', order: ['draft', 'published', 'canonized', 'deprecated'] },
    dependencies: [objectRef(`interpretation:${interp.id}`, 'representation_asset')],
    payload,
  };
}

export function paletteAssetFor(interp: Interpretation): ConstitutionalObject {
  return representationView(interp, 'palette', COLOR_ROLES);
}

export function typographyAssetFor(interp: Interpretation): ConstitutionalObject {
  return representationView(interp, 'typography', TYPE_ROLES);
}

export function materialAssetFor(interp: Interpretation): ConstitutionalObject {
  return representationView(interp, 'material', MATERIAL_ROLES);
}

/** The whole interpretation as a first-class representation asset (CFS-022a A3–A5). */
export function interpretationAssetFor(interp: Interpretation): ConstitutionalObject {
  const id = `interpretation:${interp.id}`;
  const payload = { interpretationId: interp.id, label: interp.label, roles: interp.roles };
  return {
    identity: {
      id,
      kind: 'representation_asset',
      ref: assetCommitment('representation_asset', id),
      displayLabel: interp.label,
    },
    version: { version: 1, status: 'published' },
    standing: {
      standing: CANONICAL_STANDING_SCORE,
      band: standingBandFor(CANONICAL_STANDING_SCORE),
      reach: 3,
    },
    authority: {
      minStandingToCompose: 'validated',
      ratificationRequired: true,
      governingInvariants: ['inv.representation.128'],
    },
    ownership: { ownerCommitment: PLATFORM_STEWARD_COMMITMENT },
    provenance: {
      receiptIds: [],
      contentCommitment: contentCommitment(payload),
      source: 'authored',
    },
    lifecycle: { state: 'canonized', order: ['draft', 'published', 'canonized', 'deprecated'] },
    dependencies: [objectRef('representation-contract', 'representation_asset')],
    payload,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// The Canonical Plates (CP-001..CP-007) — the visual ontology as assets
// ─────────────────────────────────────────────────────────────────────────

/** CP v1.0 is operator-SPECCED but not yet ratified (CFS-027) — plates enter at
 *  the `validated` band and `published` state; ratification lifts them to
 *  `canonized` / the canonical band. */
const PLATE_STANDING_SCORE = 0.5; // standingBandFor(0.5) === 'validated'

/**
 * A Canonical Plate as a first-class canonical asset (CFS-027): the SAME figure
 * every surface (papers, decks, website, keynotes, PRDs, Studio) retrieves —
 * an ecosystem asset, not per-document art. The payload is the plate's encoded
 * structure; the (later) rendering layer derives the SVG engineering drawing
 * from it, so the drawing and the ontology can never diverge.
 */
export function canonicalPlateAsset(plate: CanonicalPlate): ConstitutionalObject {
  const payload = {
    number: plate.number,
    roman: plate.roman,
    title: plate.title,
    form: plate.form,
    kind: plate.kind,
    structure: plate.structure,
    message: plate.message,
    signature: Boolean(plate.signature),
  };
  return {
    identity: {
      id: `plate:${plate.number.toLowerCase()}`,
      kind: 'canonical_asset',
      ref: assetCommitment('canonical_asset', `plate:${plate.number.toLowerCase()}`),
      displayLabel: `${plate.number} — ${plate.title}`,
    },
    version: { version: 1, status: 'published' },
    standing: {
      standing: PLATE_STANDING_SCORE,
      band: standingBandFor(PLATE_STANDING_SCORE),
      reach: 3, // ecosystem-wide reuse is the point
    },
    authority: {
      minStandingToCompose: 'validated',
      ratificationRequired: true, // CFS-027 ratification lifts to canonized
      governingInvariants: [],
    },
    ownership: { ownerCommitment: PLATFORM_STEWARD_COMMITMENT },
    provenance: {
      receiptIds: [],
      contentCommitment: contentCommitment(payload),
      source: 'authored',
    },
    lifecycle: { state: 'published', order: ['draft', 'published', 'canonized', 'deprecated'] },
    dependencies: [],
    payload,
  };
}

/** All seven plates as canonical assets, in CP order. Pure + deterministic. */
export function canonicalPlateAssets(): ConstitutionalObject[] {
  return CANONICAL_PLATES_V1.map(canonicalPlateAsset);
}

/** ObjectRef helper (P0) for a canonical-asset descriptor. */
export function assetObjectRef(o: ConstitutionalObject): ObjectRef {
  return objectRef(o.identity.id, o.identity.kind);
}

// ─────────────────────────────────────────────────────────────────────────
// The Canonical Asset Registry (CFS-022a §2) — the in-situ read source
// ─────────────────────────────────────────────────────────────────────────

/**
 * Every canonical asset that EXISTS today, as ConstitutionalObjects (P0). This
 * is the in-situ registry the read surface projects until the G2 store lands —
 * the same descriptors the Composition engine's `InSituAssetResolver` retrieves,
 * exposed as a browsable list so the assets are visible as first-class
 * constitutional objects (standing · authority · provenance · lifecycle):
 *
 *   A1  Bearing Instrument v1      canonical_asset      the navigation primitive
 *   A2  metaVitruvian v1           canonical_asset      the composable human (A1's pair)
 *   A3  CCF interpretation         representation_asset the ratified role bindings
 *   A4  CCF palette / typography / material  representation_asset  VIEWS of A3
 *   CP-001..CP-007                 canonical_asset      the Canonical Plates (CFS-027)
 *
 * Pure — no clock, no randomness, no DB. Deterministic order (A1, A2, the CCF
 * interpretation and its views, then the seven plates) so the projection is stable.
 */
export function listCanonicalAssets(): ConstitutionalObject[] {
  const ccf = constitutionalCivicFuturism;
  return [
    bearingInstrumentV1(),
    metaVitruvianV1(),
    interpretationAssetFor(ccf),
    paletteAssetFor(ccf),
    typographyAssetFor(ccf),
    materialAssetFor(ccf),
    ...canonicalPlateAssets(),
  ];
}
