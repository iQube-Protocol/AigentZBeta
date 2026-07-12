# CFS-027 — The Canonical Plates (CP): the visual ontology of Invariant Intelligence

**Chrysalis Foundation Specification · v1.0 · Status: PROPOSED (2026-07-11; operator-specced)**
Substrate: `services/artifact/canonicalPlates.ts` · canary `tests/canonical-plates.test.ts`
Companion to: `CFS-026` (Constitutional Publishing System) · `CFS-025` (Artifact Runtime)

> Slow down and establish the canonical visual language before producing another page. We do not need twelve diagrams. We need **seven canonical plates** — like Euclid's *Elements*, Darwin's sketches, Bell Labs system diagrams. Everything else is derived.

---

## The three complementary systems

Today's work defined one coherent knowledge architecture from three systems:

| System | Role |
|---|---|
| **IRL** — Invariant Research Lab | Discovers the science. |
| **CPS** — Constitutional Publishing System (CFS-026) | Communicates the science. |
| **CP** — Canonical Plates (this spec) | **Encodes** the science, visually. |

The plates are **stable intellectual artifacts in their own right**, independent of any single publication — as recognisable within the discipline as UML in software or Feynman diagrams in physics. The diagrams are not illustrations; **they are the knowledge primitives**, and the prose is written around them.

## The seven canonical plates (v1.0)

Numbered CP-001..CP-007 so writing can cite them — *"See Canonical Plate CP-002."* Pinned in `canonicalPlates.ts` (`CANONICAL_PLATES_V1`, order-pinned, canaried).

| № | Plate | Reads as |
|---|---|---|
| **CP-001** | The Evolution of Intelligence | Intelligence is the scientific object; Human/Machine are manifestations; Hybrid the composition; Civilisational the scale. |
| **CP-002** | The First Principles of Intelligence | Two invariant families — **Structural** (Compression, Abstraction, Representation, Composition, Learning, Prediction, Generalisation) and **Constitutional** (Standing, Delegation, Authority, Trust, Identity, Consequence, Constitutional Economics) — synthesising to Hybrid Intelligence. **The periodic table of the discipline.** ★ |
| **CP-003** | Human Agency | Human Agency at the centre; Privacy · Property · Identity · Standing · Trust · Delegation · Constitutional Economics · Knowledge around it as mechanisms that expand it. Research Invariant 001, visualised. ★ |
| **CP-004** | Invariant Intelligence (Cycle) | The discovery cycle — a **circle, not a pipeline**: Observation → Pattern → Invariant → Validation → Primitive → Reference Architecture → Engineering Discipline → Deployment → (Observation). ★ |
| **CP-005** | Constitutional Computing (Stack) | Applications → Constitutional Runtime → Constitutional Primitives → Protocols → Verification → Settlement → Infrastructure. Restrained: Bell Labs, NASA, IBM. ★ |
| **CP-006** | The metaMe Institutional Architecture | metaMe defined by constitutional **functions, not products**: IRL → Discovery → Engineering Disciplines → Venture Studio → Platforms → Deployment → Research. |
| **CP-007** | Discovery → Civilisation | The capstone: Observation → Knowledge → Science → Engineering → Infrastructure → Institutions → Civilisation; IRL, the Venture Studio, and metaMe each contribute along the ascent. ★ |

(★ = signature plate.)

## Composition, not invention

**Every publication is a different COMPOSITION of the same plates — no new diagrams, only new compositions** (`PLATE_COMPOSITIONS`):

| Publication | Plates |
|---|---|
| IRL-001 | CP-001 … CP-007 (all seven) |
| Constitutional Computing | CP-002, CP-004, CP-005, CP-006 |
| Hybrid Intelligence | CP-001, CP-002, CP-003, CP-007 |
| Investment Memorandum | CP-006, CP-007 |

Plates are numbered like papers so they become stable references independent of any document. When the visual vocabulary is stable, opening any IRL publication and recognising the concepts from the diagrams alone is what gives the discipline its identity.

## What is wired now
- **CP is data** (`canonicalPlates.ts`): the seven plates (structured content + reading), CP numbering, the composition map, `signaturePlates()`, `platesForPublication()`, `buildPlateManifest()` — order-pinned, canaried 10/10.
- **Production composes plates** — a delegate producing a CPS document (CFS-026) receives the plate manifest and is instructed to **produce diagrams-first, compose from the plates, and reference them as CP-00N** (never invent new diagrams where a plate exists).

## Reference renders (received 2026-07-11)

Two operator-supplied composite sheets live at `codexes/packs/ccrl/foundation/plates/`:

- **`canonical-plates-v1.0-reference.png`** — *the canonical R1 visual reference.* "Canonical Plates of Invariant Intelligence, Version 1.0": Plates I–VII with CP-001..CP-007 side labels, the publisher imprint, registration marks, engineering-notebook register. Verified plate-by-plate against `CANONICAL_PLATES_V1`: Plate III's eight mechanisms, Plate IV's eight-node circle, Plate V's seven-layer stack, and Plates I/II/VI/VII all match the encoded ontology (Plate VI shows "Discovery" as IRL's subtitle rather than a separate node — cosmetic).
- **`canonical-plates-v0.9-superseded.png`** — an earlier draft, **superseded**: its CP numbering disagrees with v1.0 (its CP-001 is Human Agency), and it contains two figures outside the ratified seven (the *Constitutional Orientation* compass; Hybrid-Intelligence-as-Venn). Never cite plate numbers from this sheet.

**Candidate CP-008 (backlogged, operator direction):** the *Constitutional Orientation* compass belongs to the **Bearing Instrument** family (Canonical Asset 001 — the ratified navigation primitive) and is canonical imagery. Whether it enters the plate set as CP-008 or remains the Bearing Instrument's own canonical rendering is decided at CFS-027 ratification — the seven-plate discipline is not silently widened.

## Honest limits
- **v1.0 = the ontology encoded, not rendered.** Each plate is structured data (content + form + reading); the SVG **rendering** — drawing each plate as an engineering figure in the NASA / Bell Labs / IBM Systems Journal / Da Vinci register — is the CPS rendering layer, still to build.
- **The plates are reusable ECOSYSTEM assets** (papers, decks, website, keynotes, PRDs, standards, memoranda, Studio). Registering them in the Canonical Asset Registry (Chrysalis P1) so every surface draws the SAME figure is a named follow-on.

## Ratification record
- [x] Specced by the operator 2026-07-11 (seven plates, CP numbering, composition model)
- [x] CP v1.0 encoded as data + canary (10/10); wired into diagrams-first production (CFS-026)
- [ ] Ratify CP v1.0 into the substrate (operator)
- [ ] The rendering layer: draw each plate as an SVG engineering figure
- [ ] Register the plates in the Canonical Asset Registry (one figure, every surface)
