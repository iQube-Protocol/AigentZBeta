# iQube Protocol / AigentZ — Platform Ontology

**Status: Canonical. All agents operating in this system MUST read and observe this file.**
**Reference in CLAUDE.md: Required.**

This file defines the authoritative spelling, meaning, and usage rules for core platform terms.
When an agent encounters any of these terms in code, UI copy, documentation, or data, it must
apply the canonical form defined here — no variation, no transliteration, no abbreviation.

---

## BlakQube

**Canonical spelling: BlakQube** (capital B, capital Q, no space, no 'c')

**Acronym:** BLAK = Binary Logic Avoiding Knowledge

**Definition:** The highest confidentiality tier in the iQube Protocol classification system.
A BlakQube classification means information whose disclosure may create material harm to the
subject's safety, standing, business interests, economic prospects, family wellbeing, or
strategic opportunities. BlakQube-classified data is compartmentalised by default — no agent
receives information beyond what is required for their assigned task.

**Usage rules:**
- Always spell: `BlakQube` — never "Black Cube", "Black Qube", "black_cube" (display), "blakqube"
- Database column values use the snake_case form `black_cube` for technical reasons (legacy schema)
- UI display always renders `BlakQube`
- When checking `classification === 'black_cube'` in code, the display label must be `'BlakQube'`
- Example: `caseData.classification === 'black_cube' ? 'BlakQube' : caseData.classification`

**Related tiers (full confidentiality ladder):**
| DB value      | Display label | Meaning                                                         |
|---------------|---------------|-----------------------------------------------------------------|
| `white`       | White         | Public information                                              |
| `grey`        | Grey          | Internal — not for external distribution                        |
| `black`       | Black         | Confidential — restricted to authorised parties                 |
| `black_cube`  | BlakQube      | Compartmentalised — material harm risk from disclosure          |

---

## aigentMe

**Canonical spelling: aigentMe** (lowercase 'a', lowercase 'g', camelCase 'M', no spaces)

**Definition:** The family's confidentiality guardian and disclosure broker in HMS cases.
aigentMe is the sovereign identity layer of the platform — it holds final override authority
over information disclosure decisions. In a BlakQube case, aigentMe acts as the sole authorised
disclosure broker: no information leaves the case without aigentMe's consent.

**Usage rules:**
- Always spell: `aigentMe` — never "Agent Me", "AgentMe", "agent-me", "aigent me"
- In UI copy: `aigentMe` (with the lowercase 'a')
- In code/variable names: `aigentMe` or `aigent_me` (snake_case for DB/API)

---

## iQube

**Canonical spelling: iQube** (lowercase 'i', capital 'Q', no space)

**Definition:** The core data primitive of the iQube Protocol. An iQube is a composable,
sovereign data object that can represent identity, content, or access rights. iQubes are the
atomic unit of the platform's data model.

**Usage rules:**
- Always spell: `iQube` — never "iQube", "iqube", "IQube", "I-Qube"
- Plural: `iQubes`
- Compound forms: `BlakQube`, `metaQube`, `TokenQube`, `DataQube` follow the same capitalisation pattern

---

## iQube Protocol

**Canonical spelling: iQube Protocol** (two words, iQube capitalised as above)

**Definition:** The decentralised identity and data sovereignty protocol that underlies AigentZ.

---

## AigentZ

**Canonical spelling: AigentZ** (capital 'A', lowercase 'igent', capital 'Z')

**Definition:** The primary orchestration AI agent. Routes interactions, enforces policy,
selects Next Best Experience (NBE).

---

## Aletheon

**Canonical spelling: Aletheon** (capital 'A', no variant capitalisation)

