---
title: "The Constitutional Internet — Controlling Manuscript v0.3 — Companion Document"
work: "The Constitutional Internet: The Last Human Frontier (Dele Atanda)"
home: "Polity Core → Constitutional Internet → 00 Project Governance"
governs: "01-controlling-manuscript-v0.3.md"
status: "consolidation-pass record — 2026-08-04"
note: >-
  Companion to the v0.3 consolidation pass. Records what changed and why
  (§1), what is still genuinely undecided and must not be read as resolved by
  this pass (§2), what belongs to implementation rather than manuscript prose
  (§3), and a chapter-by-chapter publication-readiness call (§4). Nothing in
  this document introduces new doctrine; every claim traces to
  00-editorial-register.md, BOOK_DOCTRINE_LINEAGE.md,
  BOOK_DISCREPANCY_REGISTER.md, or BOOK_IMPLEMENTATION_RECONCILIATION.md.
---

# The Constitutional Internet — Controlling Manuscript v0.3 — Companion Document

## 0. Scope of this pass

v0.3 consolidates v0.2 (`01-working-manuscript.md`) by (a) stripping interleaved editorial
dialogue and the duplicated Epilogue draft, (b) applying rulings CR-1–CR-17 and additions
ADD-1–ADD-3 from `00-editorial-register.md`, and (c) inserting the previously-queued CR-17
quantum-transition passage. It does **not** re-litigate any open audit finding, does not ratify
any proposed doctrine, and does not touch the Internet Foundation's parked mandate question. v0.2
remains the archival source of record.

Companion corpus positioning, per the operator's instruction for this pass:

- **Experience Sovereignty**, **COYN Thesis**, and **The Polity** are canonical Polity Core
  *constitutional commentary* — registered, citable, and part of the doctrinal record. They live at
  `items/commentary/experience-sovereignty/07-agent-runbook.md`, `items/commentary/coyn-thesis/01…
  05-*.md`, and `items/commentary/polity/01…04-*.md`, registered in `collections.json` under
  `col_commentary_experience_sovereignty`, `col_commentary_coyn_thesis`, and `col_commentary_polity`.
  Being *commentary* rather than an individually ratified constitutional instrument is the normal
  status for a Polity Paper — per `items/commentary/README.md`, the one paper elevated to ratified
  constitutional status is *The Constitution of the Agentic Polity* (`items/commentary/polity/04-*`)
  itself; the source works are not diminished by remaining commentary alongside it.
  **Derived invariant doctrine is a separate question and must be stated at its own status:** the 28
  invariants seeded from Experience Sovereignty (`inv.polity.207`–`inv.polity.234`,
  `codexes/packs/agentiq/updates/2026-07-17_polity-experience-sovereignty-canonization.md`) are
  recorded at **`status: "proposed"`** in that canonization record — verified directly in this pass,
  not ratified. Two earlier, separate invariants are already canonical: `inv.polity.163` (Time
  Sovereignty) and `inv.polity.164` (Experience Sovereignty). Citing the 207–234 block as ratified
  canon would violate the hypothesis-vs-canon discipline (CLAUDE.md, "Hypothesis vs Canon") this
  project is bound by; v0.3 and this companion cite the source commentary, not the proposed block, as
  doctrine.
- **The Genie in the Lamp** and **The Constitutional Internet for Agents** — an exhaustive repo
  search (current branch and every remote branch) for `CI-AGENT-EDITION`, `BL-17`, `Genie in the
  Lamp`, `Action Boundary`, and `Paper VI` returned **no matches anywhere**. This companion cannot
  therefore confirm the operator's stated programme records (`CI-AGENT-EDITION.md`, a `BL-17`
  launch-readiness backlog entry, a Paper VI series ruling, an "Action Boundary" source draft) as
  deposited artifacts in `iQube-Protocol/AigentZBeta` — they may exist in a different repository, an
  uncommitted local session, or another planning surface this pass has no visibility into. Until
  their location is confirmed, v0.3 treats both works as **programme-level intentions asserted by
  the operator, not yet locatable in this codebase**, and does not fabricate their content or assume
  a deposit that cannot be verified. This is a factual-location gap, not a judgment that the
  underlying programme decisions are wrong.

