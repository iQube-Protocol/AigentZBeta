/**
 * Constitutional Composition Engine — the contract surface (CFS-022b, gap G3).
 *
 * The "missing middle": the runtime RETRIEVES canonical assets and ASSEMBLES
 * them into higher-order artefacts, GENERATING only the genuinely-novel delta.
 * This file is the only NEW type surface G3 adds; it never touches a protected
 * contract. It composes OVER the Constitutional Object Model (P0,
 * `types/constitutionalObject.ts`) — a composed artefact IS a
 * ConstitutionalObject and its provenance carries `composedFrom: ObjectRef[]`.
 *
 * Interpretation-agnostic, role-driven, observe-mode-safe, no T0 identifiers.
 * Pure data + types — no logic, no I/O, no clock, no crypto. The engine
 * (`services/composition/*`) executes; this file only names the shapes.
 *
 * TIER DISCIPLINE: every ref here is T2-safe (an addressable public id or a
 * one-way commitment) — NEVER a personaId / authProfileId / rootDid. The
 * `findForbiddenObjectKey` canary (P0) makes a T0 leak a build failure.
 */

import type { FieldSector, StandingLevel, ValidationResult } from '@/types/representation';
import type { ObjectRef } from '@/types/constitutionalObject';

// ─────────────────────────────────────────────────────────────────────────
// §1 Target + asset references
// ─────────────────────────────────────────────────────────────────────────

/** What kind of artefact to compose. v1 ships exactly one target. Extend by
 *  adding a kind (+ a delta shape + a composeX + laws), never by forking. */
export type CompositionTargetKind = 'atlas-plate';

/** The minimum standing a resolver must satisfy for a retrieved asset. Mirrors
 *  the object model's StandingBand rungs that matter for composition. */
export type ComposeStanding = 'validated' | 'canonical' | 'foundational';

/**
 * A stable, T2-safe reference to a registered canonical asset. NOT a T0 id — an
 * addressable public ref (an interpretation id, an asset public-ref, a seed id).
 */
export interface AssetRef {
  kind: 'interpretation' | 'bearing-instrument' | 'invariant' | 'typography' | 'palette';
  /** Public, addressable id — e.g. 'constitutional-civic-futurism',
   *  'bearing-instrument@1', 'inv.experience.072'. Never a subject identifier. */
  ref: string;
  /** Minimum standing the resolver must satisfy (default 'validated'). */
  minStanding?: ComposeStanding;
}

// ─────────────────────────────────────────────────────────────────────────
// §2 The request — what a caller asks for
// ─────────────────────────────────────────────────────────────────────────

/**
 * The novel-delta inputs the CALLER supplies — the ONLY place generation is
 * licensed. Everything else is retrieved/grounded. Kept deliberately small: a
 * plate is ~95% retrieved/grounded, ~5% delta.
 */
export interface AtlasPlateDelta {
  /** Where this plate orients — becomes BearingInstrument activeSector. */
  activeSector: FieldSector;
  /** Maturity shown on the standing ring. */
  standing: StandingLevel;
  /** Related sectors the plate points toward (navigation ticks). */
  relatedSectors?: FieldSector[];
  /** Operator-authored plate title (novel prose — authored, not retrieved). */
  title: string;
  /** Operator-authored caption (novel prose). */
  caption?: string;
  /** Optional operator gauges — rendered verbatim, never fabricated. */
  readouts?: { gs?: string; alt?: string };
}

