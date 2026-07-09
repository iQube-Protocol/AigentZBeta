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
import type {
  ConstitutionalObject,
  ObjectRef,
} from '@/types/constitutionalObject';
import { objectRef, standingBandFor } from '@/types/constitutionalObject';

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

/** ObjectRef helper (P0) for a canonical-asset descriptor. */
export function assetObjectRef(o: ConstitutionalObject): ObjectRef {
  return objectRef(o.identity.id, o.identity.kind);
}
