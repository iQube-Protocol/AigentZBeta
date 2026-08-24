# SPEC-AEE-001A — Adaptive Experience Engine Phase 2: Differ Hosting Boundary + Financial Services Audit

**Status:** PROPOSED IMPLEMENTATION ADDENDUM  
**Date:** 2026-08-24  
**Parent:** `2026-08-24_spec-adaptive-experience-engine-differ-provider.md`  
**Reference provider/renderer:** Differ  
**Reference journey for first audit:** Horizen × MoneyPenny / Financial Services Journey Spine  

## 1. Purpose

This addendum makes explicit two things that the parent specification anticipated but did not yet define with enough operational precision:

1. **Application/interface hosting as a second phase** — allowing selected interface/navigation/rendering portions of the metaMe application to be projected or hosted through Differ while Constitutional Computing, authoritative state, object-level data and capability execution remain platform-owned.
2. **A first-pass Differ audit of the Financial Services Journey Spine** — using the existing Horizen × MoneyPenny journey as the reference system for identifying what Differ can safely render, compose, host or optimize without becoming the source of constitutional truth.

The objective is not to move the application wholesale into Differ. The objective is to establish a clean, testable separation between **application truth/capability**, **application topology/navigation**, **object data**, and **rendering/projection**.

## 2. Canonical separation

The architecture should distinguish four layers:

### A. Constitutional/runtime layer — platform-owned
Owns:

- Authority / Control / Mandate;
- Authorization;
- Journey state satisfaction;
- personhood / Passport / identity continuity;
- delegation;
- receipts / evidence;
- capability execution;
- confidential policy/runtime state;
- object-level authoritative data.

Differ MUST NOT become authoritative for any of these.

### B. Application topology layer — platform-owned, optionally externally projected
Owns or exposes:

- route / slug identifiers;
- cartridge identifiers;
- tab identifiers;
- capability/surface identifiers;
- Journey Spine definitions and current projection-safe state;
- navigation relationships;
- presentation policies;
- host compatibility metadata.

This layer may be exported through a bounded **Application Projection Manifest** for Differ or another renderer.

### C. Object/data layer — platform-owned, selectively projected
Includes object-level content/state needed by tabs, cartridges and Journey surfaces.

Examples:

- exchange metadata;
- agent card projections;
- journey step labels/state;
- public research objects;
- receipts summaries;
- artifact metadata;
- capability descriptors;
- permissible content blocks.

Object data must remain authoritative in metaMe/Constitutional Computing. External renderers receive only purpose-bounded projections appropriate to the current surface and disclosure policy.

### D. Rendering/experience layer — provider-capable
Owns presentation only:

- layout;
- composition;
- responsive rendering;
- information hierarchy;
- visual emphasis;
- surface selection;
- approved navigation projection;
- bounded adaptive copy/presentation;
- Companion placement/cues;
- approved component composition.

Differ is the reference provider for this layer.

Canonical compression:

> **metaMe owns truth, capability, topology and data. Differ may host/render bounded projections of topology and data.**

## 3. Rendering Engine versus Host

Treat **renderer** and **host** as related but separable roles.

### Rendering Engine
Consumes an `ExperienceProjection` + approved object-data projections + component/surface registry and produces the user interface.

### Host
Provides the execution/container environment in which the rendered interface is delivered.

A provider may be:

- renderer-only;
- host-only;
- renderer + host;
- neither, with metaMe native performing both.

Differ should therefore be capability-negotiated rather than assumed to provide both roles.

Conceptual provider manifest:

```ts
interface AdaptiveHostProviderManifest {
  providerId: string;
  canRender: boolean;
  canHost: boolean;
  canComposeComponents: boolean;
  canResolveRoutes: boolean;
  canPersistPresentationState: boolean;
  supportedProjectionLevels: number[];
  supportedSurfaceTypes: string[];
  dataBoundary: 'projection-only' | 'provider-stateful';
}
```

Provider verification must establish Differ's real capabilities before implementation.

## 4. Application Projection Manifest

Create a provider-safe application topology contract rather than exporting the application's internal routing/data model directly.

Conceptual shape:

```ts
interface ApplicationProjectionManifest {
  manifestVersion: string;
  applicationId: string;
  journeyRefs: JourneyProjectionRef[];
  routes: ProjectedRouteRef[];
  cartridges: ProjectedCartridgeRef[];
  tabs: ProjectedTabRef[];
  capabilities: CapabilityProjectionRef[];
  componentRegistry: ComponentProjectionRef[];
  navigationEdges: NavigationProjectionEdge[];
  dataContracts: ObjectProjectionContractRef[];
  hostPolicy: HostProjectionPolicy;
}
```