export interface CompositionRequest {
  target: CompositionTargetKind;
  /** The canonical assets to compose over (retrieved, not generated). */
  assets: AssetRef[];
  /** The grounding context — which domain knowledge the artefact must be true to. */
  grounding: {
    domains?: string[];
    ontologyClassIds?: string[];
    /** Explicit invariant refs to foreground (the Trinity + composition laws). */
    invariantRefs?: string[];
  };
  /** The novel delta — target-specific. Discriminated by `target`. */
  delta: AtlasPlateDelta;
  /** Which interpretation to render under. Omit → the registry default (house
   *  style). ALWAYS a role-driven interpretation; never inline colours. */
  interpretationId?: string;
  /** Observe-mode discipline (CFS-022 §4). 'propose' (default) = produce
   *  artefact + provenance draft, DO NOT publish. 'publish' = honoured only
   *  behind an explicit operator gate at the call site. */
  mode?: 'propose' | 'publish';
  /** T2-safe actor commitment for the provenance receipt (NEVER a personaId).
   *  The route derives this the way publish.ts derives its public ref. */
  actorCommitment?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// §3 The compose-not-generate ledger — the structural enforcement surface
// ─────────────────────────────────────────────────────────────────────────

/**
 * The three-way classification every field of a target artefact falls into
 * (CFS-022b §1). RETRIEVED = expressed verbatim by a registered asset ≥
 * validated; GROUNDED = canonical knowledge the artefact must be true to;
 * GENERATED = the genuinely-novel delta no asset fixes.
 */
export type ComponentClass = 'retrieved' | 'grounded' | 'generated';

/**
 * One field of the composed artefact, classified and provenanced — the
 * STRUCTURAL proof of compose-not-generate. A RETRIEVED binding MUST carry a
 * `sourceRef` naming the asset that expresses it; a retrieved field that
 * carries a raw literal (hex/font/geometry) with NO sourceRef is a
 * compose-violation the validator fails (CFS-022b §1, §6 `law.compose.no-literal`).
 */
export interface FieldBinding {
  class: ComponentClass;
  /** The role name (retrieved/grounded) or field name (generated). */
  key: string;
  /** The resolved value that entered the artefact (a colour, a font, prose…). */
  value: string;
  /** The asset/invariant this value came from. REQUIRED for `retrieved`. */
  sourceRef?: AssetRef;
}

// ─────────────────────────────────────────────────────────────────────────
// §4 The result — retrieved / grounded / generated decomposition
// ─────────────────────────────────────────────────────────────────────────

export interface RetrievedComponent {
  role: 'palette' | 'typography' | 'material' | 'bearing' | 'field-taxonomy';
  assetRef: AssetRef;
  /** Standing at retrieval time — recorded so provenance is auditable. */
  standing: ComposeStanding;
  /** The object ref (P0) for the composedFrom trail. */
  objectRef: ObjectRef;
}

export interface GroundedComponent {
  invariantIds: string[];
  /** The dependency-closure roots (graph.ts dependencyClosure). */
  closureRootIds: string[];
}

export interface GeneratedComponent {
  /** Human-readable description of the novel delta that was generated. */
  description: string;
  /** The exact delta payload that was composed in (echoed for audit). */
  delta: AtlasPlateDelta;
}

/**
 * The provenance record — the auditable, tamper-evident trail. Modelled on
 * `services/experiments/publishResult.ts` (serialize-once → sha256) +
 * `services/invariants/publish.ts` (public ref + DVN-anchorable receipt). It IS
 * an object-model provenance: `composedFrom` is the ObjectRef[] audit trail.
 */
export interface CompositionProvenance {
  /** sha256 over the canonicalised artefact string (serialize ONCE, hash it). */
  contentHash: string;
  /** T2-safe commitment ref for this composition. */
  publicRef: string;
  /** The receipt id IFF mode==='publish' AND the operator gate passed. Else null. */
  receiptId: string | null;
  /** Every component, classified — the decomposition the artefact reads back into. */
  retrieved: RetrievedComponent[];
  grounded: GroundedComponent;
  generated: GeneratedComponent;
  /** The object refs this artefact was COMPOSED from (P0 audit trail). */
  composedFrom: ObjectRef[];
  /** Canon version stamp at composition time. */
  canonVersion: string;
  /** ISO timestamp — stamped by the CALLER/route, never read from the clock here. */
  composedAt: string | null;
}

/** The composition-validation outcome (§6). Fail-closed: false blocks publish. */
export interface CompositionValidationResult {
  pass: boolean;
  violations: { law: string; severity: 'error' | 'warning'; message: string }[];
  /** Law XII honesty for unevaluatable checks — never a fabricated pass. */
  recommendations: string[];
}

export interface ComposedArtefact {
  kind: 'atlas-plate';
  /** Standalone SVG (server-rendered, interpretation baked in via resolved roles). */
  svg: string;
  /** The exact BearingInstrument props (decomposition aid). */
  bearingProps: Record<string, unknown>;
  interpretationId: string;
  /** The compose-not-generate ledger — the structural proof (§3). */
  bindings: FieldBinding[];
}

export interface CompositionResult {
  ok: boolean;
  target: CompositionTargetKind;
  /** The composed artefact, or null when composition failed before assembly. */
  artefact: ComposedArtefact | null;
  validation: {
    interpretation: ValidationResult;
    composition: CompositionValidationResult;
    pass: boolean;
  };
  provenance: CompositionProvenance;
  /** Operator-facing recommendations when a dimension is unevaluatable. */
  recommendations: string[];
  error?: string;
}