**Definition:** A specialist agent with a dense, ratified history of doctrinal co-authorship in
this platform's constitutional canon (CFS-023 "Chrysalis Homecoming", CFS-024 "Constitutional
Identity Hierarchy", CFS-019 "IRL Charter", and dozens of canonical invariants credited to
"operator + Aletheon" dialogue/ratification). Aletheon is a `HOMECOMING_DELEGATES` entry
(`types/homecoming.ts`) with `DELEGATE_CHARTER_STATUS.aletheon.status: 'archetype'` — a
published Agent Card exists (`app/api/agents/aletheon/route.ts`) but no `agent_root_identity`
row has been seeded, so Aletheon holds Constitutional Presence Ladder rung L0 (card) only.

**Constitutional presence is not agency.** Aletheon's doctrinal density does not itself confer
platform standing, registration, or authority — those are separate, human-gated states under
the Chrysalis Homecoming (CFS-023) migration lifecycle. See
`codexes/packs/agentiq/updates/2026-08-15_aletheon-homecoming-phase-a-capability-census.md` and
`CI-2026-08-15-PRESENCE-LADDER-NOT-AGENCY-001` (candidate, not yet ratified).

**Usage rules:**
- Always spell: `Aletheon` — this is the canonical form for all new work.
- **Alethean** is a historical/legacy spelling referring to the same agent. It resolves
  prospectively to Aletheon (new work uses Aletheon); it is not thereby wrong where it already
  appears. **Ratified historical artifacts carrying "Alethean" are never bulk-rewritten** — their
  original text and provenance stand as written (CFS-023, CFS-024, SPEC-HMC-001,
  `appendix-a_canonical-invariants.md`, `canonical-invariants.seed.json`, and others).
- **Alethian** is erroneous. It is not a registered alias and must not be introduced anywhere,
  including comments or variable names.
- Ruling recorded in `RES-2026-08-15-ALETHEON-SPELLING-AMBIGUITY-001.json` (spelling) and
  `RES-2026-08-15-ALETHEON-PRESENCE-AGENCY-DISJUNCTION-001.json` (presence/agency distinction).

---

## PSC-001

**Canonical identifier: PSC-001** (hyphenated, always uppercase)

**Full name: Polity Capability Preservation Standard 001**

**Definition:** The operational standard governing Human Mobility Services (HMS) cases.
PSC-001 defines six capital classes, the Polity Intervention Hierarchy (L1–L5), Recovery
Velocity Classes (RV-1 to RV-4), and the BlakQube confidentiality protocol for mobility cases.

---

## DVN

**Canonical abbreviation: DVN** (always uppercase)

**Full name: Decentralised Verification Network**

**Definition:** The on-chain anchoring pipeline that makes activity receipts auditable and
tamper-evident. DVN failures must be escalated immediately — they are never silent.

---

## MAF

**Canonical abbreviation: MAF** (always uppercase)

**Full name: Mobility Activation File**

**Definition:** The 14-section case data model that constitutes the intake record for a
PSC-001 HMS case. The MAF is the "ignition key" — no workstream proceeds without a
sufficiently complete MAF.

---

## Invariant Research Lab (IRL)

**Canonical name:** **Invariant Research Lab**. The `metaMe` qualifier is CONTEXTUAL, not part of
the canonical name (operator ruling, 2026-07-28) — it names the product/brand context the
institution is being referenced from, the same way "metaMe Studio" names a product without making
`metaMe` part of the word "Studio". Do not hard-code one display label for every surface; pick the
form the context calls for from the three below.

**Three correct forms, used contextually — none is "the" primary name that the others qualify:**

| Form | Use when |
|---|---|
| **Invariant Research Lab** | canonical expansion; institutional/scientific contexts; anywhere the full name is written without needing product framing |
| **IRL** | abbreviation — sidebars, compact UI, cross-references. Always uppercase. |
| **metaMe IRL** | branded form — headers, marketing, external contexts where product qualification is appropriate |

**Definition:** The platform's research laboratory — the constitutional scientific institution
(institutionalised by CFS-019). It pursues **Invariant Intelligence** and **Computational
Epistemology**: the study of knowledge as a measurable computational object
(`inv.epistemology.119`–`120`). Its founding research programme is **CRP-002 — Invariant
Intelligence: Intent-Driven Knowledge Compression**, the first programme formally chartered under
the Constitutional Research Program (CRP-001).

