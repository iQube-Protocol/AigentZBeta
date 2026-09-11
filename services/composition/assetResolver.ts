/**
 * AssetResolver — the one genuinely-new seam of the Composition engine
 * (CFS-022b §4.1).
 *
 * Because the G2 Canonical Asset Registry does not exist yet, the engine's
 * RETRIEVE stage is defined against a PORT, not a concrete store. Today an
 * `InSituAssetResolver` binds refs to the in-situ descriptors
 * (`canonicalAssets.ts`, `getInterpretation`); later a `RegistryAssetResolver`
 * fills the SAME port with zero engine change. This is the Extend-Don't-Duplicate
 * hinge: `composeArtifact` depends on the port; the registry fills it.
 *
 * Server-safe: pure resolution over in-situ data; no clock, no randomness, no DB.
 */

import type { Interpretation } from '@/types/representation';
import { getInterpretation } from '@/services/representation/interpretations';
import type { ConstitutionalObject } from '@/types/constitutionalObject';
import { bandAtLeast, type StandingBand } from '@/types/constitutionalObject';
import type {
  AssetRef,
  ComposeStanding,
  RetrievedComponent,
} from '@/types/composition';
import {
  bearingInstrumentV1,
  paletteAssetFor,
  typographyAssetFor,
  materialAssetFor,
  interpretationAssetFor,
  assetObjectRef,
} from './canonicalAssets';

// ─────────────────────────────────────────────────────────────────────────
// The port
// ─────────────────────────────────────────────────────────────────────────

/** A retrieved asset paired with the descriptor + (for interpretations) the
 *  concrete Interpretation the assembler renders with. `component` is the
 *  T2-safe decomposition record; `object` + `interpretation` are engine-internal. */
export interface ResolvedAsset {
  component: RetrievedComponent;
  object: ConstitutionalObject;
  interpretation?: Interpretation;
}

/**
 * THE PORT. Resolves T2-safe asset refs to retrieved components. An
 * implementation MUST fail-closed on an unknown ref and MUST report each
 * asset's standing so the engine can enforce `minStanding` (CFS-022b §4 step 1).
 */
export interface AssetResolver {
  resolve(refs: AssetRef[]): Promise<ResolvedAsset[]>;
}

// ─────────────────────────────────────────────────────────────────────────
// Standing helpers
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_MIN_STANDING: ComposeStanding = 'validated';

/** Whether an asset's band meets a compose-standing floor. */
export function meetsStanding(band: StandingBand, floor: ComposeStanding): boolean {
  return bandAtLeast(band, floor);
}

/** A band coerced to a ComposeStanding for the decomposition record (experimental
 *  is never a valid retrieved standing — it is caught by the standing law). */
function asComposeStanding(band: StandingBand): ComposeStanding {
  return band === 'experimental' ? 'validated' : band;
}

// ─────────────────────────────────────────────────────────────────────────
// The interim in-situ resolver
// ─────────────────────────────────────────────────────────────────────────

export class InSituAssetResolver implements AssetResolver {
  async resolve(refs: AssetRef[]): Promise<ResolvedAsset[]> {
    const out: ResolvedAsset[] = [];
    for (const ref of refs) {
      out.push(...this.resolveOne(ref));
    }
    return out;
  }

  private resolveOne(ref: AssetRef): ResolvedAsset[] {
    switch (ref.kind) {
      case 'bearing-instrument': {
        const object = bearingInstrumentV1();
        return [this.pack('bearing', ref, object)];
      }
      case 'interpretation': {
        // An interpretation resolves into its VIEWS — palette + typography
        // (+ material) — so the decomposition names the retrieved sub-assets
        // (CFS-022a §4: palette/typography are views of the interpretation).
        const interp = getInterpretation(ref.ref);
        const palette = paletteAssetFor(interp);
        const typography = typographyAssetFor(interp);
        const material = materialAssetFor(interp);
        return [
          this.pack('palette', { kind: 'palette', ref: palette.identity.id, minStanding: ref.minStanding }, palette, interp),
          this.pack('typography', { kind: 'typography', ref: typography.identity.id, minStanding: ref.minStanding }, typography, interp),
          this.pack('material', { kind: 'interpretation', ref: material.identity.id, minStanding: ref.minStanding }, material, interp),
        ];
      }
      case 'palette': {
        const interp = getInterpretation(ref.ref.replace(/^palette:/, ''));
        return [this.pack('palette', ref, paletteAssetFor(interp), interp)];
      }
      case 'typography': {
        const interp = getInterpretation(ref.ref.replace(/^typography:/, ''));
        return [this.pack('typography', ref, typographyAssetFor(interp), interp)];
      }
      case 'invariant':
        // Invariants are GROUNDED knowledge, not rendered assets — the grounding
        // stage (grounding.ts) loads them. Not returned as a retrieved component.
        return [];
      default:
        return [];
    }
  }

  private pack(
    role: RetrievedComponent['role'],
    ref: AssetRef,
    object: ConstitutionalObject,
    interpretation?: Interpretation,
  ): ResolvedAsset {
    return {
      object,
      interpretation,
      component: {
        role,
        assetRef: ref,
        standing: asComposeStanding(object.standing.band),
        objectRef: assetObjectRef(object),
      },
    };
  }
}

/** The interpretation-as-asset descriptor, for callers that want the full
 *  interpretation object (not just its views) in the composedFrom trail. */
export function resolvedInterpretationAsset(interp: Interpretation): ResolvedAsset {
  const object = interpretationAssetFor(interp);
  return {
    object,
    interpretation: interp,
    component: {
      role: 'palette',
      assetRef: { kind: 'interpretation', ref: object.identity.id },
      standing: object.standing.band === 'experimental' ? 'validated' : object.standing.band,
      objectRef: assetObjectRef(object),
    },
  };
}
