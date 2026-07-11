# CFS-026 — The Constitutional Design System (CDS) & the Publishing Factory

**Chrysalis Foundation Specification · v0.1 · Status: PROPOSED (2026-07-11; discovery + draft by Aletheon, operator-shared)**
Substrate: `services/artifact/constitutionalDesignSystem.ts` · canary `tests/constitutional-design-system.test.ts`
Companion to: `CFS-025` (Artifact Runtime) · `CFS-011` (Style Invariant Specification)

> The shift is from *drafting documents* to *building the system that produces them.* One excellent paper is a document; a design system + a production runtime is a **strategic asset** that turns out dozens of standards-grade publications for years.

---

## The three products (kept distinct)

The publishing work surfaced **three** separable assets — conflating them was the trap:

| Product | What it is |
|---|---|
| **CCS** — Constitutional Commerce Specifications | The standards THEMSELVES (CCS-000 Vision & Scope → CCS-008 Constitutional Receipts). The content. |
| **CDS** — Constitutional Design System | The visual, editorial, and architectural **invariants** every publication derives from. A reusable SYSTEM, not templates. *This spec.* |
| **CPS** — Constitutional Publications System | The production workflow + templates — the **Publishing Factory**. |

**The load-bearing connection: CPS is not a new engine. CPS is the Artifact Runtime (CFS-025) operating on the DOCUMENT profiles, configured by this CDS.** The factory Aletheon proposes = AR's `standard` / `white-paper` / `policy` / `documentation` / … profiles + CDS as their design authority + numbering + review workflow. AR already is most of the factory; CDS is the design invariants it was missing.

## CDS v0.1 — the design invariants (encoded as data)

Pinned in `services/artifact/constitutionalDesignSystem.ts`, so the runtime and any producing delegate APPLY them rather than re-deriving the design language.

**Design philosophy** (`CDS_DESIGN_PRINCIPLES`): **seriousness** (standards bodies + research institutions — W3C, IEEE, NIST, IBM Research, government white papers — never marketing) · **constitutional humanity** (rigorous yet human: ivory, paper, restrained navy + gold, architectural precision; never cyberpunk/neon/glossy) · **timelessness** (equally right in ten years; design for permanence).

**Editorial invariants** (`CDS_EDITORIAL_HIERARCHY`): Cover → Executive Summary → Concept → Architecture → Implementation → Governance → Future Work → Appendices. And every document REASONS in this order (`CDS_DOCUMENT_ARC`) — **never implementation-first**: Problem → Opportunity → Constitutional Principle → Architecture → Implementation.

**Visual invariants** (`CDS_VISUAL`): palette ivory / paper-white / navy / charcoal + gold accent (nothing else unless required); classical-serif headings, modern-sans body, monospace for engineering notation; large margins, generous whitespace, twelve-column grid.

**Figure + diagram invariants**: every figure numbered · titled · captioned · referenced in text; types = architecture / sequence / layer / lifecycle / state / ontology / matrix; diagram vocabulary = boxes / layers / swim-lanes / flow / relationships / evidence. No decorative infographics, arrows, or icons.

**Publication + engineering invariants**: author in an editable format FIRST (DOCX / Markdown / LaTeX); **PDF is always derived, never authored**. Engineering diagrams are SVG (editable, version-controlled), never PNG. Images only for cover / dividers / conceptual illustration; everything else is vector.

**AI production rules** (`CDS_PRODUCTION_RULES` — the publications-layer agent.md): one page = one page (no contact sheets); never rasterize text or embed paragraphs in images; numbered figures; all documents derive from the master template + this system; publication style, not presentation style; **white papers precede standards; standards precede implementation**.

**Series numbering** (`CDS_SERIES`): CCS · PP (Polity Papers) · CCRL (Research Reports) · REG (Registry Specs) · PAS (Passport Specs) · AIG (Agent Specs) — one shared type system.

## What is wired now (this increment)

- **CDS is data, not prose** — `constitutionalDesignSystem.ts` encodes every invariant above (order-pinned, canaried).
- **The factory applies it** — `isDocumentProfile()` marks which AR profiles are CDS publications; `buildCdsProductionGuidance()` injects the editorial arc + production rules into a delegate's production prompt. `delegateProduce` appends it for document-class artifacts, so a delegate producing a document natively (e.g. Aletheon drafting CCS-000) yields standards-grade, CDS-consistent output automatically.

## The factory — what's proposed (operator steer)

The full Constitutional Publishing Factory = the above PLUS:
1. **Master template + engineering figure libraries** (SVG components for the seven figure types).
2. **Document numbering + series registry** as first-class records (CCS-00N, PP-N, REG-N …).
3. **Review workflow** = AR's `review` → `verification` stages configured per series (the `standard` profile's `reviewGates` already name `editorial` + `normative-consistency`).
4. **CDS wired into the AR profile registry** (`services/artifact/profiles.ts`) so each document profile's verifier/distribution reference the CDS + a rendering path (editable-source → derived PDF, never server-side rasterization — see CLAUDE.md's PDF-on-Lambda prohibition).
5. **CCS-000 becomes the first factory OUTPUT** — produced by a delegate through the workshop, not authored by hand.

**Recommendation (Aletheon):** pause standalone CCS-000; invest in the factory. Then CCS-000 → CCS-008 (the week's work already outlined all eight) are produced consistently, at leverage.

## Honest limits
- **PROPOSED, v0.1.** CDS is captured + wired into native document production; the master template, figure libraries, numbering registry, and the AR-profile-config wiring are the factory build (operator-gated).
- **CDS governs prose + structure today, not pixels.** A delegate produces CDS-consistent *content + editorial structure*; the visual rendering (serif/sans/grid, SVG figures, derived PDF) is the CPS rendering layer, still to build — and must obey the editable-first / PDF-derived / no-Lambda-rasterization rules.
- **Relationship to CFS-011.** CFS-011 Style Invariants govern generative style broadly; CDS is the *publications* design system specifically. They should reconcile — CDS may become the publications interpretation of the style-invariant substrate.

## Ratification record
- [x] Drafted by Aletheon (ChatGPT), operator-shared 2026-07-11
- [x] CDS v0.1 encoded as data + canary; wired into native document production (`delegateProduce`)
- [ ] Ratify CDS v0.1 into the substrate (operator)
- [ ] The Publishing Factory: master template · figure libraries · numbering registry · AR-profile-config wiring · CDS rendering layer
- [ ] CCS-000 produced as the first factory output
