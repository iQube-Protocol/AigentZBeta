# CFS-038 / PRD-CCR-001 — The Constitutional Coordinates Registry (CCR)

**Status:** Architectural Foundation — **RATIFIED 2026-07-28** by operator act `ACT-IRE-FAMILY-2026-07-28`, decision id `CFS-038`.

> **What was ratified, and against which bytes.** The operator approved **one act covering CFS-037, CFS-038, CFS-039, CFS-040 and CFS-041**, each document enumerated independently — *"One act may contain five document commitments, but each document must remain independently attributable and recoverable."* **No aggregate family hash exists**, deliberately: a family hash would make one document unrecoverable without the other four.
>
> This document was frozen at `sha256:82295fe9f8891db36b4db138f4ea3d8ad2f026e45a69541dbf6ba6e8913cf5dc` — its bytes **after** the IRE→IPE consistency corrections required by the same disposition (*"Before signing, update any text that is already contradicted by the now-landed IRE→IPE binding"*) and **before** this status block was rewritten to record the act. A sha256 cannot commit to bytes that contain it, so the frozen hash is necessarily the pre-record hash; the post-record (`as-recorded`) hash of every one of the five is enumerated in `codexes/packs/polity-core/items/AMENDMENT_RECORDS.md`, which is also the ledger row for this act.
>
> **The 2026-07-17 attestations are NOT the basis of this act.** Five contemporaneous records attest an operator ratification that day (`be5942ae4`; `2026-07-17_ire-prd-family-phase0-builds.md`: *"All four ratified. Build all 4"*; `CHRYSALIS_WORKSTREAM_TRACKER` row 99), and **every one is an agent transcription**, which Law XI does not permit an agent to promote on. What unblocked this is the operator supplying the act directly on 2026-07-28. The transcripts remain corroboration of intent and are not the authority.