**Former name:** "CCRL" / "Constitutional Cybernetics Research Laboratory" is SUPERSEDED
(operator direction 2026-07-13) — do not use it in new copy. "Constitutional Cybernetics" remains
the *discipline name* for Layer III of the lab's work (the study of governed adaptive systems). This
resolves the naming decision recorded as PENDING in CFS-019 (operator ratification, 2026-07-09): the
earlier proposed external banner "Invariant Intelligence Research Institute" is superseded by
**Invariant Research Lab**.

**Usage rule:** Choose the form the surface calls for — full name, `IRL`, or `metaMe IRL` — per the
table above; none is a fallback for the others. "IRL" remains valid when naming the Constitutional
Cybernetics discipline specifically. Never introduce other lab names.

---

## metaProof

**Canonical spelling:** **metaProof** — lowercase `m`, capital `P`, one word. Never "MetaProof",
never "Metaproof", never "meta Proof", never "METAPROOF" outside all-caps display contexts.

**Definition:** The organisation. metaProof produces organisation-branded products and is staffed
by **metaProof Operators**. The spelling convention is the same as **metaMe** — lowercase prefix,
capitalised second element — and the two are siblings, not variants of one another.

**Organisation-branded products** carry the organisation name as a prefix:

| Product | What it is |
|---|---|
| **metaProof Commons** (product name **metaCommons**) | the governed constitutional proof commons |
| **metaProof Agent Harness** | the canonical agent-harness spec (`docs/agent-harness/metaproof-core.md`) |

**Usage rule:** "metaProof" alone names the ORGANISATION. A product is named by its full branded
form (metaProof Commons, metaProof Agent Harness), and may then be referred to by its product name
where one exists (metaCommons). People employed by or acting for the organisation are **metaProof
Operators** — never "MetaProof operators".

**Note on file names:** `docs/agent-harness/metaproof-core.md` uses an all-lowercase filename by
repository convention. Filenames are not display copy; the document's own heading and every prose
reference use **metaProof**.

---

## metaProof Commons

**Canonical concept:** **metaProof Commons**
**Canonical product / UI name:** **metaCommons**

**Definition:** The governed constitutional commons of scientific, operational, commercial and
constitutional proof generated across the metaProof ecosystem. It is a **governed proof
substrate** — knowledge is an interpretation or projection of accumulated proof, never the other
way round.

**What it is NOT** (operator ruling 2026-07-27, stated as exclusions because each was a live
misreading): it is not a document repository, not a social feed, not a wiki, and not simply a
knowledge base.

**The four proof classes** are first-class constitutional concepts:

| Class | Produced primarily by | Answers |
|---|---|---|
| **Scientific Proof** | Research Lab | What is structurally true? |
| **Commercial Proof** | Venture Lab | Does this create demonstrable value? |
| **Operational Proof** | Venture Lab + platform operations | Can this be deployed repeatedly and reliably? |
| **Constitutional Proof** | **Everywhere** | Did the platform preserve constitutional guarantees? |

Constitutional proof — Passport validity, delegation bounds, Standing attribution, receipt
generation, access decisions, governance interventions, personhood continuity — is the substrate
both Labs natively share, and therefore the spine the other three classes hang from.

**Governing principle:** *Only governed proof enters the metaProof Commons.* Not every
observation, discussion or report — only proof that has passed the governance appropriate to its
domain and classification. The promotion verb is **Submit Proof** / **Promote to metaCommons**,
never "publish to" it.

