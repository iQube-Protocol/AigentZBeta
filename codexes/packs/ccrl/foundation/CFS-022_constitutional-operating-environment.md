# CFS-022 — Operation Chrysalis 2.0: The Constitutional Operating Environment (Program of Record)

**Chrysalis Foundation Specification · v1.0 · P0 (program consolidation + reframe) — authored 2026-07-09 per the operator's COE reframe (2026-07-09)**

This is the **program of record**. It reframes and expands the mission of `CFS-015` (Operation Chrysalis 2.0) and folds the companion specs — `CFS-019` (CCRL), `CFS-020` (DCIR), `CFS-021` (Constitutional Civic Futurism / Atlas), and the CDE reliability work — into ONE program with named constitutional workstreams. **It consolidates the roadmap; it does NOT merge the contracts.** Each companion spec keeps its own invariants, ratification cadence, and authority (the "one authoritative location per concern" discipline). When they disagree on sequencing, this document wins; when they define a contract, they win.

Companion / folded specs: `CFS-015` (Chrysalis PRD — mission expanded here), `CFS-016` (deployment), `CFS-019` (CCRL — Research Lab workstream), `CFS-020` (DCIR — interaction substrate workstream), `CFS-021` (Atlas / representation workstream).

---

## 1. The reframe — from AI IDE to Constitutional Operating Environment

Until now Chrysalis 2.0 was framed as a **co-development environment** (an AI IDE). That framing is too small and, as of 2026-07-09, no longer accurate. Chrysalis 2.0 is:

> **The Constitutional Operating Environment for Agentic Work.**
>
> Not just coding. Not just experimentation. Everything an organization does becomes **constitutional objects** — repositories, specifications, research, experiments, documents, canonical assets, prompt libraries, skills, aigents, workflows, policies, standing, publications. Every object has identity, version, standing, authority, dependencies, ownership, provenance, and lifecycle. Every agent works inside constitutional constraints — nothing is *merely prompted*; everything is *governed*.

The product category is closer to **Figma + GitHub + VS Code + Notion + Jupyter + Claude Code + ChatGPT — except every object is constitutional.**

## 2. The dependency graph — the discovery of 2026-07-09

The strategic inversion: we thought the **Atlas** was the deliverable and Chrysalis was the tool. The reverse is true — the Atlas is blocked not by artwork but because **the runtime that should own the artwork does not exist yet.**

```
Chrysalis 2.0 (the Constitutional Operating Environment)
        │
        ▼
Constitutional Runtime            ← reasons, plans, delegates, maintains constitutional state
        │
        ▼
Canonical Invariants              ← the validated constitutional memory (EXISTS — foundation-complete)
        │
        ▼
Composable Assets                 ← THE MISSING MIDDLE (Object Model + Asset Registry + Composition)
        │
        ▼
Atlas Plates                      ← composed, not drawn
        │
        ▼
Picture Book                      ← a downstream publication, once the machine exists
```

**Consequence for priority:** stop expanding the Atlas; build the machine that produces it. The next milestone is not "finish the book" — it is "finish the operating environment that makes producing the book almost routine." That machine then produces research papers, PRDs, software, presentations, experiments, and visual artefacts from the SAME set of persistent invariants.

## 3. Constitutional Composition — the new first-class capability (`CFS-022 §3`)

The runtime must **never repeatedly re-invent canonical components.** It **retrieves** invariant assets, **assembles** them into higher-order artefacts, and **generates only what is genuinely novel.** Composition — not generation — is the default. This improves consistency, auditability, and efficiency, and it is the capability whose absence blocks the Atlas.

```
Request: Create Constitutional Atlas Plate
   ↓ Load Canonical Assets   (Bearing Instrument v1, metaVitruvian v1, Typography v1, Palette v1, Iconography v1)
   ↓ Load Domain Knowledge   (Constitutional Trinity)
   ↓ Compose
   ↓ Validate Against Invariants
   ↓ Publish
   ↓ Registry records provenance, version, standing
```

This is fundamentally different from asking an LLM to "draw another bearing instrument." **Compose-not-generate is a program invariant** (proposed for the substrate as `inv.composition.*`, ratified through CCRL governance, not here).

