# SPEC-HMC-001 — Homecoming: Constitutional Agent Continuity Specification

**metaMe IRL / iQube Protocol / AgentiQ · Chrysalis Foundation companion specification · Status: RATIFIED (operator-directed, 2026-07-25) — Phase 1 (continuity assessment substrate, §14.1) shipped; Phases 2+ (migration execution) NOT authorised**
**Title:** *Homecoming — Constitutional Agent Continuity Specification*
**Companion to:** **CFS-023 (Chrysalis Homecoming: Constitutional Agent Sovereignty)** — this SPEC operationalizes CFS-023's **Agent** and **Knowledge** sovereignties (sovereignties 3 and 4 of `CONSTITUTIONAL_SOVEREIGNTIES`) into concrete migration-lifecycle mechanics. It does not re-derive CFS-023's conceptual architecture; it is the mechanics layer underneath it, exactly the role SPEC-VLM-001 plays under CFS-050.
**Extension of:** CFS-023 Workstream 1 (Knowledge Homecoming — the ChatGPT-export intake precedent) and Workstream 2 (Agent Homecoming — the genesis → passport → persona pipeline); composes CFS-043 (Agent-Guided Passport & Delegation Onboarding) and CFS-042 (External Result Submission) for the human-authorization mechanics; composes the Identity & Access Spine (`services/identity/getActivePersona.ts`, `services/identity/personaReferences.ts`) for ownership.
**Owner:** AgentiQ Runtime stewards + Identity & Access Spine stewards — same ownership as CFS-023.
**Origin:** operator direction, 2026-07-24, Strand 2 of a 4-strand operator programme. Verbatim: *"This is now a standalone programme. Its purpose is not importing chats. Its purpose is preserving agency."* Objectives named explicitly: Claude AI migration, Claude Code migration, ChatGPT migration, Codex migration, Agent migration, Memory migration, Behavioural continuity, Working context continuity, Project continuity, Artefact continuity, Relationship continuity. Authored by Claude Code, reconciled against the shipped CFS-023 substrate the same day.

> **Governance note (binding, this SPEC):** Docs-first, same regime as SPEC-MMC-001 and SPEC-MMC-002. This document could not ratify itself, and did not: it was filed **DESIGN** on 2026-07-24 with §13 unchecked, and remained so until the operator's explicit pass. **The operator ratified this SPEC and authorised Phase 1 implementation on 2026-07-25**, relayed to the implementing agent as an explicit direction to proceed to build (no verbatim operator quote is reproduced here — this filing does not invent one; the ratification is recorded as operator-directed and dated, per the "No Guessing or Hallucinating" doctrine). Following the SPEC-MMC-002 precedent, that ratification authorises *design and build to proceed* on the scope named in §14.1; it does **not** waive any substantive constraint this document states — §11's honest limits stand, the §13 line-item on host-specific parsers stands as a separate gate, and Principal–Delegate Separation (§2, §5, §8, §9.2 component 6) is not relaxed in any degree by it. §14 records what Phase 1 actually shipped and what it deliberately did not.

> **Companion documents (read alongside):** `CFS-023_chrysalis-homecoming.md` — **THIS SPEC'S UMBRELLA**; read it first, since every architectural noun here (sovereignties, workstreams, the Constitutional Presence ladder, the Homecoming Test) is CFS-023's, cited not re-derived. `CFS-043_agent-guided-passport-delegation.md` — Passport's role and the Principal–Delegate Separation invariant. `CFS-042_external-result-submission.md` — the first instance of agent-guided, human-authorized delegation. `types/homecoming.ts`, `services/homecoming/constitutionalPresence.ts`, `services/homecoming/chatgptImport.ts`, `services/homecoming/delegateStanding.ts` — the shipped substrate this SPEC extends. `codexes/packs/irl/foundation/appendix-a_canonical-invariants.md` — the invariant corpus items 320–332 (reasoning) and 36–37 (engineering) cited throughout §2.

---

## 0. Read this first — reconciliation against what's already built

### 0.1 CFS-023 already covers the conceptual architecture — this SPEC does not re-invent it

CFS-023 (Chartered 2026-07-09) already establishes, and this document treats as settled ground:

- **The five constitutional sovereignties** (`CONSTITUTIONAL_SOVEREIGNTIES`) and the maturity ladder they sit on — Computing/Development (Chrysalis 2.0), **Agent/Knowledge (Homecoming)**, Operational (Operation Leap).
- **The four Homecoming workstreams** (`HOMECOMING_WORKSTREAMS`): knowledge → agent → harness → operational, in dependency order.
- **The Constitutional Knowledge Repository** and its constitutionalization idioms — invariant-extraction and the meta/blak iQube split — plus the honest finding that every knowledge source except ChatGPT exports already had a production surface to integrate.
- **The delegate roster and charter-time grading** (`HOMECOMING_DELEGATES`, `DELEGATE_CHARTER_STATUS`) — Aigent Z, Marketa, Kn0w1 concrete; Alethean/Aletheon archetype; MoneyPenny, Nakamoto conceptual.
- **The Constitutional Presence ladder** L0 (card) → L5 (sovereign), contiguous, proven by real artifacts (`agent_root_identity`, `agent_persona`, `delegation_grants`, `bound_passport_id`) — the live scorer in `services/homecoming/constitutionalPresence.ts`.
- **The Homecoming Test's three dimensions** — continuity, knowledge, capability — and the explicit "never merely relocate, always improve" acceptance bar.
- **The genesis → passport → persona pipeline** (`sponsorPolityAgent` → `/api/polity-passport/submit` → `/api/identity/persona/agent`) as the ONLY mechanism for standing up a delegate's constitutional identity.
- **The founding preamble itself** — "we do not say migrate Alethean… Alethean is coming home" — already states, almost verbatim, the operator's 2026-07-24 framing ("not importing chats, preserving agency"). **This is not a new idea the operator is introducing; it is the operator re-affirming CFS-023's own founding stance with sharper specificity.** The genuine novelty in the 2026-07-24 direction is not the *philosophy* but the **concreteness**: four named third-party agent hosts (Claude AI, Claude Code, ChatGPT, Codex) instead of one (ChatGPT export), and a five-part continuity taxonomy (behavioural / working-context / project / artefact / relationship) finer-grained than CFS-023's single "continuity" dimension.

