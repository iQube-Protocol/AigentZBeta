# Book Discrepancy Register

**Project:** The Constitutional Internet — The Last Human Frontier (Dele Atanda)
**Artifact:** BOOK_DISCREPANCY_REGISTER.md
**Home:** Polity Core → Constitutional Internet → 02 Chapter Matrix
**Audit run:** 2026-08-02 · commit `23b012473` · canonical repo `iQube-Protocol/AigentZBeta`

Every discrepancy below is **surfaced for ruling, not resolved**. No manuscript prose was edited.
Ruling options follow the matrix taxonomy: add a citation · qualify or strengthen the prose ·
correct terminology · add missing implementation evidence · mark experimental or projected ·
commission missing code, tests, or receipts.

---

## Severity A — publication blockers

These assert present-tense reality that the repo contradicts or cannot corroborate.

### A-1 · Ch17 — **quantum entropy** is a governed roadmap item
### ✅ RECLASSIFIED 2026-08-02 by operator ruling **CR-9** — Unsupported → **Projected**

**No longer an unsupported assertion.** `PRD-DIDQ-QBIT-001` v0.2 (*DIDQube Quantum Entropy
Integration with Qubit*) was canonised 2026-08-02 as the controlling implementation specification,
establishing a governed implementation path. CI-17 moves from *Not found / Unsupported / Overclaim*
to **Projected**.

It is **not** *Entering deployment*: implementation has **not begun** and execution is **explicitly
not authorised** (PRD §32 — an execution plan must be written and approved first). The audited code
remains classical (`node:crypto` `randomBytes` for all IVs, keys and identifiers).

**Permitted manuscript wording — CR-9 three-stage rule** (corrected 2026-08-02; the earlier draft
permitted *"is integrating"* at Projected, which was inconsistent with execution-not-authorised):

| State | Permitted wording |
|---|---|
| **Projected** ← *current* | *"is **specified to integrate**"* / *"the **roadmap integrates**"* |
| Entering deployment | *"is integrating"* |
| Operational | *"uses"* |

**Publication target: implement before final publication.**

**The manuscript's narrower quantum position was already correct and is unaffected** — *"We have not
attempted to defeat quantum cryptography. We use quantum mechanics to strengthen randomness and,
through randomness, privacy."* Only the *"currently uses quantum entropy"* clause was overclaimed.

<details><summary>Original A-1 finding (superseded in its absolute form)</summary>

**A-1 · Ch17 — "uses quantum entropy" has zero code backing**
**Type:** Overclaim · **Support:** Conflicting · **Impact:** Move to future tense

Manuscript (~line 3118): *"The Constitutional Internet uses quantum entropy to strengthen the
randomness upon which privacy depends."* **No QRNG, quantum, or entropy-beacon source exists anywhere
in the repo.** All IVs, keys and identifiers use Node's classical CSPRNG (`randomBytes`, `randomUUID`)
via `services/content/encryption.ts` (AES-256-GCM + HKDF-SHA256).

**Notably accurate:** the manuscript *correctly does not* claim quantum-**resistant** cryptography
(lines 3120–3121). That formulation — *"we have not attempted to defeat quantum cryptography"* — is
exact and code-consistent, and should be **kept verbatim**.

**Ruling options:** (a) requalify as roadmap ("is architected to incorporate"); (b) delete the
"uses quantum entropy" clause, retaining the accurate framing; (c) keep present tense **only** if an
external QRNG source exists outside this repo → then *Needs external verification*.
**Recommended:** (a) or (b).

</details>

### A-2 · Ch18 — person standing vs invariant standing
### ✅ RESOLVED 2026-08-02 by operator ruling **CR-10** — ontology correction, not a contradiction

**The finding is withdrawn in its absolute form.** The decay / contradiction-penalty / challenge
language applies to **invariant standing**, not to the standing of a person. Code and ratified
doctrine support **both** concepts; the manuscript had allowed their labels to blur.

