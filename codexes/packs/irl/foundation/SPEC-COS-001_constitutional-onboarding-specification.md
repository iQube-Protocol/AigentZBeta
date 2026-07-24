# SPEC-COS-001 — Constitutional Onboarding Specification

**metaMe IRL / iQube Protocol / AgentiQ · Platform-architecture specification · Status: DESIGN (docs-only, ratify-before-build)**
**Title:** *The Constitutional Onboarding Specification — the one substrate every arrival crosses, before any specialist journey begins*
**Composes:** **PRD-THR-001** (`metame-threshold.md`) — the concrete implementation of this substrate's top four layers for a *third-party-agent-mediated* arrival; **CFS-043** / **CFS-043a** (agent-guided passport & delegation onboarding — the Principal–Delegate Separation safeguard); **CFS-050** (Sovereignty Navigation — the progressive-agency ladder this spec's "progressive surface activation" section extends into the onboarding context); **SPEC-VLM-001** (Venture Lab & MoneyPenny Reorganisation — Founder Office as the reference-implementation landing surface); **PRD-MMC-001** (metaMe Companion — the Edge Companion's actual shipped capability set); the Identity & Access Spine (`services/identity/getActivePersona.ts`, `utils/personaSpine.tsx`); `services/constitutional/guidedOnboarding.ts` and `services/constitutional/constitutionalAgreement.ts` (the executable primitives every layer below composes, never forks).
**Owner:** operator (intent, substrate shape) + Aigent Z workstream (reconciliation against the shipped platform and against PRD-THR-001).
**Origin:** operator's own canonical substrate diagram (Strand 3 of a 4-strand operator programme, 2026-07-24), reconciled by Claude Code against PRD-THR-001 (already committed to this repo by a concurrent session in the same window) and every other piece of shipped onboarding infrastructure named above.

> **Governance note (binding, this SPEC):** Docs-first, ratify-before-build — the same regime as SPEC-MMC-002 and SPEC-VLM-001. A specification cannot ratify itself; nothing in this document authorises a code change. Every mechanism named below is either (a) an **already-shipped primitive** cited by file path, (b) a **specification already filed and reconciled** (PRD-THR-001, CFS-043/043a, CFS-050, SPEC-VLM-001, PRD-MMC-001), or (c) a **new architectural framing** over those primitives — never a proposal to fork, duplicate, or weaken any of them. This document is the operator's substrate diagram, made precise and reconciled against what already exists — it is not a new build authorisation.

---

## 0. Read this first — what this document is, and is not

This is **not** a new implementation plan. It is the **canonical statement of the platform's onboarding architecture** — the shape every arrival takes, regardless of how they arrive (through a third-party agent, or directly in the browser), and regardless of which specialist journey they eventually pursue. Two things make this document necessary now:

1. **The operator has stated the substrate as a single ordered structure** (§1) and asked that it become the canonical reference — not a proposal to be re-litigated per cartridge, but a structure every future onboarding-adjacent spec should cite rather than re-derive.
2. **A closely related plan already exists and has already evolved past its original shape.** Earlier in this operator programme, a plan titled "metaMe Agent Bridge — Constitutional Ingress for Any Third-Party Agent" was discussed, describing almost exactly the top of this substrate (agent → gateway → passport → delegation). That plan is **not** the document to build from: it has already been **superseded in this repository** by **PRD-THR-001 — metaMe Threshold** (`codexes/packs/irl/foundation/PRD-THR-001_metame-threshold.md`), which states its own supersession explicitly: *"Supersedes: the working title metaMe Agent Bridge / PRD-AGB-001 … 'Agent Bridge / Agent Link / Agent Gateway' are now implementation vocabulary; the product is Threshold."* (PRD-THR-001, header.) PRD-THR-001 is materially more developed than the Agent Bridge plan it replaced — it adds the Sovereignty Ladder, the Constitutional Handshake, the Journey Registry vs. Service Registry split, passport-first authority sequencing, and a Constitutional Welcome — and it is already committed to `dev`-bound history (commits `96f4cfc4`, `f67fcef2`, `62129937`).

**Therefore:** this specification does not re-derive the Agent Bridge content. It cites **PRD-THR-001 as the canonical implementation of this substrate's top layers** for the third-party-agent-mediated arrival path, reconciles the operator's substrate diagram against it (§2), and then does the work PRD-THR-001 does not attempt: naming this as the **one substrate for every arrival** — including a human who never routes through a third-party agent at all (Founder Office direct, Studio direct, a partner-issued invite) — and specifying the sections the operator asked for that sit downstream of Threshold's own scope (Studio's role, progressive surface activation as a general doctrine, the Technical Founder Operator worked example, the Edge Companion's *post*-onboarding role, Experience Qubes as the recommendation mechanism, and how Passport/delegation/standing compose across the whole thing, not just the crossing moment).

---

## 1. The governing principle

> **There is only one onboarding substrate. Specialist journeys diverge only after Agent Me.**

Every arrival — whoever they are, however they arrive — crosses the same seven layers before any domain-specific experience begins:

```
Claude
  ↓
MCP
  ↓
Passport
  ↓
Delegation
  ↓
Agent Me
  ↓
Experience Qubes
  ↓
Journey recommendation
```

Only **after** Journey recommendation does the path branch into specialist journeys — Developer, Research, Creative, Build, Safeguard, Financial Services, and any future domain. This is the load-bearing claim of this specification, stated as a constitutional invariant candidate (§9):

**No specialist journey may define its own Passport, delegation, or identity-establishment step.** A specialist journey may add its own onboarding *texture* (a tailored welcome, a domain-specific first task, a curated set of recommended first actions) — it may never re-implement personhood establishment, delegation authorization, or agent binding. Those seven layers are shared infrastructure, not per-journey scaffolding. This is the same discipline CLAUDE.md's "Core Principle: Extend, Don't Duplicate" and "Source-of-truth parity is canary-enforced" sections already require of the codebase, restated here as an onboarding-architecture principle: a second passport flow, a second delegation gate, or a second identity resolver built inside a specialist journey is exactly the CS-001 duplicate-capability defect class (`codexes/packs/irl/foundation/CS-001_duplicate-capability-as-constitutional-drift.md`), applied to onboarding.

### 1.1 Why "Claude" names the layer, not just an implementation

The operator's diagram names `Claude` at the top. This is deliberately **not** narrowed to "Claude the product" — it names the class of thing: **whatever conversational agent the arriving person already uses and trusts** (Claude, ChatGPT, Claude Code, an enterprise or custom agent). PRD-THR-001 makes the identical point and gives it a name: the **Threshold Companion** — "the user's existing agent … it is not replaced; it guides the user across the Threshold" (PRD-THR-001 §3). This specification adopts that framing rather than re-deriving it: **the top of the substrate is "bring your own agent," and Claude is metaMe's own reference instance of that class, not a hard dependency on Anthropic's product specifically.**

A second, equally real path exists at the top of the substrate: **no third-party agent at all** — a human arriving directly through a browser surface (a partner invite link opened directly, Founder Office reached from a marketing page, Studio reached by an already-onboarded operator). §2.3 reconciles this path explicitly; it is not a gap this spec ignores.

---

## 2. Reconciling three descriptions of the same substrate

Three documents now describe closely related structures. This section produces **one coherent picture**, not three competing ones, per this specification's charter.

### 2.1 The mapping table

| This spec's layer (operator's diagram) | PRD-THR-001's equivalent | What actually implements it (cite, don't re-derive) |
|---|---|---|
| **Claude** | **Threshold Companion** — "the user's existing agent" (§3) | No platform code — this is the external agent itself. metaMe's obligation is the gateway below it. |
| **MCP** | **Threshold Gateway** — "MCP now, A2A later" (§3, §8) | `app/api/mcp/*`, `services/mcp/experienceQubeTools.ts`, `services/smarttriad/primitiveRegistry` (existing tool-dispatch surface PRD-THR-001 §11 says to wrap, not rebuild) |
| **Passport** | **Personhood** — "Polity Passport — continuity without identity exposure" (§4) | `app/api/polity-passport/*`, `app/.well-known/polity-passport/route.ts`, `services/passport/personhoodProof.ts` (graded proof-of-humanity) |
| **Delegation** | The **Constitutional Handshake**'s delegation step, folded into **Constitutional Persona** (§6, §5.1) | `services/constitutional/constitutionalAgreement.ts` (`formAgreement`/`acceptAgreement`/`authorizeAgreement`), `services/constitutional/guidedOnboarding.ts` (the executable CFS-043a script), `POST /api/constitutional/agreement` |
| **Agent Me** | Not a separate rung in PRD-THR-001 — implicit in "Constitutional Persona" operating once bound | **aigentMe** (CLAUDE.md ontology: "the sovereign identity layer and confidentiality guardian") — the Capsule↔Layout system (`app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx`), the four Capsules (Brief me / Move forward / Venture progress / Ask specialists). This is where the now-bound Constitutional Persona actually *operates* day to day. §2.2 below explains why this rung is worth naming explicitly even though PRD-THR-001 doesn't separate it out. |
| **Experience Qubes** | Feeds **Journey selection** (§9.1) via **Experience Guides** | `services/iqube/experienceQube.ts` (`ExperienceQube` — per-persona container: `ExperienceModel`, `ExperienceGoals`, `ExperienceMap`, `ExperienceGuide` settings), `types/experienceGuide.ts` (`PersonalGuideData`) |
| **Journey recommendation** | **Journey Registry** — `list_journeys` / `select_journey`, the five journeys (§9.1) | `services/threshold/journeyRegistry.ts` (pure-data source of truth per PRD-THR-001 §9.1), `services/passport/participationAccess.ts` (`AccessDomain`/`DOMAIN_ROLES`) |