**Deletion-scope confirmation (v0.2 lines 4967–5960).** Verified by direct line-for-line comparison
against the retained integrated Epilogue (v0.2 lines 5961–6529): the deleted block consists of two
kinds of content only — interleaved editorial dialogue (author voice notes and drafting responses)
and a full draft copy of the embodied-delegate/human-machine-symbiosis Epilogue material that is
word-for-word identical to the integrated version that follows it, differing only in missing
Markdown heading markers. No sentence in the deleted range lacks a surviving match in the retained
text. **No unique intended narrative passage was lost.**

## 1. Ruling-to-chapter integration matrix

| Ruling | Chapter(s) | v0.3 disposition |
|---|---|---|
| CR-1 — Polity Passport first use | Part I (Ch4) | **Applied.** First use (line ~504) already carried an in-place gloss ("a personhood-first constitutional credential"); retained as-is — it already satisfied the rule. |
| CR-2 — "polity" first use | Part I (Ch4) | **Applied.** Added an in-place gloss at first use, reusing the exact phrase the manuscript itself uses at the Ch24 definition ("the shared constitutional society and institutional order formed by participating persons, agents, and institutions"). |
| CR-3 — metaMe Venture Lab naming | Part VI transition | **Applied.** The self-cancelling dictation artifact ("MVL is the metaMe Venture Lab not the metaMe Venture Lab") was interleaved dialogue, not manuscript prose — removed along with the transition's duplicate header. Verified zero remaining bare "Meta Venture Lab" occurrences; two correct "metaMe Venture Lab" occurrences remain. |
| CR-4 — Present-tense consistency | Ch23/24 | **Checked, no change needed.** Grepped both chapters for future/conditional drift markers ("will become", "would be", "could become") — none found. |
| CR-5 — Institutional separation | Throughout | **Checked, no change needed.** No conflation found between the Internet Foundation, metaProof, metaMe, IRL, MVL, Commons, and Registry in the surviving prose. |
| CR-6 — Plutocracy / state-jurisdiction addendum | Part III coda | **Retained as positioned.** The addendum already sits inside Part III's own flow (after Ch13, before the Part III→IV transition) — this is a form of integration. Removed only the interleaved "review register" checklist note that preceded it; gave the section a proper `###` heading in place of the plain-text title fragment. Did not attempt a deeper merge into a specific numbered chapter — that would be a structural rewrite beyond a consolidation pass. |
| CR-7 — Chapter-title reconciliation | Ch5, Ch16, Ch17 | **Checked, no change needed.** All three ratified titles already match the manuscript headings. |
| CR-8 — Internet Foundation / UDDR lineage | Ch5, Ch10, Ch21 | **Ch5 unchanged — already compliant** ("the Internet Foundation and I called for a Universal Declaration of Digital Rights" matches the ratified permitted claim exactly). **Ch21 deliberately left untouched** — its present-tense sponsor/guardian claims are the still-open half of this ruling; see §2. |
| CR-9 — Quantum entropy implementation status | Ch17 | **Applied.** Ch17's present-tense "The Constitutional Internet uses quantum entropy…" was reworded to the ratified Projected-stage wording, "The Constitutional Internet's roadmap integrates quantum entropy…". The immediately following exact formulation ("We have not attempted to defeat quantum cryptography…") was left untouched — the register marks it exact and code-consistent as written. |
| CR-10 — Person standing vs. invariant standing | Ch18 | **Applied.** The one decay-implying clause ("It should decay or change where the relevance of old conduct diminishes") was reworded to event-driven language ("through proven action, penalty, repair, and constitutional consequence — never through time alone"). No other decay/contradiction-penalty language found in Ch18. Glossary requirement (two separate Appendix III entries) is **not yet actionable** — the manuscript has no Appendix III; see §2. |
| CR-11 — Receipt-class anchoring and proof-state precision | Ch13, Ch19, Ch20 | **Ch13: checked, no change needed** — its proof-chain description is already staged (before-action / execution / consequence / challenge) and never compresses to a single immutability claim. **Ch19: applied** — qualified "Constitutional refusal produces a receipt" with the required limitation that this is not yet true of every runtime path. **Ch20: applied** — reworded the chapter's closing "Its machinery operates" to "Its machinery is implemented and demonstrated in the paths this book can verify, and is being extended to the rest," matching the reconciliation audit's specific required fix for CI-20. |
| CR-12 — The Commons: institution vs. implementation | Ch21, Ch22, Epilogue | **Epilogue: applied** to the specific flagged passage ("The Commons and the Registry" scene) — both present-indicative Commons sentences reworded to "is constituted to preserve" framing. **Ch21/Ch22: checked, no change made** — existing Commons language there already reads as definitional/mandate ("The Commons preserves…" as a statement of constitutional purpose) rather than an operational-completeness claim; left as the author wrote it rather than over-editing a borderline case. |
| CR-13 — Embodied constitutional agents and personal digital twins | Ch7, Ch8, Ch15, Epilogue | **No manuscript change required.** The ruling **supersedes** the audit finding that flagged this (B-1) as wrong in scope — the existing manuscript language was already correct; only the audit's own claim needed correction, not the prose. |
| CR-17 — Constitution Before Substrate | Ch17 (cross-ref only), Ch19, Epilogue | **Applied — the reason for this pass.** Inserted the full queued passage into Ch19 (after the constitutional-computing/pluralism discussion, before the chapter's closing synthesis) and the forward-reference sentence into the Epilogue's Closing (before the final "threshold was recognition / participation" beats, so the book's actual last words are undisturbed). Ch17 needed no new prose — cross-reference only, per the register. |
| ADD-1 — The Embodied Delegate | Ch15 echo + Epilogue | **Applied.** v0.2 had the full Epilogue treatment integrated but had **not yet** added the concise Ch15 echo the register calls for. Added one paragraph immediately after Ch15's attribution discussion, using only the governing distinctions already ratified in ADD-1/CR-13 (agent may represent, must never be confused with, the person; the four-part proof question). |
| ADD-2 — Human–Machine Constitutional Symbiosis | Epilogue | **Applied by removing the duplicate.** The integrated version (already correctly sequenced: day-in-life → Humans and Machines → Invitation → Closing) is retained verbatim; the draft/proposal copy and the two rounds of dialogue that produced it were deleted along with the rest of the draft Epilogue block. |
| ADD-3 — Contained invitation + revised close | Epilogue | **Applied by removing the duplicate.** Same disposition as ADD-2 — the integrated "The Invitation" and "Closing" sections are retained verbatim (with the one CR-17 sentence added to Closing); the draft copy is removed. |

## 2. Genuinely unresolved editorial decisions

These are choices only the operator/author can make. v0.3 does not resolve them, and no future
consolidation pass should resolve them silently — each needs an explicit ruling first.

| Item | Chapter(s) | What's undecided | Why it's not mine to resolve |
|---|---|---|---|
| **Internet Foundation present-tense mandate** (A-4 remainder) | Ch21, echoed in Ch5/Epilogue | Ch21 asserts the Internet Foundation "is the sponsor and founder of the polity" and "sponsors and protects" it in the present tense. CR-8 ratified the **historical** claim (Ch5) but explicitly left the **present-tense institutional mandate** open, "PARKED 2026-08-02 — mandate ruling deferred pending source materials from the operator." | The register's own status marker is "parked pending operator materials" — supplying or declining to supply a charter/mandate instrument is an operator act, not an editorial one. The reconciliation audit flags this as a candidate **publication blocker for Ch21**. |
| **Volume I wording reconciliation** (R-16, R-17, R-18) | Ch1, Ch5 | Volume I attributes the digital-rights call to the author and "NEO-citizens" alone — the Internet Foundation appears zero times in it; Volume I says "Universal Bill of Digital Rights," Ch5 says "Declaration"; Volume I's "future volumes" sentence is in the 2013 Preface, not the 2009 original. | Three explicit either/or questions the register poses to the operator, none of which the register itself decides. |
| **CI-CC-001 ratification** (G-6) | Ch12, Ch20 | The book's own governing constitution document is header-marked "Proposed for canonisation" while its footer recommends "RATIFIED COMMENTARY" — a self-contradiction. Ch12 (rights without immunity) and Ch20 (present tense) depend on it as governing. | The register frames this as a binary the operator must choose: ratify it, or have the two dependent chapters openly cite a still-proposed document. Neither branch is an editorial wording fix. |
| **The five-line authority formulation** (G-3) | Ch10 | "The rights are universal / The invitation is global / …" is a strong compression with no canonical doctrine home. | Remedy requires proposing it into the invariant corpus as `proposed` — a doctrine-authoring act this pass is not authorized to take (per the hypothesis-vs-canon discipline, an agent may not raise a candidate above `validated`, and never mints a canon entry on its own initiative). |
| **Plutocracy-addendum sourcing** (G-4) | Ch10 | 14 manuscript occurrences of the plutocracy/jurisdiction argument versus 1 each in the invariant corpus, the seed JSON, and two source `.txt` files. CR-6 is an instruction to integrate, not a doctrinal source. | No remedy is stated in the register; whether this should be re-qualified as author-original argument or formally proposed as doctrine is unresolved. |
| **metaMe Venture Lab ontology entry** (G-7, B-10, R-12) | Ch21 | Four competing forms in the repo (`metaMe Venture Lab`, `Venture Lab`, `Venture Lab α`, tokens `mvl`/`venture-lab`); no `docs/platform-ontology.md` entry; `VENTUREQUBE_SPEC.md` is `draft_wip — NOT ratified`. | Requires a ratified ontology entry and/or charter — an institutional-doctrine action outside manuscript scope. |
| **Commons vs. Registry doctrine alignment** (G-8) | Ch21 | `METACOMMONS_CHARTER.md` (ratified) defines the Commons as *a field*; Amendment E / `platform-ontology.md` define it as *a governed proof substrate with four proof classes*. The manuscript follows the ontology, but the charter and ontology are themselves out of step. | Reconciling two already-ratified doctrine documents is a doctrine-maintenance action, not a manuscript edit. |
| **Standing glossary split** (CR-10 Appendix III requirement) | Appendix III | The register requires two separate glossary entries — *person standing* and *invariant standing* — each stating what it attaches to and what changes it. | The working manuscript has no Appendix III / glossary section at all. Adding one is a structural addition beyond a consolidation pass and needs an explicit go-ahead on scope (a new appendix, not a line edit). |
| **Plate count** (Plate programme, Editorial Master §6) | Cross-cutting | Lock list records a 14-Plate programme; the author's closing guidance targets "roughly one plate per part (~12–14)," suggesting Plates 6+7 or 13+14 could combine. `BOOK_PLATE_EVIDENCE_MAP.md` states explicitly: "**Plate-count ruling still open.**" Two Plates (9, 10) are separately marked "HIGH compression risk — do not render until ruled." | Author/operator decision on final count and on the two high-risk Plates' compression, not a text edit. |
| **Under-claims worth strengthening** (C-1 through C-5) | Ch11, Ch19, Ch20, Ch23, Ch24 | The reconciliation audit identifies five places where the manuscript is *more* cautious than the evidence supports (invariance: 373 invariants/94 passing tests; fail-closed authority enforcement; the build's own constitutional-violation deploy gates; the threshold-crossing test suite). Impact tag: "Strengthen present tense." | Deliberately **not applied in this pass** — these are enhancements, not corrections, and each needs its own carefully worded strengthening rather than a mechanical substitution. Flagged here so a future pass (or the operator) can decide whether to spend that effort before publication. |
| **README / package.json / licensing hygiene** (B-5, R-13) | Ch22 (citation, not content) | Ch22's openness claim is true in doctrine but undercut by an unfilled `[Specify your licensing model]` placeholder, a `"private": true` package.json with no license field, and a copyright mismatch between `LICENSE` and `constitution-agentic-polity.v1.json`. | Repository hygiene, not manuscript prose — listed here only because it is the evidentiary support for a manuscript claim, not because the manuscript itself needs editing. |

## 3. Implementation matters that must remain outside the manuscript

These are code, infrastructure, or operational gaps. Several already have permitted, qualified
manuscript wording (applied in §1); the underlying gap itself is engineering work, tracked here so
it is never confused with an editorial task.

**From the Discrepancy Register's own "Operational annex — escalations outside manuscript scope"**
(the register's own framing, reproduced because it says explicitly this is not manuscript work):

| # | Issue | Location | Risk |
|---|---|---|---|
| O-1 | Readiness canary PEM check diverges from the real actor's parser → false "identity does not parse" | `app/api/ops/dvn/readiness/route.ts:74-93` vs `services/ops/pemNormalizer.ts` | Misdiagnosis of DVN health |
| O-2 | `finalizeReadyActivityReceipts` has no scheduler — one manual admin caller | `app/api/admin/activity-receipts/finalize/route.ts:37` | `dvn_pending → dvn_recorded` never runs unattended |
| O-3 | Governance receipts stuck at `dvn_failed`, unretried | `activity_receipts` | Provenance gaps |
| O-4 | `DVN_MOCK_MODE` can serve hardcoded green status | `app/api/ops/dvn/status/route.ts:13,27-40` | Dashboard may mask a broken anchor |
| O-5 | MoneyPenny refusals write no receipt | `app/api/moneypenny/runtime/route.ts:106` | Constitutional refusals leave no evidence |
| O-6 | No parity canary between the two PEM parsers | `tests/source-of-truth-parity.test.ts` | Recurrence of the `inv.engineering.036/037` defect class |
| O-7 | No `CREATE TABLE` for the iQube trinity tables in this repo | referenced by FK columns only | Cannot verify schema from source |

**Remediation gates named directly by the rulings applied in §1** (these are what CR-11's and
CR-12's manuscript wording is qualifying against — the manuscript now says the right thing about
each; the items below are what would need to be true before the wording could be strengthened
again):

- **To upgrade governance-receipt anchoring to operational** (CR-11): unify the readiness canary
  and the production identity parser; schedule the finalizer; clear or adjudicate stuck governance
  receipts; add end-to-end tests receipt-generation → anchoring-confirmation; produce deployment
  evidence of non-zero anchored governance receipts; ensure failures escalate visibly.
- **To make the refusal-receipt claim universal** (CR-11, Ch19): write a durable receipt for
  blocked MoneyPenny runtime executions; include the refusal invariant, mandate boundary, and
  failed step; test the path; verify persistence after session end.
- **To upgrade the Commons to implemented/operational** (CR-12, all ten required together): a
  canonical Commons resource model; constitutional admission criteria; an operational promotion
  pathway; provenance and rights preservation; capability packaging and retrieval; removal/
  supersession/repair procedures; reproduction guidance; tests proving invariants survive
  promotion and reuse; at least one demonstrated end-to-end Commons artifact; deployed-environment
  evidence.
- **To upgrade quantum entropy to Entering-deployment/Operational** (CR-9): locate the Qubit
  entropy adapter/service; integration points for the relevant randomness operations; fallback and
  failure behaviour; provenance/receipt evidence identifying the entropy source; tests demonstrating
  correct use *and* degradation behaviour; security review; deployment evidence.
- **Exit-rights implementation gap** (B-2, Ch24): of the manuscript's eight enumerated exit verbs,
  3 are implemented, 3 partial (no persona-level export; soft-delete only for service withdrawal),
  2 not found (leave-a-community, challenge-standing). No test named for exit, portability, export,
  deletion, or migration; no subject-initiated departure receipt type exists.
- **Time-sovereignty / repair measurement gap** (B-4, Ch6/14/23): no user-time measurement exists
  anywhere in `components/`/`app/`; "exported repair" has zero computational representation;
  `riskRepairHours` is an optional, self-declared, unvalidated field defaulting to 0 — an input, not
  a measurement; `RepairRisk` in `types/experienceGuide.ts` is a different concept (a hand-typed
  wellness self-assessment) that must not be cited as evidence for this claim.
- **Remedy/appeal deferred in code** (B-6, Ch9/12): `passportStatusMachine.ts` states directly that
  "appeal-driven reinstatement is a review-decision concern (deferred per PRD §16)"; no appeals
  surface, no reinstatement transition, no remedy record type exists yet.
- **One-degree delegation is structural, not enforced** (B-7, Ch15): no code currently rejects a
  re-delegation attempt; the guarantee holds today because no agent-initiated grant path exists,
  not because a check refuses one.
- **`discloseCredential()` does not exist** (B-9, Ch17): referenced by `types/access.ts:559` with no
  implementing file; ProveKit ZK is stub-mode by default, 2 of 5 circuits, self-described as a
  "partial cut for the 2026-06-13 hackathon."
- **"Companion Edge Service" is not a code symbol** (B-8, Ch16): closest real mechanism is the
  Companion session handoff (`services/identity/passportSession.ts`); needs renaming or a
  Projected mark, not a build task, but the underlying capability itself doesn't yet exist under
  that name.

## 4. Publication-readiness assessment by chapter

Status column reflects **v0.3**, incorporating the edits in §1. "Gate" names what would need to
change (in the manuscript or in the codebase) to move a chapter to fully clear.

| Ch | Title | Support (per reconciliation audit) | v0.3 status | Remaining gate |
|---|---|---|---|---|
| 1 | The Wave Arrives | Partially supported | **Clear for publication.** Volume I deposit (G-1) closed the main gap. | Author's own external archival verification of the 2009 publication (operator's pass, not blocking). |
| 2 | The Platform Settlement | Supported | **Clear.** | None found. |
| 3 | The Person Disappears | Supported | **Clear.** | None found. |
| 4 | Personhood Before Identity | Supported | **Clear.** CR-1/CR-2 first-use glosses applied here. | None. |
| 5 | Human Rights, Digital Rights, Personhood Rights | Partially supported | **Clear on the ratified claim** (CR-8). | UDHR primary text and the 1998 Declaration remain uncited internally; Volume I wording reconciliation (R-16/R-17) is an open author choice, not a blocker for the current wording. |
| 6 | The Digital Threat Is Physical | Partially supported | **Clear with existing qualification.** | Time-sovereignty/repair measurement gap (§3) — under-claimed already, so no overclaim risk; strengthening is optional (C-1 class), not required. |
| 7 | The Machine Enters The World | Partially supported → **resolved by CR-13** | **Clear.** CR-13 supersedes the earlier "no disclosure surface" finding as an audit scope error, not a manuscript defect. | None from the manuscript side. |
| 8 | The Last Human Frontier | Partially supported | **Clear.** | No canary yet binds the charter's embodiment prohibitions to code — an implementation follow-up, not a text issue. |
| 9 | What A Constitution Does | Supported (one exception) | **Clear except the remedy terminus**, which Ch9 already treats only as doctrine, not as an operational claim. | See B-6 (§3) — code-side. |
| 10 | By What Authority | Partially supported | **Clear as author-original argument**, per CR-6's integration. | G-3 (five-line formulation) and G-4 (plutocracy sourcing) remain open doctrine questions (§2), not manuscript defects. |
| 11 | Invariance | Supported — best-evidenced chapter | **Clear**, and under-stated relative to evidence (C-1). | Optional strengthening only, not applied in this pass. |
| 12 | Rights Without Immunity | Partially supported | **Not fully clear** — depends on CI-CC-001, which is not ratified (G-6). | Operator ratification decision (§2). |
| 13 | Proof Before Trust | Conflicting (per audit; not a manuscript overclaim) | **Clear on the text** — already stages the proof chain without compressing to a single immutability claim. | The *contradiction* the audit found is in the DVN anchoring pipeline's operational state (11/11 failed readiness runs), not in this chapter's wording. |
| 14 | Human Agency Is Personhood In Action | Partially supported | **Clear with existing qualification.** | Time-returned measurement gap (§3), shared with Ch6/23. |
| 15 | When Something Acts In Your Name | Supported | **Clear**, and strengthened in this pass with the ADD-1 embodied-delegate echo. | One-degree delegation is structural rather than enforced (B-7) — a code gap, not a wording gap; current text already claims only what's true. |
| 16 | The Passport Of The Person | Supported | **Clear** on everything except one naming item. | "Companion Edge Service" naming (B-8) — not addressed in this pass; low risk, recommend a follow-up wording pass. |
| 17 | Privacy Through Different Assumptions | Was Conflicting → **resolved in this pass** | **Clear.** CR-9 wording applied; the exact "we use quantum mechanics to strengthen randomness" formulation retained per the register. | None on the manuscript side; CR-9's own implementation gate (§3) governs any future upgrade to stronger wording. |
| 18 | Standing Carries Consequence | Was Conflicting → **resolved in this pass** | **Clear.** CR-10 wording applied; no decay/contradiction-penalty language remains for person standing. | Appendix III glossary split (§2) is a structural addition, not blocking this chapter's own text. |
| 19 | Constitutional Information And Computing | Partially supported → **strengthened in this pass** | **Clear.** CR-11 refusal-receipt qualification applied; CR-17 substrate-independence passage inserted. | Canonical registry-plane status (noted by the audit) is a code-side item, not a wording issue post-edit. |
| 20 | The Constitutional Internet Is Here | Partially supported → **resolved in this pass** | **Clear.** Closing sentence reworded per the audit's specific CI-20 instruction. | `DVN_MOCK_MODE` hardcoded status (§3) is a code-side risk to the *evidence*, not to this chapter's current wording. |
| 21 | The Polity As Constitutional Institute | Partially supported | **Not clear — the book's largest open item.** | Internet Foundation present-tense mandate (§2) is an explicit candidate publication blocker; Commons operational-completeness qualified in Epilogue only, not re-touched here (§1); Venture Lab ontology (G-7) and Commons/ontology divergence (G-8) both open. |
| 22 | Many Bridges, One Polity | Partially supported | **Clear on doctrine**, qualified on evidence. | README/package.json/licensing hygiene (§3) undercuts the openness claim's supporting evidence, not its argument. |
| 23 | The Person Becomes Visible | Partially supported — strongest-evidenced claim in scope | **Clear**, and under-stated relative to evidence (C-2). | Optional strengthening only; explicitly must **not** cite time-saved/RepairRisk evidence (still unmeasured, §3). |
| 24 | Entering The Polity | Partially supported | **Clear on the claims it makes**, narrowed already to the implemented subset. | Exit-rights implementation gap (B-2, §3) remains real; the manuscript's current wording does not overclaim it. |
| — | Epilogue — The Constitutional Society | Partially supported | **Clear.** Duplicate draft removed; CR-12 Commons framing qualified in the flagged passage; CR-17 forward reference added; ADD-2/ADD-3 integrated versions retained verbatim. | Internet Foundation present-tense sponsorship line in the same scene as the qualified Commons passage was deliberately left untouched — same open item as Ch21. |

**Overall**: 20 of 24 chapters plus the Epilogue are assessed clear for publication as currently
worded. Two (Ch12, Ch21) carry genuine open gates requiring an operator decision, not an editorial
fix. Two more (Ch13, Ch22) are clear on their own text but rest on evidence that is itself
incomplete or contradicted elsewhere in the stack — a distinction the manuscript's own
implementation-state discipline (CR-11's governing rule) requires making explicit rather than
resolving by omission.
