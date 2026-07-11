# CFS-026 — The Constitutional Publishing System (CPS)

**Chrysalis Foundation Specification · v0.1 · Status: PROPOSED (2026-07-11; discovery + draft by Aletheon, operator-refined & renamed)**
Substrate: `services/artifact/constitutionalPublishingSystem.ts` · canary `tests/constitutional-publishing-system.test.ts`
Companion to: `CFS-025` (Artifact Runtime / Production Runtime) · `CFS-011` (Style Invariant Specification) · Human Civic Futurism

> We set out to make a beautiful paper. What we uncovered is the **publishing subsystem for the entire metaMe ecosystem.** The Constitutional Publishing System is to artifacts what the Constitutional Runtime is to intelligent systems: a canonical, reusable, invariant production layer.

---

## The milestone (renamed from CDS)

This is no longer "the Policy Papers design system." It is the **Constitutional Publishing System (CPS)** — the canonical publication language of metaMe and the **visual implementation of Human Civic Futurism.** Every publication metaMe produces eventually speaks this language: same language, different templates.

```
Human Civic Futurism
        │
        ▼
Constitutional Publishing System (CPS)
        │
        ├── IRL Papers
        ├── Polity Papers
        ├── Constitutional Standards
        ├── Venture Papers
        ├── Investment Memoranda
        ├── Technical Specifications
        └── Research Reports
```

## The loop with Production closes here

The **Production Runtime** (CFS-025 Artifact Runtime) does **not generate PDFs — it generates constitutional publications.** CPS is **one RENDERER inside it.** Others render the same produced artifact into a different output form:

> Executive Brief · Scientific Paper · PRD · Standards Document · Investment Memorandum · Constitutional Specification · Research Report · White Paper · Book · Presentation · Website · Interactive Experience.

**Same runtime. Different renderer.** A *renderer* is HOW an artifact is output; the AR *profile* is WHAT it is. CPS is the first/canonical renderer (`CPS_RENDERERS[0]`); wiring renderers as a first-class AR concept is a follow-on. This bridges today with the production architecture: this first IRL paper is the first publication of the lab **and** the first publication produced in the emerging CPS — even before the full Production Runtime is complete.

## CDS within CPS, and the diagrams-first pipeline

CPS **re-constitutes** the Constitutional Design System — it does not replace it. The **CDS is the design-language layer WITHIN the CPS** (`CDS_DESIGN_LANGUAGE`): principles, editorial hierarchy, document arc, visual, cover, notebook marks. CPS is the whole system = **CDS (design) + the Canonical Plates (CFS-027, the visual ontology) + templates + renderers + the production pipeline.**

The core inversion: **produce DIAGRAMS-FIRST.** A publication is not written-then-illustrated — the diagrams are knowledge primitives and the prose is written *around* them (`CPS_PRODUCTION_PIPELINE`): **Canonical Concepts → Canonical Diagrams → Canonical Narrative → Publication.** The diagrams come from the seven Canonical Plates (CP-001..CP-007, CFS-027); compose them, cite them as CP-00N, never invent new visuals where a plate exists.

The three complementary systems form one knowledge architecture: **IRL** discovers the science · **CPS** communicates it · **CP** encodes it.

## The publisher imprint

Every publication carries the hierarchy (`CPS_PUBLISHER`): **metaMe · Invariant Research Lab · Foundational Research Series.** Publications are numbered **four-digit** (`cpsPaperNumber`) — `IRL-0001`, not `IRL-1` — so the series survives into the hundreds.

## The design invariants (v0.1, encoded as data)

Pinned in `services/artifact/constitutionalPublishingSystem.ts`, so the Production Runtime + any producing delegate APPLY them.

- **Design philosophy** — *seriousness* (W3C / IEEE / NIST / IBM Research / government white papers, never marketing) · *constitutional humanity* (ivory, paper, restrained navy + gold; never cyberpunk/neon/glossy) · *timelessness* (right in ten years).
- **Editorial hierarchy** — Cover → Executive Summary → Concept → Architecture → Implementation → Governance → Future Work → Appendices. Reason **problem-first**, never implementation-first: Problem → Opportunity → Constitutional Principle → Architecture → Implementation.
- **Cover** (operator refinement) — a constitutional **manuscript**, not a Renaissance poster: keep geometric constructions, circles, the golden ratio, Da Vinci notebook marks, faint engineering sketches; **omit the literal human figure** (the Vitruvian Man is too literal — keep the geometry, lose the body).
- **Engineering-notebook feel** (operator refinement) — very faint, never decorative: margin construction marks, drafting ticks, annotation arrows, page registration marks, architectural scale bars. Everything useful.
- **Architecture diagrams are ENGINEERING DRAWINGS** (operator refinement — this is what makes a CPS publication distinctive): the register of **NASA systems diagrams, Bell Labs drawings, IBM Systems Journal, Da Vinci engineering notebooks.** Never infographics. Every figure numbered · titled · captioned · referenced; SVG, never PNG.
- **Publication invariants** — author editable-first (DOCX / Markdown / LaTeX); **PDF always derived, never authored**; one page = one page; never rasterize text; publication style, not presentation; white papers precede standards, standards precede implementation.

