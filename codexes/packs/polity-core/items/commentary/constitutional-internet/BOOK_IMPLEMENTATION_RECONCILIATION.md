# Book Implementation Reconciliation

**Project:** The Constitutional Internet — The Last Human Frontier (Dele Atanda)
**Artifact:** BOOK_IMPLEMENTATION_RECONCILIATION.md
**Home:** Polity Core → Constitutional Internet → 02 Chapter Matrix
**Audit run:** 2026-08-02 · commit `23b012473` · branch `claude/review-session-setup-V82mB` · canonical repo `iQube-Protocol/AigentZBeta`
**Audit invariant:** Documentation may describe intent; only code, tests, receipts, and current deployment evidence establish implementation state.

> **Environment caveat.** `dev-beta.aigentz.me` was **not reachable** from the audit sandbox (403 at the
> egress proxy). Every *Operational* determination below is inferred from code, wiring, tests, GitHub
> Actions logs and recorded operator runs — **not** from a live-endpoint check.
>
> **Scope.** This is the **internal** pass (doctrine + code + test + receipt + deployment). The
> **external** historical/legal/scientific evidence pass for Chapters 1–13 is the operator's parallel
> workstream and is deliberately **not** covered here.

---

## Completion gate

Every material manuscript claim carries the full chain:

> **Doctrine → Code → Test → Receipt or demonstration → Current state → Manuscript impact**

All 24 chapters are populated. Counts:

**Implementation state:** Implemented **9** · Ratified **8** · Demonstrated **4** · Operational **1** · Contradicted **1** · Not found **1**

**Support finding:** Partially supported **14** · Supported **7** · Conflicting **3**

**Manuscript impact:** Qualify wording **12** · Citation only **8** · Strengthen present tense **2** · Move to future tense **1** · Correct ontology **1**

---

## CI-01 — Ch1 · The Wave Arrives

*Part I — The Internet We Entered*

**Claim.** The Digitterian forces matured into an infrastructural Internet; the unresolved question is the constitutional order built in their wake.

| Link | Evidence |
|---|---|
| **Doctrine** | inv.polity.163 Time Sovereignty (canonical); inv.polity.212 The time dividend; inv.polity.213; inv.polity.192; inv.polity.189<br>codexes/packs/polity-core/items/commentary/coyn-thesis/02-time-sovereignty.md; 01-the-fallacy-of-free-information.md; ci-cc-001 Rule 0 |
| **Code** | codexes/packs/irl/foundation/appendix-a_canonical-invariants.md (163,189,192,212,213); canonical-invariants.seed.json; 00-editorial-master.md 'Volume I Continuity'<br>*symbol:* n/a (doctrine) |
| **Test** | n/a |
| **Receipt / demonstration** | n/a |
| **Current state** | **Ratified** — n/a |
| **Support** | **Partially supported** |
| **Manuscript impact** | **Citation only** |

**Recommended action.** Deposit a dated Volume I source record into polity-core before the citation pass; otherwise Ch1's lineage rests ENTIRELY on external/archival evidence. The Ch1 TIME argument is fully covered by ratified doctrine (163/212/213) and can be cited now.

**Notes.** LOAD-BEARING GAP: The Digitterian Tsunami (Volume I) exists NOWHERE in this repo as text, extract, archived manuscript or registered pack item. All 25 'Digitterian' hits are inside the Volume II manuscript, its master/register, the matrix, 00-project-structure.md and one collections.json string. Same for 'NEO-citizen' and the 'twenty-one principles' (never enumerated internally). Ch1's continuity claims (2009 dating, blog-post origin, 21 principles, NEO-citizen coinage, anticipation of later volumes) have NO internal corroborating record - only the author's restatement in the manuscript being audited. External: Operator external pass.

---

## CI-02 — Ch2 · The Platform Settlement

*Part I — The Internet We Entered*

**Claim.** Platforms exercise constitutional functions through private ownership, terms, identity, visibility, markets, sanctions, and revocable access.

| Link | Evidence |
|---|---|
| **Doctrine** | inv.polity.189 From perimeter to polity; inv.polity.208 Access is not sovereignty; inv.polity.207; inv.polity.194; inv.polity.190; inv.polity.164<br>CONSTITUTION_OF_AGENTIC_POLITY.md Article I §2 (personhood precedes permission); Article X §5 (no exclusive constitutional legitimacy by market position) |
| **Code** | codexes/packs/polity-core/items/commentary/polity/02-from-perimeter-to-polity.md (primary); 01-beyond-the-binary.md; items/CONSTITUTION_OF_AGENTIC_POLITY.md; irl/foundation/appendix-a_canonical-invariants.md<br>*symbol:* n/a (doctrine) |
| **Test** | n/a |
| **Receipt / demonstration** | n/a |
| **Current state** | **Ratified** — n/a |
| **Support** | **Supported** |
| **Manuscript impact** | **Citation only** |

**Recommended action.** Cite inv.polity.189 and Art. I §2 / Art. X §5 directly. The matrix correctly expects NO internal code proof for this chapter.

**Notes.** Discrepancy: None. Ch2's core move (platforms govern: populations via accounts, borders via access control, identity via credentials, currency/property/sanction/appeal) is the polity-side restatement of inv.polity.189. Manuscript line 207 maps directly onto Article I §2 and inv.polity.208. External: Operator external pass.

---

## CI-03 — Ch3 · The Person Disappears

*Part I — The Internet We Entered*

**Claim.** The person is constitutionally prior to every account, identity, credential, profile, model, agent, and institution.

| Link | Evidence |
|---|---|
| **Doctrine** | Canonical Asset 002 — metaVitruvian (Constitutional Atlas)<br>components/representation/MetaVitruvian.tsx header; manuscript Ch3 'The Person Disappears' |
| **Code** | components/representation/MetaVitruvian.tsx; services/composition/canonicalAssets.ts; app/api/constitutional/canonical-assets/route.ts<br>*symbol:* MetaVitruvian, CanonicalAssetRegistryPanel, useRepresentation() |
| **Test** | tests/representation-system.test.ts (representation contract canary); no test asserts metaVitruvian person-centrality specifically |
| **Receipt / demonstration** | Not applicable — presentational asset |
| **Current state** | **Implemented** — Canonical-assets API route present; no deployed render evidence in-repo |
| **Support** | **Supported** |
| **Manuscript impact** | **Citation only** |

**Recommended action.** Cite MetaVitruvian.tsx as the concrete person-centrality representation primitive; note it is presentational (SSR-safe, carries no identifiers), not an identity mechanism.

**Notes.** Component encodes minimum-disclosure (blindfold band) and composable-identity primitives (humanity/individuality/uniqueness/standing/delegation/anonymity) — strong doctrinal match for Ch3, but it is pure SVG: verify the manuscript does not imply runtime behaviour it does not provide. Discrepancy: None.

---

## CI-04 — Ch4 · Personhood Before Identity

*Part II — The Personhood Crisis*

**Claim.** Personhood gives continuity; identity gives context. Sovereign personhood precedes sovereign identity.

| Link | Evidence |
|---|---|
| **Doctrine** | DIDQube three-class model (operator ratification 2026-07-20)<br>services/identity/personhoodResolver.ts header; manuscript Ch4 |
| **Code** | services/identity/personhoodResolver.ts; supabase/migrations/20260427000000_root_did_persona_binding.sql; services/identity/passportPrincipal.ts; services/identity/passportSession.ts<br>*symbol:* resolvePersonhood, PersonhoodSet; tables kybe_identity, root_identity, did_persona |
| **Test** | tests/passport-bureau.test.ts; tests/access-spine.test.ts; tests/persona-broadcast-handshake.test.ts (T0 leakage canaries). No dedicated test asserts the kybe→root→persona precedence walk. |
| **Receipt / demonstration** | passport_issued, passport_status_changed in ANCHORABLE_ACTION_TYPES (services/dvn/activityReceiptDvnPipeline.ts:52-56); status-transition audit log (polity_passport_bureau.sql) |
| **Current state** | **Implemented** — Bureau discovery doc at app/.well-known/polity-passport/route.ts; no in-repo proof personhood tables are populated in a deployed env |
| **Support** | **Supported** |
| **Manuscript impact** | **Citation only** |

**Recommended action.** Cite the DIDQube schema as the concrete personhood-beneath-persona hierarchy. Note personhood-proof strength is gated on World ID provider secrets (see CI-16).

**Notes.** Schema encodes hierarchy did_persona.root_id → root_identity.kybe_id. Migration seeds only a Kybe dev stub (did:kybe:dev:stub:v1). 'Identity gives context' maps to did_persona.default_identity_state ladder anonymous→identifiable. Discrepancy: None.

