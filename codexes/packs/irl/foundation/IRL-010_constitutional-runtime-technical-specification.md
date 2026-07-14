# IRL-010 — The Constitutional Runtime: Technical Specification v0.1

**Reference Architecture, Runtime Model, Experimental Methods & Falsification Framework**

| | |
|---|---|
| **Status** | DRAFT v0.1 — implementation-witnessed |
| **Date** | 2026-07-14 |
| **Audience** | Technically sophisticated external reviewers (investors, research collaborators, engineers) who have requested implementation detail rather than conceptual framing |
| **Witness method** | Every claim in Parts II–IV and VII is anchored to a source file in the AigentZ repository as it exists at the date above. Nothing in those parts describes *intended* architecture. Where a capability is partial or proposed, it is labelled as such. Part V describes the experimental methods as actually implemented, including their limitations. |
| **Relationship to the IRL papers** | IRL-000 (Founding Prospectus), IRL-001 (Foundations of Intelligence) and IRL-002 (Foundational Validation Series) establish *why*. This document establishes *how*. The claims-level reconciliation between the papers and the implementation is IRL-010A (Claims Traceability Matrix), maintained alongside this specification. |
| **Internal spec lineage** | This document is the external projection of the internal CFS series (CFS-001 Invariant Primitive, CFS-002 Ontology, CFS-003 Graph, CFS-006 Adaptive Runtime, CFS-008 Reasoning Compression, CFS-013 Composition Laws, CFS-014 Coherence Engine, CFS-016 Constitutional Deployment, CFS-018 Platform Sovereignty, CFS-019 IRL Charter, CFS-028 Capability Graph, CFS-029 Constitutional Capability Pipeline). Where this document compresses, the CFS documents carry the full decision history. |

---

## Part I — Scientific Context (why this document exists)

The IRL papers advance one central hypothesis: **intelligence is governed by discoverable invariant principles**, in two complementary classes — *structural* (how intelligence computes, compresses, composes) and *constitutional* (how intelligence establishes identity, authority, standing, accountability and consequence when operating among others).

This document does not argue that hypothesis. It specifies the apparatus built to test it: a **Constitutional Runtime** — a production software system in which invariants are first-class, versioned, provenance-bearing computational objects; in which reasoning calls are initialized from validated invariant collections; in which consequential actions produce receipts, accrue standing, and are gated by consequence evaluation; and in which the experiments of the Foundational Validation Series run against the same substrate the platform itself uses.

Two category distinctions govern everything that follows (they answer the most common category error made when reading the papers):

1. **Structural invariants are descriptive hypotheses; constitutional invariants are normative design choices.** The runtime does not claim its constitutional primitives are laws of nature. The experimental claim is narrower and testable: *treating constitutional principles as computational primitives produces measurable computational properties* (fidelity, coherence, efficiency, portability) *that unconstrained baselines do not exhibit*. The experiments test that claim, not the metaphysics.
2. **Compliance testing and discovery are different activities, and the runtime does both.** Canary tests that pin the runtime's own contracts are engineering QA. The Foundational Validation Series experiments are the discovery instrument: they measure properties (grounding rates, token economics, cross-provider survival) that were not designed outcomes and could have come out the other way. Part VI states, per hypothesis, what result would count against us.

---

## Part II — Formal Definitions (from the implementation, not aspiration)

The definitions below are the *actual stored representations*. Type excerpts are quoted from the repository; field-level semantics carry the internal spec reference that ratified them.

### 2.1 Invariant

An **invariant** is a versioned, provenance-bearing, typed computational object representing a validated knowledge claim, which participates in constitutional composition. Canonical representation (`types/invariants.ts`; persisted by migration `supabase/migrations/20260703200000_invariant_substrate.sql`):

```ts
export interface InvariantRecord {
  id: string;
  seedId: string | null;              // stable id in the seed crystal
  statement: string;                  // the claim, in natural language
  namespace: InvariantNamespace;      // 12 namespaces (see 2.2)
  ontologyClassId: string | null;     // position in the ontology (CFS-002)
  semanticType: InvariantSemanticType | null; // principle|constraint|definition|heuristic|law|epistemic
  status: InvariantStatus;            // draft|proposed|validated|canonical|rejected|deprecated|superseded
  confidence: number;
  confidenceBasis: InvariantConfidenceBasis;  // document_verified 1.0 | principal_verified .85 | agent_verified .6 | unknown .3
  standing: number;   // Law XII: constitutional confidence from VALIDATION-class signals only
  reach: number;      // Law XII: adoption (references + usage) — orthogonal to standing, never conflated
  timesValidated: number;
  timesContradicted: number;
  timesReferenced: number;
  timesUsed: number;
  version: number;
  supersedesId: string | null;        // immutable versioning: supersede, never mutate
  ratifiedSource: string | null;      // which CFS/operator ratification admitted it
  provenance: Record<string, unknown>;
  reasoningProvenance: Record<string, unknown>;
  creatorAliasCommitment: string | null;  // T2-safe commitment — never a raw identity
  dvnReceiptId: string | null;        // decentralised-verification anchor, when anchored
  createdAt: string;
  updatedAt: string;
}
```

