# Book Doctrine Lineage

**Project:** The Constitutional Internet — The Last Human Frontier (Dele Atanda)
**Artifact:** BOOK_DOCTRINE_LINEAGE.md
**Home:** Polity Core → Constitutional Internet → 02 Chapter Matrix
**Audit run:** 2026-08-02 · commit `23b012473` · canonical repo `iQube-Protocol/AigentZBeta`

---

Maps every chapter to its **canonical internal doctrine** — ratified constitution articles, Polity
Papers, constitutional commentary, and the invariant corpus. This is the *internal* lineage only;
external legal/historical/scientific sources are the operator's parallel pass.

**Corpus at commit `23b012473`:** `codexes/packs/irl/foundation/canonical-invariants.seed.json` carries
**373 invariants** — 222 `canonical`, 144 `proposed`, 7 `validated` — across 14 namespaces. The seed
file declares itself *bootstrap material*; the database is authoritative, frozen via
`scripts/export-crystal-snapshot.mjs` into hashed Crystal snapshots.

---

## Lineage table

| Ch | Title | Canonical doctrine | Section / article |
|---|---|---|---|
| 1 | The Wave Arrives | inv.polity.163 Time Sovereignty (canonical); inv.polity.212 The time dividend; inv.polity.213; inv.polity.192; inv.polity.189 | codexes/packs/polity-core/items/commentary/coyn-thesis/02-time-sovereignty.md; 01-the-fallacy-of-free-information.md; ci-cc-001 Rule 0 |
| 2 | The Platform Settlement | inv.polity.189 From perimeter to polity; inv.polity.208 Access is not sovereignty; inv.polity.207; inv.polity.194; inv.polity.190; inv.polity.164 | CONSTITUTION_OF_AGENTIC_POLITY.md Article I §2 (personhood precedes permission); Article X §5 (no exclusive constitutional legitimacy by market position) |
| 3 | The Person Disappears | Canonical Asset 002 — metaVitruvian (Constitutional Atlas) | components/representation/MetaVitruvian.tsx header; manuscript Ch3 'The Person Disappears' |
| 4 | Personhood Before Identity | DIDQube three-class model (operator ratification 2026-07-20) | services/identity/personhoodResolver.ts header; manuscript Ch4 |
| 5 | Human Rights, Digital Rights, And Personhood Rights | inv.polity.177 The human-rights floor (cites Art. I §6-7 + Art. IX, UDHR Art. 15); inv.polity.179 four-tier rights hierarchy; inv.polity.175; inv.polity.178 | CONSTITUTION_OF_AGENTIC_POLITY.md Article II §1-7 (Sovereign Natural Person); Article III §1-12 (esp §3 foundational-rights floor) |
| 6 | The Digital Threat Is Physical | inv.polity.161, inv.polity.198, inv.polity.268 (canonical) | codexes/packs/irl/foundation/canonical-invariants.seed.json; STANDING_CHARTER.md §'Standing and Proof of Time Saved' (L56-62) |
| 7 | The Machine Enters The World | agent-charter v1.0.0 (ratified 2026-06-17); DELEGATION_FRAMEWORK.md v1.0.0 | services/polity/frameworks/agent-charter.v1.json; codexes/packs/polity-core/items/DELEGATION_FRAMEWORK.md; editorial register ADD-1 |
| 8 | The Last Human Frontier | agent-charter v1.0.0 | phase1.agentsMustNotPossess; identityClass.ADID (isHuman:false, mayNot vote/possess_citizenship/hold_constitutional_rights); sponsorship.required / noOrphanedAgents; economicControls.assetsR… |
| 9 | What A Constitution Does | inv.polity.176 constitutional priority chain; inv.polity.186 Constitutional restraint; inv.polity.183 rights-affecting-action gate; inv.polity.184 Escalation over silent execution | CONSTITUTION_OF_AGENTIC_POLITY.md Art I §4-5, Art IX §6, Art XII; GOVERNANCE_FRAMEWORK.md; CONSTITUTION.md §Core Principle + §Amendment |
| 10 | By What Authority | inv.polity.185 Open, plural, non-monopolized implementation; inv.polity.177; inv.polity.180; inv.polity.184 | CONSTITUTION_OF_AGENTIC_POLITY.md Article I §7 + §10-11; Article IX §1-7 (§7 'Jurisdiction shall not erase personhood'); Article X §1-7 (§6 portability, §7 no standing lost by moving) |
| 11 | Invariance | CFS-001, CFS-002, CFS-013, CFS-019 §2, CFS-048, CFS-051, CFS-052 + CFS-009 Law XVI (ratified 2026-07-27) | codexes/packs/polity-core/constitutional-records/invariant-intelligence.md; AMENDMENT_RECORDS.md |
| 12 | Rights Without Immunity | ci-cc-001-book-constitution.md Rule IV (NOT RATIFIED - header says 'Proposed for canonisation'); inv.polity.204 Accountable speech; inv.polity.179 §12 proportionality; inv.polity.183; inv.po… | CONSTITUTION_OF_AGENTIC_POLITY.md Article III §8 (necessity, proportionality, accountability, review) and §12; Article IX §6 (receipted, reviewable, challengeable); STANDING_CHARTER.md |
| 13 | Proof Before Trust | CLAUDE.md 'DVN Pipeline Protection'; docs/agent-harness/metaproof-core.md (DVN receipt taxonomy) | codexes/packs/polity-core/items/commentary/coyn-thesis/05-the-sovereign-cybernetic-economy.md:265-266 (Proof of State/Risk/Price triad) |
| 14 | Human Agency Is Personhood In Action | inv.polity.163 Time Sovereignty (canonical); inv.polity.200 | codexes/packs/irl/foundation/canonical-invariants.seed.json; types/constitutionalContext.ts:92 |
| 15 | When Something Acts In Your Name | DELEGATION_FRAMEWORK.md v1.0.0; agent-charter v1.0.0 | 'Bounded on every dimension' (scope/duration/spend/info-access/domains); Prohibitions; Immutability; revocation.states/effect:'immediate'; receipts.everyAutonomousActionMustGenerate |
| 16 | The Passport Of The Person | PRD-PAG-001 Amendment A | referenced throughout services/identity/passportSession.ts and passportPrincipal.ts; manuscript Ch16 (title ratified 00-editorial-register.md CR-7) |
| 17 | Privacy Through Different Assumptions | Not found (no ratified quantum-entropy record) | manuscript Ch17 (title ratified 00-editorial-register.md CR-7) |
| 18 | Standing Carries Consequence | STANDING_CHARTER.md v1.0.0 (ratified 2026-06-17); STANDING_FRAMEWORK.md v1.0.1 | §Purpose L11-17 ('Standing is not reputation / popularity / status / social ranking'); §Standing dimensions (operational) L24 ('event-driven, never time-driven'); machine form services/polit… |
| 19 | Constitutional Information And Computing | CLAUDE.md 'Identity & Access Spine' (T0/T1/T2 tiers); docs/platform-ontology.md (iQube, BlakQube) | CRP-003a / PRD-MPY-001 §10 (constitutional service pattern); CFS-020 CDE |
| 20 | The Constitutional Internet Is Here | inv.polity.185; ci-cc-001 Rule V 'The Constitutional Internet Is Present Tense' (PROPOSED, not ratified) | 02-source-and-evidence-matrix.json taxonomy.implementationStates |
| 21 | The Polity As Constitutional Institute | CONSTITUTION_OF_AGENTIC_POLITY.md; METACOMMONS_CHARTER.md v1.0.0 (ratified 2026-06-17); FOUNDER_OFFICE_CHARTER.md; CFS-019; AMENDMENT_RECORDS.md Horizen Amendments A-G (2026-07-27) | Amendment E (metaProof organisation / metaProof Commons constitutional object / metaCommons product surface); Amendment G (four-layer separation Public/Community -> Venture Lab -> Registry -… |
| 22 | Many Bridges, One Polity | CFS-018 (Platform Sovereignty, Sovereignty Scale S0-S3); CFS-042 (External Result Submission); CFS-044 (Open Lab Reviewer Engagement) | NO ratified doctrine in this repo states the stack is contributed openly - grep for 'open source/open-source' over polity-core items and CFS-018 returns NOTHING |
| 23 | The Person Becomes Visible | PRD-THR-001 §9a (canonical operator/Aletheon-authored copy — 'render it verbatim, don't paraphrase') | services/threshold/welcome.ts:15 WELCOME_MESSAGE, :24 WHAT_IS_CONSTITUTIONAL_INTERNET, :31 WHAT_IS_CITIZENSHIP; canonical-invariants.seed.json:3670 |
| 24 | Entering The Polity | inv.polity.185 (the ONLY internal doctrine carrying portability); inv.polity.180; inv.polity.170 (delegation envelope bounded on every dimension, immutable after creation); inv.polity.178; i… | CONSTITUTION_OF_AGENTIC_POLITY.md Article X §6 ('shall retain, WHERE FEASIBLE, rights of portability, interoperability, and migration') and §7 ('No subject shall lose constitutional standing… |


---

## Doctrine gaps — claims with **no** internal canonical source

These are the passages where the manuscript asserts something the repo's ratified corpus does not
carry. Each needs either a deposited source, a proposed invariant, or a prose requalification.

### ~~G-1~~ — **CLOSED 2026-08-02** · *The Digitterian Tsunami* (Volume I) deposited

Volume I was deposited at `03-volume-i-digitterian-tsunami.md` (with verification notes at
`03-volume-i-verification-notes.md`). Chapter 1's continuity claims — the 2009 dating, the
blog-post origin as *The Aquarian Tsunami*, the twenty-one principles (now **fully enumerated**
internally), the NEO-citizen coinage, and the anticipation of later volumes (**near-verbatim**) —
are now corroborated by a primary internal source. **CI-01 moves Partially supported → Supported.**

Three caveats carried forward as rulings **R-16/R-17/R-18** (see the verification notes): the
Internet Foundation appears **nowhere** in Volume I; Volume I says *"Bill"* where Volume II says
*"Declaration"*; and the "future volumes" sentence sits in the **2013** Preface, not the 2009
original. External archival verification of the 2009 publication remains the operator's pass.

<details><summary>Original G-1 finding (superseded)</summary>

**G-1 — *The Digitterian Tsunami* (Volume I) is absent from the repo entirely**
**Chapter 1.** No text, extract, archived manuscript, or registered pack item exists. All 25
occurrences of "Digitterian" are inside the Volume II manuscript, its editorial master/register, the
evidence matrix, `00-project-structure.md` and one `collections.json` description string. The same
holds for "NEO-citizen" and the "twenty-one principles" — **never enumerated internally**.
Consequently Ch1's continuity claims (2009 dating, blog-post origin, the 21 principles, the
NEO-citizen coinage, the explicit anticipation of later volumes) rest **solely on the author's
restatement in the manuscript being audited**.
*Remedy:* deposit a dated Volume I source record into Polity Core before the citation pass.
*Note:* the Ch1 **time** argument is fully covered by ratified doctrine (`inv.polity.163`/`212`/`213`)
and is citable today.

</details>

### G-2 — **PARTIALLY CLOSED 2026-08-02** · UDHR / 1998 Declaration / Internet Foundation material

Volume I's **Appendix 1 — Draft Universal Bill of Digital Rights** (18 articles, each mapped to UDHR
articles 6, 12, 13, 14, 15, 17, 18, 19, 20, 26, 27, 28) is now an internal dated source for the
digital-rights lineage in Chapters 5 and 10, and its Article 16 (data portability + identity asylum)
is the strongest internal warrant for Chapter 24's exit claim.

**Still outstanding:** the UDHR text, the 1998 UN Human Rights Defenders Declaration (A/RES/53/144),
and — critically — any **dated Internet Foundation** publication. Volume I supplies the *author's*
draft; it does **not** supply the *institutional* call.

<details><summary>Original G-2 finding (partially superseded)</summary>

**G-2 — No UDHR / 1998 Declaration / Universal Declaration of Digital Rights material**
**Chapter 5, Chapter 10.** Grep for `UDHR|Universal Declaration` returns only the two citations of
UDHR Art. 15 in `commentary/polity/03-citizenship-in-the-agentic-internet.md`, the manuscript's own
prose, the editorial master's restatement, the matrix's "required" field, and `inv.polity.177`.
The manuscript's claim that *"the Internet Foundation and I called for a Universal Declaration of
Digital Rights"* has **zero internal corroboration** — an authorial assertion pending archival
evidence.

**2026-08-02 update — now actively contradicted, not merely uncorroborated.** `grep -c "Internet
Foundation"` over Volume I returns **0**. Volume I attributes the call to the author and to
NEO-citizens: *"I believe **NEO-citizens will call for** a Universal Bill of Digital Rights."*

</details>

### G-3 — The five-line authority formulation is a new coinage, not canon
**Chapter 10.** *"The rights are universal / The invitation is global / Entry is permissionless /
Constitutional authority is participatory / Coercive jurisdiction remains bounded by law."* This is
an excellent compression but has **no single canonical doctrine home**.
*Remedy:* propose it into the invariant corpus (as `proposed`, per the hypothesis-vs-canon
discipline) so the book cites canon rather than inventing it in prose.

### G-4 — The plutocracy / state-jurisdiction addendum has no ratified doctrine
**Chapter 10 (CR-6).** 14 manuscript occurrences versus 1 in the invariant corpus, 1 in the seed
JSON, 1 in `Experience Sovereignty.txt`, 1 in `Threshold Articles.txt`. CR-6 in the editorial
register is an **instruction to integrate**, not a source. Currently author-original argument.

### G-5 — The Internet Foundation has no instrument of any kind
**Chapter 21.** No charter, mandate, sponsorship agreement, ontology entry, ratification-ledger row,
cartridge, or code reference. Every other named institution has at least a ratified document. This is
the **largest institutional evidence gap in the book**.

### G-6 — CI-CC-001 (the Book Constitution) is itself **not ratified**
**Chapters 12 and 20 depend on it.** Its header reads *"Proposed for canonisation in Polity Core /
Constitutional Commentary"*; its footer *"Recommended status: RATIFIED COMMENTARY"*. Rule IV is
load-bearing for Ch12 (rights without immunity) and Rule V for Ch20 (present tense).
*Remedy:* ratify it, or the two most dependent chapters cite a proposed document as governing.

### G-7 — The metaMe Venture Lab has no charter and no ontology entry
**Chapter 21.** Four competing forms in the repo (`metaMe Venture Lab`, `Venture Lab`, `Venture Lab α`,
tokens `mvl`/`venture-lab`), **no `docs/platform-ontology.md` entry** despite that file governing
canonical spelling, and `VENTUREQUBE_SPEC.md` registered `draft_wip — NOT ratified`.

### G-8 — Commons definition diverges between charter and ontology
**Chapter 21.** `METACOMMONS_CHARTER.md` (ratified 2026-06-17) defines the Commons as *a field* —
continuously evolving, aggregating Proof of Work Potential, learning through Proof of Time Saved.
Amendment E / `docs/platform-ontology.md` define it as *a governed proof substrate* with four proof
classes. **The charter and the ontology are themselves out of step**; the book follows the latter.

---

## Where doctrine is *stronger* than the manuscript

- **Chapter 11 (Invariance).** `DiscoveryClass = 'constitutional' | 'structural' | 'experiential'` is a
  **live type** (`services/invariants/discoveryEngine.ts`), not prose. The eight
  `inv.commercialisation.*` records all sit at `proposed` with provenance recording verbatim that the
  evidence is *"platform-derived and UNVALIDATED"* — a working instance of the hypothesis-vs-canon
  discipline the chapter argues for. 94 tests passing.
- **Chapter 21 (Institutions).** **Amendment G (2026-07-27)** is *more precise* than the chapter: the
  four-layer chain Public/Community → Venture Lab → Registry → Commons, with the layers explicitly
  forbidden from collapsing, and Public/Community named as a fourth domain that is **not** the Commons.
  The chapter would be more defensible framed on this ratified model than on seven peer institutions.
- **Chapter 9.** The closing chain *constitution → commentary → invariants → architecture → execution →
  receipts → proof → remedy* is doctrinally exact **and** demonstrated by the codebase's own machinery
  — except the **remedy** terminus, which is deferred in code.

---

## Operator rulings applied — 2026-08-02

### CR-8 · Internet Foundation and UDDR lineage → **Ch5, Ch10, Ch21**

**G-2 further closed on the institutional limb.** External published evidence (IAPP, *"BSI Group
eyeing ethical data use,"* 1 June 2017, referencing coverage **as far back as 2013**) establishes the
Internet Foundation as an NGO advancing a Universal Declaration of Digital Rights, framing digital
rights as an extension of human rights, and proposing ethical-data-use standards work to BSI.

| Chapter | Effect |
|---|---|
| **Ch5** | The *"the Internet Foundation and I called for a Universal Declaration of Digital Rights"* attribution is **now supported**. **Supersedes ruling R-16** — Volume I's silence is explained: it is a 2009/2013 *authored work*, not an institutional record. Rulings **R-17** (Bill vs Declaration) and **V-3** (do not propagate Volume I's "Universal Bill of Human Rights" miscall of the UDHR) remain open. |
| **Ch10** | The digital-rights lineage underpinning the permissionless/participatory authority argument gains an externally evidenced institutional actor. **G-4 (plutocracy) is unaffected.** |
| **Ch21** | **Historical** existence supported; **current constitutional mandate still uncodified.** Ch21's present-tense sponsor/guardian passages remain unsupported until a founding/mandate artifact is ratified into Polity Core. |

**Still required:** a canonical Internet Foundation founding and mandate artifact defining
institutional purpose · relationship to the polity · constitutional authority and limits ·
relationship to metaProof and other operators · governance and continuity · current institutional
status.

*Verification caveat:* operator-attested; agent retrieval blocked (`iapp.org` → 403;
`web.archive.org` blocked). Archive a copy into `03 Source Lineage`.

### CR-9 · Quantum entropy implementation status → **Ch17**

**A new doctrine source now exists for Ch17.** `PRD-DIDQ-QBIT-001` v0.2 — *DIDQube Quantum Entropy
Integration with Qubit* (`codexes/packs/irl/foundation/PRD-DIDQ-QBIT-001_didqube-quantum-entropy-integration.md`)
— is canonised as the **controlling implementation specification**, for review and **not for
execution**.

Ch17 previously had **no** doctrine source for its quantum claim. It now has a governed one, moving
the claim from *unsupported assertion* to **Projected roadmap item**. The PRD also supplies doctrine
Ch17 can cite for the *architecture* of privacy: the hybrid entropy model, domain separation,
root/persona separation, metaNet/blakNet separation, and the two product invariants —

> **Quantum entropy may strengthen the unpredictability of a constitutional operation, but it may
> never supply the authority for that operation.**

> **No party that supplies entropy may thereby acquire the capacity to reconstruct, correlate or
> control the identifier, key, person or action derived from it.**

**Manuscript rule — CR-9 three-stage language rule** (corrected 2026-08-02):

| State | Permitted wording |
|---|---|
| **Projected** ← *current* | *"is **specified to integrate**"* / *"the **roadmap integrates**"* |
| Entering deployment | *"is integrating"* |
| Operational | *"uses"* |

*"is integrating"* was initially drafted as the permitted-now wording; it was withdrawn from the
Projected stage because it implies active implementation while execution is not authorised. The
*"we have not attempted to defeat quantum cryptography"* formulation is retained verbatim — it was
always correct.

---

## Registered external source — SRC-IF-IAPP-2017-001 (2026-08-02)

**IAPP, *"BSI Group eyeing ethical data use,"* Sam Pfeifle, 1 June 2017.**
`https://iapp.org/news/a/bsi-group-eyeing-ethical-data-use` ·
archived at `03-source-lineage/internet-foundation-uddr/SRC-IF-IAPP-2017-001.md` ·
sha256 `de36753f…dd6a` · **verificationStatus: independently-retrieved-live-source**

**Source hierarchy:** the live IAPP URL is the **primary external source**; the archived Markdown is
the **durable Polity Core evidence record**. The archive exists because the older linked
representation of the initiative is already broken.

### What it establishes

1. The Internet Foundation existed as an NGO by at least **2013**.
2. It was seeking the creation of a universal declaration of digital rights.
3. IAPP had covered that effort **as far back as 2013**.
4. Dele Atanda and the Foundation had proposed ethical-data-use standards work to BSI before 2017.
5. That work concerned privacy, ownership, consent, fair use, data transfer, correction, erasure,
   arbitration and notification.
6. It connected to standards work beyond baseline legal compliance, including GDPR and the changing
   UK data-protection environment.

### What it does NOT establish

The Foundation's **present constitutional mandate**, current legal or operational status, present
relationship to the polity, governance structure, or current relationship to metaProof. Those require
a **separate canonical founding and mandate instrument**.

### Chapter effect

| Chapter | Lineage effect |
|---|---|
| **Ch5 — Human Rights, Digital Rights, and Personhood Rights** | *Doctrine lineage.* The *"the Internet Foundation and I called for a Universal Declaration of Digital Rights"* attribution is **externally verified**. Supersedes **R-16**. |
| **Ch10 — By What Authority?** | *Authority lineage.* The permissionless/participatory authority argument gains an externally evidenced institutional actor with a dated public record. **G-4 (plutocracy) unaffected.** |
| **Ch21 — The Polity as Constitutional Institute** | *Institutional lineage.* **Historical existence supported; present mandate still uncodified.** The present-tense sponsor/guardian passages remain unsupported. |

**The governing distinction, to be carried consistently through all three chapters:**

> **Historical existence and UDDR lineage — externally verified.**
> **Current constitutional mandate — pending canonical documentation.**