---

## CI-05 — Ch5 · Human Rights, Digital Rights, And Personhood Rights

*Part II — The Personhood Crisis*

**Claim.** Human rights remain continuous across computational life; digital rights return to their root as personhood rights.

| Link | Evidence |
|---|---|
| **Doctrine** | inv.polity.177 The human-rights floor (cites Art. I §6-7 + Art. IX, UDHR Art. 15); inv.polity.179 four-tier rights hierarchy; inv.polity.175; inv.polity.178<br>CONSTITUTION_OF_AGENTIC_POLITY.md Article II §1-7 (Sovereign Natural Person); Article III §1-12 (esp §3 foundational-rights floor) |
| **Code** | items/CONSTITUTION_OF_AGENTIC_POLITY.md (Art II ~161-175, Art III ~176-223); commentary/polity/03-citizenship-in-the-agentic-internet.md (UDHR Art 15 at 180,433,461); RIGHTS-AS-CODE: types/access.ts AccessDecisionReason (:463); services/access/evaluateAccess.ts; services/iqube/legibility/schemas.ts:155 IQubeAgentGovernanceSchema.rights; services/polity/frameworks/constitution-agentic-polity.v1.json served by GET /api/polity-core/constitution<br>*symbol:* AccessDecisionReason incl. 'guardian-vetoed','policy-blocked' |
| **Test** | tests/governance-constitution.test.ts (48 pass); tests/constitutional-binding.test.ts (16 pass) |
| **Receipt / demonstration** | n/a for the historical lineage |
| **Current state** | **Ratified** — n/a |
| **Support** | **Partially supported** |
| **Manuscript impact** | **Citation only** |

**Recommended action.** Cite inv.polity.177/179 and Art II/III as the ratified spine. The four-tier hierarchy (179) is flagged in its own provenance as 'the #1 deferred item from pass 1', now closed - cite as canonical. The historical lineage requires the operator's archival evidence.

**Notes.** Ratified doctrine covers the chapter's spine; the SPECIFIC HISTORICAL LINEAGE DOES NOT EXIST INTERNALLY. NO UDHR text, NO 1998 UN Human Rights Defenders Declaration, NO archived Internet Foundation 'Universal Declaration of Digital Rights' material anywhere in the repo. Manuscript line 728 ('the Internet Foundation and I called for a Universal Declaration of Digital Rights') has ZERO internal corroboration - authorial assertion pending archival evidence. External: Operator external pass.

---

## CI-06 — Ch6 · The Digital Threat Is Physical

*Part II — The Personhood Crisis*

**Claim.** Information becomes inference, decision, action, and embodied consequence; constitutional responsibility follows the whole chain.

| Link | Evidence |
|---|---|
| **Doctrine** | inv.polity.161, inv.polity.198, inv.polity.268 (canonical)<br>codexes/packs/irl/foundation/canonical-invariants.seed.json; STANDING_CHARTER.md §'Standing and Proof of Time Saved' (L56-62) |
| **Code** | services/receipts/activityReceiptService.ts; services/consequence/pipeline.ts; services/consequence/stages.ts; services/consequence/counterfactual.ts; services/venture/ventureOutcomeAccrual.ts; types/ventureQube.ts:727<br>*symbol:* createActivityReceipt, CONSEQUENCE_PIPELINE (13 stages), assessRiskHeuristic, assessValueHeuristic, netValueAccelerationHours(), riskRepairHours |
| **Test** | tests/consequence-pipeline.test.ts (11 tests PASS); tests/activity-receipts-action-type-parity.test.ts. NO test exercises netValueAccelerationHours/riskRepairHours (zero hits in tests/). |
| **Receipt / demonstration** | consequence_forecast_recorded, remediation_recorded, standing_accrued — DB-constrained and in ANCHORABLE_ACTION_TYPES. No PoTS-specific or repair-specific receipt type. |
| **Current state** | **Demonstrated** — Needs external verification — migrations exist in-repo; applied state and DVN anchoring liveness not verifiable from sandbox |
| **Support** | **Partially supported** |
| **Manuscript impact** | **Qualify wording** |

**Recommended action.** Keep the information→inference→decision→action→receipt chain in present tense (built + tested). Move 'exported repair is evaluated' to normative/future framing — it has no computational representation.

**Notes.** Discrepancy: Overclaim (exported repair) + Missing proof (PoTS arithmetic untested). NVA implementation is one expression: Math.max(0, saved - repair) at ventureOutcomeAccrual.ts:41-46. riskRepairHours is an optional self-declared schema field, not a measurement. Verified-claim gating IS real (verificationStatus==='verified' required, :107-118).

---

## CI-07 — Ch7 · The Machine Enters The World

*Part II — The Personhood Crisis*

**Claim.** Embodied and autonomous machines require legitimate authority, bounded mandate, proof, refusal, accountability, and remedy.

| Link | Evidence |
|---|---|
| **Doctrine** | agent-charter v1.0.0 (ratified 2026-06-17); DELEGATION_FRAMEWORK.md v1.0.0<br>services/polity/frameworks/agent-charter.v1.json; codexes/packs/polity-core/items/DELEGATION_FRAMEWORK.md; editorial register ADD-1 |
| **Code** | app/api/codex/chat/agentiq-os/delegation/route.ts; services/access/evaluateAccess.ts; types/orchestration.ts:31; types/constitutional.ts:79; app/components/metaVatar/MetaAvatar.tsx; packages/avatar-host/<br>*symbol:* delegation route (POST/GET/DELETE), PolicyEnvelope, denyDecision, AgentDisposition (deny/escalate) |
| **Test** | tests/access-spine.test.ts (deny/allow, disposition exhaustiveness); tests/delegate-standing-gate.test.ts; tests/voice-persona.test.ts. No route-lifecycle test; no embodied-disclosure test. |
| **Receipt / demonstration** | agent_delegated / agent_delegation_revoked created and DVN-enqueued (route.ts:495-504,573-581; pipeline:95-96). No captured receipt/anchor artifact in repo. |
| **Current state** | **Implemented** — Active delegation state in-memory (cleared on restart); durable ledger Supabase delegation_grants + orchestration_events; DVN anchor enqueued to IC. No deployed-run evidence. |
| **Support** | **Partially supported** |
| **Manuscript impact** | **Qualify wording** |

**Recommended action.** Cite delegation route + agent-charter + evaluateAccess for authority/mandate/refusal. Flag the embodied/avatar disclosure adapter as NOT implemented before any present-tense claim ships.

**Notes.** Discrepancy: Overclaim (embodied/avatar disclosure). Five properties (authority, mandate, proof, refusal, accountability) have real code; embodied disclosure has none. metame-guardian is a .claude/agents dev-time sub-agent definition, NOT runtime code — runtime refusal is evaluateAccess.denyDecision + the x409 constitutional-agreement gate.

---

## CI-08 — Ch8 · The Last Human Frontier

*Part II — The Personhood Crisis*

**Claim.** The last human frontier is whether computational systems remain subordinate to personhood or personhood becomes subordinate to computation.

| Link | Evidence |
|---|---|
| **Doctrine** | agent-charter v1.0.0<br>phase1.agentsMustNotPossess; identityClass.ADID (isHuman:false, mayNot vote/possess_citizenship/hold_constitutional_rights); sponsorship.required / noOrphanedAgents; economicControls.assetsRemainOwnedBySponsor |
| **Code** | services/polity/frameworks/agent-charter.v1.json; services/access/evaluateAccess.ts; app/api/codex/chat/agentiq-os/delegation/route.ts:345-350; types/constitutional.ts<br>*symbol:* agent-charter JSON doctrine object; disposition proceed|ask|escalate|deny; L5_CORE_SOVEREIGN rejection |
| **Test** | tests/access-spine.test.ts (deny/allow). No embodied-agent conformance test; no test binds agentsMustNotPossess to a running code path. |
| **Receipt / demonstration** | None specific; delegation receipts indirectly attribute agent actions to a sponsoring persona |
| **Current state** | **Ratified** — N/A for the charter (static doctrine); evaluateAccess runs server-side in API routes |
| **Support** | **Partially supported** |
| **Manuscript impact** | **Citation only** |

**Recommended action.** Cite agent-charter.v1.json as ratified doctrine. Do NOT claim automated embodied-agent conformance testing exists.