**Classification:** Constitutional Runtime Primitive (the field's basis governance).
**Designation:** IRL ratified-spec filing of **PRD-CCR-001** (the PRD family, §9 of CFS-037).
**Dependencies:** CFS-037 (IRE — consumes the coordinates + the library), CFS-002 (iQube ontology — the axes this extends), `types/registry-canonical.ts` `IQubeScoreBlock` (the calibrated-axis pattern), `services/invariants/resolution.ts` (`UNIVERSAL_INVARIANT_LIBRARY`).

---

## 0. Why the CCR exists

CFS-037 introduced two things the IRE needs but does not itself govern: the **Universal Invariant Library** (16 baseline nodes) and the **Constitutional Coordinates** (three classes). Both are *candidate* today — unseeded, provisional. The CCR is their governance home: it **defines** the coordinate basis, **seeds** the library, and owns the **stable-operational-basis vs evolving-research-basis** split (Aletheon) so the runtime stays stable while the science evolves underneath.

Discipline (unchanged): code is truth; extension not replacement; ratify before build; the coordinate basis is *provisional and evolves through research* — the runtime never assumes it is final.

---

## 1. The two registries in one

### 1.1 The Coordinate Basis Registry
The canonical, ratified set of coordinate **basis vectors** — the axes every invariant/intent/iQube/agent is located against. Three classes (CFS-037 §5), each vector carrying: `key`, `class` (structural | constitutional | operational), `question`, `range` (`[0,1]`), `basis` (how it is derived), `status` (candidate | ratified | deprecated), and — critically — a `stability` flag:

- **operational basis** = ratified, stable, the runtime computes against it every request;
- **research basis** = under IRL test (redundancy / emergence / domain-specific additions) — computed in shadow, never load-bearing until promoted.

The IRL can add, deprecate, or split a vector **only** through a ratification ceremony (Law XI applied to the basis) — exactly as invariants are governed. The `types/registry-canonical.ts` `IQubeScoreBlock` already models "calibrated axes with `_source: derived | operator_override` + `derivation_strategy`" — the CCR **lifts that pattern to the basis level** (extension, not replacement).

### 1.2 The Universal Invariant Library Registry
The 16 baseline invariant nodes (CFS-037 §4), seeded into the crystal as candidates and ratified through the standard process. Named once here so `resolveConstitutionalField`'s universal pass grounds in the **real library** instead of the `constitutional/epistemology` proxy it uses today (CFS-037 §3.2 honest limit).

---

## 2. The coordinate basis (candidate — for ratification)

| Class | Vectors (candidate) | Notes |
|---|---|---|
| **Structural** (describe the problem; actor-independent) | Complexity · EvidenceDensity · Uncertainty · Sensitivity · Risk · Scope · Verifiability | The four native iQube axes (sensitivity/verifiability/accuracy→uncertainty/risk) become structural vectors — **not new inventions**, they are `IQubeScoreBlock` axes generalised. |
| **Constitutional** (describe the relationship; vary by actor/org/polity) | Authority · Standing · Delegability · Consent · Accountability · Sovereignty · IdentityProtection · Trust · PersonhoodImpact | Need actor context — the IRE carries these **null** until the CCR supplies the basis (never faked, CFS-037 resolution.ts). |
| **Operational** (describe execution economics) | TimeToValue · RepairCost · ReusePotential · AutomationPotential · KnowledgeCoverage | Field-level; the IRE already estimates coverage/reuse/ttv with named proxy bases (Phase 0). |

Each vector's precise derivation (`basis`) is ratified here, so calibration is never an invented number.

## 3. The Universal Invariant Library — seeding path

The 16 nodes (`UNIVERSAL_INVARIANT_LIBRARY` in `resolution.ts`) seed as **candidate** invariants under a dedicated namespace — proposed `inv.universal.<n>` (or mapped onto existing namespaces where a node already exists, e.g. `personhood`→`inv.constitutional.130` family, `standing`→the standing invariants, `evidence`/`verifiability`→`inv.epistemology.*`). The CCR's first job is the **reconciliation pass** (CS-001 discipline): for each of the 16, either bind to an existing canonical invariant or seed a new candidate — never duplicate. Only after that pass does the IRE's universal grounding switch from the proxy namespaces to the library.

**Operator step (when ratified):** the reconciliation table → seed additions in `canonical-invariants.seed.json` + `appendix-a` (same-commit rule) → `node scripts/ingest-canonical-invariants.mjs` → ratify. Deliberately NOT done in this spec (ratify-before-seed; the reconciliation must be reviewed to avoid duplication).

## 4. Constitutional space — what the basis enables

Once coordinates are a governed basis, the runtime operates in **constitutional space** alongside semantic (embedding) space:
- **Field navigation** (not keyword/vector search): "which iQubes/agents/workflows occupy this region?"
- **Topographic reasoning**: follow gradients — minimise RepairCost, maximise EvidenceDensity, increase Standing.
- **Constitutional proximity**: distance in coordinate space as a first-class retrieval signal (the KRE, CFS-040, consumes this).
- **Field dynamics**: movement over time → a natural basis for progressive sovereignty + standing evolution (the CFS-019 Field Theory measurements get their coordinate system here).

## 5. Governance — stable vs evolving

- The **operational basis** changes only by ratification; downstream (IRE calibration, KRE proximity, IPE projection) computes against it and can rely on its stability.
- The **research basis** is where the IRL tests whether a vector is redundant (two vectors always co-vary), whether a new dimension emerges, or whether a domain needs extra vectors (healthcare→ClinicalSafety, legal→Jurisdiction). Research vectors compute in shadow; promotion to operational is a ratification.
- This is the CFS-031 cybernetic loop applied to the *basis itself* — the field's own axes evolve through evidence, not opinion.

## 6. Build plan (ratify-before-build)

- **Phase 0:** the coordinate basis as a ratified data structure (`services/invariants/coordinates.ts` — the vector definitions + `status`/`stability`), consumed by `resolution.ts`'s calibration (replacing the inline structural set). Node-verifiable, no DB.
- **Phase 1:** the Universal Invariant Library reconciliation + seed (§3) — the IRE universal pass goes real.
- **Phase 2:** constitutional-class coordinate derivation (needs actor context from the identity spine) — the IRE's null constitutional coordinates become computed.
- **Phase 3:** constitutional-proximity as a retrieval signal (feeds KRE + CFO).

## 7. Honest limits

- **The basis is provisional.** Every vector is a candidate; none has an operationalised metric yet (CFS-019 Field Theory measurements are named, not computed).
- **The 16-node library is unseeded** and requires the reconciliation pass before it can replace the proxy grounding — done under ratification, not here.
- **Constitutional-class coordinates need actor context** (identity spine) and stay null until Phase 2 — the IRE never fabricates them.
- This spec seeds no invariant and gates no Chrysalis deliverable (CRP-001 interface rule).

## Ratification record
- [x] **RATIFIED 2026-07-28** — authored as the PRD-CCR-001 filing, third of the CFS-037 PRD family. Ratified in full — the numbered items below are what the operator approved: (1) the three-class coordinate basis (§2); (2) the Universal Invariant Library seeding path (§3); (3) the stable-vs-research basis governance (§5).

  Authority: operator act `ACT-IRE-FAMILY-2026-07-28`, decision id `CFS-038`, authority basis **Law XI — amending canon is an operator act**. Frozen content hash `sha256:82295fe9f8891db36b4db138f4ea3d8ad2f026e45a69541dbf6ba6e8913cf5dc` (bytes after the IRE→IPE consistency corrections, before this record was written). Ledger row: `codexes/packs/polity-core/items/AMENDMENT_RECORDS.md`. The 2026-07-17 agent transcriptions are corroboration of intent, never the authority (Law XI).

- [ ] **DVN anchoring outstanding** — the act is recorded through `POST /api/governance/ratify`, which writes the `governance_ratifications` row, invokes `createGovernanceReceipt` and enters the DVN pipeline. Until an operator runs it, this document's ratification exists in the repo ledger and not yet on chain.