## What is wired now (this increment)

- **CPS is data** (`constitutionalPublishingSystem.ts`): the invariants above + publisher imprint + four-digit numbering (`cpsPaperNumber`) + the renderer roster (`CPS_RENDERERS`) + the template layer (`CPS_TEMPLATES`), order-pinned + canaried (8/8).
- **The Production Runtime applies it**: `isDocumentProfile()` marks which AR profiles are CPS publications; `buildCpsProductionGuidance()` injects the imprint, editorial arc, engineering-drawing diagram register, and production rules into a delegate's production prompt. A delegate producing a publication natively (e.g. the first IRL paper) now speaks the canonical language automatically.

## What's proposed (the factory build — operator-gated)

1. **Renderers as a first-class AR concept** — CPS as the canonical renderer, others pluggable; the runtime selects a renderer per output.
2. **Master template + engineering figure libraries** (SVG components for the seven figure types, in the NASA/Bell-Labs/Da-Vinci register).
3. **Numbering + series registry** — `IRL-0001`, `PP-000N`, `CCS-000N` … as first-class records.
4. **The rendering layer** — editable-source → **derived** PDF (never server-side Lambda rasterization — CLAUDE.md). The biggest piece; specced before building.
5. **CPS wired into the AR profile registry** (`services/artifact/profiles.ts`).

## The rendering layer — design (specced 2026-07-11; build gated on operator sign-off)

The layer that makes a CPS publication *look* like a standard. Three phases, each independently shippable, all obeying the hard platform constraint: **no server-side PDF rasterization on Lambda** (CLAUDE.md — pdfjs/canvas on Lambda is a documented dead end). Authoring stays editable-first; PDF is always **derived, client-side**.

**R1 — the Plate renderer (SVG engineering drawings).** One isomorphic React component, `CanonicalPlateFigure`, that renders a `CanonicalPlate` **from its registered asset payload** (`plate:cp-00n` in the Canonical Asset Registry — the drawing can never diverge from the ontology). One renderer per `PlateForm` (`branch` · `radial` · `circle` · `stack` · `flow`), drawn in the engineering-drawing register: hairline strokes, boxes/layers/flow vocabulary, numbered figure block (Fig. N · title · caption), faint drafting marks from `CPS_NOTEBOOK_MARKS`. Pure SVG — vector, version-controlled, reusable in papers/decks/website/Studio. Palette + type from the representation system (a CPS interpretation with ivory/navy/gold bindings), never hardcoded literals (house rule).

**R2 — the Publication shell (HTML).** A `CpsPublicationView` that lays out a produced publication: manuscript cover (geometric constructions, golden-ratio guides, **no human figure**), the publisher imprint block (metaMe · Invariant Research Lab · series + `IRL-0001` number), CPS typography (serif headings / sans body / mono notation), twelve-column grid, plates placed as `CanonicalPlateFigure`s at their cited positions ("See Canonical Plate CP-002" anchors). Renders the editable Markdown source — the source of truth stays text.

**R3 — the derived PDF.** Client-side only: print-CSS on the R2 shell (`@page` margins, page-registration marks, break rules) → the browser's print-to-PDF produces the artifact. No Lambda involvement; the PDF is a *derivation* of the HTML, which is a derivation of the Markdown + plate assets. (If a headless-render service is ever wanted, it is an external worker, never in-Lambda — a separate ratification.)

Order of build: **R1 first** (the plates are the reusable asset with the widest surface), then R2, then R3. R1 alone already upgrades every deck/paper/Studio surface.

## Honest limits
- **PROPOSED, v0.1.** CPS governs prose + editorial structure + the *description* of engineering figures today; the visual rendering layer (serif/sans/grid, SVG figures in the engineering-drawing register, derived PDF) is unbuilt.
- **Relationship to CFS-011.** CFS-011 Style Invariants govern generative style broadly; CPS is the metaMe *publications* language specifically. CPS may become the publications interpretation of the style-invariant substrate.

## Ratification record
- [x] Drafted by Aletheon; operator-refined + renamed CDS → CPS 2026-07-11
- [x] CPS v0.1 encoded as data + canary (8/8); wired into native document production
- [ ] Ratify CPS v0.1 into the substrate (operator)
- [ ] The factory: renderers-as-AR-concept · master template · figure libraries · numbering registry · rendering layer
- [ ] First IRL paper produced as the first CPS publication (`IRL-0001`)