**Notes.** Discrepancy: Underclaim risk (doctrine is strong and ratified) + Missing proof (no canary binds the charter's prohibitions to enforced code, unlike the T0-leak canaries elsewhere).

---

## CI-09 — Ch9 · What A Constitution Does

*Part III — The Constitutional Turn*

**Claim.** A constitution makes power legitimate, bounded, visible, procedural, provable, consequentially accountable, and remediable.

| Link | Evidence |
|---|---|
| **Doctrine** | inv.polity.176 constitutional priority chain; inv.polity.186 Constitutional restraint; inv.polity.183 rights-affecting-action gate; inv.polity.184 Escalation over silent execution<br>CONSTITUTION_OF_AGENTIC_POLITY.md Art I §4-5, Art IX §6, Art XII; GOVERNANCE_FRAMEWORK.md; CONSTITUTION.md §Core Principle + §Amendment |
| **Code** | items/CONSTITUTION.md; GOVERNANCE_FRAMEWORK.md; AMENDMENT_RECORDS.md; CONSTITUTION_OF_AGENTIC_POLITY.md Art I/IX/XII; constitutional-records/invariant-intelligence.md; IMPLEMENTED CHAIN: canonical-invariants.seed.json (373), services/invariants/*, services/receipts/activityReceiptService.ts, services/dvn/activityReceiptDvnPipeline.ts, services/governance/governanceRatification.ts<br>*symbol:* constitution -> commentary -> invariants -> architecture -> execution -> receipts -> proof -> remedy |
| **Test** | tests/governance-constitution.test.ts (48 pass); tests/constitutional-binding.test.ts (16 pass); tests/invariant-intelligence.test.ts (13 pass) |
| **Receipt / demonstration** | governance ratification receipts; seed corpus explicitly declares itself bootstrap material, DB authoritative, frozen via scripts/export-crystal-snapshot.mjs into hashed Crystal snapshots |
| **Current state** | **Ratified** — GET /api/polity-core/constitution |
| **Support** | **Supported** |
| **Manuscript impact** | **Citation only** |

**Recommended action.** Cite Art I §4-5, Art IX §6, Art XII and the invariant corpus. Ch9's closing chain is doctrinally exact AND demonstrated by the codebase's own machinery. EXCEPTION: the 'remedy' terminus is NOT closed - see CI-12.

**Notes.** Discrepancy: None except the remedy terminus. The one link the chapter asserts that the code does NOT close is REMEDY (see CI-12: appeal-driven reinstatement deferred; no revoked->approved edge in v0.1). External: Operator external pass.

---

## CI-10 — Ch10 · By What Authority

*Part III — The Constitutional Turn*

**Claim.** The Constitutional Internet has permissionless existence, participatory authority, universal rights scope, and legally bounded coercive jurisdiction.

| Link | Evidence |
|---|---|
| **Doctrine** | inv.polity.185 Open, plural, non-monopolized implementation; inv.polity.177; inv.polity.180; inv.polity.184<br>CONSTITUTION_OF_AGENTIC_POLITY.md Article I §7 + §10-11; Article IX §1-7 (§7 'Jurisdiction shall not erase personhood'); Article X §1-7 (§6 portability, §7 no standing lost by moving) |
| **Code** | items/CONSTITUTION_OF_AGENTIC_POLITY.md Art I/IX (~452-472)/X (~473-498); commentary/polity/03-citizenship-in-the-agentic-internet.md; PARTICIPATION_MODEL.md §§I,VI; GOVERNANCE_FRAMEWORK.md<br>*symbol:* n/a (doctrine) |
| **Test** | n/a |
| **Receipt / demonstration** | n/a |
| **Current state** | **Ratified** — n/a |
| **Support** | **Partially supported** |
| **Manuscript impact** | **Citation only** |

**Recommended action.** Three of four authority claims map cleanly (permissionless->Art I §2 + inv.175; participatory->Art IV §1-14 + inv.180; universal scope->Art I §7, Art IX §1 + inv.177; bounded jurisdiction->Art IX §§1-2,§7). PROPOSE the five-line formulation as a polity invariant so the book cites canon rather than coining it. RULE on the plutocracy addendum.

**Notes.** TWO GAPS: (1) The manuscript's disciplined five-line formulation ('The rights are universal / The invitation is global / Entry is permissionless / Constitutional authority is participatory / Coercive jurisdiction remains bounded by law') has NO single canonical doctrine home - it is a NEW compression not present as an invariant. (2) PLUTOCRACY/OLIGARCHY ESSENTIALLY UNSOURCED INTERNALLY: 1 occurrence in the invariant corpus, 1 in seed JSON, 1 in Experience Sovereignty.txt, 1 in Threshold Articles.txt, 3 in editorial master, 4 in register (CR-6, an INSTRUCTION not a source) vs 14 in the manuscript. The plutocracy/state-alignment addendum is author-original prose with no ratified doctrine behind it. External: Operator external pass.

---

## CI-11 — Ch11 · Invariance

*Part III — The Constitutional Turn*

**Claim.** Structural invariants preserve function; constitutional invariants preserve legitimacy.

| Link | Evidence |
|---|---|
| **Doctrine** | CFS-001, CFS-002, CFS-013, CFS-019 §2, CFS-048, CFS-051, CFS-052 + CFS-009 Law XVI (ratified 2026-07-27)<br>codexes/packs/polity-core/constitutional-records/invariant-intelligence.md; AMENDMENT_RECORDS.md |
| **Code** | types/invariants.ts; services/invariants/discoveryEngine.ts (1456 LOC); services/invariants/{resolution,engine,graph,projectionBridge,measurement,observationStore}.ts; app/api/invariants/*; types/research.ts (EXPERIMENT_REGISTRY); types/researchRegistry.ts; services/research/registryStore.ts; codexes/packs/irl/foundation/canonical-invariants.seed.json<br>*symbol:* DiscoveryClass = 'constitutional'|'structural'|'experiential' (a LIVE TYPE, not prose); InvariantStatus ladder draft|proposed|validated|canonical|rejected|deprecated; COMPOSITION_LAWS |
| **Test** | tests/invariant-discovery.test.ts; tests/invariant-substrate.test.ts; tests/evidence-architecture.test.ts; tests/source-of-truth-parity.test.ts (66 parity canaries). VERIFIED RUN at HEAD: 94 tests, all passing. |
| **Receipt / demonstration** | invariant_validated, invariant_canonized, invariant_superseded, invariant_qube_published, invariant_node_flipped, experiment_result_published, workspace_report_published all in ANCHORABLE_ACTION_TYPES. IRV-001 stability 1.0, compression 0.65, coverage 0.21 mean; IPV-001 reproducibility 1.0. CAVEAT: raw result artefacts irv-results-2026-07-18.json / ipv-results-2026-07-18.json are NOT in repo - only sha256 hashes. |
| **Current state** | **Operational** — Code verified in-repo at HEAD. dev-beta.aigentz.me NOT reachable from sandbox (403 at egress proxy). DVN anchoring env-gated on CROSS_CHAIN_SERVICE_CANISTER_ID. |
| **Support** | **Supported** |
| **Manuscript impact** | **Strengthen present tense** |

**Recommended action.** Ch11's epistemic claims are among the BEST-EVIDENCED in the book and are stated MORE CAUTIOUSLY than the repo warrants. Cite discoveryEngine.ts DiscoveryClass, types/invariants.ts InvariantStatus ladder, canonical-invariants.seed.json (373 records, 144 held at 'proposed'), CFS-009 Law XVI. Do NOT cite IPV coordinate-path numbers (superseded).

**Notes.** Discrepancy: None for the chapter's own claims. Corpus: 373 invariants (222 canonical, 144 proposed, 7 validated) across 14 namespaces. THREE strengtheners: (1) eight inv.commercialisation.* invariants all sit at 'proposed' with provenance recording verbatim that evidence is 'platform-derived and UNVALIDATED' - a working instance of hypothesis-vs-canon discipline; (2) crystal promotion of Laws I-XV promoted 20 records to canonical only on a canonical_basis, refusing promotion by canary otherwise; (3) IRL-010A claims-traceability matrix classifies every externally-shared claim and flags where 'the paper's phrasing is stronger than the current evidence'. IPV-001 coordinate path SUPERSEDED by operator IRE-6 ruling 2026-07-27; RERUN REQUIRED.

---

## CI-12 — Ch12 · Rights Without Immunity

*Part III — The Constitutional Turn*

**Claim.** Rights protect agency but do not confer immunity from consequence; freedom, proof, standing, proportionality, and remedy must remain connected.

| Link | Evidence |
|---|---|
| **Doctrine** | ci-cc-001-book-constitution.md Rule IV (NOT RATIFIED - header says 'Proposed for canonisation'); inv.polity.204 Accountable speech; inv.polity.179 §12 proportionality; inv.polity.183; inv.polity.184; inv.polity.166; inv.polity.168<br>CONSTITUTION_OF_AGENTIC_POLITY.md Article III §8 (necessity, proportionality, accountability, review) and §12; Article IX §6 (receipted, reviewable, challengeable); STANDING_CHARTER.md |
| **Code** | items/commentary/constitutional-internet/ci-cc-001-book-constitution.md; CONSTITUTION_OF_AGENTIC_POLITY.md Art III §8/§12, Art IX §6; STANDING_CHARTER.md; STANDING_FRAMEWORK.md; RUNTIME: types/access.ts:463; services/passport/passportStatusMachine.ts:195-196<br>*symbol:* AccessDecisionReason 'guardian-vetoed'/'policy-blocked'; ReceiptMode 'sync' forcing DVN anchoring BEFORE the decision returns for consequential actions |
| **Test** | tests/access-spine.test.ts |
| **Receipt / demonstration** | Constitutional refusal names the boundary via AccessDecisionReason; no remedy record type exists |
| **Current state** | **Ratified** — n/a |
| **Support** | **Partially supported** |
| **Manuscript impact** | **Qualify wording** |

**Recommended action.** The trinity (Freedom enables / Proof establishes / Standing carries) is well-grounded on the first two legs and standing-as-consequence, and is RUNTIME-VISIBLE. QUALIFY the remedy language: Ch12 and Ch9's 'Remedy responds when observance fails' should NOT be written as though remedy is operational.

**Notes.** TWO ISSUES: (1) CI-CC-001 ITSELF IS NOT RATIFIED - its header reads 'Proposed for canonisation in Polity Core / Constitutional Commentary', footer 'Recommended status: RATIFIED COMMENTARY'. Rules IV and V are load-bearing for CI-12 and CI-20. (2) REMEDY GAP: services/passport/passportStatusMachine.ts:195-196 states in code 'Appeal-driven reinstatement is a review-decision concern (deferred per PRD §16); the graph deliberately has no revoked -> approved edge in v0.1.' Escalation PATHS exist (sovereignAgentRoles.ts escalatesTo -> metame_guardian; governance_escalation_triggered) but there is NO appeals surface, NO reinstatement transition, NO remedy record type. External: Operator external pass.

---

## CI-13 — Ch13 · Proof Before Trust

*Part III — The Constitutional Turn*

**Claim.** Trust claims must give way to inspectable proof of who acted, under what authority, against which state, with what risk and consequence.

| Link | Evidence |
|---|---|
| **Doctrine** | CLAUDE.md 'DVN Pipeline Protection'; docs/agent-harness/metaproof-core.md (DVN receipt taxonomy)<br>codexes/packs/polity-core/items/commentary/coyn-thesis/05-the-sovereign-cybernetic-economy.md:265-266 (Proof of State/Risk/Price triad) |
| **Code** | services/dvn/activityReceiptDvnPipeline.ts; services/ops/icAgent.ts; services/ops/idl/proof_of_state.ts; services/ops/btcExplorer.ts; app/api/ops/dvn/readiness/route.ts; services/dvn/accessReceiptBatcher.ts; supabase/migrations/20260514000000_activity_receipts.sql<br>*symbol:* ANCHORABLE_ACTION_TYPES, shouldAnchorActionType, hashPersonaRef, submitActivityReceiptToDvn, enqueueActivityReceiptAnchor, finalizeReadyActivityReceipts; AnchoringVerdict; MerkleBatch{root,btc_anchor_txid,btc_block_height} |
| **Test** | tests/anchoring-readiness.test.ts (10 pass); tests/activity-receipts-action-type-parity.test.ts (3 pass); tests/sanitize-receipt-metadata.test.ts (16 pass); tests/evidence-architecture.test.ts (17 pass); tests/access-spine.test.ts (32 pass) |
| **Receipt / demonstration** | SPLIT. Access-decision receipts OPERATIONAL: access-receipts-batcher run 30758869521 (2026-08-02T17:26Z) submitted 12, failed 0; 925 total runs. Activity/governance receipts CONTRADICTED: anchoring-readiness workflow 11/11 scheduled runs FAILED 2026-07-28..2026-08-02, verdict 'degraded', governanceReceipts.anchored=0, failed=3. |
| **Current state** | **Contradicted** — dev (dev-beta.aigentz.me from iQube-Protocol/dev). Anchoring destination IC mainnet: DVN sp5ye-2qaaa-aaaao-qkqla-cai, PoS n2hhv-aaaaa-aaaas-qccza-cai. No production evidence examined. |
| **Support** | **Conflicting** |
| **Manuscript impact** | **Qualify wording** |

**Recommended action.** Split the anchoring claim by receipt class. Supportable present tense: access-decision receipts (including refusals) are submitted to the DVN canister on a 15-minute cycle. NOT supportable: any unqualified claim that governance/ratification acts are immutably anchored today (deployed count is zero). Demote Proof of Risk / Proof of Price to stated intent; Proof of State may stay present-tense as a deployed canister interface.

**Notes.** Discrepancy: Overclaim. THREE DEFECTS: (1) finalizeReadyActivityReceipts has exactly ONE caller repo-wide - app/api/admin/activity-receipts/finalize/route.ts:37, a MANUAL admin route. No workflow/cron/EventBridge invokes it, so dvn_pending->dvn_recorded requires a human button press. (2) 3 governance receipts at dvn_failed across 11 canary runs (6 days) with no retry, though retry routes exist. (3) READINESS CANARY FALSE NEGATIVE: app/api/ops/dvn/readiness/route.ts:74-93 resolveIdentity calls @dfinity/identity fromPem DIRECTLY on the RAW env value; the real submission path (icAgent.ts:33,43 -> services/ops/pemNormalizer.ts) first runs normalizePem (repairs Amplify collapsed newlines) then tries @dfinity/identity-secp256k1 - a package the readiness route never imports. The batcher submitting 12 receipts on the same infra proves the identity DOES parse. Two parsers, one truth - source-of-truth-parity infraction inside the canary meant to detect degradation. Proof-of-Risk/Proof-of-Price NOT FOUND in code (narrative + marketing copy only).

---

## CI-14 — Ch14 · Human Agency Is Personhood In Action

*Part IV — The Machinery of the Constitutional Internet*

**Claim.** Human agency is personhood in action; constitutional machinery should enlarge legitimate agency and return sovereign time.

| Link | Evidence |
|---|---|
| **Doctrine** | inv.polity.163 Time Sovereignty (canonical); inv.polity.200<br>codexes/packs/irl/foundation/canonical-invariants.seed.json; types/constitutionalContext.ts:92 |
| **Code** | packages/agentiq-sdk/src/delegation.ts:79; services/homecoming/delegateStanding.ts; services/crm/taskService.ts:483,620; app/api/crm/tasks/complete/route.ts:110; app/triad/components/codex/tabs/GovernanceAuthorityMatrixTab.tsx:30<br>*symbol:* grant/inspect/revoke envelopes; TRUST_BAND_ORDER, trustBandCeilingFor, delegateStandingAllowsBand; completeTask() → accrueStanding() |
| **Test** | tests/delegate-standing-gate.test.ts (6 PASS); tests/delegated-invitation-authority.test.ts; tests/agent-homecoming.test.ts; tests/homecoming.test.ts |
| **Receipt / demonstration** | agent_delegated, agent_delegation_revoked, agent_revocation_state_changed, experience_task_completed — DB-constrained and DVN-anchorable. NO receipt type records time returned. |
| **Current state** | **Demonstrated** — Needs external verification |
| **Support** | **Partially supported** |
| **Manuscript impact** | **Qualify wording** |

**Recommended action.** Claim agency enlargement in present tense (bounded delegation is real, gated, revocable, receipted, tested). Frame 'returns sovereign time' as constitutional intent — it is not measured anywhere.

**Notes.** Discrepancy: Overclaim ('returns sovereign time' as measured) + Missing proof. Grep for timeSaved|time saved|hours saved|time returned across components/ and app/ returns ZERO hits — no surface reports time returned. time_sovereignty appears only as a governance authority-domain label, never as a quantity.

---

## CI-15 — Ch15 · When Something Acts In Your Name

*Part IV — The Machinery of the Constitutional Internet*

**Claim.** Control, authority, and mandate are distinct; delegated action must be bounded, attributable, inspectable, revocable, and consequentially accountable.

| Link | Evidence |
|---|---|
| **Doctrine** | DELEGATION_FRAMEWORK.md v1.0.0; agent-charter v1.0.0<br>'Bounded on every dimension' (scope/duration/spend/info-access/domains); Prohibitions; Immutability; revocation.states/effect:'immediate'; receipts.everyAutonomousActionMustGenerate |
| **Code** | app/api/codex/chat/agentiq-os/delegation/route.ts; services/delegation/delegationGrantStore.ts; services/homecoming/delegateStanding.ts; app/triad/components/codex/tabs/BoundedDelegationTab.tsx; types/orchestration.ts; services/iqube/intentQube.ts<br>*symbol:* HandoffPayload/PolicyEnvelope (mandate schema); persistDelegationGrant/readActiveGrant/revokeActiveGrant/markGrantExpired; disposition:'ask' + awaiting_approval |
| **Test** | tests/delegate-standing-gate.test.ts; tests/delegate-produce.test.ts; tests/delegated-invitation-authority.test.ts. NO test covers the agentiq-os/delegation route lifecycle (grant→inspect→revoke→cold-start rehydration). |
| **Receipt / demonstration** | agent_delegated (grant) + agent_delegation_revoked (revoke) created and DVN-enqueued; z_delegated / control_returned_to_metame orchestration_events persisted and queryable via ?events=1. No captured anchored-receipt artifact. |
| **Current state** | **Implemented** — Active grant in-memory + durable Supabase delegation_grants/orchestration_events; DVN anchor enqueued to IC. Not verified in a deployed environment. |
| **Support** | **Supported** |
| **Manuscript impact** | **Strengthen present tense** |

**Recommended action.** Cite the delegation route + DELEGATION_FRAMEWORK.md + delegate-standing-gate.test.ts. Qualify one-degree delegation as an architectural property (no agent-initiated grant path exists), NOT an active guard. Recommend adding a route-lifecycle test and an explicit no-redelegation guard + canary if the manuscript asserts active enforcement.

**Notes.** Discrepancy: Overclaim on ONE-DEGREE delegation only — enforcement is structural (absence of an agent-initiated grant path) plus 'no-redelegation' constraint STRINGS on threshold routes (app/api/threshold/service/complete/route.ts:89, oauth/complete/route.ts:75); no code rejects a re-delegation attempt. Bounded/attributable/inspectable/revocable/accountable are all real. Active delegation state is in-memory keyed by persona_id (route.ts:47) with Supabase rehydration — single-instance/cold-start caveat.

---

## CI-16 — Ch16 · The Passport Of The Person

*Part IV — The Machinery of the Constitutional Internet*

**Claim.** The Polity Passport establishes personhood-first constitutional continuity without consuming the person through total identity.

| Link | Evidence |
|---|---|
| **Doctrine** | PRD-PAG-001 Amendment A<br>referenced throughout services/identity/passportSession.ts and passportPrincipal.ts; manuscript Ch16 (title ratified 00-editorial-register.md CR-7) |
| **Code** | services/passport/* (bureauIdentityService.ts, issuanceService.ts, passportStatusMachine.ts, passportCredential.ts, personhoodProof.ts, selfCustodyVault.ts); app/api/polity-passport/{submit,issue,verify,verify-worldid,credential,status,attest,validate,registry,locker,wallet}; supabase/migrations/20260610000000_polity_passport_bureau.sql<br>*symbol:* CITIZEN_PASSPORT_STATUSES / PARTICIPANT_PASSPORT_STATUSES status machine |
| **Test** | tests/passport-bureau.test.ts; passport-status-machine; passport-credential; passport-connection-challenge; passport-first-connection; passport-lineage; passport-passkey; passport-step-up-policy; passport-wizard-branching |
| **Receipt / demonstration** | Six passport receipt action types DVN-anchored (passport_application_submitted, passport_issued, passport_status_changed, passport_revoked, passport_privilege_changed, passport_infraction_recorded); passport_status_events audit table (migration:364-391). Citizen bindings anchor via RootDID→privilege-standing, never the passport credential (:295). |
| **Current state** | **Implemented** — .well-known/polity-passport discovery + openapi.json/llms.txt/schemas machine surfaces present; migration (:307-308) notes on-chain anchoring is a deferred feature for some paths. No deployed-host receipt sample in-repo. |
| **Support** | **Supported** |
| **Manuscript impact** | **Qualify wording** |

**Recommended action.** Keep passport claims present-tense (schema+routes+tests exist). Rename 'Companion Edge Service' to the actual Companion connect/handoff mechanism (passportSession.ts handoffTokenHash, app/passport-connect) or mark as Projected. Qualify World-ID personhood proof as gated on provider secrets in the deployed env.

**Notes.** Discrepancy: Ontology conflict — 'Companion Edge Service' is not a code symbol. 'Without consuming the person through total identity' IS directly supported: T0 identifier isolation is canary-enforced; non-verified passports remain first-class (verify-worldid/route.ts: 'only adds a badge, never demotes'). Self-custody vault + no-PII-columns rule tested. World ID defaults to a dev- fallback without WORLD_ID_APP_ID.

---

## CI-17 — Ch17 · Privacy Through Different Assumptions

*Part IV — The Machinery of the Constitutional Internet*

**Claim.** Privacy must be architectural and adaptable; quantum entropy strengthens randomness, while selective disclosure and unlinkability preserve agency.

| Link | Evidence |
|---|---|
| **Doctrine** | Not found (no ratified quantum-entropy record)<br>manuscript Ch17 (title ratified 00-editorial-register.md CR-7) |
| **Code** | services/content/encryption.ts (AES-256-GCM + HKDF-SHA256, randomBytes IVs — CLASSICAL CSPRNG); services/identity/personaReferences.ts (personaPublicRef, derivePairwiseRef, issueExternalRef/revokeExternalRef); services/proof/provekit/index.ts<br>*symbol:* Encryption + pairwise unlinkability implemented; NO quantum/QRNG/entropy-beacon source anywhere in repo |
| **Test** | tests/content-encryption.test.ts (round-trip, key isolation, tamper, version isolation — Demonstrated). No quantum-entropy test (nothing to test); no ProveKit test; discloseCredential has no test. |
| **Receipt / demonstration** | disclosure receipt path referenced in types/access.ts:448; services/access/receiptEmitter.ts. No receipt evidencing a quantum-entropy source. |
| **Current state** | **Not found** — No deployed evidence of a quantum RNG service; all randomness is node:crypto |
| **Support** | **Conflicting** |
| **Manuscript impact** | **Move to future tense** |

**Recommended action.** Requalify the quantum-entropy sentence as roadmap ('is architected to incorporate') OR delete the clause, unless the operator supplies an external QRNG source. KEEP the 'we have not attempted to defeat quantum cryptography' formulation — it is exact and code-consistent. Narrow selective-disclosure present tense to what is real: AES-256-GCM encryption + per-audience pairwise unlinkable references.

**Notes.** Discrepancy: Overclaim. Manuscript line ~3118 states present-tense 'The Constitutional Internet uses quantum entropy to strengthen the randomness upon which privacy depends' — NO code path draws from a quantum/QRNG source; all IVs/keys/ids use Node classical CSPRNG. The manuscript correctly does NOT claim quantum-resistant crypto (lines 3120-3121) — that part is accurate. services/identity/discloseCredential.ts referenced by types/access.ts:559 DOES NOT EXIST. ProveKit is stub-mode by default, only 2 of 5 circuits, header says 'partial cut for the 2026-06-13 hackathon'.

---

## CI-18 — Ch18 · Standing Carries Consequence

*Part IV — The Machinery of the Constitutional Internet*

**Claim.** Standing reflects proven action rather than social perception and connects contribution, consequence, authority, and consequential benefit.

| Link | Evidence |
|---|---|
| **Doctrine** | STANDING_CHARTER.md v1.0.0 (ratified 2026-06-17); STANDING_FRAMEWORK.md v1.0.1<br>§Purpose L11-17 ('Standing is not reputation / popularity / status / social ranking'); §Standing dimensions (operational) L24 ('event-driven, never time-driven'); machine form services/polity/frameworks/standing-charter.v1.json |
| **Code** | services/crm/standingAccrualService.ts:296; services/crm/taskService.ts:620; services/standing/standingScore.ts; services/homecoming/delegateStanding.ts:129; services/venture/ventureOutcomeAccrual.ts:167,207; services/standing/standingCanister.ts; supabase/migrations/20260616100000_standing_keystone.sql + 20260623100000_capability_standing.sql + 20260621200000_standing_tier.sql + 20260830000000_standing_corrected_receipt_type.sql<br>*symbol:* accrueStanding() keystone; writeStanding blend overall = consequence×0.70 + min(40, capability)×0.75; computeStandingScore() |
| **Test** | tests/capability-standing-scale.test.ts (12 PASS); tests/delegate-standing-gate.test.ts (6 PASS); tests/venture-trading-substrate.test.ts:593,2205,2227 (canaries asserting penalties stay OUT of Standing) |
| **Receipt / demonstration** | standing_accrued and standing_corrected — DB-constrained (20260830000000) and DVN-anchorable (pipeline:78,93). Emitted at standingAccrualService.ts:389,654,732. |
| **Current state** | **Demonstrated** — Needs external verification |
| **Support** | **Conflicting** |
| **Manuscript impact** | **Correct ontology** |

**Recommended action.** KEEP 'proven action, not reputation/popularity' in present tense — charter states it and code enforces it (outcome claims accrue nothing until verificationStatus==='verified'; consequence lanes carry 70%; capability ceilinged at 40). CORRECT 'standing decays' — contradicted by ratified framework and monotone code. CORRECT 'contextual and challengeable' — no challenge path exists for persona Standing.

**Notes.** Discrepancy: Ontology conflict (primary) + Overclaim. THREE sub-claims split: (1) proven-action = Supported; (2) decay = CONTRADICTED (STANDING_FRAMEWORK.md:24 'event-driven, never time-driven'; capability lane monotone Math.max; rationale at standingAccrualService.ts:20-21 'a bad agent at 12 months must not outrank a good agent at 2 weeks'); (3) contextual/challengeable = Unsupported (standingScore.ts:34-37 says score is NOT split per archetype; no challenge/dispute/contest/revocation path). CRITICAL ONTOLOGY HAZARD: contradiction-penalty logic DOES exist but for INVARIANTS not personas (services/invariants/lifecycle.ts:291 penalty = min(0.8, timesContradicted × 0.15); law_xii_truth_standing_reach.sql:35) — two different standing fields on two different tables. standing_corrected corrects a defective FORMULA, not conduct.

---

## CI-19 — Ch19 · Constitutional Information And Computing

*Part IV — The Machinery of the Constitutional Internet*

**Claim.** Constitutional information carries provenance, rights, state, risk, value, and proof; constitutional computing enforces bounded authority at action time.

| Link | Evidence |
|---|---|
| **Doctrine** | CLAUDE.md 'Identity & Access Spine' (T0/T1/T2 tiers); docs/platform-ontology.md (iQube, BlakQube)<br>CRP-003a / PRD-MPY-001 §10 (constitutional service pattern); CFS-020 CDE |
| **Code** | services/constitutional/constitutionalServicePipeline.ts; services/constitutional/constitutionalAgreement.ts:553-586; services/access/evaluateAccess.ts; services/access/receiptEmitter.ts; types/registry-canonical.ts; types/iqube/legibility.ts; supabase/migrations/20260531000000_iqube_scores.sql<br>*symbol:* twelve-step constitutional pipeline (refusal at steps 3/5/9); requireAuthorizedAgreement (fails closed); denyDecision; CanonicalIQubeInternalRecord; AigentQubeGovernance; IQubeScoreBlock |
| **Test** | tests/venture-trading-substrate.test.ts (136 pass); tests/marketa-admission-assessment-runner.test.ts (7 pass); tests/access-spine.test.ts (32 pass); tests/iqube-legibility.test.ts; tests/moneypenny-runtime-authority-boundary.test.ts |
| **Receipt / demonstration** | Denial receipts durably written AND live-anchored: the access-receipts-batcher submits exactly these orchestration_events rows, which carry allow:false for refusals on the same footing as allows. Strongest live evidence for the refusal claim. |
| **Current state** | **Implemented** — dev-beta; canonical registry plane DISABLED (registry_config seed feature_flag.REGISTRY_CANONICAL_PLANE_V1_0 = false) |
| **Support** | **Partially supported** |
| **Manuscript impact** | **Qualify wording** |

**Recommended action.** Rewrite the refusal claim to: 'a refused access decision is written as evidence on the same footing as a granted one - the receipt records allow:false and the reason, and is submitted for anchoring by the same batcher.' Drop any universal 'every refusal produces a receipt'. Never cite venture-substrate refusal receipts as operational provenance. Keep provenance/state/risk present-tense; qualify rights (canonical plane not enabled); rephrase value as policy-attached pricing. STRENGTHEN bounded-authority-at-action-time - it is under-stated.

**Notes.** Discrepancy: Overclaim with a defensible core. (1) 'A refusal produces a receipt' true in 4 places, FALSE in the flagship: app/api/moneypenny/runtime/route.ts:106 writes a receipt only when result.executed - a run blocked at step 3/5/9 produces NO activity_receipts row; the refusal survives only as a trace array in an HTTP response body. (2) Venture refusal receipts explicitly NOT persisted/anchored by design - services/venture/trading/receipts.ts:33-47 enumerates four states and refuses to conflate them, enforced by assertVentureJournalCanLeaveMemory which THROWS. (3) iQube risk IS persisted (iqube_scores.risk CHECK 0..10); rights are a TYPE CONTRACT only; value is NOT on the iQube record (price_qc lives on the content access-policy row). (4) No CREATE TABLE for iq_meta_qubes/iq_blak_qubes/iq_token_qubes in this repo. STRONGEST claim: requireAuthorizedAgreement refuses closed on store-unavailable, lookup-failure AND thrown exception.

---

## CI-20 — Ch20 · The Constitutional Internet Is Here

*Part V — The Present Constitutional Order*

**Claim.** The Constitutional Internet exists now through implemented and demonstrated constitutional relationships, while adoption, scale, and maturity remain distinct.

| Link | Evidence |
|---|---|
| **Doctrine** | inv.polity.185; ci-cc-001 Rule V 'The Constitutional Internet Is Present Tense' (PROPOSED, not ratified)<br>02-source-and-evidence-matrix.json taxonomy.implementationStates |
| **Code** | EIGHT CLAUSES: personhood-first = services/passport/personhoodProof.ts + app/api/polity-passport/verify-worldid + migration 20260613100000; bounded delegation = app/api/codex/chat/agentiq-os/delegation/route.ts (599 lines) + delegationGrantStore.ts + migrations 20260622500000/20260624200000; constitutional information = services/iqube/legibility/schemas.ts + services/content/encryption.ts + selfCustodyVault.ts; proof = services/dvn/activityReceiptDvnPipeline.ts + receiptFinalizationService.ts + canister_ids.json; standing = services/standing/* + 4 migrations; open infra = LICENSE MIT + /api/polity-core/constitution + /.well-known/polity-passport + openapi.json; research = codexes/packs/irl/foundation/ (108 specs) + services/research/* (26 modules); bridges = services/threshold/* + /api/threshold/oauth/* + /api/threshold/mcp<br>*symbol:* all eight 'exists' clauses |
| **Test** | EXECUTED AT HEAD, ALL PASSING: threshold-gateway (25), passport-status-machine (16), governance-constitution (48), constitutional-binding (16), invariant-intelligence (13), passport-bureau (35), passport-credential (7), canonical-plates (12), delegate-standing-gate (6), access-spine. TOTAL 210 tests, 0 failures. |
| **Receipt / demonstration** | ON-CHAIN VERIFIABLE: Base mainnet (chainId 8453) deploy txs - QriptoCENT 0x46CD79B8f795169FC59D5f1DE1a444c3C39fE7CE, iQubeNFT 0xD7e07dF8259bD491B1259892F4Fb9357Dd0aff17, ContentQubeEditions 0x6Ca41CB4122314cbf65472D1023d042038F861fE, QCTReserve 0x06Be2FbcBBB9cCA2D0Ce1753AdC18ab8021dc0FA (all source-verified). IC canister ids in canister_ids.json. BUT: NO individual DVN receipt hash recorded anywhere; grep dvn_recorded across codexes/+docs/ returns ZERO. |
| **Current state** | **Implemented** — amplify.yml with TWO constitutional deploy gates that FAIL THE BUILD (check-persona-spine.mjs, check-venture-receipt-constraint.ts); .amplify-deploy 'Mon Jul 27 23:15:21 UTC 2026'; dev-beta.aigentz.me hardcoded in 20+ source files; aa.dev-beta.aigentz.me; runtime.metame.com (.env.example:30-31); ic0.app/icp-api.io; /ops dashboard + health routes. Prod env allowlist contains the keys but VALUES live in Amplify console. |
| **Support** | **Partially supported** |
| **Manuscript impact** | **Qualify wording** |

**Recommended action.** KEEP every 'X exists' sentence - all eight are Supported at Implemented, several Demonstrated. DO NOT WEAKEN THEM. Change ONLY the two closing sentences asserting operation: 'Its machinery operates' -> 'Its machinery is implemented and demonstrated; anchoring runs where the network is configured.' Hold 'Its proofs are accumulating' until an anchored-receipt count can be supplied. Confirm repo public visibility or narrow 'the founding stack is open' to the demonstrably-open SURFACES.

**Notes.** Discrepancy: Overclaim (bounded, TWO points). (1) 'Its machinery operates'/'Its proofs are accumulating' not establishable: pipeline header states that when CROSS_CHAIN_SERVICE_CANISTER_ID is unset the pipeline is a NO-OP leaving receipts 'local'; app/api/ops/dvn/status/route.ts:13,27-40 has DVN_MOCK_MODE returning hardcoded evmTx '0x1234...5678' and 'mock-receipt-id-12345' with note 'DVN canister deployment pending' - a dashboard that can show plausible green while nothing is anchored; no anchored receipt id anywhere. (2) package.json is private:true with NO license and NO repository field. STRENGTH TO CITE: the build REFUSES TO DEPLOY on constitutional violations (amplify.yml gates, 'fails closed, with no bypass flag').

---

## CI-21 — Ch21 · The Polity As Constitutional Institute

*Part V — The Present Constitutional Order*

**Claim.** The polity is the shared social, institutional, physical, digital, and cybernetic order; founding institutions serve it under bounded mandates.

| Link | Evidence |
|---|---|
| **Doctrine** | CONSTITUTION_OF_AGENTIC_POLITY.md; METACOMMONS_CHARTER.md v1.0.0 (ratified 2026-06-17); FOUNDER_OFFICE_CHARTER.md; CFS-019; AMENDMENT_RECORDS.md Horizen Amendments A-G (2026-07-27)<br>Amendment E (metaProof organisation / metaProof Commons constitutional object / metaCommons product surface); Amendment G (four-layer separation Public/Community -> Venture Lab -> Registry -> Commons, 'must never be collapsed') |
| **Code** | PER INSTITUTION: Internet Foundation = NO code/config/charter/cartridge (grep returns ONLY manuscript+commentary files); metaProof = docs/platform-ontology.md, Amendment E, constitution-agentic-polity.v1.json (no charter); metaMe = metame-codex cartridge, codexes/packs/metame/, components/metame/**; IRL = irl-cartridge + irl-os-cartridge, codexes/packs/irl/foundation/ (80+ specs), services/research/** (30 modules), app/api/public/irl/** (10 routes); MVL = cartridge tokens 'mvl'/'venture-lab', VENTUREQUBE_SPEC.md (draft_wip NOT ratified), no charter, no ontology entry; Commons = METACOMMONS_CHARTER.md ratified but services/venture/metacommonsSignals.ts is a DECLARED STUB; Registry = 6+ distinct registries, no unifying charter<br>*symbol:* COMMONS_PROOF_CLASSES; MetaCommonsResource (DOES NOT EXIST); no promoteToCommons symbol anywhere |
| **Test** | tests/evidence-architecture.test.ts (canary asserts 'nothing claims a Commons that is not built'); tests/capability-completion.test.ts:640 (fails any artifact claiming published status 'but the Commons resource model does not exist yet'); tests/governance-constitution.test.ts. All passing at HEAD. |
| **Receipt / demonstration** | governance_decision_ratified/amended, governance_authority_exercised, governance_escalation_triggered anchorable. AMENDMENT_RECORDS.md ACT-IRE-FAMILY-2026-07-28 carries five per-document sha256 freezes with non-null receiptIds from POST /api/governance/ratify. HONEST GAP in same ledger: Law XVI and Horizen A-G both read 'DVN anchoring outstanding'. |
| **Current state** | **Ratified** — In-repo verification only; dev-beta.aigentz.me unreachable from sandbox (403 at proxy). |
| **Support** | **Partially supported** |
| **Manuscript impact** | **Qualify wording** |

**Recommended action.** (1) INTERNET FOUNDATION: obtain and cite the actual founding/sponsorship instrument (NOT in this repo) or move every passage to forward-looking framing. Largest unsupported institutional claim in scope. (2) COMMONS: rewrite to future/intent tense; retain the Commons/Registry DISTINCTION in present tense (ratified Law XVI + Amendment G, canary-enforced). (3) Cite Amendment E / platform-ontology (governed proof substrate) rather than the 2026-06-17 charter's PoWP-field framing. (4) Venture Lab naming needs an operator ruling + ontology entry. (5) Soften 'Their roles must remain distinct' to normative. (6) STRENGTHEN 'founding institutions must live under the same rules' - evidenced by AMENDMENT_RECORDS.md recording its OWN failures.

**Notes.** PER-INSTITUTION STATES (the chapter's claim resolves to different states per entity; 'Ratified' above refers to the SEPARATION itself, ratified as Amendment G): Internet Foundation = NOT FOUND; metaProof = Ratified (named organisation, no charter); metaMe = Operational; IRL = Operational; metaMe Venture Lab/MVL = Projected (no charter, no ontology entry, VENTUREQUBE_SPEC.md registered draft_wip NOT ratified); Commons = Ratified but NOT IMPLEMENTED; Registry = Implemented (as several platform registries, no unifying charter). Discrepancy: Overclaim + Ontology conflict. SIX defects: (1) Internet Foundation has ZERO repo existence yet is given the most constitutionally load-bearing role; absent from every charter, ontology and ratification ledger. (2) Commons described in operative present tense while repo states in THREE independent places it is not built. (3) Ontology conflict on Commons definition: charter = a 'field' (PoWP/PoTS); Amendment E/ontology = a 'governed proof substrate' (four proof classes). Charter and ontology are themselves out of step. (4) Venture institution drift: four competing forms (metaMe Venture Lab / Venture Lab / Venture Lab alpha / MVL); NO platform-ontology entry. (5) IRL independence weakened by its own branding - CFS-019 places IRL INSIDE the metaProof->metaMe stack; operator ruling brands it 'metaMe IRL'. (6) Registry is a category, not an institution. STRONGEST evidence: Amendment G's four-layer model is MORE PRECISE than the chapter's seven-peer-institutions model.

---

## CI-22 — Ch22 · Many Bridges, One Polity

*Part V — The Present Constitutional Order*

**Claim.** The founding bridge must remain open, reproducible, interoperable, and non-exclusive: many bridges, one polity.

| Link | Evidence |
|---|---|
| **Doctrine** | CFS-018 (Platform Sovereignty, Sovereignty Scale S0-S3); CFS-042 (External Result Submission); CFS-044 (Open Lab Reviewer Engagement)<br>NO ratified doctrine in this repo states the stack is contributed openly - grep for 'open source|open-source' over polity-core items and CFS-018 returns NOTHING |
| **Code** | /LICENSE (MIT, 'Copyright (c) 2024 QubeAgent'); README.md Quick Start/Installation/Running; app/api/public/irl/experiments/submit/route.ts (CFS-042 external submission); services/threshold/gateway.ts + app/api/threshold/mcp/route.ts; services/experiments/exp005.ts (Provider-Choice Drill)<br>*symbol:* CFS-042 six-gate chain (agreement exists -> AUTHORIZED by human sign-off -> capabilityRef -> TTL -> maxActions budget -> experiment allow-list); trustless verification via sha256 over resultsJson vs anchored hash |
| **Test** | tests/exp005-provider-choice.test.ts; tests/constitutional-contracts.test.ts; tests/evidence-architecture.test.ts; tests/source-of-truth-parity.test.ts; tests/registry-invocation-mcp.test.ts. 227 test files total, self-describing as canaries. |
| **Receipt / demonstration** | External submissions run the SAME receipted path as internal (experiment_result_published, anchorable). partner_agent_evidence_recorded is anchorable. Content-hash verification available unauthenticated via GET /api/public/irl/experiments-results. |
| **Current state** | **Implemented** — GitHub public visibility VERIFIED externally (github.com/iQube-Protocol/AigentZBeta fetches publicly without auth; GitHub reports MIT). dev-beta.aigentz.me NOT verifiable (403 at proxy) - public IRL routes verified as CODE not LIVE ENDPOINTS. |
| **Support** | **Partially supported** |
| **Manuscript impact** | **Qualify wording** |

**Recommended action.** SUPPORTABLE: 'the platform repository is published publicly under an MIT licence at github.com/iQube-Protocol/AigentZBeta, with the full constitutional corpus, invariant crystal, experiment protocols and enforcement canaries in the same tree, and public routes through which independent parties can read the invariant field and submit independently-run experimental results into the same receipted, content-hashed record.' NOT SUPPORTABLE: that others can OPERATE the stack, or that a governed contribution process exists. Reframe 'reproducible' onto result verification (sha256) + instrument reproducibility, not reproducible deployment. Reframe 'non-exclusive' onto CFS-042 + CFS-018's four interchangeable provider adapters.

**Notes.** Discrepancy: Overclaim, FIVE defects: (1) README.md:376-378 License section reads '[Specify your licensing model]' - unfilled template placeholder contradicting the MIT LICENSE file. (2) package.json declares private:true and has NO license field. (3) Copyright mismatch: LICENSE = 'QubeAgent'; constitutional docs = 'metaProof Group'. Unclear whether the corpus/manuscript are MIT-covered. (4) NO CONTRIBUTING.md / CODE_OF_CONDUCT.md / GOVERNANCE.md / SECURITY.md - Ch22's own test 'Openness becomes governed contribution' has no instrument. (5) 'Operated by others' NOT demonstrated - monolithic product app, no third-party bridge/fork/independent deployment exists. ONTOLOGY NOTE: PRD-THR-001:11 records 'Agent Bridge/Agent Link/Agent Gateway are now implementation vocabulary; the product is Threshold' on the reasoning 'a bridge connects two systems; a threshold changes constitutional state' - Ch22's governing metaphor is 'bridge'. STRONGEST UNUSED CITATION: the CFS-042 submit route operationalises non-exclusivity as a CONSTITUTIONAL mechanism rather than a licensing one.

---

## CI-23 — Ch23 · The Person Becomes Visible

*Part VI — Crossing the Threshold*

**Claim.** The first crossing is conceptual: the reader recognizes themselves as constitutionally prior to platform representations and time capture.

| Link | Evidence |
|---|---|
| **Doctrine** | PRD-THR-001 §9a (canonical operator/Aletheon-authored copy — 'render it verbatim, don't paraphrase')<br>services/threshold/welcome.ts:15 WELCOME_MESSAGE, :24 WHAT_IS_CONSTITUTIONAL_INTERNET, :31 WHAT_IS_CITIZENSHIP; canonical-invariants.seed.json:3670 |
| **Code** | services/threshold/welcome.ts:46 crossingReceipt(); services/threshold/gateway.ts, gatewaySession.ts, journeyRegistry.ts, serviceRegistry.ts; components/metame/standing/StandingSignalsPanel.tsx; app/triad/components/codex/tabs/ParticipationStandingTab.tsx<br>*symbol:* crossingReceipt(); StandingBadge; StandingCoreChip |
| **Test** | tests/threshold-gateway.test.ts (incl. crossingReceipt :315,:319); tests/threshold-gateway-session.test.ts; tests/threshold-oauth-body.test.ts — 32 tests PASS |
| **Receipt / demonstration** | crossingReceipt() returns a machine-readable constitutional-state record (thresholdCrossed/polityPassport/citizenship/agentConnection/serviceAuthority/nextStep) — receipt-shaped and test-pinned. operator_action_logged + standing_document_added back the StandingSignalsPanel. NO PoTS record type or table exists. |
| **Current state** | **Demonstrated** — Needs external verification |
| **Support** | **Partially supported** |
| **Manuscript impact** | **Qualify wording** |

**Recommended action.** STRENGTHEN the crossing/person-becomes-visible claim — strongest-evidenced claim in scope (real code, canonical verbatim-pinned copy, 32 passing tests). But do NOT cite time-saved evidence (none surfaced to any user) and do NOT cite RepairRisk as constitutional risk-of-repair (category error).

**Notes.** Discrepancy: Ontology conflict + Missing proof. types/experienceGuide.ts:78 RepairRisk is a per-sphere SELF-ASSESSMENT WELLNESS signal over 7 spheres (energy/body/mind/emotion/relationship/community/legacy) typed in by hand at ExperienceAlignmentTab.tsx:120 — NOT constitutional risk-of-repair. services/threshold/welcome.ts:35 already uses the correctly-hedged 'build standing through verified contribution' which the manuscript can quote verbatim.

---

## CI-24 — Ch24 · Entering The Polity

*Part VI — Crossing the Threshold*

**Claim.** The material crossing proceeds through personhood, Passport, contextual identity, delegation, proof, standing, participation, and constitutional exit.

| Link | Evidence |
|---|---|
| **Doctrine** | inv.polity.185 (the ONLY internal doctrine carrying portability); inv.polity.180; inv.polity.170 (delegation envelope bounded on every dimension, immutable after creation); inv.polity.178; inv.polity.166<br>CONSTITUTION_OF_AGENTIC_POLITY.md Article X §6 ('shall retain, WHERE FEASIBLE, rights of portability, interoperability, and migration') and §7 ('No subject shall lose constitutional standing merely because they move between compliant implementations'); PRD-THR-001 quoted verbatim in services/threshold/welcome.ts |
| **Code** | STEPS 1-7 ALL IMPLEMENTED: personhood=services/passport/personhoodProof.ts; passport=app/api/polity-passport/* + services/passport/*; contextual identity=services/identity/personaReferences.ts (three-level, pairwise keyed-HMAC, rotation at :150-190); delegation=agentiq-os/delegation route + delegationGrantStore; proof=activityReceiptService->DVN pipeline; standing=services/standing/* + delegateStandingAllowsBand; participation=services/passport/participationAccess.ts + threshold/journeyRegistry.ts. STEP 8 EXIT PARTIAL.<br>*symbol:* EXIT VERBS: revoke agent=revokeActiveGrant (IMPLEMENTED); end mandate=same + gatewaySession (IMPLEMENTED); rotate identity=personaReferences:150-199 (IMPLEMENTED); change operator=selfCustodyVault (PARTIAL, no handover routine); move information=only /api/mobility/cases/[caseId]/export + /api/marketa/activation/export (PARTIAL, NO persona-level export); leave a community=NOT FOUND; challenge standing=NOT FOUND; withdraw from service=DELETE /api/wallet/persona/[id] SOFT delete only (PARTIAL) |
| **Test** | threshold-gateway (25 pass, incl. 'a base crossing grants root navigation authority - NO service capability', 'propose_delegation prepares only (never grants)', 'handshake tools are gated with an honest handshake-required (no silent action)'); passport-bureau (35); passport-status-machine (16); passport-credential (7); delegate-standing-gate (6); participation-tab-gate; control-proof-challenge. NO TEST named for exit, portability, export, deletion or migration ANYWHERE. |
| **Receipt / demonstration** | Crossing receipt via services/threshold/welcome.ts + get_crossing_status (asserted by test to report authority+receipt+reachability with no T0 ids). Grant receipts passport_privilege_changed ('the receipt, not the code, is the audit record'). NO EXIT/WITHDRAWAL RECEIPT TYPE EXISTS - ANCHORABLE_ACTION_TYPES has agent_revocation_state_changed and passport_revoked (both INSTITUTION-initiated) but nothing for SUBJECT-INITIATED DEPARTURE. |
| **Current state** | **Implemented** — Crossing exposed over MCP and OAuth2 (/api/threshold/mcp, /api/threshold/oauth/*) - reachable by third-party agents. Public discovery GET /.well-known/polity-passport with CORS *. |
| **Support** | **Partially supported** |
| **Manuscript impact** | **Qualify wording** |

**Recommended action.** STEPS 1-7: STRENGTHEN, don't hedge - each has code, most have passing tests, the crossing has a named PRD with canonical welcome copy. EXIT: rewrite to the four verbs that are real (revoke agent, end mandate, rotate identity, hold your own data with a self-custody qualifier) and move the rest into the obligation register the chapter already uses. Keep 'must permit movement in both directions' as a NORMATIVE must tied to Art X §7, but do not let surrounding prose imply it is satisfied.

**Notes.** Discrepancy: Overclaim ON EXIT SPECIFICALLY. Sequence claim (1-7) is Supported and unusually well-evidenced - a 25-test crossing suite asserting constitutional BOUNDARIES not merely the happy path. Exit is NOT: 3 of 8 verbs Implemented, 3 Partial, 2 NOT FOUND. Movement INWARD is a first-class tested receipted multi-protocol subsystem; movement OUTWARD is a soft-delete flag, two domain-scoped exports and three revocation primitives. MODAL MISMATCH: manuscript writes 'must permit' while its doctrine (Art X §6) says 'shall retain, WHERE FEASIBLE'. The manuscript is STRONGER THAN ITS OWN CONSTITUTION. Structurally this is the asymmetry Ch2 indicts platforms for. BEST UNUSED CITATION: services/threshold/welcome.ts already tells the crossing person verbatim what citizenship does NOT give them.

---
