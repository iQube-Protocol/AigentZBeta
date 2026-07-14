# IRL-010A — Claims Traceability Matrix v0.1

**Companion to IRL-010 (Constitutional Runtime Technical Specification).** Every substantive claim in the externally shared IRL papers (IRL-000 Founding Prospectus, IRL-001 Foundations, IRL-002 Foundational Validation Series) is classified into exactly one of four evidentiary classes and anchored to its evidence. Claims that currently lack supporting implementation or evidence are **flagged, not defended** — the institute applies the same evidentiary standard to itself that it asks of its hypotheses.

**Classes**
- **I — Implemented in code**: the claim names a mechanism that exists and runs; anchored to source files.
- **D — Experimentally demonstrated**: a measurable result exists in the canonical record (`experiment_results`, content-hashed + receipted); scope and limitations stated.
- **P — Theoretically proposed**: a research hypothesis or design position, presented as such; no empirical claim yet.
- **F — Future work**: named in the papers as direction or ambition; no implementation.

**Flags**: ⚑ = the paper's phrasing is stronger than the current evidence; the precise supportable statement is given.

**Witnessed**: 2026-07-14, against the AigentZ repository. Method: direct code inspection (not recall); anchors verified to exist at witness date.

---

## 1. IRL-001 — Foundations (and IRL-000 where it makes the same claim)