## 4. Architecture — five pillars, mapped to existing organs (Extend, Don't Duplicate)

None of these is greenfield-by-default. Each is inventoried against the existing organs and enters by composition.

| Pillar | What it is | Existing organs (compose over these) | Honest state |
|---|---|---|---|
| **Constitutional Registry** | The constitutional memory: invariants, identities, versions, standing, provenance | `services/registry/*` (resolver, persistence, mintSaga, publisher, trustScorer, validator, lifecycle, projections); `services/invariants/*` (store, graph, lifecycle, publish, grounding); `services/constitutional/ontologyResolver.ts`; the 130-seed crystal; the Identity & Access Spine | **Strong but fragmented** per-domain — no ONE addressable object registry across all kinds |
| **AgentiQ Runtime** | Reasons, plans, delegates, loads invariants, maintains constitutional state | `modelRouter`, `ontologyResolver`, `types/orchestration.ts` (Aigent Z/C/metaMe, NBEPlan, HandoffPayload), DCIR `stateEngine`, the ICE `stageOrchestrator`, bounded delegation | **Strong** — but state/loading is DCC/research-specific; must generalise across object kinds |
| **Constitutional Workspace** | Where humans + agents collaborate; navigation, bearing, maps | CDE, aigentMe, Studio Composer, CCRL (all DCIR-instrumented); the Bearing Instrument (nav primitive); the representation system | **Surfaces exist; no ONE shell** + unified navigation over all object kinds |
| **Artifact Factory** | Produces documents, code, images, video, presentations, plates, research, PRDs | `implementationPack`, `invariantVideoBrief`, image bundles, `ComposerStudio`, research proposals, coherence engine | **Fragmented per-artifact** producers; no unified Factory; no compose-not-generate discipline |
| **Publication Layer** | Exports: GitHub, PDF, Canvas, Website, Registry, Package, NPM, Atlas | `invariants/publish`, `experiments/publishResult`, `registry/publisherService`, `write-doc` (GitHub), `btc/anchor`, `marketa/publish`, `cartridge/publish-to-cluster`, DVN anchoring, hash-commit | **Strong but fragmented** per-target; no ONE layer with pluggable export targets |

Two capabilities cut across all five: the **Research Lab** (CCRL — foundation-complete, folds in whole) and **Constitutional AI / governance** (the Identity/Access Spine, invariant grounding, DVN receipts, observe-mode discipline — governs every object lifecycle uniformly).

## 5. Gap assessment — what stands between here and the COE

| # | Gap | Depends on | Seeds to reuse | Verdict |
|---|---|---|---|---|
| **G1** | **Constitutional Object Model** — one contract (identity · version · standing · authority · dependencies · ownership · provenance · lifecycle) every object kind implements | — | `types/iqube` (`provenance_receipts`, `charter_version`), `types/{research,invariants,studioArtifact,access,dcir,representation}.ts` | **KEYSTONE** — contract-first, unblocks everything below |
| **G2** | **Canonical Asset Registry** — Bearing v1, palette, typography, iconography, metaVitruvian, invariants registered as first-class versioned objects with standing/provenance | G1 | `services/registry/*`, `services/invariants/store.ts`, the representation interpretations | High leverage |
| **G3** | **Constitutional Composition engine** — retrieve → assemble → validate-against-invariants → publish → provenance | G1, G2 | representation roles/interpretations (composable), `services/invariants/grounding.ts`, coherence engine, ontology resolver | **The missing middle** — confirmed absent |
| **G4** | **Publication Layer unification** — one publish seam, pluggable targets | G1 | the per-target publish routes become adapters | Medium |
| **G5** | **Workspace shell + Factory unification** — one environment + navigation (Bearing/Atlas as the map); Factory as the production front for Composition | G1–G4 | the four DCIR surfaces + Bearing Instrument | Frontier |