| | Person standing | Invariant standing |
|---|---|---|
| Attaches to | a **person** | a **proposition / candidate / discovered rule** |
| Records | proven **conduct** | evidentiary **support** |
| Changes on | contribution, validation, proven harm, penalty, repair, successful challenge, correction, reversal | recurrence, validation, contradiction, new evidence, narrowing, supersession |
| Time alone | **does not reduce it** | — |
| Contradiction | — | **may reduce it** (`lifecycle.ts:291`, Law XII) |

> **Person standing is event-driven, never time-driven. A person does not lose standing through
> inactivity alone.** What looks like decay is **consequence carried forward through proof**.

**Required action:** separate the two throughout the manuscript, matrix, Plates and glossary. Ch18
must not imply a person's standing naturally decays; any decay/penalty/confidence passage must
**explicitly name** invariant standing. **CI-18: Doctrine Supported after ontology correction;
Implementation Supported; Impact Correct ontology.**

<details><summary>Original A-2 finding (superseded in its absolute form)</summary>

**A-2 · Ch18 — "standing decays" is contradicted by ratified doctrine**
**Type:** Ontology conflict · **Support:** Conflicting · **Impact:** Correct ontology

`STANDING_FRAMEWORK.md:24` (ratified): Standing is *"event-driven, **never** time-driven."* The
capability lane is **monotone** by migration (`Math.max(existing.capability, newScore)`). The code
states its rationale at `standingAccrualService.ts:20-21`: *"a bad agent at 12 months must not
outrank a good agent at 2 weeks."* **There is no decay function in the repo.**

**⚠ Ontology hazard — needs an authorial-intent ruling.** Contradiction-penalty logic *does* exist —
but for **invariants**, not persons (`services/invariants/lifecycle.ts:291`,
`penalty = min(0.8, timesContradicted × 0.15)`; Law XII). These are **two different `standing` fields
on two different tables**. If the decay/challenge language was written *about invariants*, it is
Supported and merely needs its subject named. If about persons, it is Contradicted.

**Also unsupported:** *"standing is contextual and challengeable."* `standingScore.ts:34-37` states the
score *"is NOT split per archetype"*; pathways are read-only filter tags. **No challenge, dispute,
contest or revocation path exists for persona Standing.** (`standing_corrected` corrects a defective
*formula*, not conduct — the migration header is explicit.)

**Supported and citable:** *"proven action, not reputation/popularity"* — outcome claims accrue
**nothing** until `verificationStatus === 'verified'`; consequence lanes carry 70%; the capability
signal is ceilinged at 40 so "signal noise cannot overwhelm verified outcomes."

</details>

### A-3 · Ch13/Ch20 — anchoring is claimed unscoped; governance receipts are at **zero**
**Type:** Overclaim · **Support:** Conflicting · **Impact:** Qualify wording

Live GitHub Actions evidence, canonical repo:
- **`anchoring-readiness`: 11 of 11 scheduled runs FAILED**, unbroken 2026-07-28 → 2026-08-02,
  byte-identical output — a standing condition, not a blip:
  `{"verdict":"degraded","governanceReceipts":{"anchored":0,"stuckLocal":0,"failed":3}}`
- **`access-receipts-batcher`: healthy** — run `30758869521`, 2026-08-02T17:26Z, **12 submitted, 0
  failed**, 925 runs total.

**Three underlying defects** (all operator-escalation items, see the operational annex below):
1. `finalizeReadyActivityReceipts` has **exactly one caller repo-wide** — a *manual admin route*
   (`app/api/admin/activity-receipts/finalize/route.ts:37`). No cron, workflow or EventBridge invokes
   it. `dvn_pending → dvn_recorded` currently **requires a human button press**.
2. **Three governance receipts at `dvn_failed`** across 11 canary runs (six days) with no retry,
   though retry routes exist.