**Read this table as one substrate, not two.** The operator's diagram and PRD-THR-001's architecture are the same seven-to-nine-layer structure described from two angles: the operator's diagram states the *general* substrate every arrival crosses; PRD-THR-001 is the *fully worked implementation* of that substrate's top five layers, specifically for the case where a third-party conversational agent mediates the crossing. Neither is wrong; PRD-THR-001 is more specific and further along, and this spec defers to it entirely for that scope rather than re-specifying it.

### 2.2 Why "Agent Me" deserves its own named rung

PRD-THR-001 folds what this spec calls "Agent Me" into the general notion of the bound "Constitutional Persona … operating." That is accurate but under-specifies something operationally important: **aigentMe is a concrete, already-shipped surface** (CLAUDE.md's "aigentMe Capsule ↔ Layout Contract" section — `activeCapsuleId` + `activeLayoutId` state, four Capsule chips, `CAPSULE_LAYOUT` mapping at `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx`) — not an abstract "the agent now operates" statement. Once Delegation is authorized (the human-only gate, CFS-043 §2), the bound agent's operating home **is** aigentMe: the Brief-me / Move-forward / Venture-progress / Ask-specialists capsules are where the newly-delegated relationship actually transacts day to day, and where Experience Qubes' recommendations (§6) surface as concrete Next-Best-Experience (NBE) suggestions. Naming this rung explicitly matters because it is the rung at which **Content Capsule Containment** (CLAUDE.md's "Content Capsule Containment — GOLDEN RULE") and the **Capsule↔Layout Contract** apply — two already-paramount rules that any future onboarding work must not violate by, for example, routing a freshly-delegated agent's first actions to a page-level surface instead of into the engaged Capsule.

