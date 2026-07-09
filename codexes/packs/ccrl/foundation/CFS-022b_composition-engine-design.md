# CFS-022b — Constitutional Composition Engine (Design) · P2 / gap G3

**Chrysalis Foundation Specification · design doc · authored 2026-07-09 · DESIGN ONLY (no implementation, no contract merges)**

Companion to `CFS-022` (Constitutional Operating Environment, program of record). This
document designs the **Constitutional Composition engine** — gap **G3**, "the missing
middle" (`CFS-022 §5`) — and specifies its **first vertical proof**: compose ONE
Constitutional Atlas Plate end-to-end from registered canonical assets. It designs the
`retrieve → assemble → validate → publish → provenance` seam. It does not touch `types/`,
`CFS-022`, or any protected service; every claim below cites a real file.

The engine's whole discipline in one line: **the runtime RETRIEVES canonical assets and
ASSEMBLES them into higher-order artefacts, GENERATING only the genuinely-novel delta.**
This is `CFS-022 §3`'s compose-not-generate made concrete, and it is the capability whose
absence blocks the Atlas.

---

## 0. Grounding — what already exists vs. what this designs

Read before trusting any "reuse" claim below. The seed organs are real and were read for
this design:

| Organ | File | What it gives the engine |
|---|---|---|
| Representation contract | `types/representation.ts` | `Interpretation`, `RepresentationContract`, `CONSTITUTIONAL_REPRESENTATION_CONTRACT`, roles (colour/type/motion/material/field/standing), `ValidationResult` |
| Representation resolver (**the validation gate**) | `services/representation/representationResolver.ts` | `validateInterpretation()`, `resolveRole()`, `surfaceStyle()`, `emitCssVariables()` — pure, SSR-safe, no T0 |
| Interpretation registry | `services/representation/interpretations/index.ts` (+ `constitutionalCivicFuturism.ts`, `agentiqLiquidGlass.ts`, `highContrastAccessible.ts`) | The concrete palette/typography/motion/material bindings — the "palette + typography canonical assets" a plate composes over |
| Bearing Instrument (**Canonical Asset 001**) | `components/representation/BearingInstrument.tsx` | `variant="atlas"` = Bearing Instrument v1.0; `ATLAS_TRINITY`, `ATLAS_POLES`, `ATLAS_ARTEFACTS`, `ATLAS_LAYERS`, `atlasHeadingDegrees()` — the first asset a plate composes |
| Invariant grounding | `services/invariants/grounding.ts` | `buildInvariantSlice()`, `initializeKnowledge()`, `citeInvariants()` — "load domain knowledge" and the consequence/citation return path |
| Invariant graph | `services/invariants/graph.ts` | `dependencyClosure()`, `reasoningPath()` — closure of the invariants a plate is grounded on |
| Coherence engine | `services/coherence/index.ts` | The `CoherenceResult` / `DimensionScore` shape + fail-closed, "no score without validation" (Law XII) posture to mirror for plates |
| Invariant publish (**provenance precedent**) | `services/invariants/publish.ts` | `deriveInvariantQubePublicRef()` (sha256, 16-char T2-safe ref), draft→finalize, DVN-anchorable receipt |
| Experiment publish (**hash-commitment precedent**) | `services/experiments/publishResult.ts` | serialize-once → sha256 content hash → receipt carries the hash. The exact pattern the plate provenance record copies |
| Coherence law seeds | `canonical-invariants.seed.json` | `inv.experience.072` (multiplicative composition), `inv.experience.070`, `inv.reasoning.071/073`, `inv.engineering.068/074` (composition laws), `inv.representation.121–129` (representation invariants) |

**Honest state of the two upstream dependencies (verified 2026-07-09):**

- **G1 Object Model — `types/constitutionalObject.ts` does NOT exist.** No unified
  `identity · version · standing · authority · dependencies · ownership · provenance ·
  lifecycle` contract. The engine's contracts below therefore reference an *intended* asset
  descriptor and must not assume it. (`ls types/constitutionalObject.ts` → not found.)
