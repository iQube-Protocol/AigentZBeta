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

## Enforcement

All agents (Claude Code, Codex, Lovable, any future agent) must:
1. Use these canonical spellings in all new code, UI copy, documentation, and data
2. Correct any non-canonical spelling they encounter in files they are editing
3. Never introduce a variant spelling, even in comments or variable names
4. Treat a non-canonical spelling as a bug to be fixed, not a style preference

Last updated: 2026-07-27