### 2.3 The path PRD-THR-001 does not cover: direct human arrival

PRD-THR-001 is explicit about its own scope: it is the crossing for someone who **already has** a conversational agent and gives it a Threshold Link. This specification's substrate must also cover the person who arrives **without** one — directly at Founder Office, directly at a partner-issued invite page (`app/invite/[code]/page.tsx`), directly at the Polity Passport Bureau cartridge. For that path, the seven-layer substrate still holds, with layer 1 simply absent rather than replaced:

```
(no third-party agent)
  ↓
MCP / in-app copilot surface  →  the SAME SmartTriad copilot the bound agent would otherwise drive (CLAUDE.md "metaMe Client Protocol Primitive"), now first-personed by the platform itself rather than an external agent
  ↓
Passport  →  identical: app/api/polity-passport/*, same graded proof-of-humanity
  ↓
Delegation  →  often skipped or minimal for a direct human (no external agent needs bounded authority yet) — CFS-043's Principal–Delegate Separation still governs the moment it IS needed (e.g. the human later connects an agent)
  ↓
Agent Me  →  identical: aigentMe is the operating home regardless of arrival path
  ↓
Experience Qubes  →  identical
  ↓
Journey recommendation  →  identical
```

**The invariant holds either way:** whether the top layer is an external Threshold Companion or the platform's own in-app copilot, everything from Passport onward is the *same* infrastructure, the *same* gates, the *same* Journey Registry. This is precisely what "one onboarding substrate" means — the substrate does not fork based on arrival channel, only its topmost rung does.

---

## 3. Studio as an advanced OPERATING environment — a distinction, not a demotion

**Studio is never an onboarding surface. This is architectural, not a matter of emphasis.**

The canonical Studio/Runtime distinction is already specified: *"Studio: Authoring environment. Creates StudioArtifacts. Drafts and reviews. Working state. Private (platform layer). Runtime: Delivery environment. Renders StudioArtifacts. Published and live. Canonical state. Public (cartridge layer)"* (`codexes/packs/agentiq-os/items/reference-studio.md`). `ComposerStudio.tsx` (`components/composer/ComposerStudio.tsx`) is the shipped instance: device-preview switching, liquid-template composition, DesignQube theming, DCIR observation — a full authoring environment producing `StudioArtifact` objects that move through `Working → Review → Published → Canonical → Archival` (`types/studioArtifact.ts`).