3. **The readiness canary is a probable false negative.** `resolveIdentity`
   (`app/api/ops/dvn/readiness/route.ts:74-93`) calls `@dfinity/identity`'s `fromPem` **directly on the
   raw env value**. The real submission path (`services/ops/icAgent.ts:33,43` →
   `services/ops/pemNormalizer.ts`) first runs `normalizePem` (repairing Amplify's collapsed newlines)
   then tries **`@dfinity/identity-secp256k1`** — a package the readiness route never imports, and the
   one `pemNormalizer.ts:52-58` documents as *required*. The batcher succeeding on the same
   infrastructure proves the identity **does** parse. Two parsers, one truth — a
   source-of-truth-parity infraction (`inv.engineering.036/037`) **inside the canary meant to detect
   degradation**.

**Aggravating factor for Ch20:** `app/api/ops/dvn/status/route.ts:13,27-40` contains a
**`DVN_MOCK_MODE`** branch returning hardcoded `evmTx: '0x1234…5678'` and
`icpReceipt: 'mock-receipt-id-12345'`. A status dashboard can show plausible green while nothing is
anchored. Any screenshot used as evidence must be accompanied by proof mock mode was off.

**Ruling options:** split the claim by receipt class. *Supportable today:* "access-decision receipts —
including refusals — are submitted to the DVN canister on a fifteen-minute cycle." *Not supportable:*
any unqualified claim that governance/ratification acts are immutably anchored today.

### A-4 · Ch21 — the **Internet Foundation** has no *current* mandate instrument
### ✅ NARROWED 2026-08-02 by operator ruling **CR-8** — historical existence now externally evidenced

**The earlier absolute finding ("zero evidentiary existence") is WITHDRAWN.** External published
evidence — IAPP, *"BSI Group eyeing ethical data use,"* 1 June 2017, recording that the Foundation's
Universal Declaration of Digital Rights work had been covered **as far back as 2013** — establishes
the historical institution and its digital-rights lineage. **Ch5's historical authorship claim is now
supported.**

**What remains open is narrower and different in kind:** there is still **no canonical Internet
Foundation charter or mandate instrument in Polity Core** defining institutional purpose,
relationship to the polity, constitutional authority and limits, relationship to metaProof and other
operators, governance and continuity, or current institutional status. **Ch21's present-tense
sponsor/guardian role therefore remains unsupported.** The question to close is no longer *"did this
organisation exist"* (it did) but *"what is its constitutional mandate today."*

*Verification: **EXTERNALLY VERIFIED** (upgraded 2026-08-02).* The article has been independently
retrieved from the live IAPP page and archived as registered source **`SRC-IF-IAPP-2017-001`**
(`03-source-lineage/internet-foundation-uddr/SRC-IF-IAPP-2017-001.md`, sha256 `de36753f…dd6a`). The earlier
*operator-attested* qualification recorded a limitation of the **agent's retrieval**, not of the
evidence, and no longer applies. The live IAPP URL remains the primary external source; the archived
Markdown is the durable Polity Core evidence record.

<details><summary>Original A-4 finding (superseded in its absolute form)</summary>

**A-4 · Ch21 — the Internet Foundation has zero repo existence**
**Type:** Overclaim · **Support:** Partially supported · **Impact:** Qualify wording

`grep -ril "internet foundation"` returns **only manuscript and commentary files**. Absent from every
charter, the ratification ledger (`AMENDMENT_RECORDS.md`), `docs/platform-ontology.md`, all code, and
all cartridges. Yet Ch21 gives it the most constitutionally load-bearing role — sponsor/founder,
guardian against operator capture — and poses the self-test *"Does the Internet Foundation protect the
mission without monopolizing interpretation?"* about an entity with **no mandate document to test
against**.

**Ruling options:** (a) supply the founding/sponsorship instrument (not in this repo) and cite it;
(b) move every Internet Foundation passage to explicit forward-looking framing.
**Recommended:** treat as a publication blocker for Ch21 until (a) or (b).

**Escalation (2026-08-02).** The deposit of Volume I made this worse, not better. `grep -c "Internet
Foundation"` over the 2009/2013 source returns **0** — the Foundation is absent from the author's own
prior volume, which attributes the digital-rights call to *"NEO-citizens"* and to the author
personally. The Foundation is therefore unattested in: the codebase, every ratified charter, the
ratification ledger, `docs/platform-ontology.md`, **and Volume I**. It now underwrites two separate
present-tense claims (Ch5's authorship of the digital-rights call, and Ch21's sponsor/guardian role)
with no instrument behind either. See also ruling **R-16**.

</details>

### A-5 · Ch21/Ch22 — the **Commons is ratified but not built**, and canaries forbid claiming otherwise
**Type:** Overclaim · **Impact:** Move to future tense

Three independent in-repo statements: `services/venture/metacommonsSignals.ts` (*"deterministic stub…
constitutional-only today"*); `types/capabilityCompletion.ts:338` (*"the Commons resource model is **not
built yet**, so nothing here may claim it has"*); `tests/evidence-architecture.test.ts:25` (*"NOT TESTED
HERE, because it does not exist"*). `MetaCommonsResource` does not exist; there is **no
`promoteToCommons` symbol anywhere**. `tests/capability-completion.test.ts:640` **actively fails** any
artifact claiming published status while the Commons model is absent.

**Keep in present tense:** the Commons/Registry **distinction** *is* ratified (Law XVI + Amendment G)
and canary-enforced.

---

## Severity B — material qualifications

### B-1 · Ch15/Epilogue — the **embodied delegate** has no code, test, or receipt
**Type:** Overclaim · **Impact:** Move to future tense

The manuscript states an embodied delegate *"must make its status legible"* — that observers can know
it is an agent, whom it represents, its role, mandate limits, and how its actions verify; and that
*"the agent clearly declares its delegated status; a colleague can inspect its mandate."*

`app/components/metaVatar/MetaAvatar.tsx` and `packages/avatar-host/` are a **D-ID iframe container
with zero disclosure surface** — `AvatarHostProps` / `AgentConfig` / `AvatarContext` contain **no**
delegate-status, principal-identity, mandate, or non-human fields. The package README marks it
*"🚧 In Development — Phase 5."* Nearest real evidence: `agent-charter.v1.json`
`agentsMustBeIdentifiedAsNonHuman: true` — a **ratified doctrine flag, not rendering code**.

### B-2 · Ch24 — **exit rights are unimplemented while entry rights are fully instrumented**
**Type:** Overclaim · **Impact:** Qualify wording

Of the manuscript's eight enumerated exit verbs: **3 Implemented** (revoke an agent · end a mandate ·
rotate identity), **3 Partial** (change an operator — self-custody exists, no handover routine; move
information — only two domain-scoped exports, **no persona-level export**; withdraw from a service —
**soft delete only**), **2 Not found** (*leave a community* · *challenge standing*).

**No test named for exit, portability, export, deletion or migration exists anywhere.** No
subject-initiated departure receipt type exists (`ANCHORABLE_ACTION_TYPES` has
`agent_revocation_state_changed` and `passport_revoked`, both *institution*-initiated).

**Modal mismatch:** the manuscript writes *"must permit movement in both directions"* while its own
doctrine (Art. X §6) says *"shall retain, **where feasible**, rights of portability."* **The manuscript
is stronger than its own constitution here.** Structurally, an order whose exit rights are unbuilt
while entry is fully instrumented is the asymmetry Ch2 indicts platforms for.

### B-3 · Ch19 — "a refusal produces a receipt" is false in the flagship path
**Type:** Overclaim · **Impact:** Qualify wording

True in four places (access-spine denials, `approval_rejected`, Marketa refusals). **False in
MoneyPenny** — `app/api/moneypenny/runtime/route.ts:106` writes a receipt only `if (result.executed)`.
A run blocked at step 3 (no authorized agreement), step 5 (forbidden envelope) or step 9 (spend cap)
produces **no `activity_receipts` row at all**; the refusal survives only as a `trace` array in an HTTP
response body, discarded when the caller closes the tab.

**Do not cite venture-substrate refusal receipts as provenance.**
`services/venture/trading/receipts.ts:33-47` enumerates four states and refuses to conflate them —
*"receipt persisted — NO; receipt DVN-anchored — NO"* — adding that *"a report that says 'the receipts
exist' when it means 'receipt objects were generated' claims provenance that does not exist."*
Enforced by `assertVentureJournalCanLeaveMemory`, which **throws**.

### B-4 · Ch6/Ch14/Ch23 — time sovereignty and repair are **not measured**
**Type:** Overclaim + Missing proof · **Impact:** Qualify wording

- **No user-time measurement exists.** Grep for `timeSaved|time saved|hours saved|time returned` across
  `components/` and `app/` returns **zero** hits. `time_sovereignty` appears only as a *governance
  authority-domain label*, never as a quantity.
- **"Exported repair" has no computational representation at all** — 20+ manuscript occurrences and
  `inv.polity.268`, but **nowhere in any `.ts`/`.sql`**.
- **PoTS/NVA arithmetic is untested** — `netValueAccelerationHours`, `riskRepairHours` have **zero
  occurrences in `tests/`**. The whole NVA implementation is one expression: `Math.max(0, saved - repair)`.
- **`riskRepairHours` is an optional, self-declared, unvalidated field defaulting to 0** — a claim
  *input*, not a measurement.
- **Category error to avoid:** `types/experienceGuide.ts:78 RepairRisk` is a **hand-typed 7-sphere
  wellness self-assessment** (energy/body/mind/emotion/relationship/community/legacy), **not**
  constitutional risk-of-repair.

### B-5 · Ch22 — the openness claim is true but four artifacts undercut it
**Type:** Overclaim · **Impact:** Qualify wording

Verified: the repo **is** public MIT (unauthenticated fetch confirms). But —

| Defect | Location |
|---|---|
| License section is an **unfilled placeholder** `[Specify your licensing model]` | `README.md:376-378` |
| `"private": true`, **no `license` field**, no `repository` field | `package.json` |
| Copyright mismatch: `QubeAgent` vs `© metaProof Group` in the same tree | `LICENSE` vs `constitution-agentic-polity.v1.json` |
| **No `CONTRIBUTING.md` / `GOVERNANCE.md` / `CODE_OF_CONDUCT.md` / `SECURITY.md`** | repo root |

*"Operated by others"* is **not demonstrated** — no third-party bridge, fork, or independent deployment
exists. Ch22's own caution ("Open source may remain technically available while practical operation
requires inaccessible capital or expertise") **describes the current state precisely**.

**Strongest unused citation:** `app/api/public/irl/experiments/submit/route.ts` (CFS-042) —
passport-delegated external result submission through a six-gate chain onto the *same* receipted,
content-hashed, anchorable record, with **trustless verification** (recompute sha256 over `resultsJson`,
compare with the anchored hash). That operationalises non-exclusivity as a **constitutional** mechanism
rather than a licensing one.

### B-6 · Ch9/Ch12 — **remedy is deferred in code**
**Type:** Missing proof · **Impact:** Qualify wording

`services/passport/passportStatusMachine.ts:195-196` states in code: *"Appeal-driven reinstatement is a
review-decision concern (deferred per PRD §16); the graph deliberately has no revoked → approved edge
in v0.1."* Escalation *paths* exist, but there is **no appeals surface, no reinstatement transition, and
no remedy record type**. Ch9's *"Remedy responds when observance fails"* and Ch12's remedy language
should not be written as though remedy is operational.

### B-7 · Ch15 — "one-degree delegation" is architectural, not an enforced guard
**Type:** Overclaim · **Impact:** Qualify wording

Enforcement is **structural** (no agent-initiated grant path exists) plus `no-redelegation` constraint
**strings** on threshold routes. **No code rejects a re-delegation attempt.** Everything else in Ch15 —
bounded, attributable, inspectable, revocable, consequentially accountable — is real and tested.

### B-8 · Ch16 — "Companion Edge Service" is not a code symbol
**Type:** Ontology conflict · **Impact:** Correct ontology
Closest real mechanism: the Companion session handoff (`services/identity/passportSession.ts`
`handoffTokenHash`, `app/passport-connect`). Rename or mark Projected.

### B-9 · Ch17 — `discloseCredential()` has **no implementation**
Referenced by `types/access.ts:559`; **`services/identity/discloseCredential.ts` does not exist**.
ProveKit ZK is **stub-mode by default**, supports **2 of 5** circuits, and its header calls it a
*"partial cut for the 2026-06-13 hackathon"*. Narrow selective-disclosure present tense to what is
real: AES-256-GCM encryption + per-audience pairwise unlinkable references.

### B-10 · Ch21 — MVL / Registry / IRL ontology drift
- **Venture Lab:** four competing forms, **no `platform-ontology.md` entry** (see doctrine gap G-7).
- **Registry:** treated as one of seven peer institutions; the repo has **at least six distinct
  registries with no unifying charter**. Amendment G's four-layer model is the defensible framing.
- **IRL independence:** `CFS-019` places IRL *inside* the metaProof → metaMe operating stack and the
  operator's 2026-07-28 ruling brands it *"metaMe IRL"*. Suggest normative framing ("must not collapse")
  over descriptive ("are distinct").

---

## Severity C — under-claims (strengthen)

### C-1 · Ch11 (Invariance) — best-evidenced chapter, stated too cautiously
`DiscoveryClass = 'constitutional' | 'structural' | 'experiential'` is a **live type**, not prose.
373 invariants (222 canonical / 144 proposed). **94 tests passing.** The eight
`inv.commercialisation.*` records sit at `proposed` with provenance recording verbatim that the
evidence is *"platform-derived and UNVALIDATED"* — a working instance of the discipline the chapter
argues for. **Impact: Strengthen present tense.**

### C-2 · Ch23 (The Person Becomes Visible) — strongest-evidenced claim in scope
Real code, canonical verbatim-pinned copy (PRD-THR-001 §9a), **32 passing tests**.
`services/threshold/welcome.ts:35` already uses the correctly-hedged *"build standing through verified
contribution"*, quotable verbatim. **Impact: Strengthen present tense** — but do **not** cite time-saved
evidence or `RepairRisk`.

### C-3 · Ch19 — bounded authority at action time is under-stated
`requireAuthorizedAgreement` (`services/constitutional/constitutionalAgreement.ts:553-586`) **fails
closed by construction**: store unavailable, lookup error, *and* thrown exception all return
`refuse(...)` with HTTP 409 — three paths a convenience-minded implementation would have let through.

### C-4 · Ch20 — the build refuses to deploy on constitutional violations
`amplify.yml` runs two gates that **fail the build**: `scripts/check-persona-spine.mjs` and
`scripts/check-venture-receipt-constraint.ts` (the latter "fails closed, with no bypass flag").
Citable evidence for the "clear states" argument.

### C-5 · Ch24 — the crossing suite asserts *boundaries*, not the happy path
`tests/threshold-gateway.test.ts` (25 passing) includes *"a base crossing grants root navigation
authority — NO service capability"*, *"propose_delegation prepares only (never grants)"*, and
*"handshake tools are gated with an honest 'handshake required' (no silent action)"*.

---

## Operational annex — escalations outside manuscript scope

Surfaced by the audit; **no protected file was modified**. Each needs operator sign-off.

| # | Issue | Location | Risk |
|---|---|---|---|
| O-1 | Readiness canary PEM check diverges from the real actor's parser → **false "identity does not parse"** | `app/api/ops/dvn/readiness/route.ts:74-93` vs `services/ops/pemNormalizer.ts` | Misdiagnosis of DVN health; **this is the likely source of the earlier env-var debugging loop** |
| O-2 | `finalizeReadyActivityReceipts` has **no scheduler** — one manual admin caller | `app/api/admin/activity-receipts/finalize/route.ts:37` | `dvn_pending → dvn_recorded` never runs unattended |
| O-3 | **3 governance receipts at `dvn_failed`** for six days, unretried | `activity_receipts` | Provenance gaps |
| O-4 | `DVN_MOCK_MODE` can serve hardcoded green status | `app/api/ops/dvn/status/route.ts:13,27-40` | Dashboard may mask a broken anchor |
| O-5 | MoneyPenny refusals write **no receipt** | `app/api/moneypenny/runtime/route.ts:106` | Constitutional refusals leave no evidence — money-adjacent route, needs approval |
| O-6 | No parity canary between the two PEM parsers | `tests/source-of-truth-parity.test.ts` | The `inv.engineering.036/037` class defect recurs |
| O-7 | No `CREATE TABLE` for `iq_meta_qubes` / `iq_blak_qubes` / `iq_token_qubes` in this repo | referenced by FK columns only | Cannot verify iQube trinity schema from source |

---

## Ruling worksheet

| # | Chapter | Question for the operator |
|---|---|---|
| R-1 | 17 | Quantum entropy: requalify, delete the clause, or supply an external QRNG source? |
| R-2 | 18 | **Was the decay/challenge language written about invariants or persons?** Determines Correct ontology vs Remove claim. |
| R-3 | 13/20 | Split anchoring by receipt class, or supply live anchored-receipt evidence with `DVN_MOCK_MODE` off? |
| R-4 | 21 | Does an Internet Foundation founding instrument exist outside this repo? |
| R-5 | 21 | Confirm Commons → future tense; and which Commons definition is canonical (charter *field* vs Amendment E *governed proof substrate*)? |
| R-6 | 15/Epi | Embodied delegate → Projected, or commission a disclosure adapter + test first? |
| R-7 | 24 | Rewrite exit to the implemented subset, or publish with a documented gap register? |
| R-8 | 19 | Is "a refusal produces a receipt" universal or a pattern? (Fixing MoneyPenny is small but money-adjacent.) |
| R-9 | 12/20 | Ratify CI-CC-001, or accept that the two most dependent chapters cite a *proposed* document? |
| R-10 | 10 | Propose the five-line authority formulation as an invariant? Ratify a plutocracy source? |
| ~~R-11~~ | 1/5 | ~~Deposit a dated Volume I record~~ — **Volume I DEPOSITED 2026-08-02** (G-1 closed). Outstanding: UDHR text, A/RES/53/144, and dated **Internet Foundation** material. |
| **R-16** | 5 | **Volume I attributes the digital-rights call to the author and NEO-citizens — the Internet Foundation appears ZERO times in it.** Amend Ch5's "the Internet Foundation and I called for…", or supply dated Internet Foundation material? |
| **R-17** | 5 | Volume I says **"Universal Bill of Digital Rights"**; Ch5 says **"Declaration"**. Adopt Volume I's wording for the historical claim, or keep "Declaration" and explain the renaming? |
| **R-18** | 1 | Volume I's *"future volumes"* sentence is in the **January 2013 Preface**, not the 2009 original. Attribute the anticipation to 2013, or claim it for 2009? (Precise-dating risk.) |
| R-12 | 21 | Canonical Venture Lab name + `platform-ontology.md` entry? |
| R-13 | 22 | Fix README license / `package.json` / copyright / governance files before publication? |
| R-14 | 9/12 | May remedy be described in present tense given appeal is deferred in code? |
| R-15 | 6/23 | Does an optional self-declared `riskRepairHours` constitute "measurement"? Rename `RepairRisk`? |