- **G2 Canonical Asset Registry does NOT exist** as one addressable store. There is no
  `CanonicalAsset` type and no asset-registry service. Today the canonical assets are
  addressable only *in situ*: the interpretation by id via `getInterpretation(id)`
  (`services/representation/interpretations/index.ts:34`), the Bearing atlas variant as a
  React component export, the invariants by seed-id via `buildInvariantSlice`. (grep for
  `CanonicalAsset` / asset-registry → no hits.)

**Consequence for this design:** the engine is specified against a thin **AssetResolver
port** (§4.1) so it can run *today* over the in-situ assets and *later* over the G2 registry
with zero engine change. This is the one genuinely-new seam; everything else composes over an
existing organ. This is called out again in Limits (§9).

---

## 1. What "compose, not generate" means here (the core rule)

`CFS-022 §3` and the coherence-law seeds fix the discipline. The engine is governed by a
single **compose-vs-generate boundary rule**:

> **A component is RETRIEVED (never generated) iff a canonical, registered asset with
> standing ≥ `validated` already expresses it. The engine may GENERATE only the *novel
> delta* — the arrangement/selection/labelling that no registered asset already fixes — and
> that delta is itself validated and recorded as the artefact's own contribution.**

Made operational as a three-way classification every field of a target artefact falls into:

| Class | Definition | Source | Example (Atlas Plate) |
|---|---|---|---|
| **RETRIEVED** | Expressed verbatim by a registered asset ≥ `validated` | AssetResolver → registry/in-situ | The Bearing dial geometry; every colour/type/material value (they come from the interpretation, never a literal); the field-sector taxonomy |
| **GROUNDED** | Not a rendered asset, but *canonical knowledge* the artefact must be true to | `grounding.ts` invariant slice | The Constitutional Trinity (Order/Reasoning/Action) domain labels; the standing scale semantics |
| **GENERATED (delta)** | The genuinely-novel arrangement no asset fixes | The engine's assembler | Which sector is `activeSector` for *this* plate; the plate's title/caption; layout placement of the dial + margin labels + provenance cartouche |