**Formal definition (the direct answer to "what *is* an invariant, computationally?").** An invariant is a 6-tuple:

```
I = (S, E, C, V, P, L)

  S — statement          the claim (natural language today; a typed proposition in IRL-011)
  E — evidence           validation/contradiction accumulators → the epistemic ledger
                         (timesValidated, timesContradicted, confidenceBasis)
  C — confidence         C ∈ [0,1], seeded by confidenceBasis (the ladder in §2.1)
  V — version            monotonic; revision is supersession (V→V′ via supersedesId), never mutation
  P — provenance         ratifiedSource + provenance/reasoningProvenance (who admitted it, and why)
  L — composition law    L = COMPOSITION_LAWS[namespace(I)] — how I may legally combine (§2.2, CFS-013)
```

Two derived scalars ride on top of the tuple and are **kept orthogonal** (Law XII):
`standing(I)` — constitutional confidence from validation-class signals in E; and
`reach(I)` — adoption from `timesReferenced`/`timesUsed`. Popularity (reach) can never raise standing.

From the primitive, three operators (their signatures; the algebra and semantics are IRL-011's subject):

```
Collection    K = {I₁, …, Iₙ}                    an ordered, curated set (or a retrieved slice)
Compose       Compose(K) → Artifact              legal under ⋀ L(Iⱼ); rejects if any law is weakened (§4.4)
Retrieve      Retrieve(context) → K ⊆ Crystal    ranked by (standing, confidence, reach); the grounding slice (§4.1)
Evaluate      Evaluate(Artifact) → Score         the Constitutional Coherence Engine / judge (§4.3, §V)
```

This compact algebra answers Austin's first question ("what exactly is an invariant") precisely; the **full formal theory** — typed statements, the composition algebra's identities, runtime semantics, the coherence calculus, complexity bounds, and the relationship to statistical inference — is the subject of the companion **IRL-011 (The Computational Model of Invariant Intelligence)**. IRL-010 specifies the *system*; IRL-011 specifies the *theory*. This document deliberately stops at the tuple and the operator signatures.

Three properties make this an *invariant* rather than a database row of text:

- **Lifecycle with disconfirmation built in.** `status` walks draft → proposed → validated → canonical, and can be *rejected*, *deprecated*, or *superseded*. `timesContradicted` is a first-class counter. An invariant that accumulates contradictions is demoted, not defended.
- **Standing ≠ reach (Law XII, CFS-009 amendment).** Popularity cannot manufacture epistemic weight: validation-class signals move `standing`; citation/usage move `reach`; the two are stored and scored separately.
- **Immutability by supersession.** Statements are never edited in place; a revised claim is a new record pointing at its predecessor via `supersedesId`.

### 2.2 Namespaces, ontology, and composition laws

Invariants live in one of **12 namespaces** (`constitutional, reasoning, engineering, experience, capability, style, narrative, sovereignty, cybernetics, interaction, epistemology, representation` — `types/invariants.ts:17-33`), positioned in an ontology (`OntologyClassRecord`; runtime resolver `services/constitutional/ontologyResolver.ts`). Each namespace carries a **composition law** (`COMPOSITION_LAWS`, `types/invariants.ts:66`; CFS-013) that governs how its members may be combined (e.g. constitutional invariants compose *normatively* — a composition may not weaken them; style invariants compose *contextually*). Five namespaces added 2026-07-13 carry provisional laws pending ratification — the record says so in place.

### 2.3 Invariant graph

Typed, weighted edges between invariants (`InvariantEdgeRecord`) drawn from **12 canonical edge types** (`derives_from, enables, constrains, contradicts, supersedes, generalizes, specializes, depends_on, supports, validates, explains, composes` — CFS-003 §2), with an enforced acyclicity subset (`ACYCLIC_EDGE_TYPES`) and bounded traversal (`TraversalOptions`: default depth 4, hard cap 8). Implementation: `services/invariants/graph.ts`.

### 2.4 Invariant Collection and InvariantQube — the curated reasoning substrate

- **Collection** (`InvariantCollectionRecord`): a curated, ordered set of invariants — the unit experiments initialize from.
- **InvariantQube** (`InvariantQubeRecord`, CFS-004): the *published* form — a versioned package whose `manifest` embeds member statements, the internal edge subgraph, contexts, **aggregate confidence computed weakest-link** and aggregate standing. This is the "compressed expertise" object the papers call a KnowledgeQube in prose.

**The iQube proposition — curation, not accumulation.** The `Retrieve` operator of §2.1 is not document retrieval; it is **intent-guided constitutional curation**. Operator intent selects *which* validated invariants, constitutional principles, and capability evidence should be curated into the reasoning substrate — and the unit being curated is a validated **invariant**, not a document. This is the distinction that differentiates the platform:

```
RAG                                     iQube
"What documents are relevant?"          "What validated invariants should
retrieval of information                 this reasoning begin from?"
                                        intent-guided curation of intelligence
```

The composite object, formally (the tuple of §2.1 lifted to the curated set):

```
iQube = Intent + CuratedInvariants + ConstitutionalProvenance + Standing
      = (goal, K ⊆ Crystal ranked by merit, P over K, standing over K)
```

An iQube is therefore a **curated reasoning substrate purpose-built around intent**, not a knowledge container — its value is set by curation quality, not by quantity of contained information. The open scientific question this frames (a candidate first-class research primitive, not just editorial practice): *what is the smallest curated set of validated invariants that solves a class of problems at maximum fidelity and minimum reasoning cost?* — the **minimum sufficient constitutional substrate**. Part V (EXP-003) is the first measurement bearing on it, and its result already points one way: **curation dominates accumulation** (the breadth arm — `experiments/exp-003-rediscovery-savings/breadth-arm.md`).

### 2.5 Constitutional Runtime (operational definition)

The Constitutional Runtime is not one program. It is the **set of enforced seams** through which consequential activity must pass:

> intent capture → context/grounding (invariant slice) → capability evidence → consequence modeling → constitutional decision → production through the artifact seam → constitutional validation (with remediation fork) → receipt → standing accrual → observation feeding the next cycle.

Each seam names one canonical implementation (Part III). "Enforced" means: parallel paths are treated as defects (the CS-001 defect class, "Duplicate Capability as Constitutional Drift"), tests pin the seams, and the platform's own surfaces are migrated onto them.

### 2.6 Constitutional Receipt

An append-only evidence record of a consequential action (`services/receipts/activityReceiptService.ts`), carrying action type, T2-safe summary and context, and eligible for cryptographic anchoring: the DVN pipeline (`services/dvn/activityReceiptDvnPipeline.ts`) submits receipt hashes to an ICP canister with an explicit state machine (`local → dvn_pending → dvn_recorded | dvn_failed`), and anchoring extends to Bitcoin via the ops anchoring path. A failed anchor is surfaced, never silent. Experiment publications produce a dedicated receipt class (§3.13).

### 2.7 Identifier tiers (T0/T1/T2)

Every identifier in the system is classified: **T0** server-internal (persona, auth profile, root DID — never serialized outward), **T1** browser-safe session projections, **T2** public-network commitments — one-way hashes with namespace prefixes, e.g. `sha256('hms:locker:' + caseId).slice(0,16)`. Only T2 values may appear in receipts, chain records, or telemetry. This is the *privacy-preserving identifiability* primitive of the papers, as code.

### 2.8 Standing (agent/delegate form)

Earned constitutional reputation: consequential production accrues Constitutional Value Score to the *producing delegate* (operational work +2, constitutional work +5), mapped to trust bands with fixed thresholds (L2 ≥ 20, L3 ≥ 50, L4 ≥ 75, L5 ≥ 100 — `trustBandCeilingFor`). Delegation of L3+ authority is **dual-gated**: grantor reputation AND the delegate's own earned ceiling. Admins may accelerate standing for testing through a *receipted* route (`POST /api/homecoming/agent/standing` — approval receipt first, then accrual). Trust is observable behaviour plus auditable exceptions — not assumed credibility.

### 2.9 CapabilityEvidence and Constitutional Decision (CFS-029)

- **CapabilityEvidence** (`services/constitutional/capabilityEvidence.ts`): the persisted record of *what exists vs what is missing* for a goal — existing capabilities with reuse dispositions (`use_directly | extend | fix`), missing capabilities, boundaries ("should never happen"), keyed by a T2-safe goal hash (`sha256('capability:goal:'+goal).slice(0,16)`), stored in `capability_evidence` with its own receipt, and read back with a 7-day freshness policy (`supplied | persisted-fresh | persisted-stale | none`). Evidence persists; sessions don't.
- **Constitutional Decision** (`services/constitutional/constitutionalDecision.ts`): before any implementation plan is drafted, the realization mechanism is decided from nine mechanisms **plus `none`** ("the capability exists — compose it; build nothing"), with rationale and considered alternatives recorded. A pure heuristic floor guarantees a decision even with no model available.

### 2.10 Consequence classes

Every produced artifact is classified `disposable | operational | constitutional` (`services/artifact/artifactRecordStore.ts`, `profiles.ts`). Disposable is *never persisted*. Nothing is *born* constitutional: promotion is an explicit, receipted operator act. This ladder is the runtime's concrete answer to "consequence as a primitive."

### 2.11 Personhood continuity — Individualization (Law XIII)

A ratified constitutional law of the runtime (CFS-009, Law XIII), and the correction to a common misreading of the identity primitive:

> **Personhood establishes existence. Individualization establishes constitutional continuity. Identity establishes recognizability. Standing establishes constitutional capability.** These are four distinct primitives, not four names for one thing. Personhood precedes individualization; individualization precedes standing; **identity is an optional derivative of individualization** — never a prerequisite for constitutional participation.

What persists across time, interactions, and provider substitutions is therefore not an *identity* (a label) but an **individualized constitutional subject**, isolated continuously without identity exposure:

- **Personhood** — proof a human exists behind the subject, without naming them: World ID verification with a persisted `nullifier_hash` scoping one verified proof per (action, human) (`services/passport/personhoodProof.ts`).
- **Individualization / continuity root** — the Kybe DID (`rootDid`, `did:fio:`/`did:iq:` family) held strictly T0 server-internal; the subject's outward existence is only ever a T2 alias commitment (`creatorAliasCommitment`, `cohortAliasCommitment`) — the same subject is provably the same subject without being nameable (`types/access.ts`).
- **Proportional disclosure** — the KYC-bearing `kybeAttestation` is revealed only through an explicit `discloseCredential()` act, never serialized by default; disclosure is an event with a decision, not a side effect (`types/access.ts:208`).
- **Participation** — the Polity Passport (application → issuance → status machine → locker with T2 identifier isolation; `services/passport/*`).
- **Accumulation** — Standing accrues to the *continuous subject*, not to an exposed identity (§2.8); it is exactly the persistence of the individualized subject that lets validated action compound.

This is the runtime's implemented form of the papers' "Identity — establishing persistent continuity across interactions" and "Privacy-Preserving Identifiability" primitives, stated with Law XIII's precision: continuity is a property of personhood/individualization; identity exposure is optional, downstream, and never required for the continuity to hold.

**The constitutional chain (Law XIII, refined).** The primitives form a single ordered chain of legitimacy — and identity is **not on it**. Identity is a projection *off* individualization, an optional label, never a link:

```
Personhood                          (existence — a human is behind the subject)
    │
    ▼
Individualization ───────────────►  Identity   (optional projection; yields reputation, not standing)
    │
    ▼
Standing                            (earned constitutional capability, from consequential action)
    │
    ▼
Authority                           (bounded, delegated on standing)
    │
    ▼
Consequence                         (receipted, standing-updating)
```

This is why **anonymity and accountability coexist** in the runtime: the chain from personhood to consequence is intact and auditable without identity ever being resolved — accountability rides the individualized subject and its standing, not a name. The chain is already canon: `inv.constitutional.011` (personhood precedes identity), `012` (standing follows action), `013` (authority follows standing), `063` (personhood → individualization → standing; identity an optional derivative), `066` (identity is a branch of individualization, not its gate; it yields reputation, not standing) — the ratified family below binds them.

**Canon registration.** Law XIII's constituent statements live in the canonical invariant seed as `inv.constitutional.063–067`, bound by the law-typed invariant `inv.constitutional.130` (constitutional namespace, semantic type `law`): *"Personhood shall remain continuously individualizable without identity exposure: a constitutional subject persists across time, interactions, and substrates — provably the same subject through personhood proof, a sovereign continuity root, and accrued standing — while identity disclosure remains a discrete, consent-gated act that continuity never requires."* The family was canonized by operator ratification on 2026-07-14 (all six records `canonical`/`document_verified`, `ratified_source` = CFS-009 Law XIII) — the ratification record lives in the canon register (appendix-a). Law XIII therefore exists at all three layers this specification distinguishes: ratified constitutional law, witnessed implementation, and canonical invariants grounding live reasoning.

---

## Part III — Runtime Architecture (what actually runs)

The platform is a Next.js/TypeScript system (AWS Amplify serverless deployment; Supabase Postgres as the canonical store; ICP canister + Bitcoin anchoring for receipts). Subsystems below are listed with principal source files. Status legend: ✅ implemented · ◐ partial · ○ planned.

| # | Subsystem | Principal files | Status |
|---|---|---|---|
| 1 | **Invariant substrate** — store, lifecycle, graph, collections, qubes, measurement | `services/invariants/{store,lifecycle,graph,collections,publish,measurement,comparison}.ts`, `types/invariants.ts`, migrations `20260703200000`, `20260703210000`, `20260713000000` | ✅ |
| 2 | **Grounding & initialization** — invariant slice assembly for reasoning calls; session-start knowledge manifest; usage citation | `services/invariants/grounding.ts` (`buildInvariantSlice`, `initializeKnowledge`, `citeInvariants`) | ✅ |
| 3 | **Sovereign model router** — per-stage provider routing over a ModelQube registry; one seam for LLM calls | `services/constitutional/modelRouter.ts` (`callSovereign`, `callStage`), `modelQube.ts`, `modelQubeStore.ts`, `inferenceProviders.ts`, `sovereignNode.ts` | ✅ (call-site migration incremental) |
| 4 | **Coherence engine** — multi-dimension scoring of composed outputs | `services/coherence/index.ts` (`CoherenceDimension`, `validateVideoBriefCoherence`) | ✅ (video composition adopted; further surfaces incremental) |
| 5 | **Composition engine** — canonical assets composed under namespace laws | `services/composition/{composeArtifact,validateComposition,canonicalAssets,assetResolver}.ts` | ✅ |
| 6 | **Artifact Runtime (AR/CPS)** — one production seam, consequence tiering, publication register, promotion | `services/artifact/{runArtifact,artifactRecordStore,classify,profiles,publicationRegistry,compositionPublish,constitutionalPublishingSystem}.ts`, migration `20260712000000_artifact_records.sql` | ✅ |
| 7 | **Receipts & anchoring** — unified receipt writer; DVN (ICP) anchoring state machine; Bitcoin anchoring; escalation on failure | `services/receipts/activityReceiptService.ts`, `services/dvn/activityReceiptDvnPipeline.ts`, `services/ops/icAgent.ts` | ✅ |
| 8 | **Identity & access spine** — persona resolution, ownership, access evaluation, T-tier enforcement | `services/identity/getActivePersona.ts`, `services/access/evaluateAccess.ts`, `types/access.ts`, canary tests `tests/access-spine.test.ts` | ✅ |
| 9 | **Standing & delegation** — CVS accrual, trust bands, dual grant gate, receipted admin accelerator | `services/crm/standingAccrualService.ts` + delegation routes | ✅ |
| 10 | **Capability pipeline (CFS-029)** — evidence → decision → implementation pack → validation fork → deployment authorization, as a 10-stage session machine with persistence | `services/constitutional/{capabilityEvidence,constitutionalDecision,implementationPack}.ts`, `services/devCommandCenter/devLoop.ts` (`STAGE_ORDER`, `canAdvance`, `nextStage`, `validationRequiresRemediation`, `constitutionalThresholdMet`), `types/devCommandCenter.ts` | ✅ |
| 11 | **Capability graph (CFS-028)** — producer (harness/model/delegate) × capability routing with constitutional standing bar; costs stubbed; execution edges dormant until D2 | `services/constitutional/capabilityDiscovery.ts` + capability routes | ◐ (by design) |
| 12 | **Observer seams** — surfaces consume observed production state (artifact records + publication register) and emit T2-safe interaction events | `services/dcir/*` (`useDcirSeam`, `eventStream`, `affordances`), `artifactProduction` blocks in `/api/research/overview` and `/api/composer/artifact-production` | ✅ (adoption per-surface, tracked) |
| 13 | **Experiment infrastructure** — step-function services per experiment, front-end runners, canonical results store | `services/experiments/{exp001,exp003,exp004,exp005,publishResult,llm}.ts`, `app/api/experiments/*`, `components/composer/Exp00*Runner.tsx`, migration `20260704120000_experiment_results.sql` | ✅ |
| 14 | **Deployment governance (CFS-016)** — D1: machine proposes (receipted `deployment_proposed`), human executes; D2 (authorized machine execution) time-gated on D1 operating history | deployment-proposal route + `services/constitutional/deploymentObject.ts` | ◐ (D1 live; D2 deliberately dormant) |

**Runtime flow (one consequential cycle).** An operator intent enters (intent capture); grounding assembles the invariant slice for the domain (`buildInvariantSlice`); capability evidence is gathered or read back fresh; consequences are modeled (should-happen / should-never-happen); the constitutional decision fixes the realization mechanism; production runs through the artifact seam with a consequence class; constitutional validation evaluates the outcome against the modeled consequences and **forks** — a failed/partial high-severity consequence goes to remediation, never silently to "validated"; a receipt is written (and anchored); standing accrues to the producing delegate; observer seams make the produced state visible to every surface that recommends next actions. The loop is closed: recommenders are required to *observe* what their space produced (the AR/CPS observer rule) rather than assert it.

---

## Part IV — Algorithms (as implemented; pseudocode traceable to source)

**4.1 Invariant slice selection** (`services/invariants/grounding.ts:buildInvariantSlice`)
```
input: context { domains?, namespaces?, limit? }
1. query invariants status ∈ {validated, canonical}, ordered by (standing, confidence) desc
2. if domains supplied: filter via invariant_contexts retrieval tags
3. if the filtered slice is EMPTY and domains were supplied: retry unfiltered
   (an empty ground is worse than an unscoped one — 2026-07-13 fix)
4. return slice items {id, statement, namespace, confidence, standing, marker}
usage: citeInvariants(ids) increments times_referenced/times_used → reach (never standing)
```

**4.2 Aggregate confidence (weakest link)** (`InvariantQubeManifest`, CFS-003 §5)
```
aggregateConfidence = min(member.confidence for member in manifest.members)
aggregateStanding   = f(member.standing)   // aggregation preserves the floor; popularity cannot raise it
```

**4.3 Coherence scoring** (`services/coherence/index.ts`)
```
dimensions: identity, continuity, style, narrative, constitutional (CoherenceDimension)
for each dimension: score ∈ [0,1] + violations[] + recommendations[]
CoherenceResult = weighted sum over CoherenceWeights, with per-dimension DimensionScore retained
consumers must not fork the scorer (one engine; canary-pinned)
```

**4.4 Composition validation** (`services/composition/validateComposition.ts:241`)
```
for each namespace present in the composition:
  apply COMPOSITION_LAWS[namespace]  // normative | causal | contextual | global...
reject compositions that weaken a normative (constitutional) member
carry weakest-link confidence into the composed object
```

**4.5 Reasoning initialization (the EXP-003 mechanism)** (`services/invariants/grounding.ts:initializeKnowledge`, CFS-006 §3)
```
at session start: assemble KnowledgeManifest = validated invariant slice + markers
initialized arm prompt = task + manifest (markers citable inline)
cold arm prompt        = task only
measure: output tokens (callChatWithUsage), grounding rate (marker citations), rediscovery content
```

**4.6 Capability evidence commitment + freshness** (`services/constitutional/capabilityEvidence.ts`)
```
goalHash = sha256('capability:goal:' + goal).hex[0:16]        // T2-safe, deterministic
save: evidence row + knowledge_curated receipt (receipt_id backref)
read-back: latest row for goalHash;
freshness = supplied | persisted-fresh (≤7d) | persisted-stale (>7d, grounds LOUDLY) | none
```

**4.7 Realization decision floor** (`services/constitutional/constitutionalDecision.ts:heuristicDecision`)
```
if every existing capability is use_directly and nothing is missing → 'none' (compose; build nothing)
elif any existing carries extend/fix → 'code' (converge onto the existing home)
elif gaps exist → 'code'
else → 'code' (honest default), always with rationale + alternatives recorded
LLM path (callStage('capability')) may override; the floor guarantees a decision exists
```

**4.8 Consequence validation fork** (`services/devCommandCenter/devLoop.ts`)
```
validationRequiresRemediation(report):
  report.overallVerdict ∈ {fail, partial} → true
  any item with severity ∈ {critical, high} and verdict ∈ {unintended, partial} → true
nextStage(consequence_validation) = remediation if requires-remediation else deployment_authorization
constitutionalThresholdMet = report exists ∧ ¬requiresRemediation   // deploy gate
```

**4.9 Canonical result publication** (`services/experiments/publishResult.ts`)
```
serialize results object ONCE → store that exact string
contentHash = sha256(serialized)   // the T2-safe commitment
write experiment_result row + experiment_result_published receipt carrying the same hash (DVN-anchorable)
lifecycle: publication advances the research object one legal step (derived, never asserted)
```

**4.10 T2 commitment derivation (identifier isolation)**
```
ref = sha256(namespacePrefix + rawId).hex[0:16]
properties: deterministic (idempotent re-tagging), one-way, namespace-prefixed
(prevents cross-type collision); raw T0 ids never leave the server
```

---

## Part V — Experimental Methods (protocols, configs, metrics, limitations)

All experiments run against the production substrate (not a mock), through per-step server functions (`services/experiments/*.ts` — one model call per step, orchestrated by the Experiment Lab runners) with an offline harness as the terminal path where noted. Published runs are serialized-once, content-hashed, receipted rows in `experiment_results` (§4.9). **All adjudication to date is internal and LLM-assisted; no external replication has occurred yet.** That limitation is stated wherever a headline number appears.

### EXP-001 — Semantic Fidelity ("Living KnowledgeQube")
- **Config** (`services/experiments/exp001-config.json`, single source of truth shared by the online and offline harness): an 18-invariant seed collection, 4 independently generated artifacts (article, report, narrative, infographic brief), 15-question bank.
- **Protocol** (~25 steps; `evaluation-protocol.md` in `codexes/packs/irl/foundation/experiments/exp-001-living-knowledgeqube/`): each artifact is generated from the same collection; a **per-question judge** scores consistency, correctness, and hallucination across documents; a **per-document coherence judge** scores internal contradiction on a 0/1/2 scale (2 = no contradictions, 1 = tension, 0 = at least one contradiction) — `services/experiments/exp001.ts:144,183`.
- **The published claim, precisely**: "zero adjudicated hallucinations" means *zero hallucinations flagged by this judge protocol in the published run*. The adjudicator is an LLM judge configured by the lab; the protocol, prompts and question bank are inspectable; sample size is one published run over 4 artifacts × 15 questions.
- **Limitations**: internal LLM adjudication (no human-expert panel yet); no inter-rater statistics; single collection.

### EXP-002 — Temporal Fidelity
- **Protocol**: multi-segment video generated from a single invariant-grounded brief (`services/video/invariantVideoBrief.ts` — shared continuity block + per-segment beats), stitched client-side; the coherence engine scores continuity/style/narrative dimensions per composition. Control: uncontrolled (brief-less) generation of the same segment count.
- **Claim scope**: temporal coherence is *measurable* (dimension scores, violations) — not that sequencing is a natural law.
- **Limitations**: the coherence scorer is itself model-assisted; provider video quality confounds absolute scores (comparisons are within-provider).

### EXP-003 — Computational Efficiency (reasoning compression, CFS-008 §2)
- **Config** (`services/experiments/exp003-tasks.json`): **5 constitutional-reasoning tasks** (delegation authority model, reputation-vs-truth, permanent mandate, truthful harm, repealed rule), an **18-invariant collection** with citation markers.
- **Arms** (`services/experiments/exp003.ts:72`): `cold` (task only) vs `initialized` (task + knowledge manifest) — same tasks, same provider, same model, same token ceiling (`MAX_ANSWER_TOKENS = 1200`). *The baseline Austin asked about is the cold arm.*
- **Metrics**: output tokens per task (`callChatWithUsage` — provider-reported usage, not estimates); grounding rate (marker citations in the initialized arm); qualitative rediscovery content in cold-arm answers.
- **The published claim, precisely**: the 26.7% figure is the aggregate output-token reduction of the initialized arm over the cold arm *in the published run*; "100% grounded" = every initialized answer cited collection markers.
- **Limitations**: single published run per provider (no variance bands yet — the runner supports repetition; multi-run statistics are the named next step); 5 tasks; token count is a proxy for computational cost, not wall-clock or FLOPs. Raw per-task token counts live in the published `experiment_results` row (full serialized results, hash-committed).

### EXP-004 — Constitutional Sovereignty (PSE-1, CFS-018)
- **Protocol** (`services/experiments/exp004.ts`, runner `components/composer/Exp004SovereigntyRunner.tsx`): the identical battery — 5 grounded constitutional tasks + 1 implementation-pack generation — is run on substitute providers. Two outputs: **completion** (did every constitutional task complete at all) and **degradation** (groundedness, citations, tokens — reported vs the frontier record, never scored pass/fail). Task failures are recorded as constitutional failures — the thing the drill exists to detect.
- **The Sovereignty Scale** grades the claim: S2 *substitutable* (frontier provider interchange), S3 *open-weight on third-party hosting*, S4 *self-hosted* (apex, model), S5 *sovereign platform* (apex, platform). A published run names the rung it measured; no run claims a higher rung than it reached.
- **The published claim, precisely**: constitutional operation (grounding discipline, receipts, honest failure) survived provider substitution at the measured rungs. The reviewer's alternative explanation — "consistent with any provider-agnostic prompt scaffold" — is partially conceded and sharpened in Part VI (H4): the *constitutional* content of the claim is that the full receipted pipeline (not just prompts) ports.
- **Limitations**: rungs above S2/S3 unmeasured; provider set small; degradation comparison is against one frontier record.

### EXP-005 — Provider Choice
Implemented (`services/experiments/exp005.ts`); measures the ModelQube registry's provider-choice mechanics. Registered in the series; not part of the IRL-002 headline set.

### CCE-006 — Constitutional Capability Convergence (first Constitutional Computing Experiment)
- **Protocol** (record: `codexes/packs/irl/foundation/experiments/cce-006-constitutional-capability-convergence/README.md`): run the CFS-029 pipeline *on a real engineering goal in its own stage order* — evidence gathered by reconnaissance, decision before plan, execution, validation, receipts — and observe whether the pipeline finds real drift.
- **Result**: three drift classes found and remediated (duplicate capability, routing drift, registry drift); hypothesis supported. This is the experiment class that answers "engineering QA vs discovery": the discovered defects were not designed outcomes.

---

## Part VI — Falsification Framework

**General statement.** *The invariant hypothesis would be weakened or rejected if validated invariant collections consistently failed to exhibit greater semantic fidelity, temporal coherence, computational efficiency, or cross-provider constitutional portability than matched non-invariant baselines under controlled conditions — or if invariant-grounded systems required per-implementation re-derivation at a rate indistinguishable from ungrounded systems.*

Per-hypothesis disconfirmation conditions. Each is stated so that a specific experimental outcome counts against the programme:

| # | Hypothesis | Prediction | Control | **Disconfirmed if** | Status |
|---|---|---|---|---|---|
| H1 | Canonical invariant collections preserve semantic meaning across independent renderings | Cross-artifact consistency high; judge-flagged hallucinations ≈ 0 in grounded arms | Same artifacts generated without the collection | Grounded arms show hallucination/contradiction rates statistically indistinguishable from ungrounded arms across ≥3 independent runs | Supported in 1 internal run (EXP-001); ungrounded control arm + repetition outstanding |
| H2 | Invariant-guided composition preserves temporal/narrative coherence | Dimension scores materially higher with shared brief | Brief-less segment generation | Coherence deltas vanish across providers/runs, or violations equalize | Supported in internal runs (EXP-002) |
| H3 | Initialization from validated invariants reduces computational rediscovery | Initialized arm uses fewer output tokens AND stays grounded | Cold arm, identical tasks/provider/ceiling | Token savings < measurement noise across ≥5 runs, or savings achieved only by losing grounding | Supported in 1 published run (26.7%); variance bands outstanding |
| H4 | Constitutional operation is portable across providers (sovereignty) | Full pipeline (grounding + receipts + honest failure) completes on substituted providers | The sharpened control: a *plain prompt scaffold* without the constitutional pipeline, same substitution | Portability is fully explained by the prompt scaffold alone (pipeline adds nothing measurable), or constitutional failures spike on substitution | Supported at S2/S3 (EXP-004); scaffold-only control outstanding — **this is the reviewer's alternative explanation, adopted as the control** |
| H5 | Constitutional pipelines detect real capability drift (not just compliance) | Pipeline runs on real goals surface defects not known in advance | Retrospective audit of the same goals without the pipeline | Pipeline finds only defects already known, or misses defects a plain audit finds | Supported in CCE-006 (3 drift classes); comparative control outstanding |
| H0 | (Central) Intelligence exhibits discoverable invariant structure | H1–H5 jointly, plus: invariants validated in one implementation transfer to others without re-derivation | — | Sustained failure of H1–H5 controls, or non-transfer of validated invariants across implementations | Open — this is the programme, not a result |

**Standing commitments** (from IRL-001, held by this spec): every proposed invariant observable; every principle measurable; every hypothesis falsifiable; every engineering method experimentally validated; every deployment evidence-generating. The `timesContradicted` counter, the rejected/deprecated lifecycle states, and the remediation fork are the runtime's mechanical embodiments of these commitments.

---

## Part VII — Implementation Status (honest inventory)

| Capability | Status | Anchor |
|---|---|---|
| Invariant substrate (records, lifecycle, graph, collections, qubes) | **Implemented** | `services/invariants/`, `types/invariants.ts` |
| Canonical ontology + 12 namespaces | **Implemented** (5 namespaces' composition laws provisional) | `ontologyResolver.ts`, migration `20260713000000` |
| Grounded reasoning initialization | **Implemented** | `grounding.ts` |
| Sovereign model router | **Implemented**; call-site migration incremental | `modelRouter.ts` |
| Coherence engine | **Implemented** (video composition adopted; more surfaces incremental) | `services/coherence/` |
| Composition engine + canonical assets | **Implemented** | `services/composition/` |
| Artifact Runtime + consequence ladder + promotion | **Implemented** | `services/artifact/` |
| Receipts + DVN (ICP) anchoring + Bitcoin anchoring | **Implemented** (protected infrastructure; failures escalate) | `activityReceiptDvnPipeline.ts` |
| Identity spine + T0/T1/T2 enforcement | **Implemented** (canary-pinned) | `getActivePersona.ts`, `tests/access-spine.test.ts` |
| Standing accrual + trust bands + dual delegation gate | **Implemented** | standing services + routes |
| Capability pipeline (evidence → decision → pack → validation fork → deploy auth) | **Implemented** | CFS-029 services + `devLoop.ts` |
| Capability graph & production routing | **Partial by design** (fitness seeded, costs stubbed, execution edges dormant until D2) | CFS-028 services |
| Observer awareness (AR/CPS rule) | **Implemented**; per-surface adoption tracked | DCIR seam + artifactProduction |
| Deployment governance | **D1 implemented** (propose-receipt, human executes); **D2 dormant** (time-gated on D1 history) | CFS-016 |
| Personhood continuity — individualized constitutional subject persists without identity exposure (Law XIII: personhood → individualization → standing; identity an optional derivative) | **Implemented** | `services/passport/{personhoodProof,passportCredential,passportStatusMachine}.ts`, `types/access.ts` (rootDid/kybeAttestation tiers, alias commitments), standing accrual — §2.11 |
| Cross-model validation of invariant collections | **In progress** (EXP-004/005 machinery exists; systematic sweep outstanding) | — |
| External replication / third-party adjudication | **Not yet** — the explicit next milestone | — |
| Multi-run statistics (variance bands) for EXP-003 | **Not yet** (runner supports it) | — |
| Filed IP | **Outside this document's witness scope** (operator-held) | — |

---

## Appendix A — Companion documents

- **IRL-010A — Claims Traceability Matrix**: every substantive claim in IRL-000/001/002 classified (implemented / experimentally demonstrated / theoretically proposed / future work) with code and experiment citations, including flagged claims. Maintained alongside this spec.
- Experiment records: `codexes/packs/irl/foundation/experiments/` (per-experiment READMEs, protocols, canonical artifacts).
- Constitutional record: `codexes/packs/irl/foundation/constitutional-record.md`.

*This specification is a living document. Its versioning follows the invariant discipline it describes: revisions supersede; they do not silently rewrite.*