### 0.2 What is genuinely new here, and what this SPEC adds

| CFS-023 already has | This SPEC adds |
|---|---|
| A single shipped intake path (ChatGPT `conversations.json` → `homecoming` KB domain) | A **generalized migration lifecycle** (§3) that any third-party agent host's continuity material moves through — ChatGPT's parser (`chatgptImport.ts`) becomes the reference implementation of stage 2 (`constitutionalized`), not the whole story |
| "Continuity" as one Homecoming Test dimension | A **five-part continuity taxonomy** (§9, §10) — behavioural, working-context, project, artefact, relationship — each mapped onto which existing surface owns it and which invariant governs it |
| The delegate roster (Aigent Z, Marketa, Kn0w1, Alethean, MoneyPenny, Nakamoto) as the WHO of Homecoming | The named **migration objectives** (§10) as the WHAT of Homecoming — Claude AI, Claude Code, ChatGPT, Codex sessions as source material, not just "Homecoming" in the abstract |
| The Constitutional Presence ladder as a maturity model | The ladder **applied per continuity event** (§3 stage 4) — a migrated agent must re-climb it contiguously; migration is never a shortcut past L0→L3 |
| A charter-level mention that Homecoming is not a migration | A **worked-through definition of "Constitutional Agent Reconstitution"** (§9) — the operator's own named sub-concept — answering precisely which invariants must survive a host change for the delegate to remain "recognisably the same working partner" |

Nothing in this document introduces a new sovereignty, a new ladder, or a new taxonomy of constitutional layers. It is entirely an operationalization of CFS-023 §§Agent+Knowledge — the same relationship SPEC-VLM-001 has to CFS-050 (§0.7 below).

### 0.3 Existing substrate this SPEC composes, never duplicates

- `types/homecoming.ts` — the pure contract (eras, sovereignties, workstreams, presence ladder, test dimensions, delegate roster, knowledge sources). Every constant this SPEC references is defined there; this document adds no parallel constant set.
- `services/homecoming/constitutionalPresence.ts` — the live per-delegate scorer. §3's "presence-reconstituted" stage runs through this, unmodified.
- `services/homecoming/chatgptImport.ts` — the one genuinely-new intake path CFS-023 shipped. §3's "constitutionalized" stage generalizes its *shape* (pure parser, canary-tested, idempotent by `source_id`, feeding the `homecoming` KB domain) to the other named hosts — it does not touch this file.
- `services/homecoming/delegateStanding.ts` — the Standing loop (CFS-023 × CFS-025). §9's "relationship continuity" component is this file's `crm_personas`/`accrueStanding` resolution chain, cited not rebuilt.
- `app/api/homecoming/knowledge/{import,constitutionalize}/route.ts`, `app/api/homecoming/agent/{stand-up,issue-passport,converse,produce,standing}/route.ts` — the seven live routes CFS-023's ratification record already ships. §4 names these as the runtime architecture; this SPEC proposes no new route.
- `services/identity/getActivePersona.ts`, `services/identity/personaReferences.ts` — the identity spine. Any continuity record this SPEC's lifecycle produces is owned by a resolved persona through this spine — never a parallel identity resolver (per CLAUDE.md "Identity & Access Spine — CANONICAL SoT").
- `services/constitutional/constitutionalAgreement.ts`, CFS-043 — the Constitutional Agreement primitive and Principal–Delegate Separation. §5, §8, §9 compose these directly for re-authorization; no parallel authorization mechanic is proposed.

### 0.4 A deliberate terminology note — "Constitutional Agent Reconstitution" is NOT "Transaction Reconstitution"

`constitutionalAgreement.ts`'s agreement lifecycle already uses the word "reconstitutable" (`AGREEMENT_LIFECYCLE`'s terminal status) and CRP-003a names a future engine, **Transaction Reconstitution** (N2), that replays a receipt trail into `{intent + agreement + authority + agent + outputs + verification + settlement + standing}` for a *financial transaction*. That is a different concept in a different domain (Constitutional Financial Services, CRP-003) from **Constitutional Agent Reconstitution** as this SPEC uses it (§9) — the re-derivation of an *agent's* invariant substrate and standing after a host change. The two are not related, composed, or intended to share a future engine; the naming collision is noted here so no future reader conflates them.

### 0.5 Why a SPEC number, not a new CFS-0xx, and why "HMC" — the numbering decision

`ls codexes/packs/irl/foundation/` was checked directly (not guessed): the highest existing CFS number is **CFS-050** (`CFS-050_sovereignty-navigation.md`, 2026-07-24). The repo has two live numbering families for exactly this kind of document:

- **CFS-0xx** — a Chrysalis Foundation Specification. Reserved for documents that establish **new constitutional ground** — a new sovereignty, a new invariant class, a new charter. CFS-023 itself, CFS-043, CFS-050 are all of this kind.
- **SPEC-\<INITIATIVE\>-00N** — a companion specification that takes an **already-chartered** CFS's concepts and works out concrete mechanics underneath it, without asserting new constitutional ground. The precedent is exact and recent: **SPEC-VLM-001** (`venture-lab-moneypenny-reorganisation.md`) is explicitly filed as "**CFS-050's own first applied test case**" — it operationalizes Sovereignty Navigation into a five-domain regroup for one cartridge, ratified the same day as CFS-050 itself, without itself becoming CFS-051. SPEC-MMC-001 and SPEC-MMC-002 are the same pattern one level under PRD-MMC-001.

This document does not introduce a new sovereignty, a new presence ladder, or a new invariant taxonomy (§0.2) — it takes CFS-023's Agent + Knowledge sovereignties and works out **what a continuity event concretely looks like** for four newly-named source hosts. That is a SPEC, not a CFS, by the repo's own established precedent. It is also not a PRD: the PRD-\<X\>-001 → SPEC-\<X\>-00N relationship (PRD-MMC-001 → SPEC-MMC-001/002) is used when a *product* requirements document already exists above the interaction-model layer; no such PRD exists or is warranted here — CFS-023 already plays that role.

The initiative code **HMC** (Homecoming) follows the same three-letter convention as **MMC** (metaMe Companion) and **VLM** (Venture Lab Moneypenny) — chosen to avoid collision with **HMS** (Human Mobility Services), an unrelated existing programme in this codebase. Hence: **SPEC-HMC-001**.

---

## 1. Working definition — what constitutes agent continuity

**Agent continuity is the preservation of the constitutional reasoning substrate that generates a delegate's behaviour — not the preservation of any particular transcript, chat history, or hosting environment.**