Grounding for the rule, cited: assets compose rather than get rediscovered
(`inv.reasoning` seed line: *"Adaptive systems compose validated primitives rather than
rediscover them."*); an experience is *composed, not stored*
(`inv.experience` seed: *"A constitutional experience is an emergent property of field
composition — it is not stored, it is composed."*); changing any field changes the whole
(`inv.experience.072`, multiplicative composition); the runtime is closed, the ontology open
(`inv.engineering.069`) — so the engine never rewrites an asset, it selects and arranges
registered ones.

**The rule is enforced structurally, not by good intent:** a RETRIEVED field that carries a
raw literal (a hex colour, a font string, a geometry constant) instead of an asset reference
is a **compose-violation** and fails validation (§6). This is the same zero-literal canary
posture the representation system already uses (`types/representation.ts` header: interpretation-
agnostic, no hardcoded look).

---

## 2. The `CompositionRequest` contract (what a caller asks for)

Interpretation-agnostic, role-driven, observe-mode-safe, no T0 identifiers. Proposed to live
at `types/composition.ts` (new file — G3's only new type surface), never inside a protected
contract.

```ts
/** What kind of artefact to compose. v1 ships exactly one target: 'atlas-plate'. */
export type CompositionTargetKind = 'atlas-plate'; // extend by adding kinds, never forking

/** A stable, T2-safe reference to a registered canonical asset. NOT a T0 id — an
 *  addressable public ref (interpretation id, asset public-ref, or seed id). */
export interface AssetRef {
  kind: 'interpretation' | 'bearing-instrument' | 'invariant' | 'typography' | 'palette';
  /** Public, addressable id — e.g. 'agentiq-liquid-glass', 'bearing-instrument@1',
   *  'inv.experience.072'. Never a personaId / rowId / authProfileId. */
  ref: string;
  /** Minimum standing the resolver must satisfy (default 'validated'). */
  minStanding?: 'validated' | 'canonical' | 'foundational';
}

/** The novel-delta inputs the CALLER supplies — the only place generation is licensed.
 *  Everything else is retrieved/grounded. Kept deliberately small: the delta is small. */
export interface AtlasPlateDelta {
  /** Where this plate orients — becomes BearingInstrument activeSector. */
  activeSector: FieldSector;             // from types/representation.ts
  /** Maturity shown on the standing ring. */
  standing: StandingLevel;               // from types/representation.ts
  /** Related sectors the plate points toward (navigation ticks). */
  relatedSectors?: FieldSector[];
  /** Operator-authored plate title + caption (novel prose — generated/authored). */
  title: string;
  caption?: string;
  /** Optional operator gauges (gs/alt) — rendered verbatim, never fabricated. */
  readouts?: { gs?: string; alt?: string };
}

export interface CompositionRequest {
  target: CompositionTargetKind;
  /** The canonical assets to compose over (retrieved, not generated). */
  assets: AssetRef[];
  /** The grounding context — which domain knowledge the artefact must be true to. */
  grounding: {
    domains?: string[];                  // -> grounding.ts GroundingContext.domains
    ontologyClassIds?: string[];
    /** Explicit invariant refs to foreground (e.g. the Trinity + composition laws). */
    invariantRefs?: string[];
  };
  /** The novel delta — target-specific. Discriminated by `target`. */
  delta: AtlasPlateDelta;
  /** Which interpretation to render under. Omit → the registry default (house style).
   *  ALWAYS a role-driven interpretation; never inline colours. */
  interpretationId?: string;
  /** Observe-mode discipline (CFS-022 §4 "observe-mode governs every lifecycle").
   *  'propose' (default) = produce artefact + provenance draft, DO NOT publish.
   *  'publish' = only honoured behind an explicit operator gate at the call site. */
  mode?: 'propose' | 'publish';
  /** T2-safe actor commitment for the provenance receipt (NEVER a personaId).
   *  The route derives this the way publish.ts derives its public ref. */
  actorCommitment?: string;
}
```

Design notes:
- `AssetRef.ref` is **addressable and public** — it mirrors `deriveInvariantQubePublicRef`'s
  T2-safe posture (`services/invariants/publish.ts:146`). No T0 ever enters the request.
- `delta` is the *only* generation surface. Its smallness is the point: the plate is 95%
  retrieved/grounded, 5% delta.
- `mode` defaults to `propose`. Publication is never automatic (observe-mode safe, §7).

---

## 3. The `CompositionResult` contract (what comes back)

```ts
export interface RetrievedComponent {
  role: 'palette' | 'typography' | 'material' | 'bearing' | 'field-taxonomy';
  assetRef: AssetRef;
  /** Standing at retrieval time — recorded so provenance is auditable. */
  standing: 'validated' | 'canonical' | 'foundational';
}

export interface GroundedComponent {
  invariantIds: string[];                // the slice's citedIds (grounding.ts)
  /** The dependency-closure roots (graph.ts dependencyClosure). */
  closureRootIds: string[];
}

export interface GeneratedComponent {
  /** Human-readable description of the novel delta that was generated. */
  description: string;
  /** The exact delta payload that was composed in (echoed for audit). */
  delta: AtlasPlateDelta;
}

/** The provenance record — the auditable, tamper-evident trail. Modelled on
 *  services/experiments/publishResult.ts (serialize-once → sha256) +
 *  services/invariants/publish.ts (public ref + DVN-anchorable receipt). */
export interface CompositionProvenance {
  /** sha256 over the canonicalised artefact string (serialize ONCE, hash that string). */
  contentHash: string;
  /** T2-safe commitment ref for this composition (sha256('composition:'+id).slice(0,16)). */
  publicRef: string;
  /** The receipt id IFF mode==='publish' AND the operator gate passed. Else null. */
  receiptId: string | null;
  /** Every component, classified — the decomposition the artefact can be read back into
   *  (inv.experience seed: "decomposable back into the fields from which it was composed"). */
  retrieved: RetrievedComponent[];
  grounded: GroundedComponent;
  generated: GeneratedComponent;
  /** Canon version stamp at composition time (grounding.ts currentCanonVersion analogue). */
  canonVersion: string;
  /** ISO timestamp — stamped by the CALLER/route, never read from the clock here
   *  (mirrors grounding.ts: "this module never reads the clock"). */
  composedAt: string | null;
}

export interface CompositionResult {
  ok: boolean;
  target: CompositionTargetKind;
  /** The composed artefact. For 'atlas-plate': a self-contained SVG string + the
   *  BearingInstrument props used, so it re-renders identically and role-agnostically. */
  artefact: {
    kind: 'atlas-plate';
    /** Standalone SVG (server-rendered, interpretation-baked-in via resolved roles). */
    svg: string;
    /** The exact BearingInstrument props (decomposition aid). */
    bearingProps: Record<string, unknown>;
    interpretationId: string;
  } | null;
  /** The interpretation-validation + composition-validation outcome (§6). */
  validation: {
    interpretation: ValidationResult;    // from validateInterpretation()
    composition: CompositionValidationResult; // §6
    pass: boolean;                       // fail-closed: false blocks publish
  };
  provenance: CompositionProvenance;
  /** Operator-facing recommendations when a dimension is unevaluatable (Law XII honesty). */
  recommendations: string[];
  error?: string;
}
```

Design notes:
- The artefact ships as **SVG string + the props that produced it**. Because
  `BearingInstrument`'s atlas variant is already fully role-driven and SSR-safe (pure
  deterministic geometry, `components/representation/BearingInstrument.tsx:32`), server-side
  SVG emission is a rendering of the *same* component under a resolved interpretation — no new
  drawing code, no rasteriser (heeding the CLAUDE.md "no server-side PDF/image rasterising"
  hard-won lesson).
- `provenance` is a full decomposition (retrieved/grounded/generated), satisfying the seed
  law *"every constitutional experience shall be decomposable back into the fields and
  invariants from which it was composed."*

---

## 4. The pipeline — `retrieve → assemble → validate → publish → provenance`

One authoritative service, proposed at `services/composition/composeArtifact.ts` (new — the
engine itself), pure where possible, server-only for the retrieval/grounding I/O. It **calls
into** existing organs and owns no logic they already own (façade-not-fork, the discipline
`representationResolver.ts` and `ontologyResolver.ts` model).

```
composeArtifact(request: CompositionRequest): Promise<CompositionResult>
  │
  ├─ (1) RETRIEVE canonical assets ─────────────────────────────────────────
  │      AssetResolver.resolve(request.assets)  →  RetrievedComponent[]
  │      • interpretation  ← getInterpretation(interpretationId)   [interpretations/index.ts]
  │      • bearing v1      ← <BearingInstrument variant="atlas">   [component export]
  │      • palette/typography/material  ← the interpretation's ROLE bindings (NOT literals)
  │      • asserts every retrieved asset meets AssetRef.minStanding; else fail-closed
  │
  ├─ (2) LOAD domain knowledge (GROUNDED) ──────────────────────────────────
  │      buildInvariantSlice({ domains, ontologyClassIds })        [grounding.ts]
  │      initializeKnowledge(...) → dependencyClosure roots        [grounding.ts/graph.ts]
  │      • foreground request.grounding.invariantRefs (Trinity + inv.experience.072 …)
  │
  ├─ (3) ASSEMBLE (the only place the novel delta enters) ───────────────────
  │      • map request.delta → BearingInstrument atlas props
  │          activeSector, standing, relatedSectors, readouts, showLayerLabels
  │      • place dial + title/caption + margin labels + provenance cartouche (layout = delta)
  │      • resolve EVERY colour/type/material through resolveRole(...)         [resolver.ts]
  │        → the SVG carries role-resolved values, never inline literals
  │
  ├─ (4) VALIDATE against invariants (fail-closed) ─────────────────────────
  │      • validateInterpretation(interp)                          [resolver.ts]  → must pass
  │      • validateComposition(artefact, retrieved, grounded)      [§6, new]      → must pass
  │      • pass = no interpretation violations AND no composition errors
  │
  ├─ (5) PROVENANCE (always) + PUBLISH (gated) ─────────────────────────────
  │      • contentHash = sha256(serializeOnce(artefact))           [publishResult.ts pattern]
  │      • publicRef   = sha256('composition:'+id).slice(0,16)     [publish.ts pattern]
  │      • decomposition record (retrieved/grounded/generated)
  │      • IF mode==='publish' AND validation.pass AND operator-gate:
  │           createActivityReceipt(actionType:'composition_published', …)  [receipts svc]
  │           → receiptId set; else receiptId = null (propose-only)
  │
  └─ return CompositionResult
```

### 4.1 The one new seam — `AssetResolver` port

Because G2 (asset registry) does not exist yet, stage (1) is defined against a **port**, not a
concrete store:

```ts
export interface AssetResolver {
  resolve(refs: AssetRef[]): Promise<RetrievedComponent[]>;
}
```

- **Today (interim, in-situ binding):** `InSituAssetResolver` maps
  `kind:'interpretation'` → `getInterpretation(ref)`; `kind:'bearing-instrument'` → the
  frozen atlas variant (standing = `canonical`, per the component's "Canonical Asset 001 ·
  Bearing Instrument v1.0" designation, `BearingInstrument.tsx:390`); `kind:'invariant'` →
  `getInvariantsByIds`. Standing for interpretations is read from the registered
  representation invariants (`inv.representation.128/129`, currently `proposed`).
- **Later (P1/G2):** a `RegistryAssetResolver` backed by the Canonical Asset Registry with no
  change to `composeArtifact`. This is the Extend-Don't-Duplicate hinge: the engine depends on
  the *port*, the registry fills it.

This is the honest boundary between "designed to compose over existing organs" and "genuinely
new": the port + the interim resolver + `composeArtifact` + `validateComposition` are new; the
five organs they orchestrate are not.

---

## 5. First vertical — compose ONE Constitutional Atlas Plate (full walkthrough)

The leverage-point milestone (`CFS-022 §6`, P2). Concrete inputs, concrete pipeline, concrete
output.

**Inputs (a `CompositionRequest`):**

```jsonc
{
  "target": "atlas-plate",
  "assets": [
    { "kind": "interpretation",       "ref": "constitutional-civic-futurism", "minStanding": "validated" },
    { "kind": "bearing-instrument",   "ref": "bearing-instrument@1",          "minStanding": "canonical" }
  ],
  "grounding": {
    "domains": ["representation", "constitutional"],
    "invariantRefs": ["inv.experience.072", "inv.experience", "inv.reasoning.071",
                      "inv.representation.124", "inv.representation.128"]
  },
  "delta": {
    "activeSector": "reasoning",
    "standing": "canonical",
    "relatedSectors": ["order", "action"],
    "title": "Plate I · The Constitutional Trinity",
    "caption": "Order, Reasoning, and Action as the primary octants of the field.",
    "readouts": { "gs": "—", "alt": "—" }
  },
  "interpretationId": "constitutional-civic-futurism",
  "mode": "propose"
}
```

**Pipeline, step by step:**

1. **Retrieve.** `InSituAssetResolver` returns two `RetrievedComponent`s:
   - the CCF interpretation (`constitutionalCivicFuturism.ts`) — supplies **palette**
     (`field.*`, `standing.*`, `surface.*`, `ink.*`), **typography** (`type.title/annotation/
     mono`), **material** (`material.blur='none'`, flat parchment), **motion**. Standing is
     read from `inv.representation.128`. *None of these values is generated — every one is a
     role binding retrieved verbatim.*
   - Bearing Instrument v1.0 (atlas variant) — supplies the **dial geometry, Trinity octants
     (`ATLAS_TRINITY = [order, reasoning, action]`), poles, artefacts gauge, standing ring,
     HDG/GS/ALT/TRK windows.** Standing `canonical` (frozen navigation primitive). *The dial
     is retrieved, not redrawn.*

2. **Ground.** `buildInvariantSlice({ domains:['representation','constitutional'] })` +
   foreground the requested invariant refs. This binds the plate to the **Constitutional
   Trinity** as *knowledge* (Order/Reasoning/Action are grounded domain labels, already the
   Bearing's `ATLAS_TRINITY`), and to the composition laws the plate must not violate
   (`inv.experience.072`, `inv.reasoning.071`). `dependencyClosure` gives the closure roots for
   the provenance record. `citeInvariants(citedIds)` is called only on publish (consequence
   return path, `grounding.ts:173`).

3. **Assemble.** The engine maps `delta` → atlas props:
   `activeSector='reasoning'` (needle points due-north Reasoning; `atlasHeadingDegrees` derives
   HDG=360°), `standing='canonical'` (standing ring lit to rung 3, TRK='CANON'),
   `relatedSectors=[order,action]`, `readouts={gs:'—',alt:'—'}`, `showLayerLabels=true`. It
   places the dial, the operator-authored **title/caption** (the novel prose delta), the five
   margin labels (`ATLAS_LAYERS`, retrieved), and a **provenance cartouche** (publicRef +
   canonVersion). Every stroke/fill/font in the emitted SVG is `resolveRole(...)` under CCF —
   **zero literals**.

   - **The novel delta, named precisely:** *the selection* (which sector, which standing,
     which related sectors), *the plate prose* (title + caption), and *the layout arrangement*
     of dial + labels + cartouche. That is all that is generated. The dial, the palette, the
     type system, the field taxonomy, the Trinity labels — all retrieved or grounded.

4. **Validate (fail-closed).**
   - `validateInterpretation(CCF)` → must return `{ valid:true }` (CCF already passes,
     `tests/representation-system.test.ts`). Guarantees body legibility, monotonic standing,
     distinct principal — the plate inherits accessibility *for free*.
   - `validateComposition(...)` (§6) → the plate-specific laws: every retrieved field carries
     an assetRef (no literal leaked), `activeSector` ∈ `FIELD_SECTORS`, `standing` ∈
     `STANDING_LEVELS`, grounded Trinity labels match `ATLAS_TRINITY`, no `contradicts` edge
     among the grounded invariants (reusing `checkCoherence`, `publish.ts:53`).
   - `pass` iff both clean.

5. **Provenance + (gated) publish.**
   - `contentHash = sha256(serializeOnce({svg,bearingProps,interpretationId}))` — the
     `publishResult.ts` serialize-once discipline, so verification recomputes over the stored
     string verbatim.
   - `publicRef = sha256('composition:'+rowId).slice(0,16)` — the `publish.ts` T2-safe
     commitment.
   - Decomposition record built: `retrieved=[CCF, Bearing v1]`, `grounded={citedIds, roots}`,
     `generated={activeSector,standing,title,caption,layout}`.
   - `mode==='propose'` → **no receipt written, `receiptId=null`.** The plate + its provenance
     draft are returned for operator review. A subsequent explicit `mode:'publish'` call behind
     an operator gate writes the `composition_published` receipt and calls `citeInvariants`.

**Output (a `CompositionResult`):** a standalone CCF-parchment SVG of Plate I — the Bearing
dial oriented to Reasoning, standing ring lit to Canonical, Trinity octants labelled, title
"Plate I · The Constitutional Trinity", a provenance cartouche — plus the full validation +
decomposition record. Flip `interpretationId` to `agentiq-liquid-glass` and the *same request*
yields the same plate reskinned coherently, because every value flowed through a role.

---

## 6. Validation design — reuse the gate, add only the composition laws

Two validators, composed; the engine invents no colour math.

**(a) Interpretation validation — reused verbatim.** `validateInterpretation(interp)`
(`representationResolver.ts:177`) runs the four contract laws (completeness, standing-monotonic,
principal-distinct, body-legibility). The plate calls it unchanged. This is why the plate is
accessible and coherent without the engine re-deriving WCAG.

**(b) Composition validation — the genuinely-new, small validator** (proposed
`services/composition/validateComposition.ts`), modelled on the coherence engine's shape
(`services/coherence/index.ts`: `DimensionScore`, fail-closed `pass`, "no score without
validation"):

```ts
export interface CompositionValidationResult {
  pass: boolean;                         // false = block publish (fail-closed, Law XI waiver aside)
  violations: { law: string; severity: 'error' | 'warning'; message: string }[];
  recommendations: string[];             // Law XII honesty for unevaluatable checks
}
```

Laws it checks (each grounded in a seed invariant):

| Law id | Check | Grounding invariant |
|---|---|---|
| `law.compose.no-literal` | Every RETRIEVED field references an asset, not a raw hex/font/geometry literal | compose-not-generate (`CFS-022 §3`); zero-literal canary posture |
| `law.compose.asset-standing` | Every retrieved asset meets `AssetRef.minStanding` | grounding authority = validated+ (`grounding.ts:33`) |
| `law.compose.grounded-coherent` | No `contradicts` edge among grounded invariants (**reuses `checkCoherence`**, `publish.ts:53`) | `inv.experience.072` multiplicative composition; coherence law |
| `law.compose.delta-in-taxonomy` | `delta.activeSector ∈ FIELD_SECTORS`, `standing ∈ STANDING_LEVELS`, Trinity labels == `ATLAS_TRINITY` | `types/representation.ts` canon; `inv.representation.123` (navigate through identity) |
| `law.compose.decomposable` | The result's decomposition round-trips (retrieved ∪ grounded ∪ generated covers every artefact field) | seed: *"decomposable back into the fields from which it was composed"* |
| `law.compose.sequence` (recommend-only v1) | Field arrangement respects any constitutional sequence | `inv` sequencing corollary (CFS-013 §7) — *unevaluated in v1*, returns a recommendation, never a false pass |

Fail-closed like coherence: renderers/publishers act only on `pass`. Unevaluatable dimensions
return `recommendations`, never a fabricated score — the exact Law XII honesty the coherence
engine already practises (`coherence/index.ts` header + §3.4/3.5).

---

## 7. Provenance & publication design — never T0, never auto-publish

**Provenance is always produced; publication is always gated.**

- **Hash-commitment.** Serialize the artefact ONCE, sha256 that exact string
  (`publishResult.ts:45`). Stored artefact + `contentHash` = tamper-evident; verification
  recomputes over the stored text. `publicRef = sha256('composition:'+id).slice(0,16)`
  (`publish.ts:146`, namespaced prefix prevents cross-type collisions).
- **No T0 identifiers, ever.** The request carries `actorCommitment` (a T2-safe commitment),
  never a `personaId`/`authProfileId`/`rootDid`. The provenance record, the SVG metadata, and
  the receipt payload carry only the commitment + the hash — exactly the DVN/receipt
  discipline in CLAUDE.md ("HMS Identifier Isolation", "Identifier exposure tiers").
- **Receipt (publish path only).** On a gated `mode:'publish'`, the route (not this engine)
  calls the existing `createActivityReceipt` with `actionType:'composition_published'`, a
  T2-safe summary (`title` + `sha256=…`, no ids), and `invariantsUsed = grounded.citedIds`.
  This is **read-only reuse** of the receipts organ — the design does not touch
  `services/receipts/*` or `services/dvn/*`; it calls the same public entry point
  `publish.ts` and `publishResult.ts` already use.
- **Observe-mode safety.** `mode` defaults to `propose`: the engine **produces** an artefact +
  a provenance *draft* and returns them for operator review. It **never** writes a receipt or
  anchors anything on its own. Publication requires (1) `mode:'publish'` explicitly set by the
  caller, (2) `validation.pass === true`, and (3) an operator gate at the route. This mirrors
  `CFS-022 §4`'s "observe-mode discipline governs every object lifecycle uniformly" and the
  publisher precedent (`publisherService.ts`: publish requires validation + score + review).

---

## 8. Extend-Don't-Duplicate map — what each stage composes over

| Pipeline stage | Composes over (existing organ) | New code (minimal) |
|---|---|---|
| Retrieve | `getInterpretation` (`interpretations/index.ts`); Bearing atlas variant (`BearingInstrument.tsx`); `getInvariantsByIds` (`invariants/store.ts`) | `AssetResolver` port + `InSituAssetResolver` (thin adapters) |
| Load domain knowledge | `buildInvariantSlice`, `initializeKnowledge`, `citeInvariants` (`grounding.ts`); `dependencyClosure` (`graph.ts`) | none — direct reuse |
| Assemble | `resolveRole`, `surfaceStyle`, `emitCssVariables` (`representationResolver.ts`); Bearing atlas props | `composeAtlasPlate` (maps delta→props, emits SVG via the existing component) |
| Validate | `validateInterpretation` (`representationResolver.ts`); `checkCoherence` (`publish.ts`) | `validateComposition` (6 small laws) |
| Provenance/publish | `deriveInvariantQubePublicRef` pattern (`publish.ts`); serialize-once sha256 (`publishResult.ts`); `createActivityReceipt` (read-only reuse) | `CompositionProvenance` assembly (glue only) |
| Orchestration | — | `composeArtifact` (the façade that calls all of the above) |

Net new surface: `types/composition.ts`, `services/composition/{composeArtifact,
composeAtlasPlate,validateComposition,assetResolver}.ts`. Everything load-bearing is reused.
No protected file (`types/`, `CFS-022`, `services/{dvn,identity,access,receipts}`,
`content/encryption`) is modified.

---

## 9. Honest limits & open questions

1. **Two upstream dependencies do not exist yet.** `types/constitutionalObject.ts` (G1) and
   the Canonical Asset Registry (G2) are absent (verified). The engine is therefore designed
   against the `AssetResolver` port + an interim in-situ resolver so P2 can prove the vertical
   *before* G1/G2 land, then swap in `RegistryAssetResolver` with zero engine change. This is
   the intended P1→P2 sequencing (`CFS-022 §6`), but it means the P2 proof runs on in-situ
   asset addressing, not a real registry. Flagged as the single biggest "must be built new"
   item.
2. **Asset standing is under-ratified.** The representation invariants that would give the
   interpretations/Bearing their `validated`/`canonical` standing (`inv.representation.128/129`)
   are still `status:'proposed'` in the seed crystal. `law.compose.asset-standing` will only
   be meaningfully enforceable once these are ratified — until then the interim resolver
   asserts standing by designation (Bearing = "Canonical Asset 001"), which is a stand-in, not
   a validated standing read. Open question: ratify the representation family before P2, or let
   P2 run with designated standing and backfill?
3. **`inv.composition.*` is proposed, not ratified.** `CFS-022 §3` says compose-not-generate
   is "proposed for the substrate as `inv.composition.*`, ratified through CCRL governance, not
   here." This design names the six composition laws (§6) but they are **proposed**; ratifying
   them (or mapping them onto existing `inv.engineering.068/069`, `inv.experience.072`) is a
   CCRL governance action, not an engine build. The engine can enforce them as code laws before
   they are constitutional invariants, but that gap should be closed.
4. **SVG-only artefact in v1.** The plate ships as SVG + props. PDF/PNG export is deliberately
   deferred to the Publication Layer (G4/P3) — and CLAUDE.md's hard-won rule forbids server-side
   PDF rasterising on Lambda. An Atlas *Picture Book* page is a downstream publication
   (`CFS-022 §2` graph), out of scope for the composition proof.
5. **The "novel delta" boundary is a judgement in edge cases.** Title/caption prose is clearly
   generated; layout is clearly generated; but e.g. "a new field-sector palette hue" would sit
   ambiguously between retrieve and generate. v1 rule: **anything not expressed by a registered
   asset ≥ validated is delta and must be validated as delta** — but a richer target kind will
   need finer boundary classification. Open question for target kinds beyond `atlas-plate`.
6. **One target kind only.** `CompositionTargetKind = 'atlas-plate'`. Research papers, PRDs,
   presentations (`CFS-022 §2`) are named, not designed — each is a new target added by
   extension (new `delta` shape + `composeX` + laws), never by forking `composeArtifact`.
7. **Coherence engine is video-brief-shaped today.** `services/coherence/index.ts` v1 validates
   `VideoInvariantBrief` specifically. This design *mirrors its posture* (fail-closed,
   DimensionScore, Law XII honesty) rather than calling it, because a plate is not a video
   brief. A future generalisation of the coherence engine to arbitrary composed artefacts would
   let `validateComposition` delegate to it instead of paralleling it — worth doing, not
   required for P2.

---

## 10. Ratification note

This is a **design doc**, not a ratified contract and not an implementation. It proposes the
`CompositionRequest`/`CompositionResult` contracts, the pipeline, the compose-vs-generate rule,
the six composition laws, and the Atlas-Plate vertical. Building it requires: (a) operator
ratification of the P2 increment (`CFS-022 §6`), (b) ideally G1/G2 or an accepted interim
in-situ binding, and (c) CCRL ratification (or mapping) of the `inv.composition.*` laws. No
code was written; no protected contract was touched or merged.