**Why this matters for onboarding architecture specifically:** Studio presupposes a fully-formed Constitutional Persona with standing and authored intent — it is where someone who has *already* crossed the substrate goes to **build** (a cartridge, an ExperienceQube, a skill, a piece of content). It is not, and must never become, a place where the substrate's own seven layers are re-implemented or bypassed. A newcomer does not "onboard into Studio" — they cross the substrate (§1), reach a Journey recommendation, and *if* that journey's climb eventually reaches Studio-level authoring authority (the Technical journey, per PRD-THR-001 §9.1's Journey table: `Technical | Build agents & constitutional software | Developer → DevOn → AgentiQ Builder → Studio → Founder Office`), Studio appears as a **destination several rungs up the ladder**, never as the entry point.

**The distinction, stated precisely:** "advanced operating environment, not onboarding surface" means Studio's authority-to-author is *itself* a rung gated by standing and delegation accrued through the substrate — not that Studio is somehow lesser. It is exactly the opposite: Studio is *more* privileged than onboarding, which is precisely why it cannot be where onboarding happens. Conflating the two would mean a not-yet-delegated arrival gaining write/publish authority before Delegation (§1) has even been granted — a direct violation of CFS-043 §2's Principal–Delegate Separation, applied one layer downstream from where CFS-043 states it.

---

## 4. Progressive surface activation

**Precedent, not re-derivation:** CFS-050 (Sovereignty Navigation) already ratifies the governing principle this section applies to onboarding specifically: *"Navigation should progressively increase agency… by making the next rung visible and reachable from wherever the person currently stands"* (CFS-050 §3, Principle 002 — Progressive agency) and *"Navigation should reveal capability only when it becomes relevant to the person's current intention"* (CFS-050 §4, Principle 003). PRD-THR-001 independently arrives at the identical shape for the crossing itself: *"progressive activation instead of a conventional onboarding wall"* (§0) and the passport-first authority refinement (§9.3) — a base crossing grants **navigation authority only** (`passport.status.read`, `journeys.list`, `journey.select`, …), never service-operating authority, with service capabilities added **only** by a service-initiated crossing, enforced server-side by `grantableCapabilities()`.

**This specification's contribution is naming the general doctrine those two documents each apply locally:**

> **Progressive surface activation:** at every layer of the onboarding substrate (§1), the arriving person is granted the *minimum* surface needed to take their next action — never the union of everything the platform could eventually show them. Each layer's crossing *reveals* the next layer's surface; it does not pre-activate downstream surfaces "just in case."

Concretely, mapped onto the seven layers:

| Layer | What is activated at this layer | What is explicitly NOT yet activated |
|---|---|---|
| Claude / MCP | Read-only resource discovery (`metame://institution/charter`, `metame://onboarding/current`) | Any mutating tool call |
| Passport | Personhood established, graded to weak (captcha) by default | Delegation, service capabilities |
| Delegation | Constitutional-root **navigation** authority only (PRD-THR-001 §9.3) | Any specialist-journey service authority |
| Agent Me | The four aigentMe Capsules become reachable | Studio authoring authority, Founder Office operating authority |
| Experience Qubes | Recommendation surfaces populate (based on observed/declared goals) | Nothing is force-recommended; CLAUDE.md's "observed, never asserted" AR/CPS discipline governs what Experience Qubes may assert (§6) |
| Journey recommendation | The five journeys become selectable | Only the *selected* journey's next rung activates — not all five simultaneously |
| (post-substrate) Specialist journey | The chosen journey's Experience Guide surfaces its own ladder, one rung at a time | The other four journeys' surfaces stay dormant until separately selected |

This is the same server-side enforcement pattern already required elsewhere in this codebase — access gates resolved server-side, never client-optimistic-only (CLAUDE.md "Security — Access Gates", "Identity & Access Spine"); progressive surface activation is that same discipline applied to *what becomes visible*, not only *what is authorized*.

---

## 5. Technical Founder Operator as the reference implementation

This section names, but does not build, the umbrella this worked example belongs to: the **Technical Founder Operator Activation Programme** — the operator's programme for onboarding technically-minded founders into full Founder Office operating authority, of which this section is the onboarding-substrate walkthrough. (A sibling strand of this same operator programme covers the programme's other facets; this spec's role is limited to walking the substrate for this one persona.)

### 5.1 Why this persona is the reference example

The Technical Founder Operator is the persona whose full climb touches **every layer of the substrate and every downstream section of this spec**: they plausibly arrive via a third-party agent (Claude Code itself, in the limiting case), they need Passport + Delegation before their agent can act, they operate day-to-day through aigentMe, their Experience Qube recommends a Technical-journey path, and their journey's apex is the **real, shipped Founder Office** — not a hypothetical. Grounding the walkthrough in this persona means every claim below is checkable against a real file, not an imagined surface.

### 5.2 The walkthrough

1. **Claude → MCP.** The Technical Founder Operator is, plausibly, already a Claude Code user. PRD-THR-001 §14's worked example ("Austin receives one Threshold Link, opens it, gives it to Claude") is this same crossing pattern, and PRD-THR-001 §8's tool catalogue (`inspect_threshold_link`, `begin_handshake`, `create_or_link_agent_card`, …) is the concrete MCP surface this operator's agent speaks.
2. **Passport.** `app/api/polity-passport/*` — the same Passport surface every arrival uses; no technical-journey-specific passport flow exists or should exist (§1's invariant).
3. **Delegation.** The bounded `DelegatedAuthority` this operator's agent requests is scoped to development-adjacent capabilities (e.g. `irl:experiment-result:submit`-shaped refs, or a future `devon:*` capability ref) — drafted by the agent (`recommendDelegatedAuthority`, `guidedOnboarding.ts`), **authorized only by the human** (CFS-043 §2). No different gate; a different `capabilityRef` payload through the identical `POST /api/constitutional/agreement` primitive.
4. **Agent Me.** Once authorized, the operator's day-to-day surface is aigentMe — most relevantly the **Venture progress** Capsule (`activeCapsuleId: 'venture-progress'`, `VentureCockpitLayout.tsx`), since a Technical Founder Operator is, by definition, running a venture.
5. **Experience Qubes.** Their `ExperienceQube` (`services/iqube/experienceQube.ts`) carries `activeCartridgeSlug` and an `OperatorArchetype` of `'technical'` (already a modeled value in `experienceQube.ts`'s `OperatorArchetype` union) — this is the literal, already-shipped field that biases their recommendations technical-ward, not a new field this spec proposes.
6. **Journey recommendation.** The Journey Registry's **Technical** row: *"Developer → DevOn → AgentiQ Builder → Studio → Founder Office"* (PRD-THR-001 §9.1) — the only journey row whose apex passes through Studio en route to Founder Office, consistent with §3's rule that Studio is a downstream-of-onboarding destination, never an entry point.
7. **Specialist journey (post-substrate).** The operator lands, per SPEC-VLM-001 §4.1, in Venture Lab's **Operate** domain: *"Founder Office remains the default landing page"* — the real `FounderOfficeTab.tsx` (`app/triad/components/codex/tabs/FounderOfficeTab.tsx`), whose own header names it precisely: *"the venture-formation operating system: turn an idea/opportunity into an executable Venture Blueprint (VentureQube v1.0) and hand it to the execution agents,"* with sub-views `Workspace · Discover · Validate · Architect · Blueprint`. This is CFS-050's illustrative ladder's own apex made concrete: *"Citizen → Participate → Passport → Delegate → Operate → Steward → Founder Office → Portfolio Operator"* (CFS-050 §3) — the Technical Founder Operator's journey is one continuous climb from the top of this spec's substrate straight through to that ladder's stated end-state.

**What this walkthrough demonstrates, and what it does not:** it demonstrates that the seven-layer substrate composes cleanly into one real, already-shipped persona's full journey without inventing a single new gate, table, or resolver. It does **not** authorize building any of the not-yet-existing pieces implied above (a `devon:*` capability ref, for instance) — those remain separately gated, exactly as CFS-043 §7 and PRD-THR-001 §13 already treat their own build items.

---

## 6. Experience Qubes as recommendation engines

**Grounding, not invention.** `services/iqube/experienceQube.ts` already models exactly this: a per-persona governed container (`ExperienceQube`) carrying `ExperienceModel`, `ExperienceGoals`, `ExperienceMap`, and `ExperienceGuide` settings, split into a T1 `meta` slice (public-safe — surfaces in bootstrap responses and cross-cartridge signals) and a T0 `blak` slice (private — strategy/IP/partner data, readable only by this service, redacted via `evaluateAccess()`). `types/experienceGuide.ts`'s `PersonalGuideData` (with `deriveOverallAlignment` / `backfillSphereAlignment`) is the guide logic that turns that stored state into a recommendation. PRD-THR-001 independently names the same mechanism from the journey side: *"Experience Guides are first-class. Each journey simply activates a different guide (`citizen-experience-guide`, `entrepreneur-experience-guide`, …). The guide already owns recommended services, progression, onboarding, achievements, delegation opportunities, and standing milestones"* (PRD-THR-001 §9.1).

**This spec's framing:** Experience Qubes are the substrate's **recommendation layer**, sitting between "who is this person" (Passport/Delegation/Agent Me) and "what should they do next" (Journey recommendation). Concretely:

- **Input:** the ExperienceQube's `meta` slice (`ExperienceType`, `ExperienceStage`, `OperatorArchetype`, `ActiveCartridgeSlug`) plus whatever the Agent-Me layer has observed (per CLAUDE.md's Artifact Production — AR/CPS + Observer Awareness doctrine: *"observed, never asserted"*).
- **Process:** the relevant `ExperienceGuide` (one per journey, per PRD-THR-001 §9.1) reads that state and derives an alignment/recommendation via `deriveOverallAlignment`.
- **Output:** a Journey recommendation (§1's final layer) and, once inside a journey, that journey's own Next-Best-Experience suggestions surfaced through the aigentMe Capsules (§2.2), never as an orphan recommendation outside the engaged Capsule (CLAUDE.md's Content Capsule Containment rule applies here too).

**What Experience Qubes must never become** (the same "observed, never asserted" discipline stated affirmatively): a recommendation engine that *asserts* a persona's readiness for a rung they have not actually reached (e.g. recommending Studio-level activity to someone who has not yet crossed Delegation) would violate both §3's Studio boundary and §4's progressive-activation doctrine. The recommendation surface is downstream of, and constrained by, everything above it in the substrate — it does not have independent authority to fast-track a persona past a gate.

---

## 7. Edge Companion as persistent continuity

**The Edge Companion's role in this specification is explicitly post-onboarding**, not merely "also present during onboarding." This distinction matters because the shipped Companion extension (`extension/companion-observer/`) is real and already scoped by PRD-MMC-001, and this spec must describe its **actual current capability**, not an aspirational one.

### 7.1 What is actually shipped

`extension/companion-observer/manifest.json` — a Manifest V3 Chrome extension, permissions `["storage", "activeTab", "scripting", "sidePanel", "contextMenus"]`, host permission scoped to `https://dev-beta.aigentz.me/*`, a side panel (`sidepanel.html`/`sidepanel.js`), a background service worker (`background.js`), and a content script (`content.js`, `constants.js`) injected at `document_idle` on all pages. The manifest's own description states its scope precisely: *"consent-gated browser context Observer + Capture ('Pull Across') for the metaMe Companion. Reads and captures only what a persona has explicitly granted … and hands it to the Companion API — never a raw page dump."*

PRD-MMC-001's own component table (§3, per its 15-component breakdown) is the authoritative description of what this actually does, phased:

- **Observer** (component 3) — consent-gated browser-context reading, extending the existing "observed, never asserted" pattern (`/api/research/overview` + `IRLResearchCopilotTab.tsx`) to a browser source. Per-capability grants (identity-only / current-tab / selection / downloads / clipboard / notifications / optional history), each explicit and revocable — never blanket install permissions.
- **Search** (component 8, "Universal Search") — a federated cross-surface search façade (Passport / Founder Office / Registry / IRL / Workspace / …), composing existing per-surface reads.
- **Capture** (component 9, "Universal Capture") — page / selection / screenshot / PDF / conversation / email / issue → routed through the **existing** Qube creators (`services/iqube/experienceQube.ts`, `services/iqube/intentQube.ts`, ResearchQube), never a parallel creator.
- **Overlay** (component 10, "Constitutional Overlay") — apps become constitutional overlays (a GitHub repo showing Standing/capabilities/contributors inline; a banking app showing Wallet/Passport/Risk/Delegations inline), composing existing registry/standing/capability-graph reads, never re-deriving them.

PRD-MMC-001 §6's phasing is explicit that **Phase 1 ships Universal SmartTriad + Deep Links + Capture without browser observation** (explicit user-initiated capture only — paste/upload/"capture this selection" — no passive observation), and that **Phase 2 (the Observer + Context Engine, consent-gated) is the highest-risk phase**, gated on §4's guardrails being ratified before it starts. Both phases are ratified per PRD-MMC-001's ratification record; the **implementation pass** is separately chartered (`2026-07-23_prd-mmc-impl-001-companion-phase2-implementation-plan.md`), not this specification, and not authorized by this document.

### 7.2 Why this belongs in the onboarding substrate at all

The Edge Companion does **not** replace any layer of §1's substrate — it is not a second Passport surface, not a second Delegation gate, not a second Agent Me. Its role is what the operator's framing names precisely: **persistent continuity**. Once a person has crossed the substrate once (Passport issued, Delegation authorized, aigentMe engaged, a Journey selected), the Edge Companion is the surface that lets that *same* constitutional relationship — the same Constitutional Persona, the same Standing, the same locker — travel with them across the browser, rather than requiring re-entry through the full substrate on every subsequent visit. This is the identical principle PRD-THR-001 states for the third-party agent case (*"the constitutional relationship belongs to the person and survives the provider"*, §16) applied to the browser-as-surface case instead of the agent-as-surface case: **the crossing happens once; continuity is what makes it durable.**

Concretely, "Edge Companion as persistent continuity" means:

- It never re-runs Passport application or Delegation authorization for an already-crossed persona — it reads their existing Constitutional Persona state (T1-safe fields only, per CLAUDE.md's Identity & Access Spine exposure tiers).
- Its Observer/Search/Capture/Overlay capabilities (§7.1) are **downstream conveniences layered on top of** an already-established identity — never an alternate identity-establishment path.
- Its per-capability consent model (§4.1 of PRD-MMC-001) is itself an instance of this spec's Progressive Surface Activation doctrine (§4): each Observer capability is granted individually and revocably, never as a blanket install-time permission.

---

## 8. Passport, delegation, and standing integration

This section states, in one place, how the three constitutional primitives that recur through every layer of §1 actually compose — because they are not three independent mechanisms bolted together, they are one lifecycle with three named checkpoints.

### 8.1 Passport establishes continuity, not authority

Per CFS-043 §2 and PRD-THR-001 §5.1: *"personhood establishes continuity; delegation establishes agent authority."* A Passport (weak captcha → `anonymous_citizen`, or strong World ID → `verified_citizen`, `services/passport/personhoodProof.ts`) proves **one human, continuously**, across sessions and across whichever agent they bring. It grants **zero** operating authority on its own — PRD-THR-001 §9.3's passport-first refinement makes this explicit and server-enforced: a base crossing grants Passport + constitutional-root **navigation** authority only, never service-operating authority.

### 8.2 Delegation is the human-only gate, always

Every delegation — regardless of which layer of §1 it sits at, regardless of which specialist journey eventually consumes it — goes through the identical primitive: `formAgreement` (agent may draft) → `acceptAgreement` (agent accepts its own side) → `authorizeAgreement` (**human only**, owner-commitment-matched, graded proof-of-humanity per contract risk). This is CFS-043 §2's Principal–Delegate Separation, and it is **not re-derived per journey** — the Technical Founder Operator's delegation (§5.2 step 3) and Austin's IRL delegation (CFS-042/043a) go through the exact same `POST /api/constitutional/agreement` route with different `capabilityRef`/`delegatedAuthority` payloads. §1's invariant ("no specialist journey may define its own delegation gate") is this fact, stated as doctrine.

### 8.3 Standing accrues to the delegation, not the arrival

PRD-THR-001's Sovereignty Ladder places **Standing** *after* Journey/Service Participation and *before* further, broader Delegation (§4): the bound agent's *acts*, once authorized, accrue polity-bound Standing — but, per §5.1's core law, the agent *"cannot become an independent delegating principal"* no matter how much Standing it accrues. Standing is read, not re-implemented, by every downstream surface (`FounderOfficeTab.tsx`'s `StandingSummary` interface — `personal`/`delegated`/`stewardship`/`overall`/`bucket` — is the shipped read model). This specification does not introduce a new Standing computation; it names where Standing sits in the substrate's overall lifecycle: the *consequence* of operating under a granted delegation, never a precondition manufactured separately per journey.

### 8.4 The one picture

```
Passport  →  proves the person, continuously, no matter which agent/browser they bring
    +
Delegation → the ONLY gate that grants operating authority, human-authorized every time, whatever the capabilityRef
    +
Standing  →  accrues FROM authorized operation; read everywhere, computed once
    =
the Constitutional Persona (PRD-THR-001 §5.1) that Agent Me operates, Experience Qubes recommend for,
and every specialist journey (Developer/Research/Creative/Build/Safeguard/Financial Services/…) consumes —
never re-implements.
```

---

## 9. Candidate invariant

**One Onboarding Substrate** — *Every arrival, regardless of channel (third-party agent or direct), crosses the identical seven-layer substrate (Claude → MCP → Passport → Delegation → Agent Me → Experience Qubes → Journey recommendation) before any specialist journey begins. A specialist journey may add onboarding texture; it may never re-implement personhood establishment, delegation authorization, or agent binding.* Proposed for ratification alongside this specification (the `constitutional` namespace), composing — not superseding — the Principal–Delegate Separation and Graded Proof-of-Humanity invariants already proposed in CFS-043 §6, and Sovereignty Navigation already ratified in CFS-050.

---

## 10. Reuse map (do NOT rebuild any of this)

| Substrate concern | Already-shipped primitive / already-filed spec |
|---|---|
| Third-party-agent crossing (Claude→MCP→Passport→Delegation), fully worked | **PRD-THR-001** — canonical; this spec defers to it entirely for this scope |
| Executable guided-onboarding plan | `services/constitutional/guidedOnboarding.ts`, `POST /api/constitutional/guided-onboarding` |
| Durable delegation + human-only authorize gate | `services/constitutional/constitutionalAgreement.ts`, `POST /api/constitutional/agreement` |
| Graded proof-of-humanity | `services/passport/personhoodProof.ts`, `guidedOnboarding.ts:requiredProofGrade` |
| Passport machine API + discovery | `app/api/polity-passport/*`, `app/.well-known/polity-passport/route.ts` |
| Agent Me operating surface | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx`, the four Capsule layouts (CLAUDE.md "aigentMe Capsule ↔ Layout Contract") |
| Experience Qube / recommendation state | `services/iqube/experienceQube.ts`, `types/experienceGuide.ts` |
| Journey Registry / Service Registry | `services/threshold/journeyRegistry.ts` (per PRD-THR-001 §9.1), `services/passport/participationAccess.ts` |
| Progressive-agency navigation doctrine | **CFS-050** — cited, not re-derived |
| Founder Office reference implementation | `app/triad/components/codex/tabs/FounderOfficeTab.tsx`, **SPEC-VLM-001** §4.1 (Operate domain) |
| Studio / Runtime distinction | `codexes/packs/agentiq-os/items/reference-studio.md`, `components/composer/ComposerStudio.tsx`, `types/studioArtifact.ts` |
| Edge Companion — actual shipped capability | `extension/companion-observer/{manifest.json,background.js,content.js,sidepanel.js}`, **PRD-MMC-001** |
| Identity spine | `services/identity/getActivePersona.ts`, `utils/personaSpine.tsx` |

**Genuinely new in this specification (the honest short list):** (1) the explicit naming of "Agent Me" as its own rung distinct from PRD-THR-001's implicit "Constitutional Persona operating" (§2.2); (2) the explicit reconciliation of the direct-human-arrival path against PRD-THR-001's third-party-agent-only scope (§2.3); (3) the general doctrine of "progressive surface activation," naming what CFS-050 and PRD-THR-001 each independently apply locally (§4); (4) the Studio-as-downstream-destination architectural rule, stated as a boundary rather than left implicit (§3); (5) the Technical Founder Operator worked walkthrough tying every layer to a real file (§5); (6) the one-picture composition of Passport/Delegation/Standing across the whole substrate rather than per-checkpoint (§8). Everything else is a citation of already-shipped or already-filed material.

---

## 11. Out of scope

- No code changes. No new API routes, tables, or resolvers.
- No re-specification of PRD-THR-001's Handshake mechanics, MCP tool catalogue, or Threshold Link schema — cite that document.
- No re-specification of CFS-043/CFS-043a's Principal–Delegate Separation mechanics — cite those documents.
- No re-specification of CFS-050's four navigation principles — cite that document.
- No new Studio, Founder Office, or Experience Qube data model. Every field or interface named above already exists in the cited file.
- The "Technical Founder Operator Activation Programme" is named (§5) but not designed here — that is a separate, already-in-progress strand of this operator programme.

---

## Ratification record

- [ ] PROPOSED 2026-07-24 — operator's canonical substrate diagram (§1), reconciled against PRD-THR-001, CFS-043/043a, CFS-050, SPEC-VLM-001, and PRD-MMC-001.
- [ ] Operator ratifies the **One Onboarding Substrate** invariant (§9).
- [ ] Operator confirms the reconciliation table (§2.1) and the direct-arrival path (§2.3) as the intended single picture.
- [ ] Operator confirms Studio's downstream-destination boundary (§3) as binding architecture, not merely descriptive.
- [ ] No build authorized by this document; any implementation proceeds only under a separately chartered, ratified pass, per the same discipline PRD-THR-001 §13 and CFS-043 §7 already apply to their own build items.