Everything else in the vision (chapters 1–12 of the operator's outline) is a *view onto* these five gaps closing over the organs that already exist.

## 6. Sequenced roadmap — the program we complete as Chrysalis 2.0

Phase letters continue the Chrysalis arc; each ratified before build (the D0-first discipline).

| Phase | Content | Gate |
|---|---|---|
| **P0** | **This document** (program consolidation + reframe) + the **Constitutional Object Model contract** (`types/constitutionalObject.ts` + charter section + canaries — contract only, no impl) | Ratify the reframe + the object contract |
| **P1** | **Canonical Asset Registry** — register the assets that already exist (Bearing v1 via the representation system; palette/typography/iconography as RepresentationQubes; invariants as InvariantQubes) as constitutional objects. Reuse `services/registry` + `services/invariants` | After P0 |
| **P2** | **Constitutional Composition engine + first vertical proof** — compose ONE Constitutional Atlas Plate end-to-end from registered assets (Bearing v1 + palette + typography + Trinity domain knowledge) → validate against representation + composition-law invariants → emit provenance. **Compose, not generate.** This is the leverage-point milestone — it proves the machine | After P1 |
| **P3** | **Publication Layer unification** — one publish seam, existing per-target routes as adapters (GitHub / PDF / Atlas / Registry / NPM) | After P1 |
| **P4** | **Workspace shell + Factory unification** — the unified environment + navigation; Factory as the compose front | After P2/P3 |

**The first buildable, highest-leverage increment after this doc is P0's Object Model contract, then the P2 Atlas-Plate composition vertical.** Once P2 lands, the picture book — and every other publication — becomes routine.

## 7. Workstreams under the program (folded, not merged)

| Workstream | Spec (unchanged authority) | Standing in the program |
|---|---|---|
| **Constitutional Runtime & Object Model** | this doc (`CFS-022`) + `CFS-015` | The COE core — P0–P4 above |
| **DCIR — interaction substrate** | `CFS-020` | D0–D2 done; D3 (generic affordance derivations) + D4 frontier (Aigent Z / Marketa / cartridges) outstanding. The runtime's observe→recommend→afford loop |
| **CCRL — Research Lab** | `CFS-019` | Foundation-complete; Phase E remainder (simulations, Layer-III scaffolding); Programme D; folds in as the Research Lab pillar |
| **Constitutional Atlas / Representation** | `CFS-021` | Bearing Instrument v1.0 built; the representation system is the P1 asset source + the Workspace's visual grammar |
| **CDE reliability & infra** | operational | Hang/flicker/env fixes shipping; the CDE is the P0 development surface |
| **Deployment → Orchestration → Sovereignty** | `CFS-015` §Phase 2/3, `CFS-016` | Chrysalis Phase 2 (native deployment + multi-model orchestration) gated on CFS-016 D1 operating history |

The living index of concrete tasks is `CHRYSALIS_WORKSTREAM_TRACKER.md` (this doc is the *why*; the tracker is the *what-next*).

## 8. Honest limits

- **"Complete now" = consolidate the program (this doc) + build the keystone contract-first, then sequence the rest.** The full COE is a multi-increment program, not a one-increment build; any claim otherwise would be dishonest. The leverage is real: the P2 vertical (compose one Plate) is close *because* the organs exist — it's an assembly-and-contract problem, not a from-scratch build.
- **The twelve chapters of the operator's outline are named, not designed.** Each chapter's design is part of the increment that builds it — this doc maps them to the five pillars; it does not pre-design them.
- **Composition is compose-first, not generation-banned.** Genuinely novel content is still generated; the discipline is *retrieve canonical, generate only the novel delta* — the `inv.composition.*` invariants that formalise it are proposed through CCRL governance, not asserted here.
- **No contracts were merged.** CCRL/DCIR/Atlas/CFS-016 keep their invariants and ratification cadence; this document consolidates sequencing only.

## Ratification record

- [ ] **P0 (this program-of-record + Constitutional Object Model contract) — AUTHORED 2026-07-09**, awaiting operator ratification. On ratification: the reframe (COE, not IDE) becomes canon; the Object Model contract (`types/constitutionalObject.ts`) is built contract-first (types + canaries, no implementation); CCRL/DCIR/Atlas/CDE are recorded as workstreams of the one program.
- [ ] P1–P4 — each ratified before build.