The manifest is **not** the canonical route database. It is an externally safe projection of platform topology.

## 5. Slugs and routing

The platform should preserve canonical slug/route ownership.

Differ MAY:

- render a route from an approved route manifest;
- host a projected route/sub-route where configured;
- request navigation to another declared route;
- present Journey Spine paths independently of the legacy global menu.

Differ MUST NOT:

- become the authoritative source of canonical slugs;
- invent actionable internal routes;
- mutate cartridge/tab routing state;
- bypass persona/access guards;
- infer route permission from route visibility.

A route/slug projection should include stable IDs plus host mappings:

```ts
interface ProjectedRouteRef {
  routeId: string;
  canonicalSlug: string;
  hostRefs: {
    native?: string;
    differ?: string;
    embed?: string;
  };
  surfaceRef: string;
  accessClass: string;
  objectDataContract?: string;
}
```

This allows the Journey Spine to remain host-neutral even when a route is rendered elsewhere.

## 6. Object-level data projection

Cartridges/tabs frequently require real object data; route portability alone is insufficient.

Define bounded `ObjectProjectionContract`s for each externally renderable surface.

Each contract must specify:

- owning service/table/object;
- safe projection schema;
- freshness model;
- read/write mode;
- confidentiality classification;
- authorization requirements;
- mutation endpoint/capability ref if actions are permitted;
- receipt/evidence behavior;
- whether provider caching is permitted;
- redaction/minimization rules.

External renderers should normally receive **read projections** and invoke platform-owned capabilities for consequential writes.

Canonical rule:

> **The renderer may hold a view of the object; the platform holds the object.**

## 7. Hybrid hosting modes

Support these explicit modes:

### Mode 0 — Native
metaMe hosts and renders everything.

### Mode 1 — External renderer, native host/data
Differ returns declarative projection; metaMe renders/hosts using native components.

### Mode 2 — External rendered surface, native runtime/data
Differ renders/hosts selected Journey or application surfaces; all object data, authorization, actions and receipts resolve back to metaMe through bounded APIs/capability refs.

### Mode 3 — Hybrid application shell
Selected navigation/Journey/application surfaces are Differ-hosted while sensitive/constitutional surfaces remain native and are embedded/linked/handed off seamlessly.

### Mode 4 — Portable application projection
A substantial interface shell can be reconstructed by a verified external host from the Application Projection Manifest + projection-safe object contracts, while Constitutional Computing remains the authoritative backend.

Phase 1 of the parent spec is Modes 0–1. This addendum makes Modes 2–4 explicit future phases.

## 8. Surface residency policy

Every surface should be classifiable by where it may reside:

- `NATIVE_ONLY`
- `NATIVE_PREFERRED`
- `HYBRID_ALLOWED`
- `EXTERNAL_RENDER_ALLOWED`
- `EXTERNAL_HOST_ALLOWED`

Residency should be determined by data sensitivity, authority semantics, latency, interaction requirements and provider capability — not aesthetics.

Examples likely to remain `NATIVE_ONLY` initially:

- Passport issuance/credential handling;
- principal-only signatures;
- secret/private-key operations;
- raw confidential artifacts;
- admin/constitutional mutation surfaces.

Examples likely suitable for early external projection:

- Journey Spine orientation/navigation;
- public/low-sensitivity information surfaces;
- explanatory/Companion framing;
- read-only research state summaries;
- approved matrices/dashboard compositions;
- state-aware next-step presentation.

## 9. Companion continuity across hosts

The Companion is the persistent threshold across native, Differ-hosted and legacy surfaces.

Host changes must not reset the person's conceptual journey.

The shared interaction contract should carry enough safe state for the Companion to say, for example:

> You are still in the Financial Services journey. This screen is being presented through an adaptive surface; your authority, Passport and transaction state remain governed by metaMe.

The Companion should be able to navigate users between:

- native metaMe surfaces;
- Differ-hosted surfaces;
- approved legacy/external destinations;

while Journey Spine retains canonical progression.

## 10. First Differ audit — Financial Services Journey Spine

Before using Ian's OCSGA collaboration as the first meaningful adaptive provider exercise, run a provider/surface audit against the mature **Horizen × MoneyPenny Financial Services Journey**.

Reference implementation:

`services/journey/horizenMoneyPennyJourney.ts`

Reference architecture/spec:

`codexes/packs/agentiq/updates/2026-07-30_prd-gjr-001-guided-journey-runtime.md`

The audit is initially READ-ONLY / SHADOW. It must not alter the live Financial Services journey.

### Audit question

> **Which parts of the Financial Services Journey can Differ safely render, compose or host while preserving platform-owned Journey truth, constitutional authorization, object-level data sovereignty, receipts and fail-closed execution?**

### Audit inventory

For every stage/surface in the Financial Services Journey record:

`STAGE | SURFACE | CANONICAL OWNER | DATA NEEDED | ACTIONS | AUTHORITY SENSITIVITY | CURRENT HOST | DIFFER RENDER? | DIFFER HOST? | REQUIRED ADAPTER | RISK | RECOMMENDATION`

Also inventory:

- journey bar/spine;
- Companion guidance;
- route/slug dependencies;
- component dependencies;
- object-level data sources;
- APIs/actions invoked;
- receipts generated;
- persona guards;
- wallet/credential interactions;
- external embeds/legacy surfaces;
- state refresh requirements.

## 11. First-pass Differ shadow projection

If a verified Differ integration surface exists, run a **shadow projection** of the Financial Services Journey:

1. assemble provider-safe Journey + Experience + Capability context;
2. provide Differ only the bounded projection manifest;
3. ask Differ to produce a proposed navigation/rendering projection;
4. do NOT expose consequential action credentials or execute writes;
5. validate the proposed projection against native Journey/Authorization truth;
6. compare native vs Differ projection;
7. record differences and any invalid/unsafe recommendations;
8. do not change the live journey until operator review.

Initial useful target: Journey Spine/navigation + low-risk explanatory/read-only surfaces, not wallet/signature/delegation execution.

## 12. Audit outputs

The first Financial Services audit should produce:

1. **Differ Provider Capability Matrix**
2. **Financial Services Surface Residency Matrix**
3. **Application Projection Manifest v0.1** for the Financial Services journey
4. **Object Projection Contract inventory**
5. **Native vs Differ shadow projection comparison** if provider access exists
6. **Hybrid-hosting recommendation** identifying the thinnest safe first externally hosted slice
7. **Gap register** for any capability required before Mode 2 hosting

## 13. First hosted slice candidate

Do not pre-decide the result of the audit, but the expected safest candidate is:

> **Differ-hosted Journey Spine + orientation/read-only journey summary, with native capability surfaces opened/embedded on demand.**

This would demonstrate navigation/capability decoupling without moving constitutional execution outside metaMe.

A later iteration may increase residency to selected read/write surfaces only after their object contracts and authorization handoffs are validated.

## 14. Acceptance criteria for Phase 2 readiness

The architecture is ready for selective Differ hosting when:

- canonical routes/slugs remain platform-owned;
- a provider-safe Application Projection Manifest exists;
- object-level data contracts exist for externally rendered surfaces;
- every surface has a residency class;
- provider access cannot bypass authorization or persona guards;
- provider-hosted actions call platform-owned capability endpoints;
- receipts/evidence remain platform-issued;
- Companion/Journey continuity survives host transitions;
- native fallback exists for each externally rendered critical journey surface;
- provider outage cannot prevent access to required constitutional actions;
- the Financial Services shadow audit has identified at least one safe externally renderable/hostable slice.

## 15. Implementation sequence

### Phase 0 — Differ capability verification + Financial Services audit

No application migration. Verify provider and inventory the Financial Services Journey.

### Phase 1 — Adaptive provider integration

Parent SPEC-AEE-001: host-neutral ExperienceProjection, native provider, Differ adapter, validation/fallback.

### Phase 2A — Application topology projection

Implement Application Projection Manifest + surface residency + route/slug projection.

### Phase 2B — Object projection contracts

Expose bounded object data for selected externally renderable surfaces.

### Phase 2C — First hybrid hosting slice

Host/render the audit-selected low-risk Financial Services slice through Differ, retaining native runtime/capability execution.

### Phase 3 — Journey Spine hybridization

Allow Journey Spine to project across native and Differ-hosted surfaces under one canonical journey state and Companion continuity.

### Phase 4 — Wider application hosting

Only after evidence from the Financial Services slice. Expand cartridge/tab/application residency selectively, never through wholesale migration by assumption.

## 16. Governing principle

> **Separate what the application knows, what it can do, where its objects live, and how its interface is rendered.**

This separation enables adaptive and portable experience without outsourcing constitutional authority or object sovereignty to the rendering provider.