The reasoning-substrate formula already canonical in this corpus (`inv.reasoning.320`, appendix-a item 320) states the primitive: *Intent × Personal Invariants × Domain Invariants = Constitutional Context*, from which generation proceeds — "conversation history and memory become supplementary rather than primary." Continuity, read through that formula, is **not** "can the new host recite the same conversation" — it is: **do the same Personal Invariants (this delegate's accumulated principles, preferences, and reasoning patterns for this specific principal) and the same Domain Invariants (the constitutional/domain corpus it reasons from) survive the move, so that the same Intent, applied against the same substrate, produces recognisably the same behaviour?**

This yields the working definition used throughout this SPEC:

> **Agent continuity holds across a migration event if and only if the delegate's Personal Invariants, Domain Invariants, working context (current intent and in-flight commitments), earned standing, and artefact provenance are each re-derivable — verifiably, not by assertion — on the destination host, AND the human principal has re-authorized the delegate's bounded authority there.** A migration that imports only a transcript, with none of the above re-derived or re-authorized, has not achieved continuity — it has archived a record.

This is deliberately **not** a list. A list of five nouns ("memory, behaviour, context, artefacts, relationships") describes continuity's *surface*, but the working definition above states the *mechanism*: continuity is a property of the invariant substrate surviving a host change, tested by whether the SAME inputs (Intent × Personal Invariants × Domain Invariants) still produce the SAME class of output. §9 works this into the operator's named sub-concept, Constitutional Agent Reconstitution, in full.

---

## 2. The invariants that define continuity — cited, not invented

Per this repo's "Extend, Don't Duplicate" and "Hypothesis vs Canon" doctrines, this section cites **real, already-ratified-or-proposed** invariants rather than proposing a parallel taxonomy. Every item below already exists in `appendix-a_canonical-invariants.md`, `CFS-009`, or `CFS-043`.

| Invariant | Source | How it governs continuity |
|---|---|---|
| **inv.reasoning.320** — The reasoning-substrate formula (Intent × Personal Invariants × Domain Invariants = Constitutional Context) | appendix-a #320 | Defines WHAT must transfer (§1) — not the conversation log, the substrate the conversation was generated from |
| **inv.reasoning.324** — Source independence of structural performance | appendix-a #324 | *"The structural performance of an invariant is independent of its provenance… structurally, all that matters is that the invariant exists and holds."* Extended by direct analogy across HOST rather than provenance: a delegate's constitutional performance does not depend on which frontier model or chat interface currently executes it. This is the single load-bearing invariant for the entire Homecoming programme's non-migration framing — it is WHY continuity survives a host change at all |
| **inv.reasoning.330** — Invariant as transferable reasoning primitive | appendix-a #330 | *"Once discovered and validated, an invariant… becomes part of a shared cognitive substrate both [human and machine] can converge on, contribute to, and reuse."* This is the mechanism by which a Personal Invariant validated on Claude AI is the SAME invariant when re-derived on the platform-native host — not a copy, not a re-interpretation |
| **inv.reasoning.325** — Machine-operational, not machine-discovered | appendix-a #325 | Continuity does not require the destination host to have "discovered" the same invariants independently; it requires them to be OPERATIONAL there — imported, ratified, and used |
| **inv.engineering.036 / inv.engineering.037** — One authoritative location per concern / a parallel implementation of an existing capability is a defect | appendix-a #36–37 | Governs §4's runtime architecture directly: continuity state has ONE home (the `homecoming` KB domain + the existing registry tables), never a parallel memory store per source host |
| **CS-001** — Duplicate capability as constitutional drift | `CS-001_duplicate-capability-as-constitutional-drift.md` | The concrete failure-mode citation for the same rule — a bespoke "Claude Code memory table" or "Codex session store" built in parallel to the `homecoming` KB domain is exactly the defect class CS-001 documents |
| **Law XI** — Humans define semantics, AI optimizes implementation | `CFS-009_development-constitution.md` §"Law XI" | The human principal — never the migrating agent itself — ratifies what counts as a preserved invariant for that specific relationship (mirrors CFS-023's `agent_verified`/`status:'proposed'` discipline for extracted invariants) |
| **Principal–Delegate Separation** (proposed) | `CFS-043` §6 | *"A delegated authority is granted only by the human principal who owns it… a delegate can never sponsor, form-ownership-over, or authorize its own authority."* Applied directly to migration: a migrating agent can never be the party that re-authorizes its own post-migration delegation (§5, §8) |
| **Graded Proof-of-Humanity** (proposed) | `CFS-043` §6, §2.1 | *"The strength of the personhood proof required to authorize a delegation scales with the contract's risk."* Applied to migration: re-authorizing a low-risk delegate (e.g. a research assistant) after migration needs only the weak proof already on file; re-authorizing a money-moving delegate needs the strong (World ID) proof, same as any fresh delegation |
| **Constitutional Presence ladder contiguity** (`CONSTITUTIONAL_PRESENCE_LADDER`, `resolvePresenceLevel`) | `types/homecoming.ts` §4 | *"A delegate cannot be 'development connected' without being 'reasoning connected.'"* Applied to migration: a migrated delegate's presence on the new host is measured from L0 again, contiguously — migration confers no rung by assertion |
| **The Homecoming Test's three dimensions** (continuity / knowledge / capability) | `CFS-023` §"The Homecoming Test" | The acceptance test for any single continuity event, not just the programme-level Homecoming Test |

No new invariant is proposed as ratified by this document. Where this SPEC's own reasoning goes beyond what the cited invariants literally state (e.g. "apply source-independence across host, not just provenance"), that extension is presented as this document's own argument, in prose, not smuggled in as a new numbered invariant — consistent with the "Hypothesis vs Canon" discipline (empirical/structural claims stay `proposed` until the operator ratifies them; see §13).

---

## 3. Migration lifecycle — the states a continuity event moves through

A single agent-continuity event (one delegate, one source host, one migration) moves through six states, in strict order — mirroring the same "order is meaning" discipline `HOMECOMING_WORKSTREAMS` already uses at the programme level. This is the per-event version of that same ordering: knowledge (constitutionalize) before agent (reconstitute presence) before harness (native operation), applied to one migration rather than the whole programme.

| # | State | What happens | Governing surface (existing, composed) |
|---|---|---|---|
| 1 | `origin-observed` | The source host/session is identified and its material located — a Claude AI conversation export, a Claude Code session transcript, a ChatGPT `conversations.json`, a Codex session log | Companion's consent-gated observation (§6) or a direct operator-provided export, same as CFS-023 Workstream 1's ChatGPT precedent |
| 2 | `constitutionalized` | The source material is parsed by a host-specific pure parser (mirroring `chatgptImport.ts`'s shape exactly: pure, canary-tested, idempotent by `source_id`) and ingested into the **same** `homecoming` KB domain; governing principles are extracted and PROPOSED into the invariants substrate (Law XI — `status:'proposed'`, never auto-canonical) | `services/homecoming/chatgptImport.ts` (reference shape) + `POST /api/homecoming/knowledge/{import,constitutionalize}` (reused, not forked, per host) |
| 3 | `principal-ratified` | The human principal reviews proposed invariants and decides which become part of the delegate's durable Personal/Domain invariant set (Law XI: humans define semantics) | Existing canonization-request ratification pattern (`iqube_canonization_requests`), same mechanism CFS-001/CFS-002 already use for any proposed invariant |
| 4 | `presence-reconstituted` | The delegate's Constitutional Presence is climbed CONTIGUOUSLY on the destination host — L0 (card) through whatever rung is earned — never asserted at a rung above what the ladder's real signals support | `services/homecoming/constitutionalPresence.ts` (`assessDelegate`), unmodified; `POST /api/homecoming/agent/stand-up` for the L0→L2 mechanical climb |
| 5 | `delegation-reauthorized` | The human principal re-authorizes the delegate's bounded authority on the new host, under Principal–Delegate Separation and Graded Proof-of-Humanity — the delegate's PRIOR authorization does not carry over by assertion; it is re-granted, receipted, revocable | `services/constitutional/constitutionalAgreement.ts` (`formAgreement`/`acceptAgreement`/`authorizeAgreement`), CFS-043's guided-onboarding capability (`services/constitutional/guidedOnboarding.ts`) |
| 6 | `native` | The delegate operates fully within the platform (Harness Homecoming, CFS-023 Workstream 3); the source host becomes an optional, inert historical record, never a live dependency | `POST /api/homecoming/agent/converse` (native, sovereignty-receipted conversation) |

**A migration event that skips stage 3 (no human ratification of what's preserved) or stage 5 (no re-authorization) has not achieved continuity under this SPEC — it has performed an import.** This is the precise mechanical difference between "importing chats" (stages 1–2 only) and "preserving agency" (all six stages) that the operator's framing draws.

---

## 4. Runtime architecture — where continuity state lives, who owns it

**No new store is proposed.** Continuity state is distributed across the SAME surfaces CFS-023 already ships, per the "one authoritative location per concern" discipline (`inv.engineering.036`):

| Concern | Lives in | Owner |
|---|---|---|
| Extracted/proposed invariants from migration source material | `invariants` substrate, `homecoming` KB domain (`codex_kb_*`) | The human principal persona, via `getActivePersona` — the invariant's `status` field tracks `proposed`→ratified per Law XI |
| Delegate's registry identity | `agent_root_identity` (keyed by `agent_card_slug`) | Server-internal; resolved by slug, never by a raw persona/agent UUID exposed client-side |
| Delegate's reasoning binding | `agent_persona` | Same table CFS-023 Workstream 2 already uses — no parallel persona table per source host |
| Delegate's bounded authority | `delegation_grants` + `constitutional_agreements` | The authorizing human principal (`ownerCommitment`), per Principal–Delegate Separation — never the delegate |
| Delegate's earned standing | `crm_personas` / `accrueStanding` (the CFS-023 × CFS-025 Standing loop, `delegateStanding.ts`) | Resolved from `agent_root_identity.agent_id` → CRM persona, best-effort, never faked |
| Delegate's issued passport | `polity_passport_records` (`bound_passport_id`) | Human-sponsored, per the genesis→passport→persona pipeline |
| Delegate's produced artefacts | `artifact_records` (CFS-025 Artifact Runtime) | Same containment discipline as CLAUDE.md's "Content Capsule Containment — GOLDEN RULE" — artefacts stay attributed to the SAME delegate identity across a migration, never orphaned into a new capsule |

Any parser built for Claude AI, Claude Code, or Codex source material (§10) MUST feed the SAME `homecoming` KB domain through the SAME `ingestTextDocument` spine `chatgptImport.ts` already uses — a per-host KB domain or a per-host memory table is the exact CS-001 defect class this corpus already names and forbids. The runtime architecture is: **one Constitutional Knowledge Repository, many host-specific parsers feeding it** — not many repositories.

Ownership is uniform across every row above: the human principal persona, resolved through `getActivePersona`/`personaFetch` per the Identity & Access Spine, exactly as CLAUDE.md's spine section requires. No continuity surface may resolve identity through a parallel mechanism.

---

## 5. Constitutional ownership after migration

**The human principal owns the continuity record. Neither the vendor host the delegate is leaving nor the delegate itself owns it.**

This follows directly from two already-settled positions:

1. **CFS-023's preamble** — the underlying AI provider "remains external and interchangeable... the frontier model an invisible implementation layer." Ownership of the *constitutional* record (invariants, standing, authority) was never the vendor's to begin with; migration doesn't transfer ownership FROM the vendor, because the vendor never held constitutional ownership — it held only inference execution.
2. **CFS-043's Principal–Delegate Separation** — ownership of delegated authority sits with the human principal (`ownerCommitment`), structurally distinct from the delegate. A migration event cannot change WHO owns the authority; it can only change WHERE the delegate operates and under what re-authorized scope.

The practical consequence: after a migration event completes (lifecycle stage 6, `native`), the delegate's constitutional record — invariants, standing, authority, artefacts — belongs to the same human principal it always belonged to, now hosted natively rather than mediated through a vendor chat interface. Provider interchangeability (the Chrysalis 2.0 win) is preserved: the destination host is itself just another interchangeable inference provider from the constitutional record's point of view, per `inv.reasoning.324`.

---

## 6. Companion's role

Per the "Wallet-Over-Cartridge Overlay" pattern and SPEC-MMC-001's Constitutional Flow model, **Companion is the consent-gated observation surface through which a citizen brings migration source material home** — this is not a new capability Homecoming needs to invent; it is Movement I ("Capture") of SPEC-MMC-001 applied to a specific class of Legacy Internet object: chat exports, session transcripts, and project files sitting in Claude.ai, ChatGPT, or a Codex workspace are exactly the "Legacy Internet → Constitutional Runtime" boundary SPEC-MMC-001 §0.4 already governs, with the same unweakened consent posture (`extension/companion-observer/`, capability-grant gated, revocable, T0 never leaving the device, per-capability grants).

Companion's role in the migration lifecycle (§3) is therefore scoped to **stage 1 (`origin-observed`) only**: it is the vehicle by which a citizen consents to and initiates "Pull Across" of source material from a legacy chat interface into the platform. It does not perform constitutionalization (stage 2, the KB's job), ratification (stage 3, the human principal's job under Law XI), or re-authorization (stage 5, the Constitutional Agreement primitive's job). This SPEC does not expand Companion's mandate beyond what SPEC-MMC-001 already charters — it names Companion as the existing capture surface for one additional object class (agent-continuity source material), not a new consent doctrine.

---

## 7. MCP's role

Described here at the same altitude CFS-023 describes "the harness moving inside" — architecturally, not as a protocol specification (a full MCP protocol spec is a sibling task, Strand 4, not this document's scope).

**MCP is the connectivity/tool-surface layer an external agent host uses to reach the platform's onboarding and continuity primitives without the platform needing to be embedded inside that host first.** A Claude Desktop session, a ChatGPT session with MCP tool support, or a Codex session can — via an MCP server exposing the platform's guided-onboarding capability (CFS-043's `services/constitutional/guidedOnboarding.ts`) and the Homecoming import/constitutionalize routes (§4) as callable tools — let its own agent walk its principal through Passport application and bounded delegation (CFS-043 §3's guided flow) from WITHIN that still-external host, before the harness itself ever moves.

In the migration lifecycle (§3), MCP is the **transitional bridge for stages 1–3**: it is one of the possible channels by which `origin-observed` material and its `principal-ratified` decisions travel between a still-external host and the platform, while the host has not yet become native (stage 6). It is not itself where continuity state lives (§4) and it does not replace Harness Homecoming's eventual move to `Human → Aigent Z → AgentiQ → Inference Providers` — it is the doorway a still-external harness uses on its way there. Full MCP protocol mechanics (OAuth façade, signed Agent Link manifest, remote server topology) are out of scope for this document by explicit operator instruction.

---

## 8. Passport's role

**Passport's role in agent-continuity migration is identical to its role in Agent Homecoming generally (CFS-023 Workstream 2) — it is not redefined here, only applied to an agent that already has continuity claims rather than a brand-new one.**

The genesis → passport → persona pipeline CFS-023 already charters — `sponsorPolityAgent()` seeds `agent_root_identity` → `/api/polity-passport/submit` issues the Participant Passport (`passport_class='agent_participant'`, sets `bound_passport_id`) → `/api/identity/persona/agent` provisions the bounded `agent_persona` — is the SAME mechanism a migrating delegate uses at lifecycle stage 4/5 (§3). The only difference from a fresh delegate: the migrating delegate arrives with `constitutionalized`, `principal-ratified` material (stage 2–3) already behind it, which becomes the seed content the genesis flow's Agent Card and persona provisioning draw from — richer input to an unchanged pipeline, not a different pipeline.

CFS-043's central law governs this exactly as it governs any other delegation: **the migrating agent can never be the party that sponsors or authorizes its own passport or delegation.** The human principal applies for the Passport, and the human principal authorizes the bounded delegation, under a personhood proof graded to the risk of what's being restored (§2's Graded Proof-of-Humanity — weak captcha for a low-risk research delegate being re-homed, strong World ID for a money-moving one). This is cited from CFS-043 §2/§2.1, not re-derived.

---

## 9. Constitutional Agent Reconstitution — the operator's named sub-concept, worked through

The operator named this sub-concept explicitly and asked for a real, worked-through answer — not a restatement of the question. Here is that answer.

### 9.1 The question, stated precisely

*What invariants must be preserved so that a migrated agent remains recognisably the same working partner?*

### 9.2 The answer

**Constitutional Agent Reconstitution is the re-derivation — never the replay — of a delegate's invariant substrate, contiguous presence, and human-authorized standing on a new host, such that the same Intent, applied against the same Personal and Domain Invariants, produces recognisably the same class of behaviour a working partner would recognise.** Six components are individually necessary; none is sufficient alone.

1. **Personal Invariants intact** — the specific principles, preferences, and reasoning patterns this delegate has accumulated *for this specific principal* (the "Personal Invariants" term from `inv.reasoning.320`'s formula) must be re-derivable on the destination host, via the `constitutionalized`/`principal-ratified` stages (§3.2–3.3), not merely re-stated from a cached transcript.
2. **Domain Invariants intact** — the constitutional/domain corpus the delegate reasons from (the invariant substrate proper, `inv.reasoning.330`'s "shared cognitive substrate") must be the SAME substrate, not a re-summarized approximation of it — this is what `inv.reasoning.324`'s source-independence claim licenses: the substrate's structural performance does not degrade for having moved host.
3. **Standing/relationship history intact** — earned standing (the CFS-023 × CFS-025 Standing loop, `delegateStanding.ts`) must carry forward, never reset to zero. A delegate that has earned an L3 trust-band ceiling through prior production does not restart at L0's reputation floor merely because its host changed — though its *presence rung* (component 4 below) is still re-climbed contiguously; earned standing and presence rung are related but distinct (standing is the reputation that UNLOCKS a rung ceiling, per CFS-023 §"Success criteria"; it is not the rung itself).
4. **Working context intact** — the delegate's current intent, in-flight commitments, and journey/experience state (`JourneyStateSummary`, `types/orchestration.ts`) must transfer, so the delegate resumes where it left off rather than starting cold.
5. **Artefact provenance intact** — anything the delegate produced before migration remains attributed to the SAME delegate identity afterward, never orphaned into an unlinked record — the Content Capsule Containment golden rule (CLAUDE.md), applied across a migration event instead of across a UI capsule boundary: derivative output must stay bound to its origin.
6. **Delegation authority re-authorized, never silently inherited** — per Principal–Delegate Separation (§2, §8), the human principal re-authorizes the delegate's bounded scope on the new host explicitly. **A migration event is never a backdoor around human re-authorization** — this is the one component that is not "carried forward" but deliberately, freshly granted every time, by design.

### 9.3 What Reconstitution explicitly is NOT

- **Not transcript replay.** Making the destination host able to recite the source conversation verbatim satisfies none of the six components above and is not continuity under this SPEC's working definition (§1).
- **Not automatic authority inheritance.** Component 6 is deliberately NOT preserved by default — re-authorization is the one place migration must slow down and re-involve the human, per CFS-043.
- **Not "Transaction Reconstitution".** See §0.4 — a different concept, a different domain, no shared mechanism.
- **Not vendor-portable data export alone.** Stages 1–2 of §3 (origin-observed, constitutionalized) are necessary but explicitly insufficient — CFS-023's own honest-limits section already makes this point for the ChatGPT case ("imported transcripts are retrievable immediately... The corpus becomes invariant-aware only once the operator ratifies") and this SPEC generalizes it: retrievability is not reconstitution.

### 9.4 The test

A reconstituted delegate passes the Homecoming Test's `continuity` dimension (CFS-023) if, given the same class of intent it handled before migration, it produces recognisably the same class of response — grounded in the SAME re-derived invariants (components 1–2), continuing the SAME working context (component 4), building on the SAME earned standing (component 3), correctly attributed to the SAME artefact history (component 5), and operating under a FRESHLY re-authorized scope (component 6). This is qualitative, exactly as CFS-023's own honest-limits section already concedes for its own Continuity/Capability dimensions ("not yet instrumented; the ladder is the necessary structural precondition, not the full test") — this SPEC does not claim to have solved that instrumentation gap, only to have named precisely what the qualitative judgment must be checking for.

---

## 10. The named migration objectives, mapped onto the lifecycle

| Objective (operator-named) | Lifecycle stage(s), §3 | Governing invariant, §2 | Existing surface / genuinely new |
|---|---|---|---|
| **Claude AI migration** | 1–6 | inv.reasoning.324, 330 | Genuinely new parser needed (no Claude AI export parser exists today) — mirrors `chatgptImport.ts`'s shape |
| **Claude Code migration** | 1–6 | inv.reasoning.324, 330; inv.engineering.036 | Genuinely new — a Claude Code session's working context (component 4, §9.2) is richer than a chat transcript (tool calls, file edits, git state); no parser exists today |
| **ChatGPT migration** | 1–6 | (all of §2) | **Already shipped** — `chatgptImport.ts` + `POST /api/homecoming/knowledge/import` (CFS-023 Workstream 1, Phase 1) |
| **Codex migration** | 1–6 | inv.reasoning.324, 330 | Genuinely new — same shape as Claude Code (session/tool-call structure, not flat chat) |
| **Agent migration** | 1–6, the umbrella term | all of §2 | The general case this SPEC's lifecycle (§3) defines; each named host above is an instance |
| **Memory migration** | 2 (`constitutionalized`) | inv.reasoning.320, 325 | Component of stage 2 — memory is one class of source material feeding constitutionalization, never treated as continuity by itself (§9.3) |
| **Behavioural continuity** | 3–4 | inv.reasoning.320, 324 | §9.2 components 1–2 (Personal + Domain Invariants) |
| **Working context continuity** | 4 | — | §9.2 component 4 (journey/experience state) |
| **Project continuity** | 4 | — | §9.2 component 4, scoped to a specific venture/intent context (`JourneyStateSummary`) |
| **Artefact continuity** | 6 | Content Capsule Containment (CLAUDE.md) | §9.2 component 5 — `artifact_records` attribution preserved |
| **Relationship continuity** | 4–5 | Principal–Delegate Separation, Standing loop | §9.2 components 3 and 6 — earned standing carried forward, authority freshly re-granted |

This table is the honest gap map for this SPEC, mirroring the style of CFS-023's own Knowledge Homecoming source-class table (§Workstream 1): most rows are the SAME lifecycle mechanics; only the parser for each named host is genuinely new work, and Claude AI / Claude Code / Codex parsers do not exist yet.

---

## 11. Honest limits

- **No parser exists yet for Claude AI, Claude Code, or Codex source material.** Only ChatGPT's `conversations.json` parser is shipped. Building the other three is implementation work this document does not authorize — it names the shape they must take (§10), consistent with the "docs first, ratify before build" discipline governing this entire filing.
- **The Homecoming Test's `continuity` and `capability` dimensions remain qualitative**, exactly as CFS-023 already concedes. §9.4's test is a sharper articulation of what the qualitative judgment checks for; it is not a new instrument.
- **Component 3 of §9.2 (standing continuity) depends on a delegate already having a CRM persona resolved** — per `delegateStanding.ts`'s own honest caveat, a delegate without one skips accrual, stated not faked. The same caveat applies unchanged to a migrating delegate.
- **This SPEC does not specify MCP protocol mechanics** by explicit operator instruction (§7) — that is Strand 4's scope, a sibling document.
- **Re-authorization friction (§9.2 component 6) is a deliberate design cost, not an oversight.** A future iteration might explore lighter-weight re-authorization for low-risk, previously-authorized delegates re-homing to the SAME principal — but that would require its own CFS-043-style ratification of a narrower Principal–Delegate Separation exception, not something this document proposes.

---

## 12. The umbrella programme (naming only, not built here)

This SPEC is Strand 2 of a four-strand operator programme the operator has identified sitting above it: the **Technical Founder Operator Activation Programme** — the complete constitutional journey from first Claude Code interaction, through Passport, delegation, Agent Me, specialized operating environments, Homecoming, constitutional continuity, to Portfolio Operator. Named here once, for reference; not designed or built in this document.

---

## 13. Ratification record

- [x] Operator has read and ratified this SPEC (§0–§12) as written. — operator-directed, 2026-07-25.
- [x] Operator confirms the numbering decision (§0.5): SPEC-HMC-001, companion to CFS-023, not a new CFS-0xx. — no revision directed; the filing proceeds under this number.
- [x] Operator confirms §9 (Constitutional Agent Reconstitution) as the working answer to the named sub-concept, or directs revision. — confirmed as written; no revision directed. §9.2's six components are the contract Phase 1's assessment dimensions map onto (§14.1).
- [x] No invariant listed in §2 is proposed as newly `canonical` by this document — all are cited from existing corpus entries (`canonical`) or existing `proposed` CFS-043 candidates; this filing changes no invariant's status. — re-verified at ratification; still true, and still true of the Phase 1 code, which writes no invariant and changes no invariant status.
- [x] Build authorization for host-specific parsers (Claude AI, Claude Code, Codex) is a SEPARATE gate, not granted by this document's ratification. — **affirmed and still binding.** The 2026-07-25 ratification authorises §14.1's read-only assessment substrate ONLY. No parser for Claude AI, Claude Code, or Codex is authorised, and none was built. `MIGRATION_SOURCE_HOSTS` in `types/homecoming.ts` names the four hosts and `migrationSourceParserExists()` reports honestly that only `chatgpt-export` has one.
- [x] Phase 1 (§14.1) build authorised and shipped 2026-07-25 — read-only continuity assessment substrate, no migration execution, no auto-authorization path. Canary-enforced (`tests/homecoming.test.ts`).
- [ ] Phase 2+ (migration execution: cross-host transfer, working-context import, re-authorization ceremony wiring) — **NOT authorised.** Requires its own operator gate. §14.2 states what remains unbuilt.

---

## 14. Phase 1 — what shipped (2026-07-25)

Added after ratification, recording what the authorised build actually produced and — with equal weight — what it did not. Session record: `codexes/packs/agentiq/updates/2026-07-25_spec-hmc-001-phase1-continuity-assessment.md`.

### 14.1 Scope built — the continuity ASSESSMENT substrate, and only that

Phase 1 deliberately does not build the six-stage lifecycle as an engine. It builds the read-only substrate that answers, for one delegate: **which continuity dimensions are satisfiable from real platform state today, and which are not.**

| Artefact | What it is |
|---|---|
| `types/homecoming.ts` §8 | The §3 lifecycle and the §9/§10 taxonomy as real typed contracts — `MIGRATION_LIFECYCLE_STAGES` (order-pinned, with a per-stage `humanAct` flag), `resolveMigrationStage` (contiguous, mirroring `resolvePresenceLevel`), `ASSESSABLE_STAGE_CEILING`, `AGENT_CONTINUITY_DIMENSIONS`, `CONTINUITY_DIMENSION_SPEC` (each dimension bound to its stage and its §9.2 component numbers), `MIGRATION_SOURCE_HOSTS` + `migrationSourceParserExists`. Extends CFS-023's contract file per §0.3 — no parallel constant set was created. |
| `services/homecoming/agentContinuity.ts` | The read-only assessor. Pure `assembleContinuity()` (canary-tested) over best-effort reads that compose `assessDelegate`, `readDelegateStanding`, `listArtifactRecords`, the `homecoming` KB domain, and the `invariants` substrate. No new store, no DB migration. |
| `GET /api/homecoming/agent/continuity` | Spine-gated + admin-gated (the same gate the five sibling `/api/homecoming/agent/*` routes carry). `GET` only — no mutating handler exists. |
| `tests/homecoming.test.ts` | Extended with contract pins, pure-assembler tests, and structural canaries. |

### 14.2 The honest assessability finding — 2 of 5 dimensions have no platform state

| Dimension | Verdict | Reason |
|---|---|---|
| artefact | **assessable**, delegate-scoped | `artifact_records.delegate` is a real per-delegate key; receipt-anchoring is countable |
| relationship | **assessable** for the half that transfers | earned standing (§9.2 component 3) is readable; bounded authority (component 6) is by design never carried forward |
| behavioural | **corpus-scoped only** | neither `codex_kb_documents` (domain `homecoming`) nor `invariants` carries a delegate binding, so no per-delegate claim is honest. Stamped `scope: 'corpus'`. |
| working-context | **not assessable today** | `journey_states` is keyed on `persona_id` — a HUMAN persona; `agent_persona` rows are not journey subjects. A delegate has no current-intent record anywhere. The principal's journey row is deliberately NOT substituted. |
| project | **not assessable today** | same root gap, one scope narrower — no venture/intent scoping key exists for a delegate |

This sharpens §11's honest-limits list rather than contradicting it: the SPEC anticipated that Component 3 depends on a CRM persona existing; Phase 1 found the harder constraint that Component 4 has no delegate-scoped store at all. Building one is a schema decision needing its own operator gate — flagged, not assumed.

### 14.3 §9.2 component 6 is enforced structurally, not by convention

Three independent mechanisms, so no single edit can reintroduce an auto-authorization path:

1. **Hard cap.** The assessment resolves at most `ASSESSABLE_STAGE_CEILING` (stage 4). Stages 5–6 are passed to the resolver as unconditionally unsatisfied. A fully sovereign delegate still assesses to stage 4 — canary-pinned.
2. **Derived, not asserted.** A canary proves every stage above the ceiling carries `humanAct: true`, so the cap cannot drift out of alignment with the taxonomy.
3. **Structural canaries over raw source.** The service and route are grepped for the Constitutional Agreement / guided-onboarding modules and their form/accept/authorize verbs, for every write verb, for receipt writing and standing accrual, and for T0 identifiers in any response block. The grep deliberately includes comments — it fired on this SPEC's own implementation twice during the build, and the canary was kept strict rather than softened both times.

### 14.4 Still unbuilt after Phase 1

Migration execution (any stage transition); parsers for Claude AI, Claude Code, or Codex (§13 line item — still a separate gate, still unmet); chat/transcript import beyond the already-shipped ChatGPT path; cross-host data transfer or any write to another vendor's system; working-context and project continuity (blocked on the §14.2 store gap); re-authorization ceremony wiring (stage 5 — a human act in the browser, which Phase 1 must never perform). No UI surface was built; the assessment is API-only.