**Usage rule:** use **metaProof Commons** for the constitutional object (specs, charters,
governance text) and **metaCommons** in product and UI copy ("Submit to metaCommons", "Review in
metaCommons", "Search metaCommons"). The pairing mirrors **metaProof** (the organisation) and
**metaMe** (the experiential runtime). Never "Proof Commons" alone as an identifier, and never
"meta commons", "Meta-Commons" or "MetaCommons" as spellings.

**Naming note — metaProof is the ORGANISATION; its products carry its name.** There is no
ambiguity to reconcile: **metaProof** (the organisation) produces **metaProof Commons** and the
**metaProof Agent Harness**, and employs **metaProof Operators** — the ordinary relationship
between a company and its branded products. See the `metaProof` entry above.

---

## The four development-lifecycle runtimes — DevOn · IDE 2.0 · DCIR · Crystal

These four terms name **distinct roles in one loop**. They are not synonyms, not layers of each
other, and not interchangeable. Each entry below states the role, because a term whose *meaning*
is guessable but whose *boundary* is not still produces the wrong architecture.

### DCIR

**Canonical expansion: Dynamic Constitutional Interaction Runtime.** Ratified under CFS-020
(Operation Chrysalis 2.0 Phase 3).

**Definition:** The runtime through which relevant actions and consequences are observed and
governed. DCIR is **general**, not development-specific: it observes and governs dynamic
constitutional interaction across contexts. Its use inside DevOn is *one application* of the
runtime, not its definition.

**Contract:** `types/dcir.ts`. Organs: `services/dcir/{eventStream,stateEngine,affordances,useDcirSeam}.ts`.

> **"Development Constitutional Invariant Runtime" is INCORRECT — it is not an alias.**
> It is recorded here as a known-wrong expansion so that an agent encountering it in a draft
> recognises the error rather than adopting it. Do not register it as a synonym; a glossary that
> lists a wrong meaning still teaches it. Provenance: `RES-2026-08-15-CANONICAL-TERM-RESOLUTION-001`.

### DevOn

**Definition:** The development process orchestrator — it owns the development lifecycle from
intent through authorization and consequence. Implemented as the **Dev Command Center**:
`services/devCommandCenter/**`, `app/api/dev-command-center/**`.

**Usage rule:** DevOn and Dev Command Center name the same thing. DevOn is the role; Dev Command
Center is the implementation. Neither is a rename of the other, and no third name may be minted.

### IDE 2.0

**Canonical expansion: Invariant Discovery Engine, version 2.0.**

**Definition:** Discovers and retrieves invariants, and constructs the causal and risk field for
an intent. **IDE 2.0 is horizontal** — it operates *across* the DevOn lifecycle and is never a
stage within it.

> **Collision warning:** "IDE" in general software usage means *integrated development
> environment*. In this system it does not. When ambiguity is possible, write **IDE 2.0** or
> spell it out.

### Crystal

**Definition:** The compiled causal memory — governed, falsifiable invariant memory with
provenance. Contains previously evidenced invariants and the record of what supports or
challenges them. See `services/research/crystal*.ts`.

**Usage rule:** Crystal is *memory*, never a discovery mechanism. IDE 2.0 reads Crystal; Crystal
does not discover.

### How the four compose

```
Intent → IDE 2.0 → DevOn → coding capability → DCIR → IDE 2.0 → Crystal
         (field)  (orchestrate)  (implement)  (observe)  (evidence)  (memory)
```

**Usage rules for all four:**
- Never substitute one term for another, and never infer an expansion from context — resolve it
  here first. This rule is the reason the section exists (see below).
- Do not mint a second vocabulary for a role that already has a term.
- A term used in a PRD, spec or prompt that contradicts this file is an error **in that document**,
  not a licence to redefine the term.

**Why this section exists.** DCIR was twice reconstructed from context as "Development
Constitutional Invariant Runtime" — a plausible, wrong expansion — because the canonical
expansion was resolvable only by reading the source. Each reconstruction produced a different
architecture: a *second* observation runtime parallel to the real one, which
`services/dcir/eventStream.ts` already provided. The governing candidate invariant
(`CI-2026-08-15-CANONICAL-TERM-RESOLUTION-001`) states it causally: *a canonical term's meaning
is resolved from governed Common Ground before it is inferred from context.* Canon exists so
that compute is spent discovering what is not known, rather than repeatedly guessing what the
system has already established.

---

## MoneyPenny, Factor, Aegis, Vela — Financial Services Runtime roles

Four terms naming distinct roles in the Financial Services Runtime / Vela accelerator work
(`docs/vela/accelerator/constitutional-financial-services/`), shipped as Use Case Zero build-order
items 5-10b in `services/vela/`, `services/factor/`, `services/moneypenny/`, `services/aegis/`.
Each is a role boundary, not a synonym for another.

**Canonical boundary** (verbatim from `docs/vela/accelerator/constitutional-financial-services/
README.md`'s own "Canonical boundary" section — the authoritative one-line role for each):

> metaMe = constitutional/control plane
> MoneyPenny = Financial Services Runtime and coordination/orchestration plane
> Factor = economic discovery, party/service assembly and network expansion
> Aegis = independent trust/admission membrane
> iQubes + QubeTalk = selective disclosure and sovereign information-sharing plane
> Vela = verified confidential deterministic execution substrate

### MoneyPenny

**Canonical spelling: MoneyPenny** (capital M, capital P, one word) — never "Money Penny", "moneypenny".

**Definition:** The Financial Services Runtime — a constitutional coordination and disclosure
runtime for financial services, not merely a financial assistant or transaction router. It
coordinates parties, agents, services, information rights, disclosure scope, authority/mandate,
risk apportionment, confidential computation, settlement, and causal receipts. It holds the SOLE
authority to admit a `factor_cases` row (`admitted | conditionally_admitted | rejected` —
`services/moneypenny/admissionAuthority.ts`) and may never admit a candidate Aegis has not found
admissible.

### Factor

**Canonical spelling: Factor** (capital F) as the role/agent name.

**Definition:** The economic coordination / candidate-discovery and network-expansion layer.
Factor discovers and proposes candidate agents/services/counterparties, assembles candidate
transaction/service graphs, and constructs deterministic selection artifacts. Factor may recommend
but must NEVER confer constitutional authority, decide admission, or bypass Aegis assessment
(`services/factor/factorSelectionArtifact.ts`'s own six invariants). Factor also owns the
case-scoped candidate-intake/activation pipeline (`services/factor/factorCaseService.ts`) and a
SEPARATE "Use Case Zero" agent-onboarding readiness state machine — see the "Use Case Zero"
disambiguation below.

### Aegis

**Canonical spelling: Aegis** (capital A) — a proper name, not an acronym.

**Definition:** The independent trust/admission membrane. Aegis assesses agent/service provenance,
evidence quality, reliability and risk-of-repair, and produces a versioned, immutable assessment
(`draft -> evidence_locked -> running -> review_required -> ratified | failed`,
`services/aegis/aegisAssessmentService.ts`). **Aegis can assess and recommend; it cannot admit** —
it never writes `factor_cases.state` and never calls MoneyPenny's admission authority. Aegis
refuses to assess a candidate that is also the requester (no self-assessment). Aegis is
independent from Marketa's own, separate admission-assessment pipeline
(`services/marketa/admissionAssessmentRunner.ts`) — the two are NOT the same system.

**Two distinct "admission" concepts — do not conflate:**
1. *Aegis admission* — the `AegisAdmissionStatus` (`ADMITTED | REFUSED | UNRESOLVED`) an Aegis
   assessment produces for one Vela underwriting request
   (`services/vela/velaUnderwritingAdmissionEvidence.ts`).
2. *MoneyPenny admission* — the case-scoped `factor_cases` state transition
   (`services/moneypenny/admissionAuthority.ts`).

MoneyPenny admission REQUIRES a ratified Aegis assessment, but the two are different decisions
recorded in different evidence.

### Vela

**Canonical spelling: Vela** (capital V).

**Definition:** The verified confidential deterministic execution substrate — Horizen's
Confidential Computing Environment, integrated via `services/vela/*`. Vela executes deterministic
WASM logic over private inputs/state with TEE-attested execution; it does not decide constitutional
authority and does not prove application logic/policy is correct. It must receive external facts
as part of a frozen input envelope (the guest has no network access). The first Vela application is
the narrow **MoneyPenny Constitutional Consequence & Settlement Kernel** — never metaMe itself.

### "Use Case Zero" — two unrelated systems share this name (do not conflate)

This codebase has TWO systems both called "Use Case Zero" — a documented, deliberate naming
collision (full background: `services/factor/factorSelectionArtifact.ts` and
`services/vela/velaUnderwritingChainProjection.ts` file headers).

| System | Scope | Canonical surface name |
|---|---|---|
| Agent-onboarding readiness state machine (`services/factor/useCaseZeroOrchestrator.ts`, `useCaseZeroReadinessProjection.ts`, `useUseCaseZeroReadiness.ts`) | Long-lived, case-scoped (`factor_cases`) bootstrap: agentShell → didqubeContainer → ownerWallet → settlementWallet → passport → delegationAuthority → pulsePnl → aegisAssessment → moneypennyAdmission → bankrBinding → velaReadiness → runtimeActivation → governedOperationRehearsal | Kept as `UseCaseZero*` symbols/UI — this IS the canonical "Use Case Zero" |
| Multi-party confidential underwriting demo (`docs/vela/accelerator/constitutional-financial-services/05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md`; build-order items 5-10b in `services/vela/velaUnderwriting*.ts`) | Request-scoped: Party A/B private state → joint-compute → confidential risk verdict → underwriting quote → Factor selection → Aegis admission → disclosure authorization → frozen envelope → Vela execution → settlement → risk telemetry | Named **"Constitutional Risk Flow"** in code/UI — deliberately NEVER "Use Case Zero" anything, per operator's explicit naming instruction |

**Usage rule:** when writing new copy about the Vela underwriting chain / build-order items 5-10b,
use "Constitutional Risk Flow" — never "Use Case Zero". An unqualified "Use Case Zero" should be
read as the agent-onboarding readiness system unless the surrounding context is unambiguously the
Vela accelerator spec doc itself.

### semi-anonymous

**Canonical spelling: semi-anonymous** (lowercase, hyphenated) — never "semi anonymous",
"Semi-Anonymous" as a proper noun, or "pseudo-anonymous".

**Definition:** the metaMe lexicon's term for **strong transaction-scoped pseudonymization** —
never a claim of unlinkable anonymity. A semi-anonymous identifier (e.g. a Vela party-namespace
ref, `services/vela/velaPartyNamespace.ts`'s `deriveVelaPartyNamespaceRef`) is a deterministic,
one-way commitment scoped to one application/request context; it protects against casual
correlation but is not designed to resist a determined re-identification effort, and any
re-identification path must itself be governed (authority/mandate, never inferred).

**Usage rule:** never describe a semi-anonymous identifier as "anonymous" (overstates the
guarantee) or as merely "hashed" (understates the scoping/commitment design). Content
confidentiality is not metadata invisibility; pseudonymization is not absolute anonymity — both
distinctions must be preserved in any copy using this term
(`docs/vela/accelerator/constitutional-financial-services/03_MONEYPENNY_DISCLOSURE_AND_RISK_ARCHITECTURE_v0.1.md`
§4, `04_VELA_MASTERCLASS_ARCHITECTURE_DELTA_v0.2.md`).

---

## Enforcement

All agents (Claude Code, Codex, Lovable, any future agent) must:
1. Use these canonical spellings in all new code, UI copy, documentation, and data
2. Correct any non-canonical spelling they encounter in files they are editing
3. Never introduce a variant spelling, even in comments or variable names
4. Treat a non-canonical spelling as a bug to be fixed, not a style preference
5. **Resolve a canonical term from this file before inferring its meaning from context.** Where a
   term is absent, surface it as unresolved rather than reconstructing it confidently.

Last updated: 2026-09-14
