# SPEC-MMC-001 — Constitutional Flow

**metaMe IRL / iQube Protocol / AgentiQ · Interaction-model specification · Status: DESIGN — docs-only, awaiting explicit operator ratification**
**Title:** *Constitutional Flow — Legacy Internet ↔ Constitutional Internet Experience Specification*
**Companion to:** metaMe Threshold (PRD-THR-001) · Workspace (myCluster's `myWorkspace` tab) · Artifact Runtime · myCluster
**Extension of:** **PRD-MMC-001 — metaMe Companion**. This is not a second PRD — it is the interaction-model layer the operator asked to specify *underneath* PRD-MMC-001, scoped to exactly the browser-extension / Companion satellite surface PRD-MMC-001 already charters. "I don't think it needs a whole PRD… it's just a specification, an extension of the current PRD" (operator, verbatim).
**Owner:** AgentiQ Runtime stewards + Identity & Access Spine stewards, same ownership as PRD-MMC-001 · **Origin:** operator + Aletheon design session, 2026-07-23, reconciled by Claude Code against the shipped runtime the same day.

> **Governance note (binding, this SPEC):** This is a **docs-only** deliverable, same regime as PRD-MMC-001. Aletheon's own draft header self-declares `Status: Ratified Implementation Specification` — that self-declaration is **not honoured as filed**. Per this repo's ratify-before-build discipline (CLAUDE.md "Security — Access Gates", "Hypothesis vs Canon — Epistemic Honesty Discipline") a document cannot ratify itself, and the operator's conversational enthusiasm for the direction ("Perfect, love it") is a real and valuable signal but is not the same artifact as a dated, line-item ratification record of *this specific document's* content. This filing's status is honestly **DESIGN**, matching PRD-MMC-001's own status line at the point it was filed. §11 below is the ratification record, unchecked, awaiting the operator's explicit pass.

> **Companion documents (read alongside):** `PRD-MMC-001_metame-companion.md` — **THIS SPEC'S UMBRELLA**; read its own §0 first, since this document applies the identical reconciliation discipline one level down. `PRD-THR-001_metame-threshold.md` — the sibling agentic-host (MCP) presentation surface; not redefined here. `CLAUDE.md` sections: "Content Capsule Containment — GOLDEN RULE", "Artifact Production — AR/CPS + Observer Awareness", "Identity & Access Spine — CANONICAL SoT". The live extension source at `extension/companion-observer/`.

---

## 0. Read this first — reconciliation against what's already built

Aletheon's "Constitutional Flow" draft is the right interaction-model reframe for the Companion satellite, and its central claims — flow over navigation, four movements, Workspace as membrane, "Pull Across" instead of "Save/Upload/Bookmark" — are kept intact below because they are good and none of them collide with anything shipped. But, exactly as PRD-MMC-001 §0 had to do one level up, this draft was authored without visibility into (a) how much of the destination side already exists, (b) which of its "movements" the extension actually implements today, and (c) governing doctrine already in `CLAUDE.md` that some of its language should cite rather than re-invent. **This section is the correction; §§1–10 and the Implementation Scope are the reconciled spec.**

### 0.1 myCluster is real, and 4 of Aletheon's 5 named areas already ship — `myResearch` is the one genuine, named gap

`data/codex-configs.ts` (search `group: 'mycluster'`) confirms four live tabs today: `myCanvas` (`component: 'MyCanvasTab'`), `myWorkspace` (`component: 'MyWorkspaceTab'`), `myCartridge` (`component: 'MyCartridgeTab'`), `myLedger` (`component: 'MyLedgerTab'`). Aletheon's §5 names a fifth — **`myResearch`** — and Aletheon's own aside in the design conversation ("the only thing that isn't really there at the moment is my research") is confirmed accurate: **`myResearch` does not exist as a myCluster tab today.** This is not glossed over here; it is named as the one component of §5 that is genuinely net-new UI surface, not a reconciliation of an existing tab. (The underlying *data* it would read — `research_objects`, `services/research/*`, `/api/research/*`, CFS-019 — already exists per PRD-MMC-001 §0.7; what's missing is the myCluster-tab presentation of it.)

### 0.2 Movement II (Organize) must respect the Content Capsule Containment golden rule — cited, not re-derived

CLAUDE.md's "Content Capsule Containment — GOLDEN RULE (PARAMOUNT)" already governs exactly the question Movement II raises — *where does derivative/organized content render once it has a destination?* Its rule: "Any derivative content generated from actions taken WITHIN a capsule MUST be rendered inside that same capsule. It must never spawn orphan pills, chips, or capsules outside of it." Aletheon's "Bring into… Workspace / Research / Venture / Story / Ledger" destinations (§6) are themselves an *assignment* of constitutional context (Movement II), but anything a capsule at that destination subsequently *derives* from the captured object — a summary, a delegated task, a generated artifact — is bound by the golden rule already, not a new containment doctrine this SPEC needs to state. **Constraint, not new invention: an "Organize" destination is a home for the captured object; it is never license for derivative capsule output to escape that home.**

### 0.3 Workspace-as-membrane observation must use the existing observer-awareness pattern, "observed, never asserted" — cited, not re-derived

CLAUDE.md's "Artifact Production — AR/CPS + Observer Awareness" section already mandates that any surface narrating the state of its space do so through the observer pattern — folding real production state into ground/observation context, "observed, never asserted" — with `/api/research/overview` + `components/composer/IRLResearchCopilotTab.tsx` as the reference implementation. Aletheon's §4 (Workspace as Constitutional Membrane — "simultaneously constitutional inbox, workbench, and outbox") is exactly this pattern applied to inbound/outbound flow state. This SPEC does not define a new observation doctrine for Workspace; it names the existing one as the mechanism §4 must use, matching PRD-MMC-001 §0.4's identical citation for the Constitutional Observer.

### 0.4 Movement I (Capture) and "Pull Across" (§9) are architecturally the SAME surface PRD-MMC-001 §0.4 already named as the platform's single biggest risk — do not weaken its consent posture

PRD-MMC-001 §0.4 is explicit: the browser-context **observation** source — reading the current page/domain/selection/document with consent — is "the single biggest risk in the whole concept," and its Observer guardrails (§4 of that PRD) are consent-gated, revocable, per-capability, with T0 never leaving the wallet and no browsing data transmitted without an explicit grant. Aletheon's Movement I ("Capture: Legacy Internet → Constitutional Runtime… the user never uploads, the user constitutionalizes") and §9's "Pull Across" signature interaction are, mechanically, **the write/action side of that same observation surface** — the object a capture/pull-across action reads (a selection, a page, a document) is exactly what PRD-MMC-001 §4.1's capability-grant table already gates (`selection`, `page-document`, `downloads`, `clipboard`). This SPEC does not get to imply a lighter consent posture than its own umbrella already ratified because the verb is friendlier ("Pull Across" vs. "Observe"). **Rule carried forward unweakened: every Capture / Pull Across action fires only within a capability already granted per PRD-MMC-001 §4.1, is revocable the same way, and never transmits T0 off-device.** Aletheon's excellent naming ("constitutionalize," "Pull Across") is retained as the *user-facing verb layer* over that existing, unweakened guardrail — not a rebrand of the guardrail itself.

### 0.5 The extension that exists today is Observer-only — Movements I, III, and IV are unbuilt; this SPEC targets work not yet started

`extension/companion-observer/` (`manifest.json`, `background.js`, `content.js`, `popup.js`, `sidepanel.html`, `observerConsentExt.js`) is real and ships today. Its `manifest.json` description states its scope precisely: *"consent-gated browser context Observer for the metaMe Companion. Reads only what a persona has explicitly granted… never a raw page dump."* Its permissions (`storage`, `activeTab`, `scripting`, `sidePanel`) and its content-script/background/sidepanel files implement **capability-grant-gated OBSERVATION** (page/domain awareness) and a search-federation surface (component 8 of PRD-MMC-001) — the read side of Component 3 (Constitutional Observer). **It does not today implement:** any context-menu "Bring into…" action (Movement I / component 9's capture triggers), any drag-based "Pull Across" interaction (§9), any "Act" affordance beyond search (Movement III / component 7), or any "Project" push-back-to-legacy-internet action (Movement IV). Say this plainly, not by omission: **this SPEC defines the target interaction model for Movements I, III, and IV — none of which the extension has started building.** Only Movement II's *destination* concept and the Observer half of the membrane (§0.3) have any shipped surface today.

### 0.6 PRD-THR-001 is a sibling surface, not something this SPEC redefines

`PRD-THR-001_metame-threshold.md` charters the MCP/agentic-host presentation surface — Claude, ChatGPT, Claude Code reaching the runtime via MCP (`services/threshold/gateway.ts`). PRD-MMC-001 §0.5 already establishes the unifying architecture: agentic hosts reach the runtime via MCP/Threshold; the regular, non-agentic web (Chrome/Safari/arbitrary sites) reaches it via the Companion extension/sidebar/overlay this SPEC's Four Movements govern. This SPEC is scoped to the second surface only. It cites PRD-THR-001 for the first; it does not restate or redefine Threshold's crossing sequence, Constitutional Handshake, or Sovereignty Ladder.

### 0.7 Numbering and status — no collision; status corrected, not silently upgraded

No `SPEC-` prefixed document exists anywhere else in this repo (`PRD-*` and `CFS-*` are the two governing prefixes in use); `SPEC-MMC-001` is a genuinely new document-type, matching the operator's own framing that this doesn't need a full PRD. No numbering scheme beyond this single document is invented here. Aletheon's draft header claims `Status: Ratified Implementation Specification` for itself; per this repo's own discipline (a document cannot self-ratify; see the governance note at the top of this file) that claim is **not carried forward as filed** — status here is **DESIGN**, and §11 records what remains for the operator to explicitly ratify, dated, the same way PRD-MMC-001 §8 and the PRD-MMC-IMPL plans record theirs.

---

## 1. Principle

The browser extension (and future mobile/desktop companion) is not an application. It is a **constitutional satellite** that allows information, intent, and action to move naturally between the Legacy Internet and the Constitutional Internet. The primary experience is **flow, not navigation**. (Retained from Aletheon's draft verbatim — this framing is correct and does not collide with anything shipped; it is the product framing PRD-MMC-001 §1 already gives the Companion — "the constitutional layer that overlays the existing web.")

## 2. UX Principle

The Constitutional Internet is the persistent state of the user. The Legacy Internet is where work *happens*. The Constitutional Internet is where work *gains*: identity, provenance, memory, delegation, governance, standing. The constitutional runtime becomes the user's persistent operational spine. (Retained — this is the same "metaMe comes with me" thesis PRD-MMC-001 §1 already states; this SPEC applies it to the specific interaction verbs below.)

## 3. The Four Constitutional Movements

Everything the satellite exposes must reduce to one of four movements. Each movement below is tagged with its build status per §0.5 — do not read a movement's presence here as evidence it ships today.

**Movement I — Capture** *(unbuilt in the extension — §0.5; consent-gated per §0.4)*
Legacy Internet → Constitutional Runtime. Purpose: bring something into constitutional state. Supported objects: webpages, PDFs, images, emails, GitHub issues, Slack conversations, AI conversations, documents, browser selections, URLs. The user never "uploads." The user **constitutionalizes**. Every capture fires through the existing Qube constructors (`services/iqube/{experienceQube,intentQube}.ts`, CapabilityQube, ResearchQube via `services/research/*`) per PRD-MMC-001 §0.7 — never a parallel creator — and only within a capability grant already established under PRD-MMC-001 §4.1 (§0.4 above).

**Movement II — Organize** *(destination concept only; containment constraint per §0.2)*
Every captured object is assigned constitutional context. Possible destinations: Workspace, Venture, Research, Experiment, Ledger, Cartridge, Story, Canvas, Intent. Folders are never exposed. Objects belong to constitutional work. Any capsule-scoped output a destination subsequently derives from a captured object stays inside that capsule (§0.2 — Content Capsule Containment, cited not re-derived).

**Movement III — Act** *(unbuilt in the extension beyond search — §0.5)*
Once constitutionalized, the runtime can: delegate, summarize, research, classify, create tasks, create intents, attach to ventures, publish, request approval, anchor, earn standing. This is the workbench — Component 7 (Agent surface) of PRD-MMC-001, itself an extension of `services/constitutional/constitutionalAgreement.ts` (bounded delegation) and `types/orchestration.ts`; the delegation engine is not rebuilt here.

**Movement IV — Project** *(unbuilt in the extension — §0.5)*
Constitutional Runtime → Legacy Internet. The runtime projects work back into the outside world: publish an article, send an email, create a GitHub PR, respond in Slack, generate an investor update, create a calendar event, update a CRM, drive browser automation. Nothing is trapped inside metaMe.

## 4. Workspace as Constitutional Membrane

Workspace (the shipped `myWorkspace` tab, `component: 'MyWorkspaceTab'` in `data/codex-configs.ts`) becomes the membrane between both Internets. Every incoming object passes through Workspace. Every outgoing projection originates from Workspace. Workspace is therefore simultaneously: constitutional inbox, constitutional workbench, constitutional outbox. **Its narration of "what's incoming / in progress / outgoing" is an observer-pattern surface** (§0.3) — it folds real capture/act/project state into its ground context and never asserts flow it hasn't observed, mirroring `/api/research/overview` + `IRLResearchCopilotTab`'s "observed, never asserted" discipline.

## 5. myCluster as the Operational Spine

myCluster is not navigation. It is the persistent operational state. Its constitutional areas, reconciled against what ships (§0.1):

| Area | Status | Anchor |
|---|---|---|
| **myWorkspace** — Ideas, Drafts, Intents, Captured material, Work | **EXISTS** | `MyWorkspaceTab` |
| **myLedger** — Receipts, Standing, DVNs, Activity history, Evidence | **EXISTS** | `MyLedgerTab` |
| **myCanvas** — Visual composition, Planning, Mapping | **EXISTS** | `MyCanvasTab` |
| **myCartridge** — Reusable capability, Applications, Knowledge, Published experiences | **EXISTS** | `MyCartridgeTab` |
| **myResearch** — Experiments, Corpora, Invariant discovery, Research artefacts | **NEW — genuinely missing tab** | Data exists (`research_objects`, `services/research/*`, CFS-019); the myCluster tab does not (§0.1) |

Each area represents a stable constitutional function rather than a UI page. Adding `myResearch` follows the same tab-registration pattern as the other four in `data/codex-configs.ts` — a scoping decision for a future implementation pass, not this SPEC.

## 6. Satellite Experience

The satellite intentionally exposes only the constitutional movements. It does not mirror the platform UI. Example: highlight text → right-click → "Bring into… Workspace / Research / Venture / Story / Ledger" — no application launch required. GitHub: "Bring Issue to Venture." Email: "Convert to Intent." ChatGPT/Claude: "Constitutionalize Conversation." The satellite surfaces **verbs, not applications**. (Retained verbatim — none of these context-menu verbs exist in `extension/companion-observer/` today; see §0.5. This is the target UI for a future implementation increment.)

## 7. Standing

Standing is never a visible objective. Users complete meaningful constitutional work. The runtime automatically issues receipts, updates the ledger, and accrues standing. Standing becomes a **consequence** of work rather than a gamified interaction. (Retained — this is consistent with the existing receipt/DVN discipline; any receipt this movement set produces flows through the unified receipt writer and the DVN pipeline as a receipt *type* only, per CLAUDE.md "DVN Pipeline Protection" — never a new mechanism.)

## 8. Persistent State vs. Active Surface

**Active Surface** (constantly changing): Browser, IDE, Claude, ChatGPT, Slack, GitHub, Word, Email, etc.
**Persistent State** (continuous regardless of host environment): Identity, Projects, Workspace, Ledger, Research, Standing, Delegation, Memory.
(Retained verbatim — this is the same runtime-first, presentation-surfaces-are-thin philosophy PRD-MMC-001 §0.6 and §2 already charter as an instance of the AgentiQ Runtime doctrine, CFS-022.)

## 9. Signature Interaction — Pull Across

Users do not "Save," "Upload," or "Bookmark." They **"Pull Across."** Legacy Internet → Pull Across → Constitutional Runtime. An object crossing the Threshold automatically gains: provenance, constitutional identity, workspace assignment, ledger entry, standing opportunity, delegation capability. Likewise: Constitutional Runtime → **Project** → Legacy Internet — the object returns carrying constitutional state. **This is the user-facing name for the Movement I / IV pair, and it inherits the unweakened consent posture of §0.4 — "Pull Across" is a friendlier verb for an action that still only fires within a capability already granted, never a bypass of that grant.**

## 10. Experience Invariant

The runtime becomes richer while the interface becomes lighter. Every additional capability should **reduce** the amount of interface required, not increase it. Interfaces should project only the minimal constitutional experience required for the user's current intent. (Retained verbatim — this is the single clearest design constraint in Aletheon's draft and collides with nothing shipped; it is a direct instruction to future implementation passes, not a claim about current state.)

---

## Implementation Scope

This specification does not introduce new constitutional primitives. It composes existing capabilities and PRD-MMC-001 components: Threshold (PRD-THR-001), Passport, Workspace (`MyWorkspaceTab`), the Artifact Runtime / Qube constructors, Ledger (`MyLedgerTab`), Standing, Delegation, the Browser Extension (`extension/companion-observer/`), and a future mobile companion — into a unified interaction model. The implementation objective is **constitutional flow**, allowing founder operators to move seamlessly between the Legacy Internet and the Constitutional Internet while preserving identity, provenance, context, governance, and agency.

**The honest scope delta, stated plainly (per §0.5):** the extension today implements the Observer/search read-side only. Everything this SPEC names as Movement I (Capture), Movement III (Act, beyond search), Movement IV (Project), the context-menu "Bring into…" affordances of §6, and the `myResearch` tab of §5 are **unbuilt** — this document specifies the target interaction model for a future, separately-chartered and separately-ratified implementation pass (mirroring how PRD-MMC-001 §6's phased rollout and the PRD-MMC-IMPL-00x plans work), not a description of shipped behavior. Any such implementation pass remains subject to every guardrail PRD-MMC-001 §4 and this SPEC's §0.4 already establish: per-capability consent, revocability, T0-never-leaves-the-wallet, spine-as-sole-resolver, and no parallel production/creator paths.

---

## 11. Ratification record

- [ ] Operator ratifies **SPEC-MMC-001** as DESIGN (docs-only), extending PRD-MMC-001 rather than standing up a second PRD — matching the operator's own framing that this is "a specification, an extension of the current PRD, a specification to provide to Claude to execute."
- [ ] Operator confirms the **Four Constitutional Movements** framing (§3) — Capture / Organize / Act / Project — as the target interaction model for the Companion satellite, with Movements I, III (beyond search), and IV named explicitly as **unbuilt** in the current extension (§0.5).
- [ ] Operator confirms **myResearch** (§5) as the one genuine, net-new myCluster tab this document surfaces — not a reconciliation of existing UI — scoped for a future implementation pass, not this SPEC.
- [ ] Operator confirms **Movement I / "Pull Across" (§9) inherits the unweakened consent posture** of PRD-MMC-001 §4.1's per-capability grant table (§0.4) — no lighter-touch consent model is introduced under the friendlier verb.
- [ ] Operator confirms **Movement II ("Organize") is bound by the existing Content Capsule Containment golden rule** (§0.2) — a destination is a home for a captured object, never license for derivative capsule output to escape that home.
- [ ] Operator confirms **Workspace-as-membrane narration (§4) uses the existing observer-awareness pattern** ("observed, never asserted," §0.3) rather than a new observation doctrine.
- [ ] On ratification, a separate **authorized implementation pass** is chartered (not this SPEC) for whichever Movement(s) the operator prioritizes next — spine-touching and Observer-adjacent work remains under the same operator-approval regime as PRD-MMC-001 §4.4 and the existing PRD-MMC-IMPL-00x plans.

---

*Authored docs-only, 2026-07-23. Reconciled against `PRD-MMC-001_metame-companion.md` (umbrella), `PRD-THR-001_metame-threshold.md` (sibling surface), `data/codex-configs.ts` (myCluster tab registry), `extension/companion-observer/` (shipped extension source), and the "Content Capsule Containment," "Artifact Production — AR/CPS + Observer Awareness," and "Identity & Access Spine" sections of `CLAUDE.md`. Builds nothing; proposes an interaction model for operator ratification, extending PRD-MMC-001 rather than standing up a second PRD.*