| # | Claim (source) | Class | Evidence / precise statement | Flags |
|---|---|---|---|---|
| 1.1 | "Intelligence is governed by invariant principles" — the central hypothesis | **P** | This is the programme's H0, now with stated disconfirmation conditions (IRL-010 Part VI). It is *not* claimed as demonstrated. | ⚑ IRL-002's "first empirical evidence supporting" is fair only with Part VI's per-hypothesis scoping; H0 itself remains open. |
| 1.2 | An invariant is "a property that remains stable despite variation... the enduring structure beneath changing implementations" | **I** | Operationalized as `InvariantRecord` (`types/invariants.ts:156`): versioned, provenance-bearing, typed, lifecycle-governed, with contradiction counting and supersession. Definition ratified in CFS-001. | The papers give no formal definition; IRL-010 §2.1 now does. |
| 1.3 | Two complementary invariant classes: structural + constitutional | **I / P** | Implemented as the 12-namespace ontology (structural: reasoning/engineering/style/narrative/...; constitutional: constitutional/sovereignty/...) with per-namespace composition laws (`COMPOSITION_LAWS`, CFS-013). *As a claim about intelligence*, it remains P. | Category distinction (descriptive vs normative) made explicit in IRL-010 Part I. |
| 1.4 | Discipline standard: observable, measurable, falsifiable, experimentally validated, evidence-generating deployments | **I** | Mechanically embodied: `timesContradicted` counter + rejected/deprecated lifecycle; canonical results store with content hashes; receipts on deployments; remediation fork on failed validation. Falsification framework now explicit (IRL-010 Part VI). | ⚑ Before IRL-010, falsification conditions were implicit — the reviewer was right. |
| 1.5 | Constitutional primitives: Identity ("establishing persistent continuity across interactions") | **I** | Identity spine (`services/identity/getActivePersona.ts`, persona/delegate model, T0/T1/T2 tiers, canary tests) — and, for the *continuity* half of the claim, see 1.5a: what persists is the individualized constitutional subject, not an exposed identity. | Correction 2026-07-14 (operator): an earlier draft of this row marked "identity continuity" as future work — wrong framing. The continuity primitive exists; it is *personhood* continuity (Law XIII), of which identity is the optional downstream label. |
| 1.5a | Personhood continuity without identity exposure — "a constitutional subject persists across time and interactions; identifiability is a separate, optional property layered on top" | **I** | **Ratified constitutional law (CFS-009 Law XIII: personhood → individualization → standing; identity an optional derivative of individualization)**, implemented end-to-end: personhood proof via World ID nullifier persisted one-per-(action,human) (`services/passport/personhoodProof.ts`); Kybe DID continuity root held T0 (`rootDid`, `did:fio:`/`did:iq:`), outward existence only as T2 alias commitments; `kybeAttestation` revealed only via explicit `discloseCredential()`; Polity Passport issuance/status machine/locker (`services/passport/*`); standing accrues to the continuous subject. IRL-010 §2.11. | **Canonized 2026-07-14** (operator ratification, verified in the operational store): constituent statements `inv.constitutional.063–067` + binding law `inv.constitutional.130`, all `canonical`/`document_verified`. The constitution↔canon loop is closed: the law is ratified (CFS-009), implemented (IRL-010 §2.11), and grounds reasoning via the canonical invariant slice. |
| 1.6 | Privacy-Preserving Identifiability | **I** | T2 commitment scheme (`sha256(namespace + id)[0:16]`), alias commitments on invariants/receipts, T0 serialization bans enforced by tests. | |
| 1.7 | Standing ("earned constitutional reputation through consequential behaviour") | **I** | CVS accrual to producing delegates (operational +2 / constitutional +5), trust bands L1–L5 with fixed thresholds, dual delegation gate, receipted admin accelerator. Invariant-level standing: Law XII standing/reach split on every record. | |
| 1.8 | Delegation ("bounded transfer of authority without surrendering responsibility") | **I** | Persona↔delegate assignments; band-gated grants (L1/L2 grantor-only bootstrap, L3+ requires the delegate's own earned ceiling); all grants receipted. | |
| 1.9 | Authority | **I** (partial semantics) | Authority expressed through the access spine (`evaluateAccess`) + delegation bands; a distinct "authority" object beyond those two does not exist. | ⚑ Papers list it as a separate primitive; implementation composes it from identity+delegation+standing. |
| 1.10 | Accountability / Receipts ("verifiable evidence of consequential actions") | **I** | Unified receipt writer; DVN (ICP) anchoring with explicit state machine and loud failure; Bitcoin anchoring; experiment publications receipt-carried with content hashes. | |
| 1.11 | Consequence | **I** | Consequence ladder on all artifacts (disposable/operational/constitutional, never born constitutional); consequence modeling stage + validation fork + deploy threshold (`validationRequiresRemediation`, `constitutionalThresholdMet`). | |
| 1.12 | Registry ("durable constitutional memory and provenance") | **I** | Invariant substrate + collections + InvariantQubes; artifact records + publication register; canonical asset registry; iQube registry. | |
| 1.13 | Production ("approved intent → accountable artifacts through consequence-aware execution") | **I** | The AR/CPS seam: `runArtifact`/`saveArtifactRecord`, tiering classifiers on every production route, promotion receipted. | |
| 1.14 | Constitutional Economics ("incentives aligned around constitutional correctness") | **I (early) / P** | CVS is the working incentive object (accrual only for validated/consequential work); Q¢ ledger exists as platform economics. A full constitutional-economics mechanism (markets, pricing of standing) is P. | ⚑ Papers list it alongside mature primitives; it is the least developed of the ten. |
| 1.15 | Coordination | **P** | Multi-agent coordination exists operationally (orchestration events, QubeTalk, capability routing) but is not yet formalized as a constitutional primitive with its own invariants. | ⚑ |
| 1.16 | "Constitutional Runtime... continuous constitutional feedback loop" (IRL-000 ch.5) | **I** | The 10-stage pipeline + receipts + standing + observer seams (IRL-010 Part III flow). The papers call it "a reference architectural concept, not a product" — the implementation is now concrete enough to specify (IRL-010). | |
| 1.17 | Hybrid Intelligence as primary paradigm; mutual amplification | **P** | Design posture across the platform (human approval gates, D1 execution model); not itself an empirical claim yet. | |
| 1.18 | Constitutional Cybernetics | **F** | Named as the next discipline; a charter exists internally (CFS-020 DCIR is adjacent); no implementation claim. | |
| 1.19 | Knowledge compression / invariant extraction as the mechanism of enduring knowledge | **P / D (early)** | EXP-003 demonstrates the *reuse* half (initialization from compressed knowledge reduces rediscovery). *Extraction* (machine-derived invariant candidates from experience) is P — current invariants are human-ratified. | ⚑ "Invariant extraction" reads as automated; today it is a governed human+agent process. |
| 1.20 | Laboratory cycle: observation → hypothesis → validation → primitive → architecture → platform → refinement | **I** (as process) | The CFS ratification discipline + experiment records + Chrysalis tracker enact this cycle; CCE-006 is a full loop instance. | |

## 2. IRL-002 — Foundational Validation Series

| # | Claim (source) | Class | Evidence / precise statement | Flags |
|---|---|---|---|---|
| 2.1 | EXP-001: "invariant-grounded knowledge maintained semantic coherence... perfect constitutional restraint and zero adjudicated hallucinations" | **D** (scoped) | Canonical run in `experiment_results`; protocol: 18-invariant collection, 4 artifacts, 15 questions, per-question judge (consistency/correctness/hallucination) + per-document contradiction judge (0/1/2) — `services/experiments/exp001.ts`, config + protocol files in the experiment record. **Precise statement**: zero hallucinations *flagged by the stated LLM-judge protocol in the published run*. | ⚑ "Adjudicated" must be read as *LLM-judge-adjudicated, internally configured*; no human panel, no control (ungrounded) arm yet, n=1 run. IRL-010 Part V states this. |
| 2.2 | EXP-002: temporal coherence maintained; "a measurable property rather than a subjective judgement" | **D** (scoped) | Invariant-grounded briefs (`invariantVideoBrief.ts`) + coherence engine dimension scores; control = brief-less generation. Measurability claim is supported (scores + violations exist); superiority claim is within-provider, internal runs. | |
| 2.3 | EXP-003: "26.7% reasoning efficiency gains while maintaining 100% grounded reasoning" | **D** (scoped) | Published run in `experiment_results` (serialized raw results incl. per-task token counts, content-hashed). Baseline = cold arm (same 5 tasks, same provider/model/token ceiling — `exp003.ts:72`); tokens are provider-reported usage. **Precise statement**: 26.7% aggregate output-token reduction, initialized vs cold, in the published run; every initialized answer cited collection markers. | ⚑ n=1 published run: no variance bands; 5 tasks; token count is a cost proxy. The full technical report Austin requested is producible from the canonical row + config + service code — nothing needs to be reconstructed from memory. |
| 2.4 | EXP-004: "constitutional operation remained portable across multiple providers... can exist independently of any individual frontier model" | **D** (scoped) | Sovereignty drill (5 grounded tasks + pack generation) on substituted providers; completion + degradation reported; Sovereignty Scale rung named per run (S2/S3 measured; S4/S5 explicitly unmeasured apex tiers). | ⚑ The reviewer's alternative ("any provider-agnostic prompt scaffold") is adopted as the H4 control (IRL-010 Part VI): the scaffold-only control run is outstanding. Until it runs, the defensible claim is portability of the *full receipted pipeline*, not superiority over plain scaffolds. |
| 2.5 | "First empirical evidence supporting... Invariant Intelligence"; "do not establish immutable laws; establish the first experimental framework" | **D / P** | The framework claim is I/D (infrastructure + 4 canonical experiment records exist). The IRL-002 text itself already disclaims law-status. | Fair as written, given Part VI scoping. |
| 2.6 | "Full technical report available upon request" | **I** (now) | IRL-010 Parts III–V + per-experiment records + canonical result rows constitute it; per-experiment deep reports can be generated from the canonical rows (raw serialized results are stored, not summarized). | Previously a promise; now anchored. |

## 3. IRL-000 — Prospectus platform claims

| # | Claim | Class | Evidence | Flags |
|---|---|---|---|---|
| 3.1 | AgentiQ (compositional/hybrid intelligence environment) | **I** | The AigentZ platform: cartridge/codex system, orchestration (Aigent Z routing), capability pipeline. | |
| 3.2 | metaMe (constitutional runtime centred on human agency) | **I** | metaMe runtime surfaces (aigentMe, capsule/layout contract, approval-gated NBE execution, receipts/ledger). | |
| 3.3 | The Registry (persistent constitutional memory) | **I** | Invariant substrate, iQube/artifact registries, publication register. | |
| 3.4 | Polity Passport | **I** (alpha) | Passport surfaces + personhood verification (World ID integration), locker with T2 identifier isolation. | |
| 3.5 | Standing platform | **I** | See 1.7. | |
| 3.6 | Constitutional Commerce | **I (early) / P** | Q¢ pricing rails, cart/multi-rail payments, KNYT commerce exist; *constitutional* commerce (standing-mediated exchange) is P. | ⚑ |
| 3.7 | Venture Studio translation pipeline (discovery → primitive → platform → venture) | **I** (as operating model) | Enacted: e.g. invariant substrate (discovery) → grounding/composition (primitives) → video-article & research surfaces (platform capabilities) → KNYT/Venture Lab (ventures). Not an empirical claim. | |
| 3.8 | GDPR/BSI/standards lineage & founder history | **—** | Biographical/historical; outside code-witness scope. Operator-attested. | |

## 4. Claims with NO current implementation or evidence (honest register)

| Claim | Where it appears | Status |
|---|---|---|
| Machine-automated invariant *extraction* from experience | IRL-000 ch.3, IRL-001 | Future work (extraction today is governed human+agent ratification) |
| Constitutional Cybernetics as a discipline | IRL-000 ch.5 | Future work |
| External validation: peer review, third-party replication, named pilot counterparties | Reviewer request | **None yet.** All four experiments designed, run, evaluated and adjudicated internally. This is the programme's most important open obligation; H1–H5 controls (Part VI) are written to be runnable by outsiders. |
| Filed IP | Reviewer request | Outside code-witness scope; operator-held answer. |
| Multi-run statistics / variance for headline numbers | EXP-003 26.7%, EXP-001 zero-hallucination | Outstanding; infrastructure supports repetition today. |
| Ungrounded control arm for EXP-001; scaffold-only control for EXP-004 | IRL-002 findings | Outstanding; specified as the H1/H4 controls in IRL-010 Part VI. |

---

## 5. Reading guide for reviewers

The shortest honest summary of this matrix: **the constitutional primitives layer is real** (class I, heavily anchored — identity, standing, delegation, receipts, consequence, registry, production); **the experimental findings are real but young** (class D with n=1 runs, internal adjudication, and two named missing controls); **the central scientific hypothesis is open by design** (class P, now with explicit disconfirmation conditions); and **the papers occasionally use discovery language for what is currently governed engineering** (each instance flagged ⚑ above, with the precise supportable statement).
